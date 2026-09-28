import { describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { safeNextPath, signAccessToken, verifyAccessToken } from '../auth/tokens'

const key = new TextEncoder().encode('x'.repeat(48))
const otherKey = new TextEncoder().encode('y'.repeat(48))
const ms = [{ tripId: '11111111-1111-4111-8111-111111111111', memberId: '22222222-2222-4222-8222-222222222222', tripCode: 'TRP-AB12' }]

describe('access tokens', () => {
  it('round-trips the session id and memberships', async () => {
    const token = await signAccessToken({ sid: 's1', ms }, key)
    expect(await verifyAccessToken(token, key)).toEqual({ sid: 's1', ms })
  })

  it('rejects a token signed with another key', async () => {
    const token = await signAccessToken({ sid: 's1', ms }, otherKey)
    expect(await verifyAccessToken(token, key)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signAccessToken({ sid: 's1', ms }, key, Date.now() - 16 * 60 * 1000)
    expect(await verifyAccessToken(token, key)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signAccessToken({ sid: 's1', ms }, key)
    const [h, , sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 's1', ms: [...ms, { ...ms[0], tripId: 'evil' }] })).toString('base64url')
    expect(await verifyAccessToken(`${h}.${forged}.${sig}`, key)).toBeNull()
  })

  it('rejects "alg: none" and tokens for another audience', async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"s1","ms":[]}').toString('base64url')}.`
    expect(await verifyAccessToken(none, key)).toBeNull()
    const foreign = await new SignJWT({ ms }).setProtectedHeader({ alg: 'HS256' }).setSubject('s1')
      .setIssuer('tripmate').setAudience('someone-else').setExpirationTime('5m').sign(key)
    expect(await verifyAccessToken(foreign, key)).toBeNull()
  })

  it('treats a missing token as logged out', async () => {
    expect(await verifyAccessToken(undefined, key)).toBeNull()
  })
})

describe('safeNextPath', () => {
  it('allows same-site paths only', () => {
    expect(safeNextPath('/dashboard/abc?x=1')).toBe('/dashboard/abc?x=1')
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
  })
})
