import type { MatchResult } from '@/types'

interface Props {
  result: MatchResult
  title?: string
  loading?: boolean
  failed?: boolean
}

const LEVEL_STYLES: Record<MatchResult['level'], string> = {
  '强烈推荐': 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  '可以投': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  '不建议': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
}

export default function MatchCard({ result, title, loading, failed }: Props) {
  if (loading) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        </div>
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg p-5 space-y-3 ${failed ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {title && (
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
        )}
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{result.score}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${LEVEL_STYLES[result.level]}`}>
          {result.level}
        </span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{result.reason}</p>

      {result.strengths.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">匹配优势</p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-green-500 dark:text-green-400 mt-0.5 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.gaps.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">主要差距</p>
          <ul className="space-y-1">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-red-500 dark:text-red-400 mt-0.5 shrink-0">✕</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
