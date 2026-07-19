import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { STRENGTHS_CHAT_SYSTEM, buildStrengthsChatPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    session_id?: string | null
    messages?: { role: string; content: string }[]
    jd_text?: string | null
    turn_index?: number
  } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null, turn_index = 0 } = body

  // Clamp turn_index to valid range
  const safeTurnIndex = Math.max(0, Math.min(2, turn_index ?? 0))

  // Bound messages to prevent unbounded token usage (3 turns × 2 messages each = max 6)
  const safeMessages = messages.slice(-6)

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let aiText = ''
      let currentSessionId = session_id ?? null

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: STRENGTHS_CHAT_SYSTEM,
          messages: [
            ...safeMessages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            {
              role: 'user',
              content: buildStrengthsChatPrompt(safeMessages, jd_text, safeTurnIndex),
            },
          ],
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            aiText += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Persist to DB if logged in
        if (user) {
          const supabase = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const updatedMessages = [
            ...safeMessages,
            { role: 'assistant', content: aiText },
          ]
          if (!currentSessionId) {
            const { data: newSession } = await supabase
              .from('strength_sessions')
              .insert({ user_id: user.id, jd_text, messages: updatedMessages })
              .select('id')
              .single()
            if (newSession) currentSessionId = newSession.id
          } else {
            await supabase
              .from('strength_sessions')
              .update({ messages: updatedMessages })
              .eq('id', currentSessionId)
              .eq('user_id', user.id)
          }
        }

        const isFinal = safeTurnIndex === 2
        controller.enqueue(encoder.encode(
          JSON.stringify({ session_id: currentSessionId, turn_index: safeTurnIndex, is_final: isFinal }) + '\n'
        ))
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: '生成问题失败，请重试' }) + '\n'))
        controller.enqueue(encoder.encode(JSON.stringify({ session_id: currentSessionId, turn_index: safeTurnIndex, is_final: false }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
