'use client'
import type { Suggestion } from '@/types'
import SuggestionCard from './SuggestionCard'

interface Props {
  suggestions: Suggestion[]
  loading: boolean
}

export default function ResultStream({ suggestions, loading }: Props) {
  if (!loading && suggestions.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {loading ? '分析中，建议将逐条显示...' : `共 ${suggestions.length} 条建议`}
      </p>
      {suggestions.map((s, i) => (
        <SuggestionCard key={i} suggestion={s} />
      ))}
      {loading && (
        <div className="h-8 flex items-center">
          <span className="animate-pulse text-gray-400 text-sm">●●●</span>
        </div>
      )}
    </div>
  )
}
