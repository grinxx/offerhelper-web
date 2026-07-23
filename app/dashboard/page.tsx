import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { JdItem } from '@/types'
import DeleteRecordButton from './DeleteRecordButton'

type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

interface TimelineRecord {
  id: string
  type: RecordType
  summary: string
  created_at: string
  href: string
}

const TYPE_CONFIG: Record<RecordType, { label: string; className: string }> = {
  analysis: {
    label: '简历分析',
    className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  },
  interview: {
    label: '面试训练',
    className: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  },
  strengths: {
    label: '优势挖掘',
    className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  },
  match: {
    label: '岗位匹配',
    className: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  },
}

const TYPE_LABELS: Record<RecordType, string> = {
  analysis: '简历分析',
  interview: '面试训练',
  strengths: '优势挖掘',
  match: '岗位匹配',
}

const TYPE_HREF: Record<RecordType, string> = {
  analysis: '/analyze',
  interview: '/interview',
  strengths: '/strengths',
  match: '/match',
}

const TYPE_ACTION: Record<RecordType, string> = {
  analysis: '开始第一次简历分析',
  interview: '开始第一次面试训练',
  strengths: '开始第一次优势挖掘',
  match: '开始第一次岗位匹配',
}

const VALID_TYPES = new Set<string>(['analysis', 'interview', 'strengths', 'match'])

const PAGE_SIZE = 20

