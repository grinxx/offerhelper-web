import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '我的记录 — OfferHelper',
  description: '查看所有简历优化、岗位匹配、面试训练和优势挖掘的历史记录，跟踪求职准备进度。',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
