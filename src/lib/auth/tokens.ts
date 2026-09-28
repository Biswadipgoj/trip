// Access tokens: short-lived JWTs (HS256) carried in an httpOnly cookie.
// Used by middleware (edge runtime) and API routes, so this file must stay
// free of Node-only APIs. Never import it from client components.

// Narrow imports keep jose's JWE/deflate code (unsupported on the edge runtime) out of the middleware bundle.
import { SignJWT } from 'jose/jwt/sign'
import { jwtVerify } from 'jose/jwt/verify'

export interface Membership {
  tripId: string
  memberId: string
  tripCode: string
}

export interface AccessClaims {
  sid: string
  ms: Membership[]
}

export const ACCESS_TTL_SECONDS = 15 * 60
export const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60

const ISSUER = 'tripmate'
const AUDIENCE = 'tripmate-web'

/**
 * Cookie names. On HTTPS the `__Host-` / `__Secure-` prefixes make the browser
 * refuse cookies that are not Secure (and, for `__Host-`, not host-only with
 * path=/), so a subdomain or plain-HTTP page can't plant or overwrite them.
 */
export function cookieNames(secure: boolean) {
  return secure
    ? { access: '__Host-tm_at', refresh: '__Secure-tm_rt' }
    : { access: 'tm_at', refresh: 'tm_rt' }
}

/** The signing key, or null when auth is not configured (local dev without secrets). */
export function sessionKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) return null
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(claims: AccessClaims, key: Uint8Array, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000)
  return new SignJWT({ ms: claims.ms })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sid)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_SECONDS)
    .sign(key)
}

/** Verified claims, or null for a missing, expired, tampered or foreign token. */
export async function verifyAccessToken(token: string | undefined, key: Uint8Array): Promise<AccessClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    const ms = Array.isArray(payload.ms) ? (payload.ms as Membership[]) : []
    if (typeof payload.sub !== 'string') return null
    return { sid: payload.sub, ms }
  } catch {
    return null
  }
}

export { safeNextPath } from './safeNext'
