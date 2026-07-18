import type { Suggestion } from '@/types'

interface Props {
  suggestion: Suggestion
}

export default function SuggestionCard({ suggestion }: Props) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
      <div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">原文</span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{suggestion.original}</p>
      </div>
      <div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">建议</span>
        <p className="text-sm font-medium mt-0.5">{suggestion.suggestion}</p>
      </div>
      <div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">理由</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{suggestion.reason}</p>
      </div>
      {suggestion.needs_proof && (
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
          <span>⚠️</span>
          <span>needs_proof — 请用真实经历补充证据再使用此表达</span>
        </div>
      )}
    </div>
  )
}
