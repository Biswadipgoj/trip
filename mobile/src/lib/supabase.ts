// Data client. It talks to the TripMate server's /api/sb proxy, never to the
// database directly: the proxy checks this phone's access token and only lets
// it reach its own trips. Null when the build has no server URL — the app then
// runs local-only (single device).
import 'react-native-url-polyfill/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { WEB_URL } from './config'
import { accessToken, expireAccessToken, isServerConfigured, refreshSession } from './session'

// React Native's fetch never times out on its own: one stalled request on a
// flaky mobile network would otherwise block the sync loop forever.
const REQUEST_TIMEOUT_MS = 25_000
const UPLOAD_TIMEOUT_MS = 90_000

function isBinaryBody(body: unknown): boolean {
  return body instanceof ArrayBuffer || ArrayBuffer.isView(body)
    || (typeof Blob !== 'undefined' && body instanceof Blob)
}

const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  const controller = new AbortController()
  const timeoutMs = isBinaryBody(init.body) ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const upstream = init.signal
  if (upstream) {
    if (upstream.aborted) controller.abort()
    else upstream.addEventListener('abort', () => controller.abort())
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function withSession(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  headers.delete('apikey')
  headers.set('x-tm-client', 'app')
  if (token) headers.set('x-tm-access', token)
  return { ...init, headers }
}

/** Adds the access token; on 401 renews it once and retries. */
const sessionFetch: typeof fetch = async (input, init = {}) => {
  const res = await fetchWithTimeout(input, withSession(init, await accessToken()))
  if (res.status !== 401) return res
  expireAccessToken()
  if (!(await refreshSession())) return res
  return fetchWithTimeout(input, withSession(init, await accessToken()))
}

function create(): SupabaseClient | null {
  if (!isServerConfigured) return null
  try {
    return createClient(`${WEB_URL}/api/sb`, 'tripmate-app', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: sessionFetch },
    })
  } catch (err) {
    console.warn('[supabase] could not create client — running local-only:', err)
    return null
  }
}

export const supabase = create()
export const isSupabaseConfigured = supabase !== null
