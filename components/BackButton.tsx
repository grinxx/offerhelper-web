'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  href?: string
  label?: string
}

export default function BackButton({ href = '/', label = '返回首页' }: Props) {
  const router = useRouter()

  return (
    <button
      onClick={() => href === 'back' ? router.back() : router.push(href)}
      className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
        <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{label}</span>
    </button>
  )
}
