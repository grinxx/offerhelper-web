'use client'
import { useEffect, useState } from 'react'
import type { UserExperience } from '@/types'

const SOURCE_LABEL: Record<string, string> = {
  strengths: '优势挖掘',
  interview: '面试训练',
  manual: '手动添加',
}

const SOURCE_CLASS: Record<string, string> = {
  strengths: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  interview: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  manual: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
}

export default function ExperienceList() {
  const [experiences, setExperiences] = useState<UserExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [inputOpen, setInputOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/experiences')
      const data = await res.json()
      if (data.experiences) setExperiences(data.experiences)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    const content = inputText.trim()
    if (!content) return
    setAdding(true)
    try {
      const res = await fetch('/api/knowledge/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '添加失败'); return }
      setExperiences(prev => [data.experience, ...prev])
      setInputText('')
      setInputOpen(false)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/knowledge/experiences/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('删除失败，请重试')
        return
      }
      setExperiences(prev => prev.filter(e => e.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4">加载中...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          共 {experiences.length} 条经历记录，简历优化时将自动参考
        </p>
        <button
          onClick={() => setInputOpen(v => !v)}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          {inputOpen ? '取消' : '+ 手动添加'}
        </button>
      </div>

      {inputOpen && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
          <textarea
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-24 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            placeholder="描述一段经历，例如：在字节跳动实习期间，负责推荐系统 A/B 测试，CTR 提升 8%..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{inputText.length}/500</span>
            <button
              onClick={handleAdd}
              disabled={adding || !inputText.trim()}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-1.5 rounded text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-40"
            >
              {adding ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {experiences.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">暂无经历记录</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            完成优势挖掘或面试训练后，经历会自动收集到这里
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {experiences.map(exp => (
            <li
              key={exp.id}
              className="flex items-start gap-3 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3"
            >
              <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${SOURCE_CLASS[exp.source] ?? SOURCE_CLASS.manual}`}>
                {SOURCE_LABEL[exp.source] ?? exp.source}
              </span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 flex-1 leading-relaxed">{exp.content}</p>
              <button
                onClick={() => handleDelete(exp.id)}
                disabled={deletingId === exp.id}
                className="text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 disabled:opacity-40 text-xs mt-0.5"
              >
                {deletingId === exp.id ? '...' : '删除'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
