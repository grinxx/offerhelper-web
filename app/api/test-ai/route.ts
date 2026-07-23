import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_HOSTS = [
  'api.siliconflow.cn',
  'api.deepseek.com',
  'dashscope.aliyuncs.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.groq.com',
]

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

  let body: { base_url?: string; api_key?: string; model?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { base_url, api_key, model } = body
  if (!base_url || !api_key || !model) {
    return Response.json({ error: '缺少必填参数' }, { status: 400 })
  }

  // 防 SSRF：只允许白名单域名
  try {
    const hostname = new URL(base_url).hostname
    if (!ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return Response.json({ error: '不支持的 API 地址，请使用已知服务商' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Base URL 格式不正确' }, { status: 400 })
  }

  const isAnthropic = base_url.includes('localhost') || base_url.includes('anthropic.com')

  try {
    if (isAnthropic) {
      const client = new Anthropic({ baseURL: base_url, apiKey: api_key })
      await client.messages.create({
        model, max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      })
    } else {
      const client = new OpenAI({ baseURL: base_url, apiKey: api_key })
      await client.chat.completions.create({
        model, max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      })
    }
    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const friendly = msg.includes('401') ? 'API Key 无效或已过期'
      : msg.includes('404') ? '模型名称不正确'
      : msg.includes('insufficient') ? '账户余额不足'
      : `连接失败：${msg.slice(0, 80)}`
    return Response.json({ error: friendly }, { status: 400 })
  }
}
