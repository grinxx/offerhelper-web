import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { UserExperience } from '@/types'

export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('user_experiences')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: '查询失败' }, { status: 500 })
  return Response.json({ experiences: data as UserExperience[] })
}

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  let body: { content?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const content = body.content?.trim()
  if (!content) return Response.json({ error: '内容不能为空' }, { status: 400 })
  if (content.length > 500) return Response.json({ error: '内容不能超过 500 字' }, { status: 400 })

  const supabase = serviceClient()

  // 上限检查：超出 100 条时删除最旧的
  const { count } = await supabase
    .from('user_experiences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 100) {
    const { data: oldest } = await supabase
      .from('user_experiences')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (oldest?.[0]) {
      await supabase.from('user_experiences').delete().eq('id', oldest[0].id)
    }
  }

  const { data, error } = await supabase
    .from('user_experiences')
    .insert({ user_id: user.id, source: 'manual', content })
    .select('*')
    .single()

  if (error) return Response.json({ error: '添加失败' }, { status: 500 })
  return Response.json({ experience: data as UserExperience })
}
