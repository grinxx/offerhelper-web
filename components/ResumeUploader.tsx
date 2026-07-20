'use client'
import { useState, useRef, useEffect } from 'react'

const STORAGE_KEY = 'offerhelper_resume_text'
const STORAGE_NAME_KEY = 'offerhelper_resume_name'

interface Props {
  onTextReady: (text: string) => void
}

export default function ResumeUploader({ onTextReady }: Props) {
  const [fileName, setFileName] = useState('')
  const [parsedText, setParsedText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [cachedName, setCachedName] = useState<string | null>(null)
  const [cachedText, setCachedText] = useState<string | null>(null)
  const [usingCached, setUsingCached] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const name = localStorage.getItem(STORAGE_NAME_KEY)
    const text = localStorage.getItem(STORAGE_KEY)
    if (name && text) {
      setCachedName(name)
      setCachedText(text)
    }
  }, [])

  function saveCache(text: string, name: string) {
    localStorage.setItem(STORAGE_KEY, text)
    localStorage.setItem(STORAGE_NAME_KEY, name)
  }

  function handleUseCached() {
    if (!cachedText || !cachedName) return
    setParsedText(cachedText)
    setFileName(cachedName)
    setUsingCached(true)
    onTextReady(cachedText)
  }

  function handleSwitch() {
    setUsingCached(false)
    setParsedText('')
    setFileName('')
    onTextReady('')
  }

  async function handleFile(file: File) {
    const name = file.name
    setFileName(name)
    setUsingCached(false)
    setCachedName(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData })
    const { text } = await res.json()
    setParsedText(text)
    saveCache(text, name)
    onTextReady(text)
  }

  // 已有解析结果（上传或使用缓存）
  if (parsedText) {
    const paragraphs = parsedText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate font-medium">{fileName}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">已解析</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {expanded ? '收起' : '查看内容'}
            </button>
            <button
              onClick={handleSwitch}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              换一份
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2 max-h-64 overflow-y-auto">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{p}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  // 粘贴模式
  if (pasteMode) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">粘贴简历文本</span>
          <button
            onClick={() => setPasteMode(false)}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← 返回上传
          </button>
        </div>
        <textarea
          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          placeholder="将简历文本粘贴到这里..."
          value={pasteText}
          onChange={e => {
            setPasteText(e.target.value)
            if (e.target.value.trim()) {
              saveCache(e.target.value, '粘贴的简历')
              onTextReady(e.target.value)
            }
          }}
          autoFocus
        />
      </div>
    )
  }

  // 默认：上传区 + 缓存提示
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      {cachedName && !usingCached && (
        <div className="flex items-center justify-between mb-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate mr-2">
            上次使用：<span className="text-zinc-700 dark:text-zinc-300 font-medium">{cachedName}</span>
          </span>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleUseCached}
              className="text-xs text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
            >
              使用
            </button>
            <button
              onClick={() => setCachedName(null)}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:underline"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      <div
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded p-6 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">PDF 或 DOCX，点击上传</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      <button
        onClick={() => setPasteMode(true)}
        className="mt-2 w-full text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors py-1"
      >
        或粘贴文本
      </button>
    </div>
  )
}
