import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { dbKeyHex, signTripPass } = await import('../server/tripPass')
const { parseJoin, samePassword } = await import('../server/tripJoin')

const GOA = '11111111-1111-4111-8111-111111111111'
const MNL = '22222222-2222-4222-8222-222222222222'
const key = dbKeyHex('x'.repeat(40))

describe('trip pass', () => {
  it('derives a stable 32-byte key from the session secret', () => {
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(dbKeyHex('x'.repeat(40))).toBe(key)
    expect(dbKeyHex('y'.repeat(40))).not.toBe(key)
  })

  it('signs exactly the format the database checks', () => {
    const now = Date.parse('2026-09-28T10:00:00Z')
    const pass = signTripPass([GOA.toUpperCase(), MNL, GOA], key, now)!
    const [v, exp, trips, sig] = pass.split('.')
    expect(v).toBe('v1')
    expect(Number(exp)).toBe(now / 1000 + 120)
    expect(trips).toBe(`${GOA},${MNL}`) // lower-cased, de-duplicated
    expect(sig).toBe(createHmac('sha256', Buffer.from(key, 'hex')).update(`v1.${exp}.${trips}`).digest('hex'))
  })

  it('gives no pass without trips, and ignores ids that are not uuids', () => {
    expect(signTripPass([], key)).toBeNull()
    expect(signTripPass(['../etc', "x' OR 1=1"], key)).toBeNull()
    expect(signTripPass([GOA, 'nope'], key)!.split('.')[2]).toBe(GOA)
  })
})

describe('join input', () => {
  const ok = { tripCode: ' trp-goa1 ', password: 'pw12', member: { name: ' Asha ', mobile: '9876543210', pin: '1234' } }

  it('normalises a valid request', () => {
    const r = parseJoin(ok)
    expect(r).toMatchObject({ tripCode: 'TRP-GOA1', member: { name: 'Asha', mobile: '9876543210', pin: '1234' }, creator: false })
  })

  it('rejects bad mobile numbers, PINs and codes', () => {
    expect(parseJoin({ ...ok, member: { ...ok.member, mobile: '12345' } })).toHaveProperty('error')
    expect(parseJoin({ ...ok, member: { ...ok.member, pin: '12a4' } })).toHaveProperty('error')
    expect(parseJoin({ ...ok, tripCode: 'x' })).toHaveProperty('error')
    expect(parseJoin({ ...ok, password: '' })).toHaveProperty('error')
    expect(parseJoin(null)).toHaveProperty('error')
  })

  it('needs a real trip id and a 4+ character password to create a trip', () => {
    expect(parseJoin({ ...ok, trip: { id: 'abc', name: 'Goa' } })).toHaveProperty('error')
    expect(parseJoin({ ...ok, password: 'pw', trip: { id: GOA, name: 'Goa' } })).toHaveProperty('error')
    expect(parseJoin({ ...ok, trip: { id: GOA, name: 'Goa' }, creator: true })).toMatchObject({ trip: { id: GOA, name: 'Goa', status: 'active' }, creator: true })
  })

  it('compares passwords exactly', () => {
    expect(samePassword('pw12', 'pw12')).toBe(true)
    expect(samePassword('pw12', 'pw1')).toBe(false)
    expect(samePassword('pw12', 'PW12')).toBe(false)
  })
})
