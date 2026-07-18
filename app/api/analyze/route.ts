import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts'
import type { Suggestion } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { resume_text, jd_text } = await request.json()

  if (!resume_text || !jd_text) {
    return new Response(JSON.stringify({ error: '简历和 JD 均为必填项' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = await createClient()

  // 创建 pending case
  const { data: caseRow, error: insertError } = await supabase
    .from('cases')
    .insert({ resume_text, jd_text, status: 'pending' })
    .select('id')
    .single()

  if (insertError || !caseRow) {
    return new Response(JSON.stringify({ error: '创建案例失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const caseId = caseRow.id
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const suggestions: Suggestion[] = []
      let buffer = ''

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(resume_text, jd_text) }],
          stream: true,
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            buffer += event.delta.text

            // 尝试从 buffer 中逐条解析完整 JSON 对象
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
                  controller.enqueue(
                    encoder.encode(JSON.stringify(obj) + '\n')
                  )
                }
              } catch {}

              buffer = buffer.slice(endIdx + 1)
              startIdx = buffer.indexOf('{')
            }
          }
        }

        // 更新 case 为 done
        await supabase
          .from('cases')
          .update({ result_json: suggestions, status: 'done' })
          .eq('id', caseId)

        controller.enqueue(
          encoder.encode(JSON.stringify({ case_id: caseId }) + '\n')
        )
      } catch (err) {
        await supabase
          .from('cases')
          .update({ status: 'error' })
          .eq('id', caseId)
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: 'AI 分析失败，请重试' }) + '\n')
        )
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
