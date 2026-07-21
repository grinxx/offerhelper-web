'use client'
import { useState } from 'react'
import type { Suggestion } from '@/types'

interface Props {
  suggestion: Suggestion
}

export default function SuggestionCard({ suggestion }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(suggestion.suggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
      {/* diff 对比 */}
      <div className="rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800 text-sm">
        <div className="bg-red-50 dark:bg-red-950/30 px-3 py-2 flex gap-2">
          <span className="text-red-400 shrink-0 select-none">−</span>
          <p className="text-red-700 dark:text-red-400 line-through leading-relaxed">{suggestion.original}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 px-3 py-2 flex gap-2">
          <span className="text-green-500 shrink-0 select-none">+</span>
          <p className="text-green-800 dark:text-green-300 leading-relaxed flex-1">{suggestion.suggestion}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 border border-green-200 dark:border-green-800 rounded px-2 py-0.5 ml-2 self-start transition-colors"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      {/* 理由 */}
      <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{suggestion.reason}</p>

      {suggestion.needs_proof && (
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
          <span>⚠️ 缺少证据</span>
          <span className="text-amber-500 dark:text-amber-500">— 需补充真实经历才能使用此表达</span>
        </div>
      )}
    </div>
  )
}
