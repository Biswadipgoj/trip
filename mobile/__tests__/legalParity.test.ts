// The Android app shows the same Privacy Policy and Terms as the website.
import { describe, expect, it } from 'vitest'
import * as web from '../../src/lib/legal'
import * as mob from '../src/lib/legal'

describe('legal text parity (web ↔ Android)', () => {
  it('has the same date, operator and contact', () => {
    expect(mob.LEGAL_UPDATED).toBe(web.LEGAL_UPDATED)
    expect(mob.LEGAL_OPERATOR).toBe(web.LEGAL_OPERATOR)
    expect(mob.LEGAL_CONTACT_URL).toBe(web.LEGAL_CONTACT_URL)
  })

  it('has identical Privacy Policy and Terms', () => {
    expect(mob.PRIVACY_POLICY).toEqual(web.PRIVACY_POLICY)
    expect(mob.TERMS_OF_SERVICE).toEqual(web.TERMS_OF_SERVICE)
  })

  it('every section has a title and at least one line', () => {
    for (const doc of [mob.PRIVACY_POLICY, mob.TERMS_OF_SERVICE]) {
      for (const s of doc.sections) {
        expect(s.title.length).toBeGreaterThan(2)
        expect(s.body.length).toBeGreaterThan(0)
      }
    }
  })
})
