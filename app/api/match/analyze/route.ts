import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { checkAndRecordUsage } from '@/lib/usage'
import { MATCH_EVAL_SYSTEM, buildMatchEvalPrompt, MATCH_SUMMARY_SYSTEM, buildMatchSummaryPrompt } from '@/lib/prompts'
import type { MatchResult, JdItem } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60  // Vercel 最长 60s，避免串行调用被截断

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_list?: JdItem[]; session_id?: string | null } = {}
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { resume_text: rawResume, jd_list: rawJdList = [], session_id = null } = body
  const resume_text = rawResume?.slice(0, 8000)
  const jd_list = (rawJdList as Array<{title?: string; content: string}>).map(j => ({
    title: j.title?.slice(0, 100),
    content: j.content?.slice(0, 4000),
  }))
  if (!resume_text?.trim()) return new Response(JSON.stringify({ error: '简历内容不能为空' }), { status: 400 })
  if (jd_list.length === 0 || jd_list.length > 5) return new Response(JSON.stringify({ error: 'JD 数量需在 1-5 条之间' }), { status: 400 })

  const usage = await checkAndRecordUsage('match_analyze')
  if (!usage.allowed) {
    return new Response(JSON.stringify({ error: `${usage.limitMessage}`, code: 'LIMIT_EXCEEDED' }), { status: 429 })
  }

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  const { chat, config } = await getAIClientForRequest(usage.userId)

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
          const { data: newSession } = await supabase.from('match_sessions')
            .insert({ user_id: user!.id, resume_text, jd_list }).select('id').single()
          if (newSession) currentSessionId = newSession.id
        }

        // 并发评估所有 JD，index 直接在 map 回调中捕获
        const evalResults = await Promise.allSettled(
          jd_list.map(async (jd, i) => {
            let buf = ''
            for await (const chunk of chat.stream(
              [
                { role: 'system', content: MATCH_EVAL_SYSTEM },
                { role: 'user', content: buildMatchEvalPrompt(resume_text, jd.content, jd.title ?? null) },
              ],
              config.modelSmart, 1024
            )) buf += chunk.text
            const cleaned = buf.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
            const parsed = JSON.parse(cleaned) as Omit<MatchResult, 'jd_index'>
            return { jd_index: i, ...parsed } as MatchResult
          })
        )

        evalResults.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            results.push(res.value)
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'result', ...res.value }) + '\n'))
          } else {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', jd_index: i, message: '该岗位评估失败，请重试' }) + '\n'))
          }
        })

        let summary = ''
        if (results.length > 0) {
          try {
            summary = await chat.complete(
              [
                { role: 'system', content: MATCH_SUMMARY_SYSTEM },
                { role: 'user', content: buildMatchSummaryPrompt(results, jd_list) },
              ],
              config.modelFast, 512
            )
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', text: summary }) + '\n'))
          } catch {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', text: '' }) + '\n'))
          }
        }

        if (supabase && currentSessionId) {
          await supabase.from('match_sessions').update({ results, summary, status: 'done' })
            .eq('id', currentSessionId).eq('user_id', user!.id)
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', session_id: currentSessionId }) + '\n'))
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', jd_index: -1, message: '分析失败，请重试' }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}
