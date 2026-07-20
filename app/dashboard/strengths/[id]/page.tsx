import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatBubble from '@/components/ChatBubble'
import StrengthsResultComponent from '@/components/StrengthsResult'
import Link from 'next/link'
import type { ChatMessage, StrengthsResult } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ back?: string }>
}

export default async function StrengthsDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { back } = await searchParams
  const backUrl = back ?? '/dashboard'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('strength_sessions')
    .select('id, jd_text, messages, result, status, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const messages = (session.messages ?? []) as ChatMessage[]
  const result = session.result as StrengthsResult | null

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href={backUrl} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">优势挖掘记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {session.jd_text && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">目标 JD</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">{session.jd_text}</p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">对话记录</p>
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-3">优势结果</p>
        {result ? (
          <StrengthsResultComponent strengths={result.strengths} summary={result.summary} />
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">该记录未完成优势提炼。</p>
        )}
      </div>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <Link
          href="/strengths"
          className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          重新挖掘优势
        </Link>
      </div>
    </main>
  )
}
