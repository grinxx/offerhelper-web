'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ResumeUploader from '@/components/ResumeUploader'
import JdInput from '@/components/JdInput'
import AnalyzeButton from '@/components/AnalyzeButton'
import ResultStream from '@/components/ResultStream'
import AuthModal from '@/components/AuthModal'
import type { Suggestion } from '@/types'

export default function HomePage() {
  const router = useRouter()
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const handleAuthSuccess = useCallback(async (userId: string) => {
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
        body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
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
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">OfferHelper</h1>
        {user ? (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <button onClick={() => router.push('/dashboard')} className="hover:text-black">历史记录</button>
            <span>|</span>
            <button onClick={handleSignOut} className="hover:text-black">退出</button>
          </div>
        ) : (
          <button onClick={() => openModal('login')} className="text-sm text-gray-500 hover:text-black">
            登录 / 历史记录
          </button>
        )}
      </header>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">把真实经历变成可投递的简历</h2>
        <p className="text-gray-500 text-sm">不编造，不包装，只优化表达</p>
      </div>

      <div className="space-y-4 mb-6">
        <ResumeUploader onTextReady={setResumeText} />
        <JdInput value={jdText} onChange={setJdText} />
        <AnalyzeButton
          loading={loading}
          disabled={!resumeText || !jdText}
          onClick={handleAnalyze}
        />
      </div>

      <ResultStream suggestions={suggestions} loading={loading} />

      {caseId && !loading && suggestions.length > 0 && (
        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-sm text-gray-500 mb-3">保存结果，下次继续优化</p>
          {user ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="border border-black text-black px-6 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              查看历史记录
            </button>
          ) : (
            <button
              onClick={() => openModal('signup')}
              className="border border-black text-black px-6 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              注册保存
            </button>
          )}
        </div>
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
