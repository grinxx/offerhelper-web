import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const DAILY_LIMIT = 10

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export interface UsageCheckResult {
  allowed: boolean
  remaining: number
  usingOwnKey: boolean
}

export async function checkAndRecordUsage(action: string): Promise<UsageCheckResult> {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  // 用户配置了自己的 Key，不受限制
  if (user) {
    const supabase = getServiceClient()
    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_api_key')
      .eq('user_id', user.id)
      .single()

    if (settings?.ai_api_key) {
      return { allowed: true, remaining: Infinity, usingOwnKey: true }
    }
  }

  const supabase = getServiceClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const since = todayStart()

  // 按 user_id 或 IP 统计今日使用次数
  let count = 0
  if (user) {
    const { count: c } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    count = c ?? 0
  } else {
    const { count: c } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .is('user_id', null)
      .gte('created_at', since)
    count = c ?? 0
  }

  if (count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0, usingOwnKey: false }
  }

  // 记录本次使用
  await supabase.from('usage_logs').insert({
    user_id: user?.id ?? null,
    ip: user ? null : ip,
    action,
  })

  return { allowed: true, remaining: DAILY_LIMIT - count - 1, usingOwnKey: false }
}

export async function getTodayUsage(): Promise<{ used: number; limit: number; usingOwnKey: boolean }> {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return { used: 0, limit: DAILY_LIMIT, usingOwnKey: false }

  const supabase = getServiceClient()

  const { data: settings } = await supabase
    .from('user_settings')
    .select('ai_api_key')
    .eq('user_id', user.id)
    .single()

  if (settings?.ai_api_key) {
    return { used: 0, limit: Infinity, usingOwnKey: true }
  }

  const { count } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart())

  return { used: count ?? 0, limit: DAILY_LIMIT, usingOwnKey: false }
}
