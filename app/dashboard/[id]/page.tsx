import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Case } from '@/types'
import SuggestionCard from '@/components/SuggestionCard'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ back?: string }>
}

export default async function CaseDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { back } = await searchParams
  const backUrl = back ?? '/dashboard'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: c } = await supabase
    .from('cases')
    .select('id, jd_text, resume_text, status, created_at, result_json')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!c) notFound()

  const caseData = c as Case

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href={backUrl} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">分析详情</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(caseData.created_at).toLocaleString('zh-CN')}</p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">目标 JD</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap line-clamp-6">{caseData.jd_text}</p>
      </div>

      {caseData.status !== 'done' ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">该记录尚未完成分析（状态：{caseData.status}）</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">共 {caseData.result_json.length} 条建议</p>
          {caseData.result_json.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} />
          ))}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2 space-y-2">
            <Link
              href={`/interview?case_id=${caseData.id}`}
              className="block w-full text-center border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              基于此 JD 开始面试训练
            </Link>
            <Link
              href={`/strengths?case_id=${caseData.id}`}
              className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              优势挖掘
            </Link>
            <Link
              href={`/match?case_id=${caseData.id}`}
              className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              岗位匹配
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
