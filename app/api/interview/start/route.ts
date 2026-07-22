import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { checkAndRecordUsage } from '@/lib/usage'
import { INTERVIEW_QUESTION_SYSTEM, buildInterviewQuestionPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })

  let body: { jd_text?: string; case_id?: string | null; question_type?: string } = {}
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { jd_text, case_id, question_type = 'all' } = body
  if (!jd_text?.trim()) return new Response(JSON.stringify({ error: 'jd_text 为必填项' }), { status: 400 })

  const usage = await checkAndRecordUsage('interview_start')
  if (!usage.allowed) {
    return new Response(JSON.stringify({ error: '今日免费额度已用完（每天 10 次），请前往「AI 设置」配置自己的 API Key 可无限使用', code: 'LIMIT_EXCEEDED' }), { status: 429 })
  }

  const { chat, config } = await getAIClientForRequest()

  let questions: string[] = []
  try {
    const raw = await chat.complete(
      [
        { role: 'system', content: INTERVIEW_QUESTION_SYSTEM },
        { role: 'user', content: buildInterviewQuestionPrompt(jd_text, question_type) },
      ],
      config.modelSmart,
      1024
    )
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    questions = JSON.parse(cleaned)
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('invalid')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return new Response(JSON.stringify({ error: '题目生成失败，请重试', detail: msg }), { status: 500 })
  }

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const insertData: Record<string, unknown> = { user_id: user.id, jd_text, questions, status: 'active' }
  if (case_id) insertData.case_id = case_id

  const { data: session, error } = await supabase.from('interview_sessions').insert(insertData).select('id').single()
  if (error || !session) return new Response(JSON.stringify({ error: '创建训练失败' }), { status: 500 })

  return new Response(
    JSON.stringify({ session_id: session.id, questions, question: questions[0], question_index: 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
