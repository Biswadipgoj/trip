// Supabase client. Null when the build has no Supabase credentials — the app
// then runs local-only (single device), exactly like the web app does.
import 'react-native-url-polyfill/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

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

function create(): SupabaseClient | null {
  if (!/^https?:\/\/\S+/.test(SUPABASE_URL) || SUPABASE_ANON_KEY.length < 20) return null
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout },
    })
  } catch (err) {
    console.warn('[supabase] could not create client — running local-only:', err)
    return null
  }
}

export const supabase = create()
export const isSupabaseConfigured = supabase !== null
