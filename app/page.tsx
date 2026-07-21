'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import AuthModal from '@/components/AuthModal'

const FEATURES = [
  {
    title: '简历优化',
    desc: '针对目标 JD 逐条优化简历表达',
    detail: '每条建议都有真实经历支撑，缺证据的内容单独标注',
    href: '/analyze',
    requireLogin: false,
  },
  {
    title: '岗位匹配',
    desc: '同时对比多个 JD，找最值得投的岗位',
    detail: '评分 + 优劣势分析 + 投递建议，最多 5 个岗位',
    href: '/match',
    requireLogin: false,
  },
  {
    title: '面试训练',
    desc: '模拟真实面试，5 题行为面试练习',
    detail: '结构、证据、岗位关联三维实时评分，附参考答案',
    href: '/interview',
    requireLogin: true,
  },
  {
    title: '优势挖掘',
    desc: '3 轮追问，整理有证据的职业优势',
    detail: '从真实经历中提炼能力标签，可结合目标 JD 定向分析',
    href: '/strengths',
    requireLogin: false,
  },
]

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const hasUsed = !!(
      localStorage.getItem('offerhelper_resume_text') ||
      localStorage.getItem('offerhelper_strengths_result') ||
      localStorage.getItem('offerhelper_match_top_jd') ||
      localStorage.getItem('offerhelper_jd_text')
    )
    setGuideOpen(!hasUsed)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleFeatureClick = (href: string, requireLogin: boolean) => {
    if (requireLogin && !user) {
      setPendingHref(href)
      setModalOpen(true)
      return
    }
    router.push(href)
  }

  const handleAuthSuccess = () => {
    setModalOpen(false)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (pendingHref) {
        router.push(pendingHref)
        setPendingHref(null)
      }
    })
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto min-h-screen flex flex-col justify-center">
      <header className="flex items-start justify-between mb-10 gap-4">
        <h1 className="text-xl font-semibold shrink-0">OfferHelper</h1>
        {user ? (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">我的记录</Link>
            <span className="hidden sm:inline">|</span>
            <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <button onClick={() => setModalOpen(true)} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
            <span className="hidden sm:inline">|</span>
            <button onClick={() => { setPendingHref(null); setModalOpen(true) }} className="hover:text-zinc-900 dark:hover:text-zinc-100">注册</button>
          </div>
        )}
      </header>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-1">把真实经历变成可投递的求职材料</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">不编造，不包装，选一个你现在最需要的功能开始</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setGuideOpen(v => !v)}
          className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <span>{guideOpen ? '▾' : '▸'}</span>
          <span>不知道从哪里开始？</span>
        </button>

        {guideOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                condition: '已有简历，想投某个岗位',
                step: '简历优化 → 岗位匹配 → 面试训练',
                start: '/analyze',
                startLabel: '从简历优化开始',
              },
              {
                condition: '不清楚自己有哪些优势',
                step: '优势挖掘 → 简历优化 → 岗位匹配',
                start: '/strengths',
                startLabel: '从优势挖掘开始',
              },
              {
                condition: '已有目标岗位，想准备面试',
                step: '岗位匹配 → 面试训练 → 优势挖掘',
                start: '/match',
                startLabel: '从岗位匹配开始',
              },
            ].map(g => (
              <div key={g.start} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">{g.condition}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3 leading-relaxed">{g.step}</p>
                <button
                  onClick={() => handleFeatureClick(g.start, g.start === '/interview')}
                  className="text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded px-2.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {g.startLabel} →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {FEATURES.map((f) => (
          <button
            key={f.href}
            onClick={() => handleFeatureClick(f.href, f.requireLogin)}
            className="text-left border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group"
          >
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
              {f.title}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{f.desc}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{f.detail}</p>
          </button>
        ))}
      </div>

      {user && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <Link
            href="/dashboard"
            className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <span>最近记录</span>
            <span>→</span>
          </Link>
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-300 dark:text-zinc-700 text-center">每次分析调用 AI，建议按需使用 · 结果仅供参考，不构成任何承诺</p>

      <AuthModal
        isOpen={modalOpen}
        defaultTab="login"
        onClose={() => { setModalOpen(false); setPendingHref(null) }}
        onAuthSuccess={handleAuthSuccess}
      />
    </main>
  )
}
