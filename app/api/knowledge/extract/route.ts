import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import type { ChatMessage } from '@/types'

export const runtime = 'nodejs'

const EXTRACT_SYSTEM = `你是一个信息提取助手。从对话记录中提取用户描述的真实经历片段，每条用一句话概括（不超过 100 字），突出：做了什么、用了什么方法、取得了什么结果。只提取有实质内容的经历，不提取泛泛而谈的内容。输出严格的 JSON 数组，格式：["经历1", "经历2"]，最多 5 条，不输出任何其他文字。`

function buildExtractPrompt(messages: ChatMessage[]): string {
  const conversation = messages
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
    .join('\n\n')
  return `以下是用户在优势挖掘对话中描述的内容，提取其中的真实经历片段：\n\n${conversation}`
}

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { user_id?: string; session_id?: string; messages?: ChatMessage[] } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { user_id, session_id, messages } = body

  if (user_id !== user.id) return Response.json({ error: '无权操作' }, { status: 403 })
  if (!user_id || !session_id || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 检查该 session 是否已提取过（避免重复）
  const { count: existing } = await supabase
    .from('user_experiences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .eq('source_id', session_id)

  if ((existing ?? 0) > 0) {
    return Response.json({ ok: true, count: 0, skipped: true })
  }

  const { chat, config } = await getAIClientForRequest(user_id)

  let extracted: string[] = []
  try {
    const raw = await chat.complete(
      [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: buildExtractPrompt(messages) },
      ],
      config.modelFast,
      512
    )
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      extracted = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
    }
  } catch {
    return Response.json({ error: 'AI 提取失败' }, { status: 500 })
  }

  if (extracted.length === 0) return Response.json({ ok: true, count: 0 })

  // 上限检查：超出 100 条时批量删最旧的
  const { count: total } = await supabase
    .from('user_experiences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)

  const overflow = (total ?? 0) + extracted.length - 100
  if (overflow > 0) {
    const { data: oldest } = await supabase
      .from('user_experiences')
      .select('id')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true })
      .limit(overflow)
    if (oldest && oldest.length > 0) {
      await supabase.from('user_experiences').delete().in('id', oldest.map(r => r.id))
    }
  }

  const rows = extracted.map(content => ({
    user_id,
    source: 'strengths' as const,
    source_id: session_id,
    content,
  }))

  const { error: insertError } = await supabase.from('user_experiences').insert(rows)
  if (insertError) {
    console.error('[knowledge/extract] insert failed:', insertError.message)
    return Response.json({ error: '保存失败' }, { status: 500 })
  }

  return Response.json({ ok: true, count: extracted.length })
}
