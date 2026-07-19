import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OfferHelper — 把真实经历变成可投递的简历',
  description: '面向应届生的证据驱动简历优化工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark:[color-scheme:dark]">
      <body className="font-sans bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">{children}</body>
    </html>
  )
}
