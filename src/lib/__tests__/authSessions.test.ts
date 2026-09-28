import { describe, expect, it } from 'vitest'
import { MemorySessionRepo, ROTATION_GRACE_MS, SessionService, hashToken } from '../server/sessions'

const tripA = { tripId: 'a', memberId: 'ma', tripCode: 'TRP-AAAA' }
const tripB = { tripId: 'b', memberId: 'mb', tripCode: 'TRP-BBBB' }

function setup() {
  let now = Date.parse('2026-09-28T10:00:00Z')
  const repo = new MemorySessionRepo()
  const svc = new SessionService(repo, () => now)
  return { repo, svc, advance: (ms: number) => { now += ms } }
}

describe('SessionService', () => {
  it('stores only a hash of the refresh token', async () => {
    const { repo, svc } = setup()
    const s = await svc.login(undefined, tripA, 'ua')
    const row = [...repo.rows.values()][0]
    expect(row.refreshHash).toBe(hashToken(s.refreshToken!))
    expect(row.refreshHash).not.toBe(s.refreshToken)
  })

  it('rotates the refresh token on every refresh', async () => {
    const { svc } = setup()
    const s1 = await svc.login(undefined, tripA, null)
    const s2 = await svc.refresh(s1.refreshToken!)
    expect(s2?.refreshToken).toBeTruthy()
    expect(s2!.refreshToken).not.toBe(s1.refreshToken)
    expect(s2!.memberships).toEqual([tripA])
  })

  it('accepts the previous token briefly (two tabs refreshing at once) without re-rotating', async () => {
    const { svc, advance } = setup()
    const s1 = await svc.login(undefined, tripA, null)
    await svc.refresh(s1.refreshToken!)
    advance(ROTATION_GRACE_MS - 1000)
    const again = await svc.refresh(s1.refreshToken!)
    expect(again).toEqual({ sessionId: s1.sessionId, memberships: [tripA], refreshToken: null })
  })

  it('revokes the whole session when an old token is replayed later (stolen cookie)', async () => {
    const { svc, advance } = setup()
    const s1 = await svc.login(undefined, tripA, null)
    const s2 = await svc.refresh(s1.refreshToken!)
    advance(ROTATION_GRACE_MS + 1000)
    expect(await svc.refresh(s1.refreshToken!)).toBeNull()
    // …and the legitimate holder is logged out too.
    expect(await svc.refresh(s2!.refreshToken!)).toBeNull()
  })

  it('rejects unknown, missing and expired tokens', async () => {
    const { svc, advance } = setup()
    expect(await svc.refresh(undefined)).toBeNull()
    expect(await svc.refresh('made-up')).toBeNull()
    const s1 = await svc.login(undefined, tripA, null)
    advance(91 * 24 * 3600 * 1000)
    expect(await svc.refresh(s1.refreshToken!)).toBeNull()
  })

  it('keeps extending while in use (sliding 90 days)', async () => {
    const { svc, advance } = setup()
    let token = (await svc.login(undefined, tripA, null)).refreshToken!
    for (let i = 0; i < 6; i++) {
      advance(60 * 24 * 3600 * 1000) // a refresh every 60 days, a year in total
      const next = await svc.refresh(token)
      expect(next).not.toBeNull()
      token = next!.refreshToken!
    }
  })

  it('adds a second trip to the same session', async () => {
    const { repo, svc } = setup()
    const s1 = await svc.login(undefined, tripA, null)
    const s2 = await svc.login(s1.refreshToken!, tripB, null)
    expect(s2.sessionId).toBe(s1.sessionId)
    expect(s2.memberships).toEqual([tripA, tripB])
    expect(repo.rows.size).toBe(1)
  })

  it('logs out of one trip, then ends the session with the last one', async () => {
    const { svc } = setup()
    const s1 = await svc.login(undefined, tripA, null)
    const s2 = await svc.login(s1.refreshToken!, tripB, null)
    const left = await svc.logout(s2.refreshToken!, 'a')
    expect(left?.memberships).toEqual([tripB])
    expect(await svc.logout(left!.refreshToken!, 'b')).toBeNull()
    expect(await svc.refresh(left!.refreshToken!)).toBeNull()
  })
})

describe('SessionService under concurrent requests', () => {
  it('a late request with the previous-but-one token does not log the user out (rotation burst)', async () => {
    const { svc, advance } = setup()
    const a = (await svc.login(undefined, tripA, null)).refreshToken!
    advance(20 * 60 * 1000) // access token expired long ago
    const r1 = await svc.refresh(a) // request 1 rotates A → B
    advance(300)
    const r2 = await svc.refresh(r1!.refreshToken!) // request 2 (already holding B) must not rotate again yet
    advance(300)
    const r3 = await svc.refresh(a) // request 3, sent earlier with A, arrives last
    expect(r2).not.toBeNull()
    expect(r3).not.toBeNull()
    // …and the session still works afterwards with whatever cookie the browser ended up holding.
    const current = r2!.refreshToken ?? r1!.refreshToken!
    expect(await svc.refresh(current)).not.toBeNull()
  })

  it('rotates at most once per grace window, then again after it', async () => {
    const { svc, advance } = setup()
    const a = (await svc.login(undefined, tripA, null)).refreshToken!
    advance(20 * 60 * 1000)
    const b = (await svc.refresh(a))!.refreshToken!
    advance(1000)
    expect((await svc.refresh(b))!.refreshToken).toBeNull() // too soon: keep B
    advance(ROTATION_GRACE_MS)
    const c = (await svc.refresh(b))!.refreshToken
    expect(c).toBeTruthy() // window passed: rotate B → C
    expect(c).not.toBe(b)
  })
})
