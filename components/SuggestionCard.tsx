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
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
      <div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">原文</span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{suggestion.original}</p>
      </div>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">建议</span>
            <p className="text-sm font-medium mt-0.5">{suggestion.suggestion}</p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 transition-colors mt-5"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      <div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">理由</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{suggestion.reason}</p>
      </div>
      {suggestion.needs_proof && (
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
          <span>⚠️ 缺少证据</span>
          <span className="text-amber-500 dark:text-amber-500">— 需补充真实经历才能使用此表达</span>
        </div>
      )}
    </div>
  )
}
