import { NextResponse, type NextRequest } from 'next/server'
import type { AccessClaims } from '@/lib/auth/tokens'
import { authContext, claimsOf, isAppClient, isSameOrigin, isUuid, json } from '@/lib/server/authHttp'
import { PASS_HEADER, dbKeyHex, ensureDbKey, signTripPass } from '@/lib/server/tripPass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The only way the web and Android apps reach trip data.
//
//   /api/sb/rest/v1/<table>…     → Supabase REST with the public key plus a
//                                   trip pass for the caller's trips; the
//                                   database's row rules do the rest.
//   /api/sb/storage/v1/…          → Supabase Storage with the service key, but
//                                   only for photo paths inside the caller's
//                                   trips (checked here).
//
// The caller is the browser's httpOnly session cookie, or the app's
// x-tm-access header. Nothing the client sends can widen its trips.

const TABLES = new Set([
  'trips', 'members', 'expenses', 'expense_participants', 'hotel_expenses', 'rooms', 'room_occupants',
  'settlement_groups', 'settlement_group_members', 'sponsorships', 'settlements', 'attachments',
  'member_balances', 'trip_summary',
])
const RPCS = new Set(['tm_push_expense', 'tm_push_hotel_expense', 'tm_push_settlement_group'])

const BUCKET = 'trip-media'
const MEDIA_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(bills|payments|payment_proofs)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/
const MAX_BODY_BYTES = 4 * 1024 * 1024

// Deliberately not accept-profile / content-profile: the apps only use the
// public schema, and those headers would let a caller aim at another one.
const FORWARD_REQUEST_HEADERS = [
  'accept', 'content-type', 'prefer', 'range', 'range-unit', 'x-client-info', 'x-upsert', 'cache-control',
]
const FORWARD_RESPONSE_HEADERS = [
  'content-type', 'content-range', 'preference-applied', 'location', 'etag', 'last-modified',
  'accept-ranges', 'content-location',
]

type Ctx = { params: Promise<{ path: string[] }> }

const error = (status: number, message: string, code = `TM${status}`) =>
  json({ message, code, error: message, statusCode: String(status) }, status)

function tripsOf(claims: AccessClaims): Set<string> {
  return new Set(claims.ms.map(m => m.tripId.toLowerCase()))
}

function mediaTrip(path: string, trips: Set<string>): boolean {
  const m = MEDIA_PATH.exec(path)
  return !!m && trips.has(m[1])
}

function passThrough(upstream: Response, extra?: Record<string, string>) {
  const headers = new Headers()
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('Cache-Control', 'private, no-store')
  for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v)
  return new NextResponse(upstream.body, { status: upstream.status, headers })
}

async function readBody(req: NextRequest): Promise<ArrayBuffer | undefined | null> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  const buf = await req.arrayBuffer()
  return buf.byteLength > MAX_BODY_BYTES ? null : buf
}

function forwardHeaders(req: NextRequest): Headers {
  const headers = new Headers()
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }
  return headers
}

