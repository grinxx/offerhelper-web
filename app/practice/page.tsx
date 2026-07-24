import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 取所有已完成的面试 session 及其 turns
  const { data: sessions } = await service
    .from('interview_sessions')
    .select('id, jd_text, created_at')
    .eq('user_id', user.id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!sessions || sessions.length === 0) {
    return (
      <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
          <Link href="/interview" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">← 面试训练</Link>
        </header>
        <h2 className="text-xl font-bold mb-4">面试题库</h2>
        <div className="text-center py-16">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-2">还没有训练记录</p>
          <Link href="/interview" className="text-xs text-zinc-500 underline">开始第一次面试训练</Link>
        </div>
      </main>
    )
  }

  const sessionIds = sessions.map(s => s.id)
  const { data: turns } = await service
    .from('interview_turns')
    .select('session_id, question_index, question, scores, feedback, reference_answer')
    .in('session_id', sessionIds)
    .order('question_index', { ascending: true })

  // 按 session 分组
  const turnsBySession: Record<string, typeof turns> = {}
  for (const t of turns ?? []) {
    if (!turnsBySession[t.session_id]) turnsBySession[t.session_id] = []
    turnsBySession[t.session_id]!.push(t)
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/interview" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">面试训练</Link>
          <span>|</span>
          <Link href="/dashboard?type=interview" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">我的记录</Link>
        </div>
      </header>

      <h2 className="text-xl font-bold mb-2">面试题库</h2>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6">历次训练积累的题目和参考答案，随时复习</p>

      <div className="space-y-8">
        {sessions.map(session => {
          const sessionTurns = turnsBySession[session.id] ?? []
          if (sessionTurns.length === 0) return null
          return (
            <div key={session.id}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {new Date(session.created_at).toLocaleDateString('zh-CN')}
                </p>
                {session.jd_text && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-xs">
                    {session.jd_text.slice(0, 40)}...
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {sessionTurns.map((turn) => {
                  const scores = turn.scores as { structure: number; evidence: number; relevance: number } | null
                  const avg = scores ? Math.round((scores.structure + scores.evidence + scores.relevance) / 3 * 10) / 10 : null
                  return (
                    <details key={turn.question_index} className="border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 pr-4">{turn.question}</p>
                        {avg !== null && (
                          <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${
                            avg >= 4 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : avg >= 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                          }`}>
                            均分 {avg}
                          </span>
                        )}
                      </summary>
                      <div className="px-4 pb-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        {turn.feedback && (
                          <div>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">点评</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{turn.feedback}</p>
                          </div>
                        )}
                        {turn.reference_answer && (
                          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">参考回答框架</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{turn.reference_answer}</p>
                          </div>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
