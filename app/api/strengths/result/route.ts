import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAIClientForRequest } from '@/lib/ai-client'
import { checkAndRecordUsage } from '@/lib/usage'
import { STRENGTHS_RESULT_SYSTEM, buildStrengthsResultPrompt } from '@/lib/prompts'
import type { StrengthsResult } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { session_id?: string | null; messages?: { role: string; content: string }[]; jd_text?: string | null } = {}
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null } = body
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const usage = await checkAndRecordUsage('strengths_result')
  if (!usage.allowed) {
    return new Response(JSON.stringify({ error: '今日免费额度已用完（每天 10 次），请前往「AI 设置」配置自己的 API Key 可无限使用', code: 'LIMIT_EXCEEDED' }), { status: 429 })
  }

  const { chat, config } = await getAIClientForRequest(usage.userId)

  let result: StrengthsResult
  try {
    const raw = await chat.complete(
      [
        { role: 'system', content: STRENGTHS_RESULT_SYSTEM },
        { role: 'user', content: buildStrengthsResultPrompt(messages, jd_text) },
      ],
      config.modelSmart,
      2048
    )
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned)
    if (!Array.isArray(result.strengths) || !result.summary) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: '优势提炼失败，请重试' }), { status: 500 })
  }

  if (user && session_id) {
    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await supabase.from('strength_sessions').update({ result, messages, status: 'done' })
      .eq('id', session_id).eq('user_id', user.id)
  }

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
