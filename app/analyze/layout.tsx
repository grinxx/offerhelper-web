import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '简历优化 — OfferHelper',
  description: '针对目标 JD 逐条优化简历表达，每条建议都有真实经历支撑，缺证据的内容单独标注。不编造，不包装。',
}

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return children
}
