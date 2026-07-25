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
      className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white py-3 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
    >
      {loading ? '分析中...' : '开始分析'}
    </button>
  )
}
