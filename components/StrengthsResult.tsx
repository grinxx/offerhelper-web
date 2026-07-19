import type { StrengthItem } from '@/types'

interface Props {
  strengths: StrengthItem[]
  summary: string
}

export default function StrengthsResult({ strengths, summary }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {strengths.map((s, i) => (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <span className="inline-block bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
              {s.label}
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.evidence}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">综合点评</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summary}</p>
      </div>
    </div>
  )
}
