import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { InterviewScores } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { session_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id } = body
  if (!session_id) {
    return new Response(JSON.stringify({ error: '缺少 session_id' }), { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sessionRow } = await supabase
    .from('interview_sessions')
    .select('user_id')
    .eq('id', session_id)
    .single()

  if (!sessionRow || sessionRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: '无权访问' }), { status: 403 })
  }

  await supabase
    .from('interview_sessions')
    .update({ status: 'done' })
    .eq('id', session_id)

  const { data: turns } = await supabase
    .from('interview_turns')
    .select('question_index, question, scores, feedback, reference_answer')
    .eq('session_id', session_id)
    .order('question_index', { ascending: true })

  const safeTurns = turns ?? []
  const count = safeTurns.length

  const avg_scores: InterviewScores = { structure: 0, evidence: 0, relevance: 0 }
  if (count > 0) {
    for (const t of safeTurns) {
      const s = (t.scores ?? {}) as Partial<InterviewScores>
      avg_scores.structure += s.structure ?? 0
      avg_scores.evidence += s.evidence ?? 0
      avg_scores.relevance += s.relevance ?? 0
    }
    avg_scores.structure = Math.round((avg_scores.structure / count) * 10) / 10
    avg_scores.evidence = Math.round((avg_scores.evidence / count) * 10) / 10
    avg_scores.relevance = Math.round((avg_scores.relevance / count) * 10) / 10
  }

  const weakest_dimension = (
    Object.entries(avg_scores) as [keyof InterviewScores, number][]
  ).reduce((a, b) => (b[1] < a[1] ? b : a))[0]

  return new Response(
    JSON.stringify({ turns: safeTurns, avg_scores, weakest_dimension }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
