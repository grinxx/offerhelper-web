'use client'

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function JdInput({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        目标 JD <span className="text-red-500">*</span>
      </label>
      <textarea
        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
        placeholder="将岗位 JD 粘贴到这里..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 text-right">{value.length} 字</p>
    </div>
  )
}
