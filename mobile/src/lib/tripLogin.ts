// Mobile-number login (mirror of the web's src/lib/tripLogin.ts; see
// __tests__/tripLoginParity.test.ts): find every trip a phone number belongs to, then the
// member enters that trip's PIN to open it.

import type { Member, Trip, TripStatus } from '../types'

export interface TripChoice {
  tripId: string
  tripCode: string
  name: string
  status: TripStatus
  createdAt: string
  memberId: string
  memberName: string
  memberCount: number
}

/** localStorage key: the number last used to log in, prefilled on the login page. */
export const LAST_MOBILE_KEY = 'tripmate_last_mobile'

export const isValidMobile = (mobile: string) => /^[6-9]\d{9}$/.test(mobile)

/** Digits only, with a pasted +91 / 0 prefix removed, capped at 10 digits. */
export function normalizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** Live trips first; within each group the most recently created trip first. */
export function sortTripChoices(choices: TripChoice[]): TripChoice[] {
  return [...choices].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '') || 0
  })
}

/** Trips on this device where `mobile` is a member who can log in (has a PIN). */
export function localTripChoices(trips: Trip[], members: Member[], mobile: string): TripChoice[] {
  const choices: TripChoice[] = []
  for (const m of members) {
    if (m.mobile !== mobile || !m.pin) continue
    const trip = trips.find(t => t.id === m.tripId)
    if (!trip) continue
    choices.push({
      tripId: trip.id,
      tripCode: trip.tripCode,
      name: trip.name,
      status: trip.status,
      createdAt: trip.createdAt,
      memberId: m.id,
      memberName: m.name,
      memberCount: members.filter(x => x.tripId === trip.id).length,
    })
  }
  return choices
}

/** Combines device and cloud results; the cloud copy wins because it is the shared source of truth. */
export function mergeTripChoices(local: TripChoice[], remote: TripChoice[]): TripChoice[] {
  const byTrip = new Map<string, TripChoice>()
  for (const c of local) byTrip.set(c.tripId, c)
  for (const c of remote) byTrip.set(c.tripId, c)
  return sortTripChoices([...byTrip.values()])
}
