import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '岗位匹配 — OfferHelper',
  description: '同时对比多个 JD，找最值得投的岗位。评分 + 优劣势分析 + 投递建议，最多 5 个岗位，根据简历智能推荐方向。',
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children
}
