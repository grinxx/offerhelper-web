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

const SCORE_COLOR = (score: number) => {
  if (score >= 75) return 'text-green-600 dark:text-green-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
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
    <div className={`border rounded-lg p-5 space-y-4 ${failed ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {title && (
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
        )}
        <span className={`text-3xl font-bold ${SCORE_COLOR(result.score)}`}>{result.score}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${LEVEL_STYLES[result.level]}`}>
          {result.level}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">/ 100</span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{result.reason}</p>

      {result.strengths.length > 0 && (
        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">匹配优势</p>
          {result.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-green-800 dark:text-green-300">
              <span className="shrink-0 mt-0.5">✓</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {result.gaps.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">主要差距</p>
          {result.gaps.map((g, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <span className="shrink-0 mt-0.5">✕</span>
              <span>{g}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
