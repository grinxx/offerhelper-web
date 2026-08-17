import { createClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'

export const runtime = 'nodejs'

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

async function getUser() {
  const supabase = await createSessionClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// GET /api/settings/tokens — list active tokens for the current user
export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('api_tokens')
    .select('id, name, prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tokens: data })
}

// POST /api/settings/tokens — create a new token
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let name = 'Default Token'
  try {
    const body = await request.json()
    if (body.name) name = String(body.name).slice(0, 64)
  } catch {}

  // Generate a secure random token: oh_<32 random hex chars>
  const raw = 'oh_' + randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 11) // "oh_" + first 8 hex chars

  const { data, error } = await serviceClient()
    .from('api_tokens')
    .insert({ user_id: user.id, name, token_hash: hash, prefix })
    .select('id, name, prefix, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Return the raw token ONCE — never stored, only the hash is kept
  return Response.json({ token: raw, meta: data }, { status: 201 })
}

// DELETE /api/settings/tokens?id=<token_id> — revoke a token
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { error } = await serviceClient()
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
