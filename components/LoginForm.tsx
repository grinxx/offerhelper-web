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

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onSuccess()
    }
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
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-600">邮件已发送，请查收</p>
        <p className="text-xs text-gray-400 mt-1">点击邮件中的链接完成登录</p>
      </div>
    )
  }

  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      {successMessage && (
        <p className="text-green-600 text-xs bg-green-50 px-3 py-2 rounded">{successMessage}</p>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="example@email.com"
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">密码</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="••••••••"
          disabled={loading}
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded-lg text-sm disabled:opacity-40"
      >
        {loading ? '处理中...' : '登录'}
      </button>
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 border-t" />
        <span className="text-xs text-gray-400">或者</span>
        <div className="flex-1 border-t" />
      </div>
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        {loading ? '处理中...' : '发送 Magic Link 邮件'}
      </button>
    </form>
  )
}
