'use client'
import { useState } from 'react'
import type { Suggestion } from '@/types'
import SuggestionCard from './SuggestionCard'

interface Props {
  suggestions: Suggestion[]
  loading: boolean
}

export default function ResultStream({ suggestions, loading }: Props) {
  const [copiedAll, setCopiedAll] = useState(false)

  if (!loading && suggestions.length === 0) return null

  async function handleCopyAll() {
    const text = suggestions.map((s, i) =>
      `【建议 ${i + 1}】\n原文：${s.original}\n建议：${s.suggestion}\n理由：${s.reason}${s.needs_proof ? '\n⚠️ 缺少证据，需补充真实经历' : ''}`
    ).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {loading ? '分析中，建议将逐条显示...' : `共 ${suggestions.length} 条建议`}
        </p>
        {!loading && suggestions.length > 0 && (
          <button
            onClick={handleCopyAll}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1 transition-colors"
          >
            {copiedAll ? '已复制全部' : '复制全部建议'}
          </button>
        )}
      </div>

      {!loading && suggestions.filter(s => s.needs_proof).length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-0.5">
            ⚠️ {suggestions.filter(s => s.needs_proof).length} 条建议标注了「缺少证据」
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
            这些建议的表达方向正确，但你需要用真实的数据、项目或经历来支撑，直接使用可能在面试中被追问时无法回答。
          </p>
        </div>
      )}

      {suggestions.map((s, i) => (
        <SuggestionCard key={i} suggestion={s} />
      ))}
      {loading && (
        <div className="h-8 flex items-center">
          <span className="animate-pulse text-zinc-400 text-sm">●●●</span>
        </div>
      )}
    </div>
  )
}
