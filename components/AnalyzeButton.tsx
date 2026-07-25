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
      className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-400 dark:hover:bg-indigo-300 text-white py-3 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
    >
      {loading ? '分析中...' : '开始分析'}
    </button>
  )
}
