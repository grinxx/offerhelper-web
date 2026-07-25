import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '优势挖掘 — OfferHelper',
  description: '通过 3 轮动态追问，从真实经历中提炼有证据的职业优势，整理成可直接用于简历和面试的能力标签。',
}

export default function StrengthsLayout({ children }: { children: React.ReactNode }) {
  return children
}
