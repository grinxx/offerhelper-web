import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/crypto'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: {
    ai_provider?: string
    ai_base_url?: string
    ai_api_key?: string
    ai_model_fast?: string
    ai_model_smart?: string
  } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 只更新非空字段，空 Key 不覆盖已有加密 Key
  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    ai_provider: body.ai_provider,
    ai_base_url: body.ai_base_url,
    ai_model_fast: body.ai_model_fast,
    ai_model_smart: body.ai_model_smart,
    updated_at: new Date().toISOString(),
  }

  if (body.ai_api_key) {
    try {
      upsertData.ai_api_key = encrypt(body.ai_api_key)
    } catch {
      return Response.json({ error: '服务端加密配置缺失，请联系管理员' }, { status: 500 })
    }
  }
  // body.ai_api_key 为空时不更新 ai_api_key 字段（保留旧值）
  // 用户主动清除 Key 应通过专用「清除 Key」接口（将字段设为空字符串）

  const { error } = await supabase.from('user_settings').upsert(upsertData)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
