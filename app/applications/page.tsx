'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_OPTIONS = [
  { value: 'submitted', label: '已投递', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' },
  { value: 'viewed', label: '已查看', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  { value: 'interview_scheduled', label: '约面试', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' },
  { value: 'interviewed', label: '已面试', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  { value: 'offer', label: '收到 Offer 🎉', color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  { value: 'rejected', label: '已拒绝', color: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
  { value: 'withdrawn', label: '已撤回', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500' },
]

interface Application {
  id: string
  company: string
  position: string
  platform: string
  applied_at: string
  status: string
  note: string
}

const EMPTY_FORM = { company: '', position: '', platform: '', applied_at: new Date().toISOString().slice(0, 10), status: 'submitted', note: '' }

export default function ApplicationsPage() {
  const router = useRouter()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string>('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(5)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setInitialized(true)
    })
  }, [])

  useEffect(() => {
    if (initialized) loadApps()
  }, [page, initialized])

  async function loadApps() {
    setLoading(true)
    const res = await fetch(`/api/applications?page=${page}`)
    const data = await res.json()
    setApps(data.applications ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.company.trim() || !form.position.trim()) return
    setSaving(true)
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
    loadApps()
  }

  async function handleStatusChange(id: string, status: string) {
    setEditingId(null)
    await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  function handleDeleteClick(id: string) {
    setPendingDelete(id)
    setDeleteCountdown(5)
    deleteIntervalRef.current = setInterval(() => {
      setDeleteCountdown(c => { if (c <= 1) { clearInterval(deleteIntervalRef.current!); return 0 } return c - 1 })
    }, 1000)
    deleteTimerRef.current = setTimeout(async () => {
      await fetch(`/api/applications?id=${id}`, { method: 'DELETE' })
      setApps(prev => prev.filter(a => a.id !== id))
      setPendingDelete(null)
    }, 5000)
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current)
    setPendingDelete(null)
  }

  const stats = {
    total: apps.length,
    active: apps.filter(a => !['rejected', 'withdrawn', 'offer'].includes(a.status)).length,
    offer: apps.filter(a => a.status === 'offer').length,
    interview: apps.filter(a => ['interview_scheduled', 'interviewed'].includes(a.status)).length,
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 我的记录
        </Link>
      </header>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">投递跟踪</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          + 记录投递
        </button>
      </div>

      {/* 统计 */}
      {apps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: '总投递', value: stats.total },
            { label: '进行中', value: stats.active },
            { label: '面试阶段', value: stats.interview },
            { label: 'Offer', value: stats.offer },
          ].map(s => (
            <div key={s.label} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 添加表单 */}
      {showForm && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">公司 *</label>
              <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" placeholder="公司名称" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">岗位 *</label>
              <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" placeholder="岗位名称" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">平台</label>
              <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" placeholder="Boss直聘 / 猎聘 / 官网..." value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">投递日期</label>
              <input type="date" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" value={form.applied_at} onChange={e => setForm(p => ({ ...p, applied_at: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">备注</label>
            <input type="text" className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" placeholder="薪资范围、联系人、注意事项..." value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.company.trim() || !form.position.trim()} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-zinc-700 transition-colors">
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <p className="text-zinc-400 animate-pulse text-sm">加载中...</p>
      ) : apps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-2">还没有投递记录</p>
          <p className="text-xs text-zinc-300 dark:text-zinc-600">点击「记录投递」开始跟踪你的求职进度</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map(app => {
            const statusOpt = STATUS_OPTIONS.find(s => s.value === app.status)
            return (
              <div key={app.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{app.company}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{app.position}</p>
                      {app.platform && <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{app.platform}</span>}
                    </div>
                    {app.note && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{app.note}</p>}
                    <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">{app.applied_at}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingId === app.id ? (
                      <select
                        autoFocus
                        value={editStatus}
                        onChange={e => handleStatusChange(app.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        className="text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded px-2 py-1 focus:outline-none"
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => { setEditingId(app.id); setEditStatus(app.status) }}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusOpt?.color}`}
                      >
                        {statusOpt?.label ?? app.status}
                      </button>
                    )}
                    {pendingDelete === app.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{deleteCountdown}s</span>
                        <button onClick={handleUndoDelete} className="text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">撤销</button>
                      </div>
                    ) : (
                      <button onClick={() => handleDeleteClick(app.id)} className="text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors">删除</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {page > 1 ? (
            <button onClick={() => setPage(p => p - 1)} className="hover:text-zinc-900 dark:hover:text-zinc-100">← 上一页</button>
          ) : <span />}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">第 {page} 页 / 共 {Math.ceil(total / PAGE_SIZE)} 页</span>
          {page * PAGE_SIZE < total ? (
            <button onClick={() => setPage(p => p + 1)} className="hover:text-zinc-900 dark:hover:text-zinc-100">下一页 →</button>
          ) : <span />}
        </div>
      )}
    </main>
  )
}
