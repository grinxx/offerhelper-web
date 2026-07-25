'use client'

interface Props {
  visible: boolean
  onClose: () => void
  message?: string
}

export default function SharePromptModal({ visible, onClose, message }: Props) {
  if (!visible) return null

  function handleShare() {
    const text = '推荐一个求职神器 OfferHelper，帮我把真实经历整理成简历，还能做面试训练和岗位匹配，应届生必备！'
    const url = 'https://offerhelper.cloud'
    if (navigator.share) {
      navigator.share({ title: 'OfferHelper', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`)
        .then(() => alert('已复制推荐文案，快发给同学吧！'))
        .catch(() => {})
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <p className="text-2xl">🎉</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {message ?? '做得很好！'}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            如果 OfferHelper 对你有帮助，推荐给有需要的同学吧，让更多人把真实经历讲清楚。
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleShare}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            推荐给同学 →
          </button>
          <button
            onClick={onClose}
            className="w-full text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 py-2 transition-colors"
          >
            不了，谢谢
          </button>
        </div>
      </div>
    </div>
  )
}
