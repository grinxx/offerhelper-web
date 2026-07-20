'use client'
import { useState, useRef, useEffect } from 'react'

const STORAGE_KEY = 'offerhelper_resume_text'

interface Props {
  onTextReady: (text: string) => void
}

export default function ResumeUploader({ onTextReady }: Props) {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      setPasteText(cached)
      setMode('paste')
      onTextReady(cached)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveAndNotify(text: string) {
    if (text.trim()) localStorage.setItem(STORAGE_KEY, text)
    onTextReady(text)
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData })
    const { text } = await res.json()
    saveAndNotify(text)
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      <div className="flex gap-2 mb-3">
        <button
          className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'upload' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'}`}
          onClick={() => setMode('upload')}
        >上传简历</button>
        <button
          className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'paste' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'}`}
          onClick={() => setMode('paste')}
        >粘贴文本</button>
      </div>

      {mode === 'upload' ? (
        <div
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded p-6 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {fileName || 'PDF 或 DOCX，点击上传'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="relative">
          <textarea
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            placeholder="将简历文本粘贴到这里..."
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); saveAndNotify(e.target.value) }}
          />
          {pasteText && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">已缓存，切换页面后自动预填</p>
          )}
        </div>
      )}
    </div>
  )
}
