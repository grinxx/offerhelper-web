import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const STATUS_LABELS: Record<string, string> = {
  submitted: '已投递',
  viewed: '已查看',
  interview_scheduled: '约面试',
  interviewed: '已面试',
  offer: '收到 Offer',
  rejected: '已拒绝',
  withdrawn: '已撤回',
}

export async function GET(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, count } = await supabase
    .from('applications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('applied_at', { ascending: false })
    .range(from, to)

  return Response.json({ applications: data ?? [], total: count ?? 0, page, limit })
}

export async function POST(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { company?: string; position?: string; platform?: string; applied_at?: string; status?: string; note?: string; case_id?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.company?.trim() || !body.position?.trim()) {
    return Response.json({ error: '公司和岗位为必填项' }, { status: 400 })
  }

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('applications').insert({
    user_id: user.id,
    company: body.company,
    position: body.position,
    platform: body.platform ?? '',
    applied_at: body.applied_at ?? new Date().toISOString().slice(0, 10),
    status: body.status ?? 'submitted',
    note: body.note ?? '',
    case_id: body.case_id ?? null,
  }).select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}

export async function PATCH(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { id?: string; status?: string; note?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.id) return Response.json({ error: '缺少 id' }, { status: 400 })

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await supabase.from('applications')
    .update({ status: body.status, note: body.note, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: '缺少 id' }, { status: 400 })

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await supabase.from('applications').delete().eq('id', id).eq('user_id', user.id)
  return Response.json({ ok: true })
}
