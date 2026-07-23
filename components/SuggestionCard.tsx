'use client'
import { useState, useEffect } from 'react'
import type { Suggestion } from '@/types'

function FeedbackButtons({ storageKey }: { storageKey?: string }) {
  const [rating, setRating] = useState<1 | -1 | null>(null)

  async function handleRate(r: 1 | -1) {
    if (!storageKey) return
    setRating(r)
    const [caseId, idx] = storageKey.split('_')
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId, suggestion_index: parseInt(idx), rating: r }),
    })
  }

  if (!storageKey) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 dark:text-zinc-500">这条建议有帮助吗？</span>
      <button
        onClick={() => handleRate(1)}
        className={`text-sm transition-colors ${rating === 1 ? 'text-green-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-green-500'}`}
      >👍</button>
      <button
        onClick={() => handleRate(-1)}
        className={`text-sm transition-colors ${rating === -1 ? 'text-red-400' : 'text-zinc-300 dark:text-zinc-600 hover:text-red-400'}`}
      >👎</button>
      {rating && <span className="text-xs text-zinc-400 dark:text-zinc-500">已记录，感谢反馈</span>}
    </div>
  )
}

interface Props {
  suggestion: Suggestion
  storageKey?: string
}

type Status = 'none' | 'applied' | 'pending'

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  none:    { label: '标记', className: 'text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800' },
  applied: { label: '✓ 已应用', className: 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' },
  pending: { label: '◷ 待处理', className: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' },
}

export default function SuggestionCard({ suggestion, storageKey }: Props) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<Status>('none')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!storageKey) return
    const saved = localStorage.getItem(`offerhelper_suggestion_${storageKey}`)
    if (saved === 'applied' || saved === 'pending') setStatus(saved)
  }, [storageKey])

  function handleSetStatus(s: Status) {
    setStatus(s)
    setMenuOpen(false)
    if (storageKey) {
      if (s === 'none') localStorage.removeItem(`offerhelper_suggestion_${storageKey}`)
      else localStorage.setItem(`offerhelper_suggestion_${storageKey}`, s)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(suggestion.suggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
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

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{suggestion.reason}</p>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`text-xs border rounded px-2 py-0.5 transition-colors ${STATUS_CONFIG[status].className}`}
          >
            {STATUS_CONFIG[status].label}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden min-w-[100px]">
              {(['applied', 'pending', 'none'] as Status[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleSetStatus(s)}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  {s === 'applied' ? '✓ 已应用' : s === 'pending' ? '◷ 待处理' : '清除标记'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {suggestion.needs_proof && (
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
          <span>⚠️ 缺少证据</span>
          <span className="text-amber-500 dark:text-amber-500">— 需补充真实经历才能使用此表达</span>
        </div>
      )}

      <FeedbackButtons storageKey={storageKey} />
    </div>
  )
}
