'use client'
import Link from 'next/link'
import { useUsage } from '@/hooks/useUsage'

export default function UsageWarning() {
  const { remaining, showWarning, usage } = useUsage()

  if (!showWarning) return null

  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
      <span>⚠️</span>
      <span>
        今日免费额度仅剩 <strong>{remaining}</strong> 次
        {usage?.limit === 3 ? '，登录后每天可用 10 次' : ''}。
        <Link href="/settings" className="underline ml-1 hover:text-amber-700 dark:hover:text-amber-300">
          配置自己的 Key 可无限使用 →
        </Link>
      </span>
    </p>
  )
}