interface Props {
  searchParams: Promise<{ page?: string; type?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { page: pageStr, type: typeParam } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const activeType = (typeParam && VALID_TYPES.has(typeParam)) ? typeParam as RecordType : null
  const fetchLimit = page * PAGE_SIZE + 1

  const shouldFetch = (t: RecordType) => !activeType || activeType === t

  const [casesRes, interviewRes, strengthsRes, matchRes, progressRes] = await Promise.all([
    shouldFetch('analysis') ? supabase
      .from('cases')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit) : { data: [] },
    shouldFetch('interview') ? supabase
      .from('interview_sessions')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit) : { data: [] },
    shouldFetch('strengths') ? supabase
      .from('strength_sessions')
      .select('id, summary, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit) : { data: [] },
    shouldFetch('match') ? supabase
      .from('match_sessions')
      .select('id, jd_list, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit) : { data: [] },
    !activeType ? Promise.all([
      supabase.from('cases').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
      supabase.from('interview_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
      supabase.from('strength_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
      supabase.from('match_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
    ]) : Promise.resolve(null),
  ])

  const allRecords: TimelineRecord[] = [
    ...(casesRes.data ?? []).map((r: { id: string; jd_text?: string; created_at: string }) => ({
      id: r.id,
      type: 'analysis' as RecordType,
      summary: r.jd_text?.slice(0, 60) ?? '简历分析',
      created_at: r.created_at,
      href: `/dashboard/${r.id}`,
    })),
    ...(interviewRes.data ?? []).map((r: { id: string; jd_text?: string; created_at: string }) => ({
      id: r.id,
      type: 'interview' as RecordType,
      summary: r.jd_text ? r.jd_text.slice(0, 60) : '面试训练',
      created_at: r.created_at,
      href: `/dashboard/interview/${r.id}`,
    })),
    ...(strengthsRes.data ?? []).map((r: { id: string; summary?: string; created_at: string }) => ({
      id: r.id,
      type: 'strengths' as RecordType,
      summary: r.summary ? (r.summary as string).slice(0, 60) : '优势挖掘',
      created_at: r.created_at,
      href: `/dashboard/strengths/${r.id}`,
    })),
    ...(matchRes.data ?? []).map((r: { id: string; jd_list?: unknown; created_at: string }) => ({
      id: r.id,
      type: 'match' as RecordType,
      summary: (() => {
        const list = r.jd_list as JdItem[] | null
        return list?.[0]?.title || list?.[0]?.content?.slice(0, 40) || '岗位匹配'
      })(),
      created_at: r.created_at,
      href: `/dashboard/match/${r.id}`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const start = (page - 1) * PAGE_SIZE
  const records = allRecords.slice(start, start + PAGE_SIZE)
  const hasMore = allRecords.length > start + PAGE_SIZE

  const pageTitle = activeType ? TYPE_LABELS[activeType] + '记录' : '我的记录'
  const baseUrl = activeType ? `/dashboard?type=${activeType}` : '/dashboard'
  const backParam = activeType ? `?back=/dashboard%3Ftype%3D${activeType}` : '?back=/dashboard'

  // 面试进度：取最近 10 次已完成 session 的平均分
  type ScoreSummary = { session_id: string; avg_structure: number; avg_evidence: number; avg_relevance: number; created_at: string }
  let interviewProgress: ScoreSummary[] = []
  if (activeType === 'interview' && (interviewRes.data ?? []).length >= 2) {
    const sessionIds = (interviewRes.data ?? []).slice(0, 10).map((r: { id: string }) => r.id)
    const { data: turns } = await supabase
      .from('interview_turns')
      .select('session_id, scores')
      .in('session_id', sessionIds)

    if (turns && turns.length > 0) {
      const bySession: Record<string, { structure: number[]; evidence: number[]; relevance: number[] }> = {}
      for (const t of turns) {
        if (!bySession[t.session_id]) bySession[t.session_id] = { structure: [], evidence: [], relevance: [] }
        bySession[t.session_id].structure.push(t.scores?.structure ?? 0)
        bySession[t.session_id].evidence.push(t.scores?.evidence ?? 0)
        bySession[t.session_id].relevance.push(t.scores?.relevance ?? 0)
      }
      interviewProgress = sessionIds
        .filter((id: string) => bySession[id])
        .map((id: string) => {
          const s = bySession[id]
          const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0
          const session = (interviewRes.data ?? []).find((r: { id: string; created_at: string }) => r.id === id)
          return { session_id: id, avg_structure: avg(s.structure), avg_evidence: avg(s.evidence), avg_relevance: avg(s.relevance), created_at: session?.created_at ?? '' }
        })
        .reverse()
    }
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {activeType && (
            <>
              <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">全部记录</Link>
              <span>|</span>
            </>
          )}
          <Link href="/applications" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">投递跟踪</Link>
          <span>|</span>
          <span className="text-zinc-400 dark:text-zinc-500">{user.email}</span>
        </div>
      </header>

      <h2 className="text-xl font-bold mb-4">{pageTitle}</h2>

      {!activeType && progressRes && (() => {
        const [cCount, iCount, sCount, mCount] = progressRes as Array<{ count: number | null }>
        const checks = [
          { label: '完成优势挖掘', done: (sCount.count ?? 0) > 0, href: '/strengths', type: 'strengths' },
          { label: '完成简历优化', done: (cCount.count ?? 0) > 0, href: '/analyze', type: 'analysis' },
          { label: '完成岗位匹配', done: (mCount.count ?? 0) > 0, href: '/match', type: 'match' },
          { label: '完成面试训练', done: (iCount.count ?? 0) > 0, href: '/interview', type: 'interview' },
        ]
        const doneCount = checks.filter(c => c.done).length
        const allDone = doneCount === 4
        return (
          <div className={`mb-6 border rounded-lg p-4 ${allDone ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">求职准备进度</p>
              <p className={`text-xs font-medium ${allDone ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {allDone ? '✓ 基础准备已完成' : `${doneCount} / 4 已完成`}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {checks.map(c => (
                <Link
                  key={c.label}
                  href={c.done ? `/dashboard?type=${c.type}` : c.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                    c.done
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      : 'border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <span>{c.done ? '✓' : '○'}</span>
                  <span>{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {interviewProgress.length >= 2 && (
        <div className="mb-6 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-3">训练趋势（近 {interviewProgress.length} 次）</p>
          <div className="grid grid-cols-3 gap-4">
            {(['avg_structure', 'avg_evidence', 'avg_relevance'] as const).map((dim, di) => {
              const labels = ['结构', '证据', '岗位关联']
              const values = interviewProgress.map(s => s[dim])
              const latest = values[values.length - 1]
              const prev = values[values.length - 2]
              const trend = latest > prev ? '↑' : latest < prev ? '↓' : '—'
              const trendColor = latest > prev ? 'text-green-500' : latest < prev ? 'text-red-400' : 'text-zinc-400'
              return (
                <div key={dim} className="text-center">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{labels[di]}</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{latest}</p>
                  <p className={`text-xs font-medium ${trendColor}`}>{trend} 较上次</p>
                  <div className="flex items-end justify-center gap-0.5 mt-2 h-8">
                    {values.map((v, i) => (
                      <div
                        key={i}
                        className="w-2 rounded-sm bg-zinc-300 dark:bg-zinc-600"
                        style={{ height: `${Math.max(4, (v / 5) * 100)}%`, opacity: i === values.length - 1 ? 1 : 0.5 }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {records.length === 0 && page === 1 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          暂无记录，<Link href={activeType ? TYPE_HREF[activeType] : '/'} className="underline">
            {activeType ? TYPE_ACTION[activeType] : '去选择一个功能开始'}
          </Link>
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {records.map(r => {
              const config = TYPE_CONFIG[r.type]
              return (
                <li key={`${r.type}-${r.id}`} className="relative">
                  <Link
                    href={`${r.href}${backParam}`}
                    className="block border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {!activeType && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${config.className}`}>
                            {config.label}
                          </span>
                        )}
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-1 min-w-0">{r.summary}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {new Date(r.created_at).toLocaleString('zh-CN')}
                        </p>
                        <DeleteRecordButton id={r.id} type={r.type} />
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            {page > 1 ? (
              <Link href={`${baseUrl}&page=${page - 1}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                ← 上一页
              </Link>
            ) : <span />}
            {hasMore && (
              <Link href={`${baseUrl}&page=${page + 1}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                下一页 →
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  )
}
