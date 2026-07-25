import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { case_id } = await request.json()

  if (!case_id) {
    return Response.json({ error: 'case_id is required' }, { status: 400 })
  }

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 使用 service client 绕过 RLS，避免 user_id=null 的行因 SELECT policy 不可见导致 UPDATE 静默失败
  // 代码层保证安全：.is('user_id', null) 确保只能认领无主记录
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('cases')
    .update({ user_id: user.id })
    .eq('id', case_id)
    .is('user_id', null)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
