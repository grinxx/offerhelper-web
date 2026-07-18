import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { case_id } = await request.json()

  if (!case_id) {
    return Response.json({ error: 'case_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

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
