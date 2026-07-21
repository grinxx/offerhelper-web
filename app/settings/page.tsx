'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PROVIDERS } from '@/lib/ai-client'

interface Settings {
  ai_provider: string
  ai_base_url: string
  ai_api_key: string
  ai_model_fast: string
  ai_model_smart: string
}

const DEFAULT_SETTINGS: Settings = {
  ai_provider: 'siliconflow',
  ai_base_url: 'https://api.siliconflow.cn/v1',
  ai_api_key: '',
  ai_model_fast: 'Qwen/Qwen2.5-7B-Instruct',
  ai_model_smart: 'Pro/claude-sonnet-4-5',
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (data) setSettings({
        ai_provider: data.ai_provider,
        ai_base_url: data.ai_base_url,
        ai_api_key: data.ai_api_key,
        ai_model_fast: data.ai_model_fast,
        ai_model_smart: data.ai_model_smart,
      })
      setLoading(false)
    })
  }, [router])

  function handleProviderChange(providerId: string) {
    const provider = PROVIDERS.find(p => p.id === providerId)
    if (!provider) return
    const firstModel = provider.models[0]?.id ?? ''
    setSettings(prev => ({
      ...prev,
      ai_provider: providerId,
      ai_base_url: provider.baseURL,
      ai_model_fast: provider.models[1]?.id ?? firstModel,
      ai_model_smart: firstModel,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() })

      if (upsertError) throw upsertError
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const currentProvider = PROVIDERS.find(p => p.id === settings.ai_provider)

  if (loading) {
    return (
      <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
        <p className="text-zinc-400 animate-pulse">加载中...</p>
      </main>
    )
  }

  return (
    <main className="w-full px-4 sm:px-8 md:px-12 lg:px-20 xl:px-32 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回首页
        </Link>
      </header>

      <h2 className="text-xl font-bold mb-6">AI 设置</h2>

      <div className="max-w-xl space-y-6">
        {/* 平台选择 */}
        <div>
          <label className="block text-sm font-medium mb-2">AI 平台</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  settings.ai_provider === p.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {settings.ai_provider === 'siliconflow' && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              推荐新用户使用，国内可直接注册，有免费额度。
              <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="underline ml-1">前往注册 →</a>
            </p>
          )}
          {settings.ai_provider === 'deepseek' && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              国内可直接注册使用。
              <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">前往注册 →</a>
            </p>
          )}
          {settings.ai_provider === 'aliyun' && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              需要阿里云账号，前往百炼控制台申请 API Key。
              <a href="https://bailian.console.aliyun.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">前往控制台 →</a>
            </p>
          )}
        </div>

        {/* Base URL（自定义时显示） */}
        {settings.ai_provider === 'custom' && (
          <div>
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              type="text"
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="https://api.example.com/v1"
              value={settings.ai_base_url}
              onChange={e => setSettings(prev => ({ ...prev, ai_base_url: e.target.value }))}
            />
          </div>
        )}

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 pr-16"
              placeholder="粘贴你的 API Key..."
              value={settings.ai_api_key}
              onChange={e => setSettings(prev => ({ ...prev, ai_api_key: e.target.value }))}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Key 保存在服务器，不会泄露给其他用户</p>
        </div>

        {/* 模型选择 */}
        {currentProvider && currentProvider.models.length > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">主力模型（用于分析、评估）</label>
              <select
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none"
                value={settings.ai_model_smart}
                onChange={e => setSettings(prev => ({ ...prev, ai_model_smart: e.target.value }))}
              >
                {currentProvider.models.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">快速模型（用于摘要、推荐）</label>
              <select
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none"
                value={settings.ai_model_fast}
                onChange={e => setSettings(prev => ({ ...prev, ai_model_fast: e.target.value }))}
              >
                {currentProvider.models.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* 自定义模型名 */}
        {settings.ai_provider === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">主力模型名称</label>
              <input
                type="text"
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none"
                placeholder="gpt-4o"
                value={settings.ai_model_smart}
                onChange={e => setSettings(prev => ({ ...prev, ai_model_smart: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">快速模型名称</label>
              <input
                type="text"
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none"
                placeholder="gpt-4o-mini"
                value={settings.ai_model_fast}
                onChange={e => setSettings(prev => ({ ...prev, ai_model_fast: e.target.value }))}
              />
            </div>
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !settings.ai_api_key.trim()}
          className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
        </button>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          未配置时使用系统默认 AI，配置后优先使用你自己的 Key
        </p>
      </div>
    </main>
  )
}
