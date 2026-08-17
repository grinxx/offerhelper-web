import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

export interface TokenUser {
  id: string
  email?: string
}

/**
 * Validate an API token from the Authorization header.
 * Returns the associated user if valid, null otherwise.
 *
 * Usage in API routes:
 *   const tokenUser = await validateBearerToken(request)
 *   if (!tokenUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function validateBearerToken(request: Request): Promise<TokenUser | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const raw = authHeader.slice(7).trim()
  if (!raw.startsWith('oh_')) return null

  const hash = createHash('sha256').update(raw).digest('hex')

  const { data, error } = await serviceClient()
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .single()

  if (error || !data) return null

  // Update last_used_at without blocking the response
  serviceClient()
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { id: data.user_id }
}
