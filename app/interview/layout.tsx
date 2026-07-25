import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '面试训练 — OfferHelper',
  description: '模拟真实面试，5 题行为面试练习。结构、证据、岗位关联三维实时评分，附参考答案框架，帮你在面试前充分准备。',
}

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
