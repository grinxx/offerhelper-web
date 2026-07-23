import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { case_id?: string; suggestion_index?: number; rating?: number } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { case_id, suggestion_index, rating } = body
  if (!case_id || suggestion_index === undefined || (rating !== 1 && rating !== -1)) {
    return Response.json({ error: '参数错误' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.from('suggestion_feedback').upsert({
    user_id: user.id,
    case_id,
    suggestion_index,
    rating,
  })

  return Response.json({ ok: true })
}
