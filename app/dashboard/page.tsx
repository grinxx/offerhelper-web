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

  const [casesRes, interviewRes, strengthsRes, matchRes] = await Promise.all([
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
          <span className="text-zinc-400 dark:text-zinc-500">{user.email}</span>
        </div>
      </header>

      <h2 className="text-xl font-bold mb-4">{pageTitle}</h2>

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
