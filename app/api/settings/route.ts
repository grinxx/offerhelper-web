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

  // 无条件更新 provider/baseURL/模型（用户可能先切 provider 再填 Key）
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
  // Key 为空时不更新 ai_api_key（保留旧值），用户通过 DELETE 接口主动清除

  const { error } = await supabase.from('user_settings').upsert(upsertData)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.from('user_settings')
    .update({ ai_api_key: '', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  // data 为空数组表示用户本无 settings 记录，清除等于无操作，仍返回成功
  return Response.json({ ok: true, cleared: (data?.length ?? 0) > 0 })
}

// GET：返回脱敏配置（不返回 Key 密文，只返回是否已配置 Key）
export async function GET() {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('user_settings')
    .select('ai_provider, ai_base_url, ai_model_fast, ai_model_smart, ai_api_key')
    .eq('user_id', user.id)
    .single()

  if (!data) return Response.json({ settings: null })

  return Response.json({
    settings: {
      ai_provider: data.ai_provider,
      ai_base_url: data.ai_base_url,
      ai_model_fast: data.ai_model_fast,
      ai_model_smart: data.ai_model_smart,
      has_key: !!(data.ai_api_key && data.ai_api_key !== ''),
    },
  })
}
