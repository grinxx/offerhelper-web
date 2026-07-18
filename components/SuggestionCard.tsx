import type { Suggestion } from '@/types'

interface Props {
  suggestion: Suggestion
}

export default function SuggestionCard({ suggestion }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">原文</span>
        <p className="text-sm text-gray-600 mt-0.5">{suggestion.original}</p>
      </div>
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">建议</span>
        <p className="text-sm font-medium mt-0.5">{suggestion.suggestion}</p>
      </div>
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">理由</span>
        <p className="text-sm text-gray-500 mt-0.5">{suggestion.reason}</p>
      </div>
      {suggestion.needs_proof && (
        <div className="flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded">
          <span>⚠️</span>
          <span>needs_proof — 请用真实经历补充证据再使用此表达</span>
        </div>
      )}
    </div>
  )
}
