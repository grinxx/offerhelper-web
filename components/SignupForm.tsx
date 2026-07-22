'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onSuccess: () => void
  onSwitchToLogin: (message?: string) => void
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onSwitchToLogin('注册成功，请登录')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          placeholder="example@email.com"
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">密码</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          placeholder="至少 6 位"
          disabled={loading}
        />
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        注册即表示你同意我们的
        <a href="/terms" target="_blank" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 mx-1">服务条款</a>
        和
        <a href="/privacy" target="_blank" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 mx-1">隐私政策</a>
      </p>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
      >
        {loading ? '处理中...' : '注册'}
      </button>
    </form>
  )
}
