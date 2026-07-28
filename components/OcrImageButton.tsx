'use client'
import { useRef, useState } from 'react'

interface Props {
  onText: (text: string) => void
  label?: string
}

export default function OcrImageButton({ onText, label = '图片识别' }: Props) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleImage(file: File) {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error ?? '识别失败，请重试')
        return
      }
      onText(data.text)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        {loading ? '识别中...' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/bmp,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])}
      />
    </>
  )
}
