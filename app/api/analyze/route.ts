import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts'
import type { Suggestion } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_text?: string; strengths_context?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  const { resume_text, jd_text, strengths_context } = body

  if (!resume_text || !jd_text) {
    return new Response(JSON.stringify({ error: '简历和 JD 均为必填项' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const sessionSupabase = await createSessionClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const insertData: Record<string, unknown> = { resume_text, jd_text, status: 'pending' }
  if (user) insertData.user_id = user.id

  const { data: caseRow, error: insertError } = await supabase
    .from('cases')
    .insert(insertData)
    .select('id')
    .single()

  if (insertError || !caseRow) {
    return new Response(JSON.stringify({ error: '创建案例失败', detail: insertError?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const caseId = caseRow.id
  const { client, config } = await getAIClientForRequest()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const suggestions: Suggestion[] = []
      let buffer = ''

      try {
        const response = await client.chat.completions.create({
          model: config.modelSmart,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(resume_text, jd_text, strengths_context) },
          ],
          stream: true,
        })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (!text) continue
          buffer += text

          let startIdx = buffer.indexOf('{')
          while (startIdx !== -1) {
            let depth = 0
            let endIdx = -1
            for (let i = startIdx; i < buffer.length; i++) {
              if (buffer[i] === '{') depth++
              if (buffer[i] === '}') {
                depth--
                if (depth === 0) { endIdx = i; break }
              }
            }
            if (endIdx === -1) break

            try {
              const obj = JSON.parse(buffer.slice(startIdx, endIdx + 1)) as Suggestion
              if (obj.original && obj.suggestion) {
                suggestions.push(obj)
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
              }
            } catch {}

            buffer = buffer.slice(endIdx + 1)
            startIdx = buffer.indexOf('{')
          }
        }

        await supabase
          .from('cases')
          .update({ result_json: suggestions, status: 'done' })
          .eq('id', caseId)

        controller.enqueue(encoder.encode(JSON.stringify({ case_id: caseId }) + '\n'))
      } catch {
        await supabase.from('cases').update({ status: 'error' }).eq('id', caseId)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 分析失败，请重试' }) + '\n'))
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
