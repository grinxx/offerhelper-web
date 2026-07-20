import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { STRENGTHS_RESULT_SYSTEM, buildStrengthsResultPrompt } from '@/lib/prompts'
import type { StrengthsResult } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    session_id?: string | null
    messages?: { role: string; content: string }[]
    jd_text?: string | null
  } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null } = body

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  let result: StrengthsResult
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: STRENGTHS_RESULT_SYSTEM,
      messages: [{ role: 'user', content: buildStrengthsResultPrompt(messages, jd_text) }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned)
    if (!Array.isArray(result.strengths) || !result.summary) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: '优势提炼失败，请重试' }), { status: 500 })
  }

  // Persist if logged in and session exists
  if (user && session_id) {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: updateError } = await supabase
      .from('strength_sessions')
      .update({ result, messages, status: 'done' })
      .eq('id', session_id)
      .eq('user_id', user.id)
    if (updateError) {
      console.error('Failed to persist strength session:', updateError.message)
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
