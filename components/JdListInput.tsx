'use client'
import type { JdItem } from '@/types'

interface Props {
  value: JdItem[]
  onChange: (v: JdItem[]) => void
}

const MAX_JDS = 5

export default function JdListInput({ value, onChange }: Props) {
  function update(index: number, field: keyof JdItem, text: string) {
    const next = value.map((item, i) =>
      i === index ? { ...item, [field]: text } : item
    )
    onChange(next)
  }

  function add() {
    if (value.length >= MAX_JDS) return
    onChange([...value, { title: '', content: '' }])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {value.map((item, i) => (
        <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="岗位名称，选填"
              value={item.title ?? ''}
              onChange={e => update(i, 'title', e.target.value)}
              className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded px-3 py-1.5 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            />
            {value.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors shrink-0"
              >
                删除
              </button>
            )}
          </div>
          <textarea
            placeholder="粘贴 JD 内容..."
            value={item.content}
            onChange={e => update(i, 'content', e.target.value)}
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded px-3 py-2 text-sm h-32 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
        </div>
      ))}
      {value.length < MAX_JDS && (
        <button
          onClick={add}
          className="w-full border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 py-2.5 rounded-lg text-sm hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          ＋ 添加岗位
        </button>
      )}
    </div>
  )
}
