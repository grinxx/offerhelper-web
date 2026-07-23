import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { case_id?: string; suggestion_index?: number; status?: string | null } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { case_id, suggestion_index, status } = body
  if (!case_id || suggestion_index === undefined) {
    return Response.json({ error: '参数错误' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (!status) {
    await supabase.from('suggestion_status')
      .delete()
      .eq('user_id', user.id)
      .eq('case_id', case_id)
      .eq('suggestion_index', suggestion_index)
  } else {
    await supabase.from('suggestion_status').upsert({
      user_id: user.id,
      case_id,
      suggestion_index,
      status,
    })
  }

  return Response.json({ ok: true })
}

export async function GET(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ statuses: {} })

  const { searchParams } = new URL(request.url)
  const case_id = searchParams.get('case_id')
  if (!case_id) return Response.json({ statuses: {} })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase.from('suggestion_status')
    .select('suggestion_index, status')
    .eq('user_id', user.id)
    .eq('case_id', case_id)

  const statuses: Record<number, string> = {}
  for (const row of data ?? []) {
    statuses[row.suggestion_index] = row.status
  }
  return Response.json({ statuses })
}
