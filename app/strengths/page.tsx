// app/strengths/page.tsx
'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ChatBubble from '@/components/ChatBubble'
import StrengthsResultComponent from '@/components/StrengthsResult'
import AuthModal from '@/components/AuthModal'
import type { ChatMessage, StrengthItem } from '@/types'

type Stage = 'idle' | 'chatting' | 'generating_result' | 'done'

interface StrengthsResultData {
  strengths: StrengthItem[]
  summary: string
}

const TOTAL_TURNS = 3

function StrengthsPageInner() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [turnIndex, setTurnIndex] = useState(0)
  const [isFinal, setIsFinal] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [result, setResult] = useState<StrengthsResultData | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function callMessage(msgs: ChatMessage[], ti: number, sid: string | null) {
    setStreamingText('')
    setError('')

    try {
      const res = await fetch('/api/strengths/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          messages: msgs,
          jd_text: jdText || null,
          turn_index: ti,
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
      let aiText = ''

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
            if (obj.text) {
              aiText += obj.text
              setStreamingText(aiText)
            } else if ('is_final' in obj) {
              if (obj.session_id) setSessionId(obj.session_id)
              setIsFinal(obj.is_final)
            } else if (obj.error) {
              setError(obj.error)
            }
          } catch {}
        }
      }

      if (aiText) {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiText }
        setMessages(prev => [...prev, aiMsg])
        setStreamingText('')
      }
    } catch {
      setError('请求失败，请重试')
      setStreamingText('')
      // 保留对话历史，不重置到 idle
    }
  }

  async function handleStart() {
    setStage('chatting')
    setMessages([])
    setTurnIndex(0)
    setIsFinal(false)
    setSessionId(null)
    await callMessage([], 0, null)
  }

  async function handleSend() {
    if (!userInput.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: userInput.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setUserInput('')

    // After user's 3rd answer (responding to turn_index=2 AI question), generate result
    if (isFinal) {
      setStage('generating_result')
      await generateResult(newMessages)
    } else {
      const nextTurnIndex = turnIndex + 1
      setTurnIndex(nextTurnIndex)
      await callMessage(newMessages, nextTurnIndex, sessionId)
    }
  }

  async function generateResult(msgs: ChatMessage[]) {
    setError('')
    try {
      const res = await fetch('/api/strengths/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: msgs,
          jd_text: jdText || null,
        }),
      })
      if (!res.ok) {
        setError('优势提炼失败，请重试')
        setStage('chatting')
        return
      }
      const data = await res.json()
      setResult(data)
      setStage('done')
    } catch {
      setError('优势提炼失败，请重试')
      setStage('chatting')
    }
  }

  function handleReset() {
    setStage('idle')
    setMessages([])
    setStreamingText('')
    setTurnIndex(0)
    setIsFinal(false)
    setUserInput('')
    setResult(null)
    setSessionId(null)
    setError('')
  }

  // Compute answered turns count for progress display
  const answeredTurns = messages.filter(m => m.role === 'user').length

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">首页</Link>
          <span>|</span>
          <Link href="/dashboard?type=strengths" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">我的记录</Link>
        </div>
      </header>

      <h2 className="text-2xl font-bold mb-6">优势挖掘</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI 将通过 3 个问题了解你的经历，帮你整理有证据的优势</p>
          <div>
            <label className="block text-sm font-medium mb-1">目标 JD（选填）</label>
            <textarea
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-32 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              placeholder="粘贴目标 JD（可选，填写后优势分析会更有针对性）..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          </div>
          {!user && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              <button onClick={() => setModalOpen(true)} className="underline hover:text-zinc-700 dark:hover:text-zinc-300">登录</button>
              {' '}后可保存记录
            </p>
          )}
          <button
            onClick={handleStart}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始挖掘
          </button>
        </div>
      )}

      {/* chatting */}
      {stage === 'chatting' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
            <span>第 {Math.min(answeredTurns + 1, TOTAL_TURNS)} 问 / 共 {TOTAL_TURNS} 问</span>
          </div>
          <div className="space-y-3 min-h-[200px]">
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}
            {streamingText && (
              <ChatBubble role="assistant" content={streamingText} />
            )}
            <div ref={bottomRef} />
          </div>
          {!streamingText && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="space-y-2">
              <textarea
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-28 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                placeholder="请详细描述你的经历..."
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && userInput.trim()) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!userInput.trim()}
                className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                {isFinal ? '提交并生成优势' : '发送'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* generating_result */}
      {stage === 'generating_result' && (
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">正在整理你的优势...</p>
        </div>
      )}

      {/* done */}
      {stage === 'done' && result && (
        <div className="space-y-6">
          <StrengthsResultComponent strengths={result.strengths} summary={result.summary} />
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleReset}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              重新开始
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

export default function StrengthsPage() {
  return (
    <Suspense>
      <StrengthsPageInner />
    </Suspense>
  )
}
