'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'offerhelper_jd_text'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
}

export default function JdInput({ value, onChange, onSubmit }: Props) {
  const [cachedJd, setCachedJd] = useState<string | null>(null)

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached && !value) setCachedJd(cached)
  }, [])

  function handleChange(v: string) {
    onChange(v)
    if (v.trim()) localStorage.setItem(STORAGE_KEY, v)
  }

  function handleUseCached() {
    if (!cachedJd) return
    onChange(cachedJd)
    setCachedJd(null)
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        目标 JD <span className="text-red-500">*</span>
      </label>
      {cachedJd && !value && (
        <div className="flex items-center justify-between mb-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate mr-2">
            检测到上次使用的 JD（{cachedJd.length} 字）
          </span>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleUseCached}
              className="text-xs text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
            >
              使用
            </button>
            <button
              onClick={() => setCachedJd(null)}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:underline"
            >
              忽略
            </button>
          </div>
        </div>
      )}
      <textarea
        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
        placeholder="将岗位 JD 粘贴到这里...（Ctrl+Enter 开始分析）"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmit && value.trim()) {
            e.preventDefault()
            onSubmit()
          }
        }}
      />
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 text-right">{value.length} 字</p>
    </div>
  )
}
