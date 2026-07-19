'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

const TABLE_MAP: Record<RecordType, string> = {
  analysis: 'cases',
  interview: 'interview_sessions',
  strengths: 'strength_sessions',
  match: 'match_sessions',
}

export async function deleteRecord(id: string, type: RecordType) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const table = TABLE_MAP[type]
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
}
