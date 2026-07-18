import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Case } from '@/types'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: cases } = await supabase
    .from('cases')
    .select('id, jd_text, status, created_at, result_json')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <span className="text-sm text-gray-500">{user.email}</span>
      </header>

      <h2 className="text-xl font-bold mb-4">历史分析记录</h2>

      {!cases || cases.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无记录，<Link href="/" className="underline">开始第一次分析</Link></p>
      ) : (
        <ul className="space-y-3">
          {(cases as Case[]).map(c => (
            <li key={c.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700 line-clamp-1">{c.jd_text.slice(0, 60)}...</p>
                <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.status === 'done' ? `${c.result_json.length} 条建议` : c.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleString('zh-CN')}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
