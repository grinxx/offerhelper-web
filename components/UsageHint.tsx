'use client'
import Link from 'next/link'
import { useUsage } from '@/hooks/useUsage'

export default function UsageHint() {
  const { usage, remaining } = useUsage()

  if (!usage) return null
  if (usage.usingOwnKey) return (
    <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
      使用自己的 API Key · 无次数限制
    </p>
  )

  return (
    <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
      {usage.limit === 3
        ? <>未登录每天 3 次免费 · <Link href="/" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">登录</Link>后每天 10 次</>
        : <>今日已用 {usage.used} / {usage.limit} 次 · <Link href="/settings" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">配置自己的 Key</Link> 可无限使用</>
      }
    </p>
  )
}
