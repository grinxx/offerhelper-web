import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScoreCard from '@/components/ScoreCard'
import Link from 'next/link'
import type { InterviewScores } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ back?: string }>
}

interface TurnRow {
  question_index: number
  question: string
  user_answer: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

export default async function InterviewDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { back } = await searchParams
  const backUrl = back ?? '/dashboard'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, jd_text, questions, status, created_at, case_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const { data: turns } = await supabase
    .from('interview_turns')
    .select('question_index, question, user_answer, scores, feedback, reference_answer')
    .eq('session_id', id)
    .order('question_index', { ascending: true })

  const turnRows = (turns ?? []) as TurnRow[]

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href={backUrl} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">面试训练记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {session.jd_text && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">目标 JD</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">{session.jd_text}</p>
        </div>
      )}

      {turnRows.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">该训练暂无回答记录。</p>
      ) : (
        <div className="space-y-6">
          {turnRows.map((turn) => (
            <div key={turn.question_index} className="space-y-3">
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">第 {turn.question_index + 1} 题</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{turn.question}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">你的回答</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{turn.user_answer}</p>
              </div>
              <ScoreCard
                scores={turn.scores}
                feedback={turn.feedback}
                reference_answer={turn.reference_answer}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        {session.case_id ? (
          <>
            <Link
              href={`/interview?case_id=${session.case_id}`}
              className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              再次面试训练（基于此 JD）
            </Link>
            <Link
              href={`/dashboard/${session.case_id}`}
              className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              查看关联简历分析
            </Link>
          </>
        ) : (
          <Link
            href="/interview"
            className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            再次面试训练
          </Link>
        )}
      </div>
    </main>
  )
}
