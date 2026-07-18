'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

interface Props {
  isOpen: boolean
  defaultTab?: 'login' | 'signup'
  onClose: () => void
  onAuthSuccess: (userId: string) => void
}

export default function AuthModal({ isOpen, defaultTab = 'login', onClose, onAuthSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [switchMessage, setSwitchMessage] = useState<string | undefined>()

  useEffect(() => {
    setTab(defaultTab)
    setSwitchMessage(undefined)
  }, [defaultTab, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        onAuthSuccess(session.user.id)
      }
    })
    return () => subscription.unsubscribe()
  }, [isOpen, onAuthSuccess])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-lg leading-none"
        >
          ✕
        </button>

        <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => { setTab('login'); setSwitchMessage(undefined) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'login' ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-400'}`}
          >
            登录
          </button>
          <button
            onClick={() => { setTab('signup'); setSwitchMessage(undefined) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'signup' ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-400'}`}
          >
            注册
          </button>
        </div>

        {tab === 'login' ? (
          <LoginForm
            onSuccess={() => {}}
            successMessage={switchMessage}
          />
        ) : (
          <SignupForm
            onSuccess={() => {}}
            onSwitchToLogin={(msg) => { setTab('login'); setSwitchMessage(msg) }}
          />
        )}
      </div>
    </div>
  )
}
