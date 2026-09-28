import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Membership } from '@/lib/auth/tokens'
import type { SessionRepo, SessionRow } from '@/lib/server/sessions'

// Service-role client. Bypasses RLS, so it must only ever run on the server:
// the `server-only` import makes the build fail if a client component imports this.

let client: SupabaseClient | null | undefined

export function supabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  client = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
  return client
}

function rowFrom(r: any): SessionRow {
  return {
    id: r.id,
    refreshHash: r.refresh_hash,
    prevRefreshHash: r.prev_refresh_hash,
    rotatedAt: r.rotated_at,
    memberships: Array.isArray(r.memberships) ? (r.memberships as Membership[]) : [],
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }
}

const COLUMNS = 'id, refresh_hash, prev_refresh_hash, rotated_at, memberships, expires_at, revoked_at'

export class SupabaseSessionRepo implements SessionRepo {
  constructor(private db: SupabaseClient) {}

  async insert(row: { refreshHash: string; memberships: Membership[]; userAgent: string | null; expiresAt: string }) {
    const { data, error } = await this.db
      .from('auth_sessions')
      .insert({ refresh_hash: row.refreshHash, memberships: row.memberships, user_agent: row.userAgent, expires_at: row.expiresAt })
      .select('id')
      .single()
    if (error || !data) throw new Error(`session insert failed: ${error?.message}`)
    return data.id as string
  }

  async findByRefreshHash(hash: string) {
    const { data, error } = await this.db.from('auth_sessions').select(COLUMNS).eq('refresh_hash', hash).maybeSingle()
    if (error) throw new Error(`session lookup failed: ${error.message}`)
    return data ? rowFrom(data) : null
  }

  async findByPrevHash(hash: string) {
    const { data, error } = await this.db.from('auth_sessions').select(COLUMNS).eq('prev_refresh_hash', hash).maybeSingle()
    if (error) throw new Error(`session lookup failed: ${error.message}`)
    return data ? rowFrom(data) : null
  }

  async rotate(id: string, oldHash: string, next: { refreshHash: string; memberships: Membership[]; expiresAt: string; rotatedAt: string }) {
    const { data, error } = await this.db
      .from('auth_sessions')
      .update({
        prev_refresh_hash: oldHash,
        refresh_hash: next.refreshHash,
        memberships: next.memberships,
        expires_at: next.expiresAt,
        rotated_at: next.rotatedAt,
        last_used_at: next.rotatedAt,
      })
      .eq('id', id)
      .eq('refresh_hash', oldHash)
      .is('revoked_at', null)
      .select('id')
    if (error) throw new Error(`session rotate failed: ${error.message}`)
    return (data?.length ?? 0) === 1
  }

  async revoke(id: string, at: string) {
    const { error } = await this.db.from('auth_sessions').update({ revoked_at: at }).eq('id', id)
    if (error) throw new Error(`session revoke failed: ${error.message}`)
  }
}