async function handle(req: NextRequest, { params }: Ctx) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const secret = process.env.SESSION_SECRET
  const ctx = authContext()
  if (!ctx || !supabaseUrl || !anonKey || !serviceKey || !secret) return error(503, 'Sync is not configured on this server.')

  const segs = (await params).path ?? []
  if (segs.some(s => s === '' || s === '.' || s === '..' || s.includes('\\'))) return error(400, 'Bad path.')
  const [service, version, ...rest] = segs
  if (version !== 'v1') return error(404, 'Not found.')

  // Signed photo links carry their own token (checked by Storage); no session needed.
  if (service === 'storage' && req.method === 'GET' && rest[0] === 'object' && rest[1] === 'sign' && rest[2] === BUCKET) {
    const path = rest.slice(3).join('/')
    if (!MEDIA_PATH.test(path) || !req.nextUrl.searchParams.get('token')) return error(404, 'Not found.')
    const url = `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}?token=${encodeURIComponent(req.nextUrl.searchParams.get('token')!)}`
    const upstream = await fetch(url, { headers: { apikey: anonKey } })
    return passThrough(upstream, upstream.ok ? { 'Cache-Control': 'private, max-age=3600' } : undefined)
  }

  const app = isAppClient(req)
  // Cookie-authenticated writes must come from our own pages (CSRF).
  if (!app && req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) return error(403, 'Forbidden.')

  const claims = await claimsOf(req, ctx.key)
  if (!claims || claims.ms.length === 0) {
    // An <img> can't refresh by itself: send the browser through the refresh
    // route and back here. Everything else gets a 401 and refreshes in code.
    if (!app && req.method === 'GET' && service === 'storage') {
      const target = new URL('/api/auth/refresh', req.url)
      target.searchParams.set('next', req.nextUrl.pathname)
      return NextResponse.redirect(target)
    }
    return error(401, 'Session expired. Log in again.', 'PGRST301')
  }
  const trips = tripsOf(claims)

  const body = await readBody(req)
  if (body === null) return error(413, 'That file is too large.')

  // ── Database ────────────────────────────────────────────────────────────────
  if (service === 'rest') {
    const allowed = rest.length === 1 ? TABLES.has(rest[0]) : rest.length === 2 && rest[0] === 'rpc' && RPCS.has(rest[1])
    if (!allowed) return error(404, 'Not found.')
    await ensureDbKey(ctx.db, dbKeyHex(secret))
    const pass = signTripPass([...trips], dbKeyHex(secret))
    if (!pass) return error(401, 'Session expired. Log in again.', 'PGRST301')

    const headers = forwardHeaders(req)
    headers.set('apikey', anonKey)
    headers.set('Authorization', `Bearer ${anonKey}`)
    headers.set(PASS_HEADER, pass)
    const upstream = await fetch(`${supabaseUrl}/rest/v1/${rest.join('/')}${req.nextUrl.search}`, {
      method: req.method, headers, body,
    })
    return passThrough(upstream)
  }

  // ── Photos ──────────────────────────────────────────────────────────────────
  if (service === 'storage' && rest[0] === 'object') {
    const serviceHeaders = (h: Headers) => {
      h.set('apikey', serviceKey)
      h.set('Authorization', `Bearer ${serviceKey}`)
      return h
    }
    const [, kind, bucket, ...pathParts] = rest

    // View: GET/HEAD object/public|authenticated/trip-media/<path>
    if ((req.method === 'GET' || req.method === 'HEAD') && (kind === 'public' || kind === 'authenticated') && bucket === BUCKET) {
      const path = pathParts.join('/')
      if (!mediaTrip(path, trips)) return error(404, 'Not found.')
      const upstream = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${path}`, {
        method: req.method, headers: serviceHeaders(new Headers()),
      })
      // Photo paths are unique per image, so the browser may keep them.
      return passThrough(upstream, upstream.ok ? { 'Cache-Control': 'private, max-age=86400, immutable' } : undefined)
    }

    // Signed link: POST object/sign/trip-media/<path>
    if (req.method === 'POST' && kind === 'sign' && bucket === BUCKET) {
      const path = pathParts.join('/')
      if (!mediaTrip(path, trips)) return error(404, 'Not found.')
      const headers = serviceHeaders(forwardHeaders(req))
      const upstream = await fetch(`${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}`, { method: 'POST', headers, body })
      return passThrough(upstream)
    }

    // Exists check: POST object/list/trip-media { prefix }
    if (req.method === 'POST' && kind === 'list' && bucket === BUCKET && pathParts.length === 0) {
      let parsed: any = null
      try { parsed = JSON.parse(new TextDecoder().decode(body!)) } catch { /* rejected below */ }
      const prefix = typeof parsed?.prefix === 'string' ? parsed.prefix.replace(/\/+$/, '') : ''
      const trip = prefix.split('/')[0]
      if (!isUuid(trip) || !trips.has(trip.toLowerCase()) || !/^[0-9a-f-]{36}\/(bills|payments|payment_proofs)$/.test(prefix)) {
        return error(404, 'Not found.')
      }
      const headers = serviceHeaders(forwardHeaders(req))
      const upstream = await fetch(`${supabaseUrl}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers, body })
      return passThrough(upstream)
    }

    // Upload: POST/PUT object/trip-media/<path>
    if ((req.method === 'POST' || req.method === 'PUT') && kind === BUCKET) {
      const path = [bucket, ...pathParts].join('/')
      if (!mediaTrip(path, trips)) return error(403, 'You can only add photos to your own trips.')
      const type = req.headers.get('content-type') ?? ''
      if (!/^image\/(jpeg|png|webp)$/.test(type) && !/^multipart\/form-data/.test(type)) return error(415, 'Only photos can be uploaded.')
      const headers = serviceHeaders(forwardHeaders(req))
      const upstream = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, { method: req.method, headers, body })
      return passThrough(upstream)
    }

    // Remove: DELETE object/trip-media { prefixes } — only photos no attachment row points at.
    if (req.method === 'DELETE' && kind === BUCKET && bucket === undefined) {
      let parsed: any = null
      try { parsed = JSON.parse(new TextDecoder().decode(body!)) } catch { /* rejected below */ }
      const prefixes: unknown = parsed?.prefixes
      if (!Array.isArray(prefixes) || prefixes.length === 0 || prefixes.length > 50) return error(400, 'Bad request.')
      if (!prefixes.every(p => typeof p === 'string' && mediaTrip(p, trips))) return error(403, 'You can only remove photos from your own trips.')
      const { data: inUse, error: useErr } = await ctx.db.from('attachments').select('storage_path').in('storage_path', prefixes)
      if (useErr) return error(502, 'Could not check the photos. Try again.')
      const busy = new Set((inUse ?? []).map(r => r.storage_path as string))
      const removable = (prefixes as string[]).filter(p => !busy.has(p))
      if (removable.length === 0) return json([])
      const headers = serviceHeaders(forwardHeaders(req))
      headers.set('content-type', 'application/json')
      const upstream = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
        method: 'DELETE', headers, body: JSON.stringify({ prefixes: removable }),
      })
      return passThrough(upstream)
    }
  }

  return error(404, 'Not found.')
}

export { handle as GET, handle as HEAD, handle as POST, handle as PUT, handle as PATCH, handle as DELETE }
