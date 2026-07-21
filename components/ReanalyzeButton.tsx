'use client'
import { useRouter } from 'next/navigation'

interface Props {
  resumeText: string
  jdText: string
}

export default function ReanalyzeButton({ resumeText, jdText }: Props) {
  const router = useRouter()

  function handleClick() {
    localStorage.setItem('offerhelper_reanalyze_resume', resumeText)
    localStorage.setItem('offerhelper_reanalyze_jd', jdText)
    router.push('/analyze?reanalyze=1')
  }

  return (
    <button
      onClick={handleClick}
      className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      基于此记录重新分析
    </button>
  )
}
