'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'

function ChangePasswordSection() {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleChange() {
    if (newPassword.length < 6) { setMsg({ type: 'err', text: '密码至少 6 位' }); return }
    if (newPassword !== confirm) { setMsg({ type: 'err', text: '两次密码不一致' }); return }
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setMsg({ type: 'err', text: error.message })
    } else {
      setMsg({ type: 'ok', text: '密码已修改成功，建议重新登录以确保所有设备同步' })
      setNewPassword('')
      setConfirm('')
      setTimeout(() => { setOpen(false); setMsg(null) }, 3000)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <span className="font-medium">修改密码</span>
        <span className="text-xs text-zinc-400">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">新密码</label>
            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">确认新密码</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleChange() }}
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="再次输入新密码"
            />
          </div>
          {msg && (
            <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {msg.text}
            </p>
          )}
          <button
            onClick={handleChange}
            disabled={saving || !newPassword || !confirm}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {saving ? '修改中...' : '确认修改'}
          </button>
        </div>
      )}
    </div>
  )
}
import { PROVIDERS } from '@/lib/ai-providers'

interface ApiToken {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
}

function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null) // the raw token shown once
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchTokens = useCallback(async () => {
    const res = await fetch('/api/settings/tokens')
    if (res.ok) {
      const data = await res.json()
      setTokens(data.tokens ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (open) fetchTokens() }, [open, fetchTokens])

  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/settings/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTokenName.trim() || 'Default Token' }),
    })
    setCreating(false)
    if (!res.ok) return
    const data = await res.json()
    setRevealed(data.token)
    setNewTokenName('')
    fetchTokens()
  }

  async function handleRevoke(id: string) {
    if (!confirm('确认撤销这个 Token？撤销后无法恢复。')) return
    await fetch(`/api/settings/tokens?id=${id}`, { method: 'DELETE' })
    setTokens(prev => prev.filter(t => t.id !== id))
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <span className="font-medium">开发者 Token（MCP / API 调用）</span>
        <span className="text-xs text-zinc-400">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            用于 MCP Server 或直接调用 OfferHelper API。Token 只在生成时显示一次，请妥善保管。
          </p>

          {/* 生成新 Token */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenName}
              onChange={e => setNewTokenName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Token 备注名（可选）"
              className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 px-4 py-2 rounded text-sm font-medium disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {creating ? '生成中...' : '生成 Token'}
            </button>
          </div>

          {/* 一次性展示新 Token */}
          {revealed && (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                ⚠️ 请立即复制，此 Token 不会再次显示
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono break-all text-zinc-700 dark:text-zinc-300">
                  {revealed}
                </code>
                <button
                  onClick={() => handleCopy(revealed)}
                  className="shrink-0 text-xs border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              </div>
              <button
                onClick={() => setRevealed(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                我已保存，关闭
              </button>
            </div>
          )}

          {/* Token 列表 */}
          {loading ? (
            <p className="text-xs text-zinc-400 animate-pulse">加载中...</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-zinc-400">暂无 Token</p>
          ) : (
            <div className="space-y-2">
              {tokens.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-zinc-400 font-mono">{t.prefix}••••••••</p>
                    <p className="text-xs text-zinc-400">
                      创建于 {new Date(t.created_at).toLocaleDateString('zh-CN')}
                      {t.last_used_at && (
                        <> · 最近使用 {new Date(t.last_used_at).toLocaleDateString('zh-CN')}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(t.id)}
                    className="shrink-0 ml-3 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                  >
                    撤销
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 配置示例 */}
          <details className="text-xs text-zinc-400 dark:text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
              查看 Claude Desktop 配置示例
            </summary>
            <pre className="mt-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-3 overflow-x-auto text-zinc-600 dark:text-zinc-400 leading-relaxed">{`{
  "mcpServers": {
    "offerhelper": {
      "command": "npx",
      "args": ["@offerhelper/mcp"],
      "env": {
        "OFFERHELPER_TOKEN": "oh_你的token"
      }
    }
  }
}`}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

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
  const [originalProvider, setOriginalProvider] = useState('siliconflow')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setSettings({
          ai_provider: data.ai_provider,
          ai_base_url: data.ai_base_url,
          ai_api_key: data.ai_api_key,
          ai_model_fast: data.ai_model_fast,
          ai_model_smart: data.ai_model_smart,
        })
        setOriginalProvider(data.ai_provider)  // 记录加载时的原始 provider
      }
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

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setError('')
    try {
      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: settings.ai_base_url,
          api_key: settings.ai_api_key,
          model: settings.ai_model_fast,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestResult('ok')
      } else {
        setTestResult('fail')
        setError(data.error ?? '连接失败')
      }
    } catch {
      setTestResult('fail')
      setError('网络请求失败')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    // 切换了 provider 但 Key 为空时，提醒用户填入新 Key（用原始 provider 比较，避免误报）
    if (!settings.ai_api_key.trim() && settings.ai_provider !== originalProvider) {
      setError('切换 AI 平台后请同时填入对应的 API Key，否则 AI 功能无法正常使用')
      return  // 必须 return，否则后续 setError('') 会立即清除警告
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '保存失败')
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
      <main className="w-full px-4 sm:px-6 py-10 max-w-2xl mx-auto">
        <p className="text-zinc-400 animate-pulse">加载中...</p>
      </main>
    )
  }

  return (
    <main className="w-full px-4 sm:px-6 py-10 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Logo />
        <Link href="/" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回首页
        </Link>
      </header>

      <h2 className="text-xl font-bold mb-6">AI 设置</h2>

      <div className="space-y-6">
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
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 border-zinc-900 dark:border-zinc-100'
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
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">常用 Base URL 参考：</p>
              {[
                { label: '硅基流动', url: 'https://api.siliconflow.cn/v1', note: '国内推荐' },
                { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', note: '国内可用' },
                { label: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', note: '国内可用' },
                { label: 'OpenAI 官方', url: 'https://api.openai.com/v1', note: '需翻墙' },
                { label: 'Groq', url: 'https://api.groq.com/openai/v1', note: '免费额度大，需翻墙' },
              ].map(item => (
                <div key={item.url} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-600 dark:text-zinc-300 shrink-0">{item.label}</span>
                    <span className="text-zinc-300 dark:text-zinc-600 truncate">{item.url}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 shrink-0">{item.note}</span>
                  </div>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, ai_base_url: item.url }))}
                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 ml-2 shrink-0 transition-colors"
                  >
                    填入
                  </button>
                </div>
              ))}
            </div>
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
          {settings.ai_api_key && (
            <button
              onClick={async () => {
                if (!confirm('确认清除 API Key？清除后将使用系统默认 AI。')) return
                const res = await fetch('/api/settings', { method: 'DELETE' })
                if (res.ok) {
                  setSettings(prev => ({ ...prev, ai_api_key: '' }))
                  setSaved(true)
                  setTimeout(() => setSaved(false), 2000)
                } else {
                  setError('清除失败，请重试')
                }
              }}
              className="mt-1 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              清除 Key
            </button>
          )}
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

        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !settings.ai_api_key.trim()}
            className="flex-1 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {testing ? '测试中...' : testResult === 'ok' ? '✓ 连接成功' : testResult === 'fail' ? '✕ 连接失败' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          未配置时使用系统默认 AI，配置后优先使用你自己的 Key
        </p>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <ChangePasswordSection />

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <ApiTokensSection />
      </div>
    </main>
  )
}
