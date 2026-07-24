import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const DAILY_LIMIT = 10
const GUEST_LIMIT = 3
const RATE_WINDOW_SECONDS = 60
const RATE_MAX_REQUESTS = 15

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
  userId: string | null
  limitMessage: string
}

export async function checkAndRecordUsage(action: string): Promise<UsageCheckResult> {
  // 本地开发环境跳过限流
  if (process.env.SKIP_USAGE_LIMIT === '1') {
    return { allowed: true, remaining: 999, usingOwnKey: true, userId: null, limitMessage: '' }
  }
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const headersList = await headers()
  const rawIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ip = /^[\w.:]{1,64}$/.test(rawIp) ? rawIp : 'unknown'

  const supabase = getServiceClient()

  // 使用原子 RPC，一次 DB 往返完成所有检查和记录
  const { data, error } = await supabase.rpc('check_and_record_usage', {
    p_user_id: user?.id ?? null,
    p_ip: ip,
    p_action: action,
    p_daily_limit: DAILY_LIMIT,
    p_guest_limit: GUEST_LIMIT,
    p_rate_limit: RATE_MAX_REQUESTS,
    p_rate_window_seconds: RATE_WINDOW_SECONDS,
  })

  // RPC 失败时拒绝请求，避免计费绕过
  if (error) {
    console.error('[usage] RPC error:', error.message)
    return {
      allowed: false,
      remaining: 0,
      usingOwnKey: false,
      userId: user?.id ?? null,
      limitMessage: '服务暂时不可用，请稍后再试',
    }
  }

  const result = data as { allowed: boolean; remaining: number; own_key: boolean; rate_limited?: boolean }

  if (!result.allowed) {
    const isRateLimited = result.rate_limited
    const isLoggedIn = !!user
    const limitMessage = isRateLimited
      ? `请求过于频繁，请 ${RATE_WINDOW_SECONDS} 秒后再试`
      : isLoggedIn
        ? `今日免费额度已用完（每天 ${DAILY_LIMIT} 次），请前往「AI 设置」配置自己的 API Key 可无限使用`
        : `游客每天最多使用 ${GUEST_LIMIT} 次，注册登录后每天可使用 ${DAILY_LIMIT} 次`
    return { allowed: false, remaining: 0, usingOwnKey: false, userId: user?.id ?? null, limitMessage }
  }

  return {
    allowed: true,
    remaining: result.remaining,
    usingOwnKey: result.own_key,
    userId: user?.id ?? null,
    limitMessage: '',
  }
}

export async function getTodayUsage(): Promise<{ used: number; limit: number; usingOwnKey: boolean }> {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return { used: 0, limit: GUEST_LIMIT, usingOwnKey: false }

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
