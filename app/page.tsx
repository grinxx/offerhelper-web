'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import AuthModal from '@/components/AuthModal'
import ThemeToggle from '@/components/ThemeToggle'

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
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; usingOwnKey: boolean } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetch('/api/usage').then(r => r.json()).then(setUsageInfo)
      }
    })

    // 新用户（从未访问过）默认展开引导
    const hasVisited = localStorage.getItem('offerhelper_visited')
    if (!hasVisited) {
      setGuideOpen(true)
      localStorage.setItem('offerhelper_visited', '1')
    }
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
            {usageInfo && !usageInfo.usingOwnKey && (
              <>
                <span className={`${usageInfo.limit - usageInfo.used <= 3 ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  今日剩余 {usageInfo.limit - usageInfo.used} 次
                </span>
                <span className="hidden sm:inline">|</span>
              </>
            )}
            {usageInfo?.usingOwnKey && (
              <>
                <span className="text-green-500 dark:text-green-400">自己的 Key</span>
                <span className="hidden sm:inline">|</span>
              </>
            )}
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">我的记录</Link>
            <span className="hidden sm:inline">|</span>
            <Link href="/applications" className="hover:text-zinc-900 dark:hover:text-zinc-100">投递跟踪</Link>
            <span className="hidden sm:inline">|</span>
            <Link href="/settings" className="hover:text-zinc-900 dark:hover:text-zinc-100">AI 设置</Link>
            <span className="hidden sm:inline">|</span>
            <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
            <span className="hidden sm:inline">|</span>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <button onClick={() => setModalOpen(true)} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
            <span className="hidden sm:inline">|</span>
            <button onClick={() => { setPendingHref(null); setModalOpen(true) }} className="hover:text-zinc-900 dark:hover:text-zinc-100">注册</button>
            <span className="hidden sm:inline">|</span>
            <ThemeToggle />
          </div>
        )}
      </header>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-1">把真实经历变成可投递的求职材料</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">不编造，不包装，选一个你现在最需要的功能开始</p>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <span>▸</span>
          <span>不知道从哪里开始？</span>
        </button>
      </div>

      {/* 引导弹窗 */}
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setGuideOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">选择适合你的起点</h3>
              <button onClick={() => setGuideOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
            </div>
            <div className="space-y-3">
              {[
                { condition: '已有简历，想投某个岗位', step: '简历优化 → 岗位匹配 → 面试训练', start: '/analyze', startLabel: '从简历优化开始' },
                { condition: '不清楚自己有哪些优势', step: '优势挖掘 → 简历优化 → 岗位匹配', start: '/strengths', startLabel: '从优势挖掘开始' },
                { condition: '已有目标岗位，想准备面试', step: '岗位匹配 → 面试训练 → 优势挖掘', start: '/match', startLabel: '从岗位匹配开始' },
              ].map(g => (
                <button
                  key={g.start}
                  onClick={() => { setGuideOpen(false); handleFeatureClick(g.start, g.start === '/interview') }}
                  className="w-full text-left border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-0.5">{g.condition}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{g.step}</p>
                    </div>
                    <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 ml-3 shrink-0">→</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setGuideOpen(false)} className="mt-4 w-full text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              我自己看看，关闭
            </button>
          </div>
        </div>
      )}

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

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">🔒 数据安全</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            简历和 JD 仅用于本次 AI 分析，不会用于模型训练。登录后的历史记录仅你本人可见，可随时删除。
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">👤 关于作者</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            OfferHelper 由一名应届毕业生独立开发，亲历校招求职的困境，希望帮助更多同学把真实经历讲清楚。希望大家都可以收到自己满意的 Offer！
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">💬 联系与反馈</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            使用中遇到问题、有功能建议，或者想分享你的求职故事，欢迎联系：
          </p>
          <a href="mailto:xinyuzhang9055@163.com" className="inline-block text-xs text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            xinyuzhang9055@163.com
          </a>
          <p className="text-xs text-zinc-300 dark:text-zinc-600">通常 1-2 个工作日内回复</p>
        </div>
      </div>

      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors list-none">
            <span>为什么用 OfferHelper？</span>
            <span className="group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: '不编造，只优化表达',
                desc: '每条建议都必须回溯到你的真实经历。缺乏证据的内容会单独标注，不会让你写出面试时无法回答的内容。',
              },
              {
                title: '四个功能，覆盖求职全流程',
                desc: '从挖掘优势、匹配岗位、优化简历，到模拟面试，四个功能相互联动，数据可以跨功能复用。',
              },
              {
                title: '应届生专属逻辑',
                desc: '专门针对课程项目、实习、社团等应届生经历设计，不用担心"没有工作经验"的问题。',
              },
            ].map(item => (
              <div key={item.title} className="space-y-1">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.title}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <p className="mt-6 text-xs text-zinc-300 dark:text-zinc-700 text-center">
        每次分析调用 AI，建议按需使用 · 结果仅供参考，不构成任何承诺 ·{' '}
        <a href="mailto:xinyuzhang9055@163.com" className="hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors">反馈与建议</a>
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600 text-center">
        <a href="/privacy" className="underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">隐私政策</a>
        {' · '}
        <a href="/terms" className="underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">服务条款</a>
      </p>

      <AuthModal
        isOpen={modalOpen}
        defaultTab="login"
        onClose={() => { setModalOpen(false); setPendingHref(null) }}
        onAuthSuccess={handleAuthSuccess}
      />
    </main>
  )
}
