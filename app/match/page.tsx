// app/match/page.tsx
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ResumeUploader from '@/components/ResumeUploader'
import JdListInput from '@/components/JdListInput'
import MatchCard from '@/components/MatchCard'
import AuthModal from '@/components/AuthModal'
import NextStepBar from '@/components/NextStepBar'
import type { JdItem, MatchResult } from '@/types'

type Stage = 'idle' | 'analyzing' | 'done'

interface Recommendation {
  name: string
  reason: string
  keywords: string[]
}

function MatchPageInner() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recommending, setRecommending] = useState(false)
  const [cachedJdList, setCachedJdList] = useState<JdItem[] | null>(null)

  function handleResumeReady(text: string) {
    setResumeText(text)
    setRecommendations([])
  }
  const [jdList, setJdList] = useState<JdItem[]>([{ title: '', content: '' }, { title: '', content: '' }])
  const [stage, setStage] = useState<Stage>('idle')
  const [results, setResults] = useState<MatchResult[]>([])
  const [summary, setSummary] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentJdIndex, setCurrentJdIndex] = useState(0)
  const [error, setError] = useState('')
  const [failedJdIndexes, setFailedJdIndexes] = useState<Set<number>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const cached = localStorage.getItem('offerhelper_match_jd_list')
    if (cached) {
      try {
        const list = JSON.parse(cached)
        if (Array.isArray(list) && list.length > 0) setCachedJdList(list)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!caseId) return
    const supabase = createClient()
    supabase.from('cases').select('resume_text, jd_text').eq('id', caseId).single()
      .then(({ data }) => {
        if (data?.resume_text) setResumeText(data.resume_text)
        if (data?.jd_text) {
          setJdList(prev => {
            const next = [...prev]
            if (next[0] && !next[0].content) next[0] = { ...next[0], content: data.jd_text }
            return next
          })
        }
      })
  }, [caseId])

  const validJds = jdList.filter(j => j.content.trim())
  const canStart = resumeText.trim() && validJds.length > 0

  async function handleStart() {
    setStage('analyzing')
    setResults([])
    setSummary('')
    setCurrentJdIndex(0)
    setError('')
    setFailedJdIndexes(new Set())

    try {
      const res = await fetch('/api/match/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_list: validJds,
          session_id: sessionId,
        }),
      })

      if (!res.body) {
        setError('请求失败，请重试')
        setStage('idle')
        return
      }

      const reader = res.body.getReader()
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
            if (obj.type === 'result') {
              const { type: _, ...result } = obj
              setResults(prev => [...prev, result as MatchResult])
              setCurrentJdIndex(result.jd_index + 1)
            } else if (obj.type === 'summary') {
              setSummary(obj.text)
            } else if (obj.type === 'done') {
              if (obj.session_id) setSessionId(obj.session_id)
              setStage('done')
              setResults(prev => {
                const top = [...prev].sort((a, b) => b.score - a.score)[0]
                if (top) {
                  const topJd = validJds[top.jd_index]
                  if (topJd) localStorage.setItem('offerhelper_match_top_jd', JSON.stringify(topJd))
                }
                // 保存完整 JD 列表供下次复用
                localStorage.setItem('offerhelper_match_jd_list', JSON.stringify(validJds))
                return prev
              })
            } else if (obj.type === 'error') {
              if (obj.jd_index === -1) {
                setError(obj.message)
              } else {
                setCurrentJdIndex(obj.jd_index + 1)
                setResults(prev => [...prev, {
                  jd_index: obj.jd_index,
                  score: 0,
                  level: '不建议' as const,
                  reason: `该岗位评估失败：${obj.message || '请重试'}`,
                  strengths: [],
                  gaps: [],
                }])
                setFailedJdIndexes(prev => new Set(prev).add(obj.jd_index))
              }
            }
          } catch {}
        }
      }

      setStage(prev => {
        if (prev === 'analyzing') {
          setError('分析未完成，请重试')
          return 'idle'
        }
        return prev
      })
    } catch {
      setError('请求失败，请重试')
      setStage('idle')
    }
  }

  function handleReset() {
    setStage('idle')
    setResults([])
    setSummary('')
    setCurrentJdIndex(0)
    setError('')
    setFailedJdIndexes(new Set())
    setRecommendations([])
  }

  async function handleRecommend() {
    if (!resumeText.trim()) return
    setRecommending(true)
    setRecommendations([])
    try {
      const res = await fetch('/api/match/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText }),
      })
      const data = await res.json()
      if (data.recommendations) setRecommendations(data.recommendations)
    } finally {
      setRecommending(false)
    }
  }

  function applyRecommendation(rec: Recommendation) {
    setJdList(prev => {
      const next = [...prev]
      const emptyIdx = next.findIndex(j => !j.title && !j.content)
      const targetIdx = emptyIdx !== -1 ? emptyIdx : next.length < 5 ? next.length : 0
      if (targetIdx === next.length) {
        return [...next, { title: rec.name, content: '' }]
      }
      const updated = [...next]
      updated[targetIdx] = { ...updated[targetIdx], title: rec.name }
      return updated
    })
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">首页</Link>
          <span>|</span>
          <Link href="/dashboard?type=match" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">我的记录</Link>
        </div>
      </header>

      <h2 className="text-2xl font-bold mb-6">岗位匹配</h2>

      {error && (
        <div className="flex items-center justify-between mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">
          <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={() => { setError(''); handleStart() }}
            className="text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded px-2 py-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ml-3 shrink-0"
          >
            重试
          </button>
        </div>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">简历</h3>
            <ResumeUploader onTextReady={handleResumeReady} />
            {resumeText && caseId && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">已预填简历内容</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">目标岗位 JD（最多 5 个）</h3>
            {cachedJdList && (
              <div className="flex items-center justify-between mb-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3">
                <div className="min-w-0 mr-3">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">检测到上次的 {cachedJdList.length} 个岗位 JD</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {cachedJdList.map(j => j.title || j.content.slice(0, 10)).join('、')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setJdList(cachedJdList); setCachedJdList(null) }}
                    className="text-xs text-zinc-900 dark:text-zinc-100 font-medium border border-zinc-300 dark:border-zinc-600 rounded px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    使用
                  </button>
                  <button
                    onClick={() => setCachedJdList(null)}
                    className="text-xs text-zinc-400 dark:text-zinc-500 hover:underline"
                  >
                    忽略
                  </button>
                </div>
              </div>
            )}
            {resumeText && recommendations.length === 0 && (
              <button
                onClick={handleRecommend}
                disabled={recommending}
                className="mb-3 text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 transition-colors"
              >
                {recommending ? '正在分析简历...' : '✦ 根据简历推荐岗位方向'}
              </button>
            )}
            {recommendations.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">根据你的简历推荐以下方向，点击填入：</p>
                {recommendations.map((rec) => (
                  <button
                    key={rec.name}
                    onClick={() => applyRecommendation(rec)}
                    className="w-full text-left border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{rec.name}</span>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{rec.reason}</p>
                        <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">搜索：{rec.keywords.join(' · ')}</p>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 mt-0.5">填入 →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <JdListInput value={jdList} onChange={setJdList} />
          </div>
          {!user && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              <button onClick={() => setModalOpen(true)} className="underline hover:text-zinc-700 dark:hover:text-zinc-300">登录</button>
              {' '}后可保存记录
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始匹配
          </button>
        </div>
      )}

      {/* analyzing */}
      {stage === 'analyzing' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">
            正在评估 第 {Math.min(currentJdIndex + 1, validJds.length)} 个 / 共 {validJds.length} 个岗位...
          </p>
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={validJds[r.jd_index]?.title || undefined}
              failed={failedJdIndexes.has(r.jd_index)}
            />
          ))}
          {currentJdIndex < validJds.length && (
            <MatchCard
              result={{ jd_index: currentJdIndex, score: 0, level: '可以投', reason: '', strengths: [], gaps: [] }}
              loading
            />
          )}
        </div>
      )}

      {/* done */}
      {stage === 'done' && (
        <div className="space-y-4">
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={validJds[r.jd_index]?.title || undefined}
              failed={failedJdIndexes.has(r.jd_index)}
            />
          ))}
          {summary && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">投递建议</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summary}</p>
            </div>
          )}
          <button
            onClick={handleReset}
            className="w-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            重新匹配
          </button>
          <NextStepBar steps={[
            {
              label: '简历优化',
              desc: '针对评分最高的岗位，定制一份更有针对性的简历',
              href: sessionId ? `/analyze` : '/analyze',
            },
            {
              label: '面试训练',
              desc: '选一个最匹配的岗位，开始行为面试模拟练习',
              href: validJds[0]?.content
                ? `/interview?case_id=${sessionId ?? ''}`
                : '/interview',
            },
          ]} />
        </div>
      )}

      <AuthModal
        isOpen={modalOpen}
        defaultTab="login"
        onClose={() => setModalOpen(false)}
        onAuthSuccess={() => {
          setModalOpen(false)
          const supabase = createClient()
          supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
        }}
      />
    </main>
  )
}

export default function MatchPage() {
  return (
    <Suspense>
      <MatchPageInner />
    </Suspense>
  )
}
