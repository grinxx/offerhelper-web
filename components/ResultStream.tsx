'use client'
import { useState, useEffect } from 'react'
import type { Suggestion } from '@/types'
import SuggestionCard from './SuggestionCard'

function OverallFeedback({ caseId }: { caseId?: string | null }) {
  const [rating, setRating] = useState<1 | -1 | null>(null)

  async function handleRate(r: 1 | -1) {
    if (!caseId) return
    // 允许切换：再次点同一个就取消，点另一个就更新
    const newRating = rating === r ? null : r
    setRating(newRating)
    if (newRating !== null) {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, suggestion_index: -1, rating: newRating }),
      }).catch(() => {})
    }
  }

  if (!caseId) return null

  return (
    <div className="flex items-center gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
      <span className="text-xs text-zinc-400 dark:text-zinc-500">这次分析对你有帮助吗？</span>
      <button
        onClick={() => handleRate(1)}
        title="有帮助"
        className={`text-base transition-all duration-150 hover:scale-125 ${
          rating === 1 ? 'text-green-500 scale-125' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'
        }`}
      >👍</button>
      <button
        onClick={() => handleRate(-1)}
        title="没帮助"
        className={`text-base transition-all duration-150 hover:scale-125 ${
          rating === -1 ? 'text-red-400 scale-125' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-400'
        }`}
      >👎</button>
      {rating !== null && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {rating === 1 ? '很高兴对你有帮助 🎉' : '感谢反馈，我们会继续改进'}
        </span>
      )}
    </div>
  )
}

interface Props {
  suggestions: Suggestion[]
  loading: boolean
  caseId?: string | null
}

export default function ResultStream({ suggestions, loading, caseId }: Props) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [showBasis, setShowBasis] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!caseId || suggestions.length === 0) return
    fetch(`/api/suggestion-status?case_id=${caseId}`)
      .then(r => r.json())
      .then(data => { if (data.statuses) setStatusMap(data.statuses) })
      .catch(() => {})
  }, [caseId, suggestions.length])

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
        <SuggestionCard key={i} suggestion={s} storageKey={caseId ? `${caseId}_${i}` : undefined} initialStatus={statusMap[i] as 'applied' | 'pending' | undefined} />
      ))}
      {loading && (
        <div className="h-8 flex items-center">
          <span className="animate-pulse text-zinc-400 text-sm">●●●</span>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          <div>
            <button
              onClick={() => setShowBasis(v => !v)}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {showBasis ? '▾ 收起分析依据' : '▸ 查看分析依据'}
            </button>
            {showBasis && (
              <div className="mt-2 space-y-1.5 text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
                <p><span className="font-medium text-zinc-600 dark:text-zinc-400">建议来源：</span>每条建议均回溯到你简历中的真实经历，不编造内容</p>
                <p><span className="font-medium text-zinc-600 dark:text-zinc-400">优化方向：</span>结合目标 JD 的关键词和要求，调整表达方式和侧重点</p>
                <p><span className="font-medium text-zinc-600 dark:text-zinc-400">⚠️ 缺少证据：</span>表达方向正确但简历中缺乏支撑，需要你补充真实事实后再使用</p>
              </div>
            )}
          </div>

          <OverallFeedback caseId={caseId} />
        </div>
      )}
    </div>
  )
}
