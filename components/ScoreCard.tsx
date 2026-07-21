import type { InterviewScores } from '@/types'

interface Props {
  scores: InterviewScores
  feedback: string
  reference_answer: string
  loading?: boolean
}

const DIMENSION_LABELS: Record<keyof InterviewScores, string> = {
  structure: '结构',
  evidence: '证据',
  relevance: '岗位关联',
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
        <div
          className="bg-zinc-900 dark:bg-zinc-100 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium w-6 text-right">{score}</span>
    </div>
  )
}

export default function ScoreCard({ scores, feedback, reference_answer, loading }: Props) {
  if (loading) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>
    )
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
      <div className="space-y-2.5">
        {(Object.keys(DIMENSION_LABELS) as (keyof InterviewScores)[]).map(key => (
          <ScoreBar key={key} label={DIMENSION_LABELS[key]} score={scores[key]} />
        ))}
      </div>

      <div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">点评</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{feedback}</p>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">参考回答框架</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">STAR 结构</span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{reference_answer}</p>
      </div>
    </div>
  )
}
