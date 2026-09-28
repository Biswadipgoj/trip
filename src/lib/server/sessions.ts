// Refresh-token sessions with rotation and reuse detection.
//
// The browser holds an opaque random refresh token in an httpOnly cookie; the
// database holds only its SHA-256 hash. Every refresh issues a new token and
// retires the old one. Presenting a retired token after a short grace window
// (two tabs refreshing at once) means it was copied, so the session is revoked.

import { createHash, randomBytes } from 'node:crypto'
import { REFRESH_TTL_SECONDS, type Membership } from '@/lib/auth/tokens'

export const ROTATION_GRACE_MS = 60_000

export interface SessionRow {
  id: string
  refreshHash: string
  prevRefreshHash: string | null
  rotatedAt: string | null
  memberships: Membership[]
  expiresAt: string
  revokedAt: string | null
}

export interface SessionRepo {
  insert(row: { refreshHash: string; memberships: Membership[]; userAgent: string | null; expiresAt: string }): Promise<string>
  findByRefreshHash(hash: string): Promise<SessionRow | null>
  findByPrevHash(hash: string): Promise<SessionRow | null>
  /** Swaps the refresh hash only if it still equals `oldHash`; false when another request won the race. */
  rotate(id: string, oldHash: string, next: { refreshHash: string; memberships: Membership[]; expiresAt: string; rotatedAt: string }): Promise<boolean>
  revoke(id: string, at: string): Promise<void>
}

export interface IssuedSession {
  sessionId: string
  memberships: Membership[]
  /** New refresh token to set as a cookie; null when the current cookie stays valid. */
  refreshToken: string | null
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')
const expiry = (now: number) => new Date(now + REFRESH_TTL_SECONDS * 1000).toISOString()

const isLive = (row: SessionRow, now: number) => !row.revokedAt && Date.parse(row.expiresAt) > now

/** Adds or replaces the membership for its trip. */
export function withMembership(list: Membership[], m: Membership): Membership[] {
  return [...list.filter(x => x.tripId !== m.tripId), m]
}

export class SessionService {
  constructor(private repo: SessionRepo, private clock: () => number = Date.now) {}

  /**
   * Logs a member in. Extends the caller's live session when there is one (so
   * one browser can hold several trips), otherwise starts a new session.
   * Always rotates the refresh token, since the session just gained access.
   */
  async login(currentRefresh: string | undefined, membership: Membership, userAgent: string | null): Promise<IssuedSession> {
    const now = this.clock()
    const existing = currentRefresh ? await this.repo.findByRefreshHash(hashToken(currentRefresh)) : null
    const token = newToken()

    if (existing && isLive(existing, now)) {
      const memberships = withMembership(existing.memberships, membership)
      const ok = await this.repo.rotate(existing.id, existing.refreshHash, {
        refreshHash: hashToken(token),
        memberships,
        expiresAt: expiry(now),
        rotatedAt: new Date(now).toISOString(),
      })
      if (ok) return { sessionId: existing.id, memberships, refreshToken: token }
    }

    const memberships = [membership]
    const sessionId = await this.repo.insert({
      refreshHash: hashToken(token),
      memberships,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt: expiry(now),
    })
    return { sessionId, memberships, refreshToken: token }
  }

  /** Exchanges a refresh token for a new one. Null means log in again. */
  async refresh(refreshToken: string | undefined): Promise<IssuedSession | null> {
    if (!refreshToken) return null
    const now = this.clock()
    const hash = hashToken(refreshToken)

    const row = await this.repo.findByRefreshHash(hash)
    if (row && isLive(row, now)) {
      const token = newToken()
      const ok = await this.repo.rotate(row.id, hash, {
        refreshHash: hashToken(token),
        memberships: row.memberships,
        expiresAt: expiry(now),
        rotatedAt: new Date(now).toISOString(),
      })
      if (ok) return { sessionId: row.id, memberships: row.memberships, refreshToken: token }
      // Lost a race with a parallel refresh: fall through to the grace check.
    }

    const prev = await this.repo.findByPrevHash(hash)
    if (!prev || !isLive(prev, now)) return null
    const rotatedAt = prev.rotatedAt ? Date.parse(prev.rotatedAt) : 0
    if (now - rotatedAt <= ROTATION_GRACE_MS) {
      // A parallel request already rotated; its response set the new cookie.
      return { sessionId: prev.id, memberships: prev.memberships, refreshToken: null }
    }
    // An old token came back long after rotation: it was copied. Kill the session.
    await this.repo.revoke(prev.id, new Date(now).toISOString())
    return null
  }

  /**
   * Logs out of one trip (or all of them). Returns what is left; null when the
   * session is gone and the cookies should be cleared.
   */
  async logout(refreshToken: string | undefined, tripId?: string): Promise<IssuedSession | null> {
    if (!refreshToken) return null
    const now = this.clock()
    const hash = hashToken(refreshToken)
    const row = await this.repo.findByRefreshHash(hash)
    if (!row || !isLive(row, now)) return null

    const remaining = tripId ? row.memberships.filter(m => m.tripId !== tripId) : []
    if (remaining.length === 0) {
      await this.repo.revoke(row.id, new Date(now).toISOString())
      return null
    }
    const token = newToken()
    const ok = await this.repo.rotate(row.id, hash, {
      refreshHash: hashToken(token),
      memberships: remaining,
      expiresAt: row.expiresAt,
      rotatedAt: new Date(now).toISOString(),
    })
    return ok ? { sessionId: row.id, memberships: remaining, refreshToken: token } : null
  }
}

/** In-memory repo for tests. */
export class MemorySessionRepo implements SessionRepo {
  rows = new Map<string, SessionRow>()
  private seq = 0

  async insert(row: { refreshHash: string; memberships: Membership[]; expiresAt: string }) {
    const id = `s${++this.seq}`
    this.rows.set(id, { id, refreshHash: row.refreshHash, prevRefreshHash: null, rotatedAt: null, memberships: row.memberships, expiresAt: row.expiresAt, revokedAt: null })
    return id
  }
  async findByRefreshHash(hash: string) {
    return [...this.rows.values()].find(r => r.refreshHash === hash) ?? null
  }
  async findByPrevHash(hash: string) {
    return [...this.rows.values()].find(r => r.prevRefreshHash === hash) ?? null
  }
  async rotate(id: string, oldHash: string, next: { refreshHash: string; memberships: Membership[]; expiresAt: string; rotatedAt: string }) {
    const r = this.rows.get(id)
    if (!r || r.refreshHash !== oldHash) return false
    this.rows.set(id, { ...r, prevRefreshHash: oldHash, refreshHash: next.refreshHash, memberships: next.memberships, expiresAt: next.expiresAt, rotatedAt: next.rotatedAt })
    return true
  }
  async revoke(id: string, at: string) {
    const r = this.rows.get(id)
    if (r) this.rows.set(id, { ...r, revokedAt: at })
  }
}
