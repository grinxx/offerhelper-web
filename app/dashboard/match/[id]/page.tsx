import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MatchCard from '@/components/MatchCard'
import Link from 'next/link'
import type { JdItem, MatchResult } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ back?: string }>
}

export default async function MatchDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { back } = await searchParams
  const backUrl = back ?? '/dashboard'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('match_sessions')
    .select('id, jd_list, results, summary, status, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const jdList = (session.jd_list ?? []) as JdItem[]
  const results = (session.results ?? []) as MatchResult[]

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href={backUrl} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">岗位匹配记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {results.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">该记录暂无匹配结果。</p>
      ) : (
        <div className="space-y-4 mb-6">
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={jdList[r.jd_index]?.title || undefined}
            />
          ))}
        </div>
      )}

      {session.summary && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">投递建议</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{session.summary}</p>
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/match"
          className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          重新匹配
        </Link>
      </div>
    </main>
  )
}
