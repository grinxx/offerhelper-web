'use client'
import { useState } from 'react'

interface Props {
  caseId: string
  initialLabel?: string | null
}

export default function VersionLabelEditor({ caseId, initialLabel }: Props) {
  const [label, setLabel] = useState(initialLabel ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/cases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: caseId, version_label: label.trim() || null }),
    })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          maxLength={30}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="如：投产品经理版、秋招通用版..."
          className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <button onClick={handleSave} disabled={saving} className="text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded disabled:opacity-40">
          {saving ? '保存...' : '保存'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-400 hover:text-zinc-600">取消</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
          {label}
        </span>
      ) : (
        <span className="text-xs text-zinc-300 dark:text-zinc-600">未设置版本标签</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        {label ? '修改' : '+ 添加版本标签'}
      </button>
      {saved && <span className="text-xs text-green-500">已保存</span>}
    </div>
  )
}
