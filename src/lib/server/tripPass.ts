import 'server-only'
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Trip passes: the server's proof to the database of which trips a request
// may touch. Format (checked by public.tm_request_trips() in SQL):
//   v1.<expiry unix seconds>.<trip uuid>[,<trip uuid>...].<hex HMAC-SHA256>
// The key is derived from SESSION_SECRET, so no extra secret has to be set;
// the server stores it in the database (service role only) on first use.

export const PASS_HEADER = 'x-tm-auth'
const PASS_TTL_SECONDS = 120

export function dbKeyHex(sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update('tripmate-db-pass-v1').digest('hex')
}

export function signTripPass(tripIds: string[], keyHex: string, now = Date.now()): string | null {
  const ids = [...new Set(tripIds.map(t => t.toLowerCase()))].filter(t => /^[0-9a-f-]{36}$/.test(t))
  if (ids.length === 0) return null
  const body = `v1.${Math.floor(now / 1000) + PASS_TTL_SECONDS}.${ids.join(',')}`
  const sig = createHmac('sha256', Buffer.from(keyHex, 'hex')).update(body).digest('hex')
  return `${body}.${sig}`
}

let keyReady: Promise<boolean> | null = null
let keyFailedAt = 0

/**
 * Makes sure the database holds the current pass key. Once per server
 * instance; after a failure (e.g. the lock migration has not run yet) it
 * waits a minute before trying again. Requests carry on either way.
 */
export function ensureDbKey(db: SupabaseClient, keyHex: string): Promise<boolean> {
  if (keyReady) return keyReady
  if (Date.now() - keyFailedAt < 60_000) return Promise.resolve(false)
  keyReady = (async () => {
    const { error } = await db.rpc('tm_set_db_key', { p_key: keyHex })
    if (!error) return true
    keyFailedAt = Date.now()
    keyReady = null
    const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message)
    if (!missing) console.error('[sb] could not set the trip pass key:', error.message)
    return false
  })()
  return keyReady
}
