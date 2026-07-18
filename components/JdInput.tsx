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
        className="w-full border rounded p-3 text-sm h-40 resize-none"
        placeholder="将岗位 JD 粘贴到这里..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-gray-400 mt-1 text-right">{value.length} 字</p>
    </div>
  )
}
