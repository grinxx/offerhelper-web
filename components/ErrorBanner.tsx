'use client'
import Link from 'next/link'

interface Props {
  error: string
}

export default function ErrorBanner({ error }: Props) {
  if (!error) return null

  const isLimitError = error.includes('额度已用完') || error.includes('游客每天')

  return (
    <div className={`flex items-start justify-between gap-3 mb-4 px-4 py-3 rounded-lg text-sm ${
      isLimitError
        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
    }`}>
      <p className={isLimitError ? 'text-amber-700 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}>
        {error}
      </p>
      {isLimitError && (
        <Link
          href="/settings"
          className="shrink-0 text-xs bg-amber-700 dark:bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          去配置 →
        </Link>
      )}
    </div>
  )
}
