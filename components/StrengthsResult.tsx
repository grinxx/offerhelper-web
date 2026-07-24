'use client'
import { useState } from 'react'
import type { StrengthItem } from '@/types'

interface Props {
  strengths: StrengthItem[]
  summary: string
}

function generateShareCard(strengths: StrengthItem[], summary: string): string {
  const canvas = document.createElement('canvas')
  const W = 720
  const padding = 48
  const lineH = 28
  const cardH = 80
  const totalH = padding * 2 + 60 + strengths.length * (cardH + 12) + 80 + 20
  canvas.width = W
  canvas.height = Math.max(totalH, 500)
  const ctx = canvas.getContext('2d')!

  // 背景
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, W, canvas.height)

  // 顶部品牌
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('OfferHelper', padding, padding + 24)
  ctx.fillStyle = '#71717a'
  ctx.font = '14px sans-serif'
  ctx.fillText('我的职业优势', padding, padding + 48)

  // 分隔线
  ctx.fillStyle = '#3f3f46'
  ctx.fillRect(padding, padding + 60, W - padding * 2, 1)

  // 优势卡片
  let y = padding + 80
  strengths.slice(0, 5).forEach((s) => {
    ctx.fillStyle = '#27272a'
    roundRect(ctx, padding, y, W - padding * 2, cardH, 10)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(s.label, padding + 16, y + 26)
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '13px sans-serif'
    const evidence = s.evidence.length > 42 ? s.evidence.slice(0, 42) + '…' : s.evidence
    ctx.fillText(evidence, padding + 16, y + 52)
    y += cardH + 12
  })

  // 底部
  ctx.fillStyle = '#52525b'
  ctx.font = '12px sans-serif'
  ctx.fillText('offerhelper.cloud', padding, canvas.height - padding + 8)
  ctx.textAlign = 'right'
  ctx.fillText('不编造，只优化表达', W - padding, canvas.height - padding + 8)

  return canvas.toDataURL('image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

export default function StrengthsResult({ strengths, summary }: Props) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [localStrengths, setLocalStrengths] = useState<StrengthItem[]>(strengths)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEvidence, setEditEvidence] = useState('')

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditLabel(localStrengths[i].label)
    setEditEvidence(localStrengths[i].evidence)
  }

  function saveEdit(i: number) {
    if (!editLabel.trim()) return
    setLocalStrengths(prev => prev.map((s, idx) =>
      idx === i ? { label: editLabel.trim(), evidence: editEvidence.trim() } : s
    ))
    setEditingIdx(null)
  }

  async function handleCopyAll() {
    const text = [
      '【职业优势】',
      ...localStrengths.map(s => `${s.label}：${s.evidence}`),
      '',
      '【综合点评】',
      summary,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShare() {
    setSharing(true)
    setTimeout(() => {
      const dataUrl = generateShareCard(localStrengths, summary)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'offerhelper-我的优势.png'
      a.click()
      setSharing(false)
    }, 50)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {localStrengths.map((s, i) => (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            {editingIdx === i ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  maxLength={20}
                  className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="能力标签（2-6字）"
                />
                <textarea
                  value={editEvidence}
                  onChange={e => setEditEvidence(e.target.value)}
                  rows={2}
                  className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="证据描述"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(i)} className="text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded">保存</button>
                  <button onClick={() => setEditingIdx(null)} className="text-xs text-zinc-400 hover:text-zinc-600">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="inline-block bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
                    {s.label}
                  </span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.evidence}</p>
                </div>
                <button
                  onClick={() => startEdit(i)}
                  className="shrink-0 text-xs text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors mt-1"
                  title="编辑"
                >
                  编辑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">综合点评</p>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1 transition-colors disabled:opacity-40"
            >
              {sharing ? '生成中...' : '生成分享图'}
            </button>
            <button
              onClick={handleCopyAll}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1 transition-colors"
            >
              {copied ? '已复制' : '复制全部优势'}
            </button>
          </div>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summary}</p>
      </div>
    </div>
  )
}
