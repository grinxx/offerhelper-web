import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OfferHelper — 把真实经历变成可投递的简历',
  description: '面向应届生的证据驱动简历优化工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark:[color-scheme:dark]">
      <body className={`${inter.className} bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen`}>{children}</body>
    </html>
  )
}
