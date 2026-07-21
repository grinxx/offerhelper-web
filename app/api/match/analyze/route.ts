import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import {
  MATCH_EVAL_SYSTEM,
  buildMatchEvalPrompt,
  MATCH_SUMMARY_SYSTEM,
  buildMatchSummaryPrompt,
} from '@/lib/prompts'
import type { MatchResult, JdItem } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_list?: JdItem[]; session_id?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { resume_text, jd_list = [], session_id = null } = body

  if (!resume_text?.trim()) {
    return new Response(JSON.stringify({ error: '简历内容不能为空' }), { status: 400 })
  }
  if (jd_list.length === 0 || jd_list.length > 5) {
    return new Response(JSON.stringify({ error: 'JD 数量需在 1-5 条之间' }), { status: 400 })
  }

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const { client, config } = await getAIClientForRequest()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let currentSessionId = session_id
      const results: MatchResult[] = []

      try {
        const supabase = user
          ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
          : null

        if (supabase && !currentSessionId) {
          const { data: newSession } = await supabase
            .from('match_sessions')
            .insert({ user_id: user!.id, resume_text, jd_list })
            .select('id')
            .single()
          if (newSession) currentSessionId = newSession.id
        }

        for (let i = 0; i < jd_list.length; i++) {
          const jd = jd_list[i]
          try {
            let buf = ''
            const resp = await client.chat.completions.create({
              model: config.modelSmart,
              max_tokens: 1024,
              messages: [
                { role: 'system', content: MATCH_EVAL_SYSTEM },
                { role: 'user', content: buildMatchEvalPrompt(resume_text, jd.content, jd.title ?? null) },
              ],
              stream: true,
            })
            for await (const chunk of resp) buf += chunk.choices[0]?.delta?.content ?? ''
            const cleaned = buf.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
            const parsed = JSON.parse(cleaned) as Omit<MatchResult, 'jd_index'>
            const result: MatchResult = { jd_index: i, ...parsed }
            results.push(result)
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'result', ...result }) + '\n'))
          } catch {
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'error', jd_index: i, message: '该岗位评估失败，请重试' }) + '\n'
            ))
          }
        }

        let summary = ''
        if (results.length > 0) {
          try {
            const summaryMsg = await client.chat.completions.create({
              model: config.modelFast,
              max_tokens: 512,
              messages: [
                { role: 'system', content: MATCH_SUMMARY_SYSTEM },
                { role: 'user', content: buildMatchSummaryPrompt(results, jd_list) },
              ],
            })
            summary = summaryMsg.choices[0]?.message?.content ?? ''
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', text: summary }) + '\n'))
          } catch {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', text: '' }) + '\n'))
          }
        }

        if (supabase && currentSessionId) {
          await supabase
            .from('match_sessions')
            .update({ results, summary, status: 'done' })
            .eq('id', currentSessionId)
            .eq('user_id', user!.id)
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', session_id: currentSessionId }) + '\n'))
      } catch {
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'error', jd_index: -1, message: '分析失败，请重试' }) + '\n'
        ))
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
