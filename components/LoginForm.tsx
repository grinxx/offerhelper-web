'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onSuccess: () => void
  successMessage?: string
}

export default function LoginForm({ onSuccess, successMessage }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message) } else { onSuccess() }
  }

  async function handleMagicLink() {
    if (!email) { setError('请先填写邮箱'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })
    setLoading(false)
    if (error) { setError(error.message) } else { setMagicLinkSent(true) }
  }

  async function handleResetPassword() {
    if (!email) { setError('请先填写邮箱'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    setLoading(false)
    if (error) { setError(error.message) } else { setResetSent(true) }
  }

  if (magicLinkSent) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">邮件已发送，请查收</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">点击邮件中的链接完成登录</p>
      </div>
    )
  }

  if (resetSent) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">重置密码邮件已发送</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">请查收邮件并点击链接重置密码</p>
        <button onClick={() => { setResetSent(false); setShowReset(false) }} className="mt-3 text-xs text-zinc-400 underline">返回登录</button>
      </div>
    )
  }

  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      {successMessage && (
        <p className="text-green-600 dark:text-green-400 text-xs bg-green-50 dark:bg-green-950 px-3 py-2 rounded">{successMessage}</p>
      )}
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
      {!showReset && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">密码</label>
            <button type="button" onClick={() => setShowReset(true)} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300">
              忘记密码？
            </button>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>
      )}
      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
      {showReset ? (
        <div className="space-y-2">
          <button type="button" onClick={handleResetPassword} disabled={loading}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-zinc-700 transition-colors">
            {loading ? '发送中...' : '发送重置密码邮件'}
          </button>
          <button type="button" onClick={() => { setShowReset(false); setError('') }}
            className="w-full border border-zinc-300 dark:border-zinc-700 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            返回登录
          </button>
        </div>
      ) : (
        <>
          <button type="submit" disabled={loading}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors">
            {loading ? '处理中...' : '登录'}
          </button>
          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">或者</span>
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          </div>
          <button type="button" onClick={handleMagicLink} disabled={loading}
            className="w-full border border-zinc-300 dark:border-zinc-700 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors">
            {loading ? '处理中...' : '发送 Magic Link 邮件'}
          </button>
        </>
      )}
    </form>
  )
}
