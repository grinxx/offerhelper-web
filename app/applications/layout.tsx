import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '投递跟踪 — OfferHelper',
  description: '记录每次投递的公司、岗位、状态，跟踪求职进度，约面试时自动提醒。',
}

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
