import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { checkAndRecordUsage } from '@/lib/usage'
import { STRENGTHS_CHAT_SYSTEM, buildStrengthsChatPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    session_id?: string | null
    messages?: { role: string; content: string }[]
    jd_text?: string | null
    turn_index?: number
  } = {}
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null, turn_index = 0 } = body
  const safeTurnIndex = Math.max(0, Math.min(2, turn_index ?? 0))
  const safeMessages = messages.slice(-6)

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const { chat, config } = await getAIClientForRequest()

  const usage = await checkAndRecordUsage('strengths_message')
  if (!usage.allowed) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ error: '今日免费额度已用完（每天 10 次），请前往「AI 设置」配置自己的 API Key 可无限使用', code: 'LIMIT_EXCEEDED' }) + '\n'))
        controller.close()
      }
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let aiText = ''
      let currentSessionId = session_id ?? null

      try {
        const chatMessages = [
          { role: 'system' as const, content: STRENGTHS_CHAT_SYSTEM },
          ...safeMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: buildStrengthsChatPrompt(safeMessages, jd_text, safeTurnIndex) },
        ]

        for await (const chunk of chat.stream(chatMessages, config.modelSmart, 512)) {
          aiText += chunk.text
          controller.enqueue(encoder.encode(JSON.stringify({ text: chunk.text }) + '\n'))
        }

        if (user) {
          const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
          const updatedMessages = [...safeMessages, { role: 'assistant', content: aiText }]
          if (!currentSessionId) {
            const { data: newSession } = await supabase.from('strength_sessions')
              .insert({ user_id: user.id, jd_text, messages: updatedMessages }).select('id').single()
            if (newSession) currentSessionId = newSession.id
          } else {
            await supabase.from('strength_sessions').update({ messages: updatedMessages })
              .eq('id', currentSessionId).eq('user_id', user.id)
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}
