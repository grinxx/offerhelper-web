// app/interview/page.tsx
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import InterviewProgress from '@/components/InterviewProgress'
import ScoreCard from '@/components/ScoreCard'
import AuthModal from '@/components/AuthModal'
import type { InterviewScores } from '@/types'

type Stage = 'idle' | 'loading_questions' | 'questioning' | 'evaluating' | 'summary'

interface TurnResult {
  question_index: number
  question: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

interface CurrentEval {
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

interface SummaryData {
  turns: TurnResult[]
  avg_scores: InterviewScores
  weakest_dimension: keyof InterviewScores
}

const WEAKEST_LABEL: Record<keyof InterviewScores, string> = {
  structure: '结构',
  evidence: '证据',
  relevance: '岗位关联',
}

const TOTAL_QUESTIONS = 5

export default function InterviewPage() {
  return (
    <Suspense>
      <InterviewPageInner />
    </Suspense>
  )
}

function InterviewPageInner() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [currentEval, setCurrentEval] = useState<CurrentEval | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (!caseId) return
    const supabase = createClient()
    supabase.from('cases').select('jd_text').eq('id', caseId).single()
      .then(({ data }) => { if (data?.jd_text) setJdText(data.jd_text) })
  }, [caseId])

  async function handleStart() {
    if (!jdText.trim()) return
    setStage('loading_questions')
    setError('')

    const res = await fetch('/api/interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jdText, case_id: caseId }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error || '启动失败，请重试')
      setStage('idle')
      return
    }

    setSessionId(data.session_id)
    const qs: string[] = data.questions ?? [data.question]
    setQuestions(qs)
    setCurrentIndex(0)
    setUserAnswer('')
    setCurrentEval(null)
    setStage('questioning')
  }

  async function handleSubmitAnswer() {
    if (!userAnswer.trim()) return
    setStage('evaluating')
    setCurrentEval(null)

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_index: currentIndex,
          question: questions[currentIndex],
          user_answer: userAnswer,
        }),
      })

      if (!res.body) {
        setError('评估失败，请重试')
        setStage('questioning')
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
            if (obj.scores) setCurrentEval(obj as CurrentEval)
            if (obj.error) setError(obj.error)
          } catch {}
        }
      }
    } catch {
      setError('评估失败，请重试')
      setStage('questioning')
    }
  }

  async function handleFinish() {
    const res = await fetch('/api/interview/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
    if (!res.ok) {
      setError('获取总结失败，请重试')
      return
    }
    const data = await res.json()
    setSummary(data)
    setStage('summary')
  }

  function handleNext() {
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex(i => i + 1)
      setUserAnswer('')
      setCurrentEval(null)
      setStage('questioning')
    } else {
      handleFinish()
    }
  }

  function handleReset() {
    setStage('idle')
    setJdText('')
    setSessionId('')
    setQuestions([])
    setCurrentIndex(0)
    setUserAnswer('')
    setCurrentEval(null)
    setSummary(null)
    setError('')
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        </header>
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">面试训练需要登录后使用</p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            登录
          </button>
        </div>
        <AuthModal
          isOpen={modalOpen}
          defaultTab="login"
          onClose={() => setModalOpen(false)}
          onAuthSuccess={(userId) => {
            setModalOpen(false)
            const supabase = createClient()
            supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
          }}
        />
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">首页</Link>
          <span>|</span>
          <Link href="/dashboard?type=interview" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">我的记录</Link>
        </div>
      </header>

      <h2 className="text-2xl font-bold mb-6">面试训练</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              目标 JD <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              placeholder="粘贴目标岗位的 JD，AI 将根据它生成针对性面试题..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={!jdText.trim()}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始面试训练
          </button>
        </div>
      )}

      {/* loading_questions */}
      {stage === 'loading_questions' && (
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">正在生成题目...</p>
        </div>
      )}

      {/* questioning */}
      {stage === 'questioning' && questions.length > 0 && (
        <div className="space-y-4">
          <InterviewProgress current={currentIndex + 1} total={TOTAL_QUESTIONS} />
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
              {questions[currentIndex]}
            </p>
          </div>
          <textarea
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            placeholder="请用 STAR 结构作答：背景（Situation）、任务（Task）、行动（Action）、结果（Result）..."
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              提交回答
            </button>
            <button
              onClick={handleFinish}
              className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              结束训练
            </button>
          </div>
        </div>
      )}

      {/* evaluating */}
      {stage === 'evaluating' && (
        <div className="space-y-4">
          <InterviewProgress current={currentIndex + 1} total={TOTAL_QUESTIONS} />
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{questions[currentIndex]}</p>
          </div>
          {currentEval ? (
            <ScoreCard
              scores={currentEval.scores}
              feedback={currentEval.feedback}
              reference_answer={currentEval.reference_answer}
            />
          ) : (
            <ScoreCard scores={{ structure: 0, evidence: 0, relevance: 0 }} feedback="" reference_answer="" loading />
          )}
          {currentEval && (
            <div className="flex gap-2">
              <button
                onClick={handleNext}
                className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                {currentIndex < TOTAL_QUESTIONS - 1 ? '下一题' : '查看总结'}
              </button>
              <button
                onClick={handleFinish}
                className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                结束训练
              </button>
            </div>
          )}
        </div>
      )}

      {/* summary */}
      {stage === 'summary' && summary && (
        <div className="space-y-6">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-medium mb-3">本次训练总结</h3>
            <div className="space-y-2 mb-4">
              {(['structure', 'evidence', 'relevance'] as (keyof InterviewScores)[]).map(dim => (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-14">{WEAKEST_LABEL[dim]}</span>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-zinc-900 dark:bg-zinc-100 h-2 rounded-full"
                      style={{ width: `${(summary.avg_scores[dim] / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{summary.avg_scores[dim]}</span>
                </div>
              ))}
            </div>
            <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded text-xs">
              你在「{WEAKEST_LABEL[summary.weakest_dimension]}」维度平均 {summary.avg_scores[summary.weakest_dimension]} 分，建议重点加强
            </p>
          </div>

          <div className="space-y-3">
            {summary.turns.map((turn) => (
              <div key={turn.question_index} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">第 {turn.question_index + 1} 题</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">{turn.question}</p>
                <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>结构 {turn.scores.structure}/5</span>
                  <span>证据 {turn.scores.evidence}/5</span>
                  <span>岗位关联 {turn.scores.relevance}/5</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              再来一次
            </button>
            <Link
              href="/"
              className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center"
            >
              返回首页
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
