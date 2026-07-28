'use client'
import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'offerhelper_jd_text'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
}

export default function JdInput({ value, onChange, onSubmit }: Props) {
  const [cachedJd, setCachedJd] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

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

  async function handleImageOCR(file: File) {
    setOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error ?? '识别失败，请重试')
        return
      }
      handleChange(data.text)
    } finally {
      setOcrLoading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">
          目标 JD <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={ocrLoading}
          className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          {ocrLoading ? '识别中...' : '图片识别'}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/bmp,image/webp"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleImageOCR(e.target.files[0])}
        />
      </div>
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
