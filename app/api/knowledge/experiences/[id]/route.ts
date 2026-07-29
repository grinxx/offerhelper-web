import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return Response.json({ error: '未登录' }, { status: 401 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('user_experiences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: '删除失败' }, { status: 500 })
  return Response.json({ ok: true })
}
