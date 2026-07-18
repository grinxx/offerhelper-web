'use client'
import { useState, useRef } from 'react'

interface Props {
  onTextReady: (text: string) => void
}

export default function ResumeUploader({ onTextReady }: Props) {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const [fileName, setFileName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData })
    const { text } = await res.json()
    onTextReady(text)
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex gap-2 mb-3">
        <button
          className={`px-3 py-1 rounded text-sm ${mode === 'upload' ? 'bg-black text-white' : 'border'}`}
          onClick={() => setMode('upload')}
        >上传简历</button>
        <button
          className={`px-3 py-1 rounded text-sm ${mode === 'paste' ? 'bg-black text-white' : 'border'}`}
          onClick={() => setMode('paste')}
        >粘贴文本</button>
      </div>

      {mode === 'upload' ? (
        <div
          className="border-2 border-dashed rounded p-6 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-gray-500 text-sm">
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
        <textarea
          className="w-full border rounded p-3 text-sm h-40 resize-none"
          placeholder="将简历文本粘贴到这里..."
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); onTextReady(e.target.value) }}
        />
      )}
    </div>
  )
}
