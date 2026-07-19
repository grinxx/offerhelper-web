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
import type { JdItem, MatchResult } from '@/types'

type Stage = 'idle' | 'analyzing' | 'done'

function MatchPageInner() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [jdList, setJdList] = useState<JdItem[]>([{ title: '', content: '' }, { title: '', content: '' }])
  const [stage, setStage] = useState<Stage>('idle')
  const [results, setResults] = useState<MatchResult[]>([])
  const [summary, setSummary] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentJdIndex, setCurrentJdIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
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
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          历史记录
        </Link>
      </header>

      <h2 className="text-2xl font-bold mb-6">岗位匹配</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">简历</h3>
            <ResumeUploader onTextReady={setResumeText} />
            {resumeText && caseId && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">已预填简历内容</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">目标岗位 JD（最多 5 个）</h3>
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
