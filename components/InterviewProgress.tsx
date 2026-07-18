interface Props {
  current: number
  total: number
}

export default function InterviewProgress({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500 mb-1">
        <span>第 {current} 题 / 共 {total} 题</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
        <div
          className="bg-zinc-900 dark:bg-zinc-100 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
