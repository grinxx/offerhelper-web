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

const PAGE_SIZE = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const fetchLimit = page * PAGE_SIZE + 1

  const [casesRes, interviewRes, strengthsRes, matchRes] = await Promise.all([
    supabase
      .from('cases')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('interview_sessions')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('strength_sessions')
      .select('id, summary, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('match_sessions')
      .select('id, jd_list, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
  ])

  const allRecords: TimelineRecord[] = [
    ...(casesRes.data ?? []).map(r => ({
      id: r.id,
      type: 'analysis' as RecordType,
      summary: r.jd_text?.slice(0, 60) ?? '简历分析',
      created_at: r.created_at,
      href: `/dashboard/${r.id}`,
    })),
    ...(interviewRes.data ?? []).map(r => ({
      id: r.id,
      type: 'interview' as RecordType,
      summary: r.jd_text ? r.jd_text.slice(0, 60) : '面试训练',
      created_at: r.created_at,
      href: `/dashboard/interview/${r.id}`,
    })),
    ...(strengthsRes.data ?? []).map(r => ({
      id: r.id,
      type: 'strengths' as RecordType,
      summary: r.summary ? (r.summary as string).slice(0, 60) : '优势挖掘',
      created_at: r.created_at,
      href: `/dashboard/strengths/${r.id}`,
    })),
    ...(matchRes.data ?? []).map(r => ({
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

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</span>
      </header>

      <h2 className="text-xl font-bold mb-4">我的记录</h2>

      {records.length === 0 && page === 1 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          暂无记录，<Link href="/" className="underline">开始第一次分析</Link>
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {records.map(r => {
              const config = TYPE_CONFIG[r.type]
              return (
                <li key={`${r.type}-${r.id}`} className="relative">
                  <Link
                    href={r.href}
                    className="block border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${config.className}`}>
                          {config.label}
                        </span>
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
              <Link href={`/dashboard?page=${page - 1}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                ← 上一页
              </Link>
            ) : <span />}
            {hasMore && (
              <Link href={`/dashboard?page=${page + 1}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                下一页 →
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  )
}
