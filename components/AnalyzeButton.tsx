'use client'

interface Props {
  loading: boolean
  disabled: boolean
  onClick: () => void
}

export default function AnalyzeButton({ loading, disabled, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
    >
      {loading ? '分析中...' : '开始分析'}
    </button>
  )
}
