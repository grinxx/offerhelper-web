'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ResumeUploader from '@/components/ResumeUploader'
import JdInput from '@/components/JdInput'
import AnalyzeButton from '@/components/AnalyzeButton'
import ResultStream from '@/components/ResultStream'
import AuthModal from '@/components/AuthModal'
import NextStepBar from '@/components/NextStepBar'
import type { Suggestion } from '@/types'

export default function AnalyzePage() {
  const router = useRouter()
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'login' | 'signup'>('login')
  const [strengthsContext, setStrengthsContext] = useState<string | null>(null)
  const [useStrengths, setUseStrengths] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const cached = localStorage.getItem('offerhelper_strengths_result')
    if (cached) {
      try {
        const data = JSON.parse(cached)
        if (data?.strengths?.length) {
          const ctx = data.strengths.map((s: { label: string; evidence: string }) =>
            `${s.label}：${s.evidence}`
          ).join('\n')
          setStrengthsContext(ctx)
        }
      } catch {}
    }
  }, [])

  const handleAuthSuccess = useCallback(async () => {
    setModalOpen(false)
    if (caseId) {
      await fetch('/api/claim-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
    }
    router.push('/dashboard')
  }, [caseId, router])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!resumeText || !jdText) return
    setLoading(true)
    setSuggestions([])
    setCaseId(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jdText,
          ...(useStrengths && strengthsContext ? { strengths_context: strengthsContext } : {}),
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line)
            if (obj.case_id) {
              setCaseId(obj.case_id)
            } else if (obj.original) {
              setSuggestions(prev => [...prev, obj as Suggestion])
            }
          } catch {}
        }
      }
    } finally {
      setLoading(false)
    }
  }, [resumeText, jdText])

  function openModal(tab: 'login' | 'signup') {
    setModalTab(tab)
    setModalOpen(true)
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-start justify-between mb-8 gap-4">
        <Link href="/" className="text-xl font-semibold shrink-0">OfferHelper</Link>
        {user ? (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">首页</Link>
            <span className="hidden sm:inline">|</span>
            <Link href="/dashboard?type=analysis" className="hover:text-zinc-900 dark:hover:text-zinc-100">我的记录</Link>
            <span className="hidden sm:inline">|</span>
            <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">首页</Link>
            <span className="hidden sm:inline">|</span>
            <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
            <span className="hidden sm:inline">|</span>
            <button onClick={() => openModal('signup')} className="hover:text-zinc-900 dark:hover:text-zinc-100">注册</button>
          </div>
        )}
      </header>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">简历优化</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">不编造，不包装，只优化表达</p>
      </div>

      <div className="space-y-4 mb-6">
        {strengthsContext && (
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3">
            <div className="min-w-0 mr-3">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">检测到你的优势挖掘结果</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">作为参考可让建议更贴合你的真实优势</p>
            </div>
            <button
              onClick={() => setUseStrengths(v => !v)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                useStrengths
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {useStrengths ? '✓ 已加入参考' : '加入参考'}
            </button>
          </div>
        )}
        <ResumeUploader onTextReady={setResumeText} />
        <JdInput value={jdText} onChange={setJdText} />
        <AnalyzeButton
          loading={loading}
          disabled={!resumeText || !jdText}
          onClick={handleAnalyze}
        />
      </div>

      <ResultStream suggestions={suggestions} loading={loading} caseId={caseId} />

      {!loading && suggestions.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => { setSuggestions([]); setCaseId(null) }}
            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5 transition-colors"
          >
            重新分析（保留简历和 JD）
          </button>
        </div>
      )}

      {caseId && !loading && suggestions.length > 0 && (
        <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">保存结果，下次继续优化</p>
          {user ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              查看我的记录
            </button>
          ) : (
            <button
              onClick={() => openModal('signup')}
              className="border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              注册保存
            </button>
          )}
        </div>
      )}

      {caseId && !loading && suggestions.length > 0 && (
        <NextStepBar steps={[
          {
            label: '岗位匹配',
            desc: '用这份简历同时对比多个 JD，找最值得投的岗位',
            href: `/match?case_id=${caseId}`,
          },
          {
            label: '面试训练',
            desc: '基于同一个 JD 做行为面试模拟练习',
            href: `/interview?case_id=${caseId}`,
          },
        ]} />
      )}

      <AuthModal
        isOpen={modalOpen}
        defaultTab={modalTab}
        onClose={() => setModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </main>
  )
}
