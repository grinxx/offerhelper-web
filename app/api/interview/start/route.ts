import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { INTERVIEW_QUESTION_SYSTEM, buildInterviewQuestionPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { jd_text?: string; case_id?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { jd_text, case_id } = body
  if (!jd_text?.trim()) {
    return new Response(JSON.stringify({ error: 'jd_text 为必填项' }), { status: 400 })
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: INTERVIEW_QUESTION_SYSTEM,
    messages: [{ role: 'user', content: buildInterviewQuestionPrompt(jd_text) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let questions: string[] = []
  try {
    questions = JSON.parse(raw)
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: '题目生成失败，请重试' }), { status: 500 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    jd_text,
    questions,
    status: 'active',
  }
  if (case_id) insertData.case_id = case_id

  const { data: session, error } = await supabase
    .from('interview_sessions')
    .insert(insertData)
    .select('id')
    .single()

  if (error || !session) {
    return new Response(JSON.stringify({ error: '创建训练失败', detail: error?.message }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ session_id: session.id, question: questions[0], question_index: 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
