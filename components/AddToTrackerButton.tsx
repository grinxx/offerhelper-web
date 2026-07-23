'use client'
import { useState } from 'react'

interface Props {
  jdText: string
}

export default function AddToTrackerButton({ jdText }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    company: '',
    position: '',
    platform: '',
    applied_at: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // 尝试从 JD 文本里提取公司名和岗位名（简单启发式）
  function prefill() {
    const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean)
    const firstLine = lines[0] ?? ''
    // 常见格式：「公司名 - 岗位名」或「岗位名 | 公司名」
    const dash = firstLine.match(/^(.+?)\s*[-|–]\s*(.+)$/)
    if (dash) {
      setForm(p => ({ ...p, company: dash[1].slice(0, 30), position: dash[2].slice(0, 30) }))
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!form.company.trim() || !form.position.trim()) return
    setSaving(true)
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setDone(true)
    setTimeout(() => { setOpen(false); setDone(false) }, 1500)
  }

  return (
    <>
      <button
        onClick={prefill}
        className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        加入投递跟踪
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold">记录投递</h3>
            {done ? (
              <p className="text-green-600 dark:text-green-400 text-sm text-center py-4">✓ 已加入投递跟踪</p>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">公司 *</label>
                    <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="公司名称" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">岗位 *</label>
                    <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="岗位名称" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">平台</label>
                    <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} placeholder="Boss直聘 / 猎聘..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">投递日期</label>
                    <input type="date" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" value={form.applied_at} onChange={e => setForm(p => ({ ...p, applied_at: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving || !form.company.trim() || !form.position.trim()} className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-zinc-700 transition-colors">
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button onClick={() => setOpen(false)} className="flex-1 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
