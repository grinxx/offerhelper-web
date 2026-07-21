import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { INTERVIEW_EVAL_SYSTEM, buildInterviewEvalPrompt } from '@/lib/prompts'
import type { InterviewScores } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { session_id?: string; question_index?: number; question?: string; user_answer?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, question_index, question, user_answer } = body
  if (!session_id || question_index === undefined || !question || !user_answer?.trim()) {
    return new Response(JSON.stringify({ error: '缺少必填字段' }), { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sessionRow } = await supabase
    .from('interview_sessions')
    .select('jd_text, user_id')
    .eq('id', session_id)
    .single()

  if (!sessionRow || sessionRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: '无权访问' }), { status: 403 })
  }

  const { client, config } = await getAIClientForRequest()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let buffer = ''
        const response = await client.chat.completions.create({
          model: config.modelSmart,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: INTERVIEW_EVAL_SYSTEM },
            { role: 'user', content: buildInterviewEvalPrompt(question, user_answer, sessionRow.jd_text) },
          ],
          stream: true,
        })

        for await (const chunk of response) {
          buffer += chunk.choices[0]?.delta?.content ?? ''
        }

        const cleaned = buffer.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
        const result: { scores: InterviewScores; feedback: string; reference_answer: string } = JSON.parse(cleaned)

        if (!result?.scores || !result.feedback || !result.reference_answer) {
          throw new Error('invalid response')
        }

        const { error: insertError } = await supabase.from('interview_turns').insert({
          session_id,
          question_index,
          question,
          user_answer,
          scores: result.scores,
          feedback: result.feedback,
          reference_answer: result.reference_answer,
        })
        if (insertError) throw insertError

        controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'))
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 评估失败，请重试' }) + '\n'))
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
