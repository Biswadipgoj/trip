// Business logic — a faithful port of the web app's src/lib/utils.ts. The
// money maths (splits, balances, settlements) must stay identical on both
// clients: parity is enforced by mobile/__tests__/parity.test.ts.
// Mobile-only differences: no DOM/Buffer (pure-JS base64 + UTF-8), cached Intl
// formatters with manual fallbacks, hex gradient pairs for LinearGradient.
import {
  MemberBalance, Expense, Member, SettlementRoute,
  SettlementGroup, Sponsorship, HotelExpense,
  Trip, InvitePayload, InviteParseResult, Settlement
} from '../types'

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Indian digit grouping: 1234567 → "12,34,567". */
export function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits
  const last3 = intDigits.slice(-3)
  let rest = intDigits.slice(0, -3)
  const parts: string[] = []
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2))
    rest = rest.slice(0, -2)
  }
  if (rest) parts.unshift(rest)
  return `${parts.join(',')},${last3}`
}

/** "12,34,567.5" style number (no symbol), up to `maxDecimals` decimals. */
export function formatIndianNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) value = 0
  const sign = value < 0 ? '-' : ''
  const fixed = Math.abs(value).toFixed(maxDecimals)
  const [int, rawDec = ''] = fixed.split('.')
  // Whole amounts show no decimals; anything else shows all of them
  // (₹6,682.50, never ₹6,682.5).
  const dec = /^0*$/.test(rawDec) ? '' : rawDec
  return `${sign}${groupIndian(int)}${dec ? `.${dec}` : ''}`
}

/** Whether an amount has paise (after rounding to 2 decimals). */
const hasPaise = (amount: number) => Math.round(Math.abs(amount) * 100) % 100 !== 0

const inrFormatters: Partial<Record<0 | 2, Intl.NumberFormat | null>> = {}
let dateFormatter: Intl.DateTimeFormat | null | undefined

function inrFormatter(decimals: 0 | 2): Intl.NumberFormat | null {
  if (inrFormatters[decimals] === undefined) {
    try {
      inrFormatters[decimals] = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    } catch {
      inrFormatters[decimals] = null
    }
  }
  return inrFormatters[decimals] ?? null
}

/** ₹1,25,000 for whole amounts, ₹6,682.50 otherwise — never one decimal. */
export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  const formatter = inrFormatter(hasPaise(safe) ? 2 : 0)
  if (formatter) {
    try {
      return formatter.format(safe)
    } catch {
      /* fall through to the manual formatter */
    }
  }
  return `${safe < 0 ? '-' : ''}₹${formatIndianNumber(Math.abs(safe))}`
}

/** Compact Indian formatting for big numbers: ₹3,250 · ₹1.25L · ₹2.4Cr */
export function formatCompactINR(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 1 : 2)}Cr`
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 1 : 2)}L`
  return formatCurrency(amount)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  if (dateFormatter === undefined) {
    try {
      dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      dateFormatter = null
    }
  }
  if (dateFormatter) {
    try {
      return dateFormatter.format(d)
    } catch {
      /* fall through */
    }
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "22 Sept" — short day label for charts. */
export function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "2 min ago" style relative time for sync/upload status. */
export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return formatDate(iso)
}

export function generateTripCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'TRP-'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// UUIDs so locally-created entities can be stored in Supabase (UUID columns).
export function generateId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function getInitials(name: string): string {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return initials || '?'
}

export const AVATAR_COLORS = [
  'hsl(262, 83%, 58%)',
  'hsl(310, 75%, 55%)',
  'hsl(340, 70%, 58%)',
  'hsl(25, 80%, 55%)',
  'hsl(168, 76%, 38%)',
  'hsl(195, 65%, 45%)',
  'hsl(42, 80%, 48%)',
  'hsl(310, 55%, 52%)',
]

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length]
}

// ──────────────────────────────────────────────────────────────────────────────
// INVITE LINKS
// The invite link carries the trip data. The payload is base64url-encoded JSON
// containing the trip WITHOUT its password, plus a signature hash of
// (tripCode|password). The joining device verifies the password the user types
// in against the signature. Byte-compatible with the web app's links.
// ──────────────────────────────────────────────────────────────────────────────

const INVITE_VERSION = 2
const INVITE_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/** Deterministic FNV-1a hash → hex string. Not cryptographic, but enough to
 *  validate a trip password offline without putting it in the URL. */
export function hashInviteSecret(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

export function inviteSignature(tripCode: string, password: string): string {
  return hashInviteSecret(`${tripCode.toUpperCase()}|${password}`)
}

// Pure-JS UTF-8 + base64: Hermes has no Buffer, and atob/escape/unescape
// support varies across React Native versions.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function utf8Encode(str: string): number[] {
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        i++
      }
    }
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }
  return out
}

function utf8Decode(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i]
    let code: number
    let extra: number
    if (b < 0x80) { code = b; extra = 0 }
    else if (b >= 0xc2 && b < 0xe0) { code = b & 0x1f; extra = 1 }
    else if (b >= 0xe0 && b < 0xf0) { code = b & 0x0f; extra = 2 }
    else if (b >= 0xf0 && b < 0xf5) { code = b & 0x07; extra = 3 }
    else throw new URIError('Malformed UTF-8')
    for (let k = 1; k <= extra; k++) {
      const cont = bytes[i + k]
      if (cont === undefined || (cont & 0xc0) !== 0x80) throw new URIError('Malformed UTF-8')
      code = (code << 6) | (cont & 0x3f)
    }
    i += extra + 1
    if (code > 0xffff) {
      code -= 0x10000
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
    } else {
      out += String.fromCharCode(code)
    }
  }
  return out
}

function bytesToBase64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += b1 === undefined ? '=' : B64[(n >> 6) & 63]
    out += b2 === undefined ? '=' : B64[n & 63]
  }
  return out
}

function base64ToBytes(b64: string): number[] {
  const clean = b64.replace(/=+$/, '')
  if (/[^A-Za-z0-9+/]/.test(clean) || clean.length % 4 === 1) {
    throw new Error('Invalid base64')
  }
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < clean.length; i++) {
    buffer = ((buffer << 6) | B64.indexOf(clean[i])) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >> bits) & 0xff)
    }
  }
  return out
}

/** Encode to base64url — survives URL encoding, spaces, and messaging apps. */
function toBase64Url(str: string): string {
  return bytesToBase64(utf8Encode(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string {
  // Normalize artifacts from URL encoding / copy-paste:
  // spaces (decoded '+'), percent-encoding, stray whitespace
  let clean = token.trim().replace(/\s/g, '')
  try { clean = decodeURIComponent(clean) } catch { /* already decoded */ }
  clean = clean.replace(/-/g, '+').replace(/_/g, '/')
  while (clean.length % 4 !== 0) clean += '='
  return utf8Decode(base64ToBytes(clean))
}

export function createInviteToken(trip: Trip): string {
  const { password, ...tripWithoutPassword } = trip
  const payload: InvitePayload = {
    v: INVITE_VERSION,
    trip: tripWithoutPassword,
    exp: Date.now() + INVITE_VALIDITY_MS,
    sig: inviteSignature(trip.tripCode, password),
  }
  return toBase64Url(JSON.stringify(payload))
}

export function createInviteLink(trip: Trip, origin: string): string {
  return `${origin}/join-trip?invite=${createInviteToken(trip)}`
}

/** Text for the Android share sheet. Never contains the trip password. */
export function createTripShareMessage(trip: Pick<Trip, 'name' | 'tripCode'>, link?: string): string {
  return [
    `Join my trip “${trip.name}” on TripMate ✈️`,
    '',
    `Trip code: ${trip.tripCode}`,
    ...(link ? [`Join link: ${link}`] : []),
    'Ask me for the trip password to get in.',
  ].join('\n')
}

export function parseInviteToken(raw: string | null): InviteParseResult {
  if (!raw) return { ok: false, reason: 'invalid' }
  try {
    const parsed = JSON.parse(fromBase64Url(raw))
    if (!parsed || typeof parsed !== 'object' || !parsed.trip || typeof parsed.trip !== 'object') {
      return { ok: false, reason: 'invalid' }
    }
    const payload: InvitePayload = {
      v: parsed.v,
      trip: {
        id: String(parsed.trip.id || ''),
        tripCode: String(parsed.trip.tripCode || ''),
        name: String(parsed.trip.name || ''),
        creatorId: String(parsed.trip.creatorId || ''),
        status: parsed.trip.status === 'closed' ? 'closed' : 'active',
        createdAt: String(parsed.trip.createdAt || ''),
      },
      exp: typeof parsed.exp === 'number' ? parsed.exp : undefined,
      sig: typeof parsed.sig === 'string' ? parsed.sig : '',
    }
    if (!payload.trip.id || !payload.trip.tripCode || !payload.sig) {
      return { ok: false, reason: 'invalid' }
    }
    if (typeof payload.exp === 'number' && Date.now() > payload.exp) {
      return { ok: false, reason: 'expired' }
    }
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/**
 * Pulls a trip code or invite token out of whatever the user pasted: a bare
 * code ("trp-ab12"), a web join link, or a tripmate:// deep link.
 */
export function extractJoinInput(raw: string): { code?: string; invite?: string } {
  const text = (raw || '').trim()
  if (!text) return {}
  const invite = text.match(/[?&]invite=([^&#\s]+)/)
  if (invite) return { invite: invite[1] }
  const codeParam = text.match(/[?&](?:code|c)=([A-Za-z0-9-]+)/)
  if (codeParam) return { code: codeParam[1].toUpperCase() }
  const code = text.toUpperCase().match(/TRP-[A-Z0-9]{4}/)
  if (code) return { code: code[0] }
  return { code: text.toUpperCase().slice(0, 8) }
}

/** Round to 2 decimals (paise-accurate). Safe against NaN/Infinity. */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Two paise-tolerant amounts are "the same payment". */
export const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.01

// ──────────────────────────────────────────────────────────────────────────────
// BALANCE CALCULATION
// Supports all split types: equal, custom, percentage, quantity, room
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the actual per-member share amounts for a single expense.
 * Returns a map of memberId → share amount.
 */
export function resolveExpenseSplits(expense: Expense): Record<string, number> {
  const shares: Record<string, number> = {}

  if (expense.participants.length === 0) return shares

  switch (expense.splitType) {
    case 'equal': {
      distributeEqually(expense.amount, expense.participants, shares)
      break
    }

    case 'custom': {
      // splits[i].value is the direct amount for that member
      const splitMap: Record<string, number> = {}
      expense.splits.forEach(s => { splitMap[s.memberId] = s.value })
      expense.participants.forEach(pid => {
        shares[pid] = splitMap[pid] ?? 0
      })
      break
    }

    case 'percentage': {
      // splits[i].value is the percentage (0–100)
      const splitMap: Record<string, number> = {}
      expense.splits.forEach(s => { splitMap[s.memberId] = s.value })
      expense.participants.forEach(pid => {
        const pct = splitMap[pid] ?? 0
        shares[pid] = (pct / 100) * expense.amount
      })
      break
    }

    case 'quantity': {
      // splits[i].value is the quantity (e.g. bottles, items)
      const totalQty = expense.splits.reduce((sum, s) => sum + s.value, 0)
      const splitMap: Record<string, number> = {}
      expense.splits.forEach(s => { splitMap[s.memberId] = s.value })
      if (totalQty > 0) {
        expense.participants.forEach(pid => {
          const qty = splitMap[pid] ?? 0
          shares[pid] = (qty / totalQty) * expense.amount
        })
      }
      break
    }

    default: {
      // fallback to equal
      distributeEqually(expense.amount, expense.participants, shares)
    }
  }

  return shares
}

/**
 * Paise-accurate equal split: each share is rounded to 2 decimals and the
 * leftover paise are assigned to the first participants so the shares always
 * sum exactly to the expense amount (no floating-point drift).
 */
export function distributeEqually(amount: number, participantIds: string[], out: Record<string, number>) {
  const n = participantIds.length
  if (n === 0) return
  if (!Number.isFinite(amount) || amount <= 0) {
    participantIds.forEach(pid => { out[pid] = 0 })
    return
  }
  const totalPaise = Math.round(amount * 100)
  const base = Math.floor(totalPaise / n)
  let remainder = totalPaise - base * n
  participantIds.forEach(pid => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    out[pid] = (base + extra) / 100
  })
}

/**
 * Resolves per-member shares for hotel rooms.
 * Returns a map of memberId → total room cost owed.
 */
export function resolveHotelSplits(hotel: HotelExpense): Record<string, number> {
  const shares: Record<string, number> = {}

  hotel.rooms.forEach(room => {
    if (room.occupantIds.length === 0) return
    const roomShares: Record<string, number> = {}
    distributeEqually(room.cost, room.occupantIds, roomShares)
    room.occupantIds.forEach(oid => {
      shares[oid] = roundMoney((shares[oid] ?? 0) + roomShares[oid])
    })
  })

  return shares
}

/**
 * Main balance calculator.
 * Processes regular expenses + hotel expenses + applies splits correctly.
 */
export function calculateBalances(
  expenses: Expense[],
  hotelExpenses: HotelExpense[],
  members: Member[]
): MemberBalance[] {
  // Initialize
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  members.forEach(m => { paid[m.id] = 0; owed[m.id] = 0 })

  // Regular expenses
  expenses.forEach(expense => {
    // Credit the payer(s) — supports multiple payers per expense
    if (expense.payers && expense.payers.length > 0) {
      expense.payers.forEach(p => {
        paid[p.memberId] = (paid[p.memberId] ?? 0) + p.amount
      })
    } else {
      paid[expense.paidBy] = (paid[expense.paidBy] ?? 0) + expense.amount
    }

    // Each participant owes their share
    const shares = resolveExpenseSplits(expense)
    Object.entries(shares).forEach(([pid, share]) => {
      owed[pid] = (owed[pid] ?? 0) + share
    })
  })

  // Hotel expenses
  hotelExpenses.forEach(hotel => {
    // Payer gets credit for total
    paid[hotel.paidBy] = (paid[hotel.paidBy] ?? 0) + hotel.totalAmount

    // Each room occupant owes their share
    const shares = resolveHotelSplits(hotel)
    Object.entries(shares).forEach(([pid, share]) => {
      owed[pid] = (owed[pid] ?? 0) + share
    })
  })

  return members.map((m, idx) => ({
    memberId: m.id,
    name: m.name,
    avatarColor: m.avatarColor || getAvatarColor(idx),
    totalPaid: roundMoney(paid[m.id] ?? 0),
    totalOwed: roundMoney(owed[m.id] ?? 0),
    netBalance: roundMoney((paid[m.id] ?? 0) - (owed[m.id] ?? 0)),
  }))
}

/**
 * Applies CONFIRMED settlement payments as real cash transfers on top of the
 * expense balances. A confirmed payment means money actually moved hands, so
 * the payer's net balance rises by the amount and the receiver's falls.
 * Pending/paid (unconfirmed) settlements are ignored — no cash moved yet.
 *
 * Settlement groups ("couples") and sponsorships matter here: their combined
 * payment is routed through ONE representative member, but it settles the
 * WHOLE entity's debt. The transfer is therefore spread across the entity —
 * clearing the largest debts first — instead of piling onto the representative
 * and leaving phantom +/− balances inside the couple.
 */
export type ConfirmedTransfer = Pick<
  Settlement,
  'fromMemberId' | 'toMemberId' | 'amount' | 'status' | 'fromGroupIds' | 'toGroupIds'
>

export function applyConfirmedTransfers(
  balances: MemberBalance[],
  settlements: ConfirmedTransfer[],
  groups: SettlementGroup[] = [],
  sponsorships: Sponsorship[] = []
): MemberBalance[] {
  const result = balances.map(b => ({ ...b }))
  const balanceMap: Record<string, MemberBalance> = {}
  result.forEach(b => { balanceMap[b.memberId] = b })

  // Union-find: members of the same settlement group, and sponsor+sponsored
  // pairs, form one payment entity.
  const parent: Record<string, string> = {}
  result.forEach(b => { parent[b.memberId] = b.memberId })
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const union = (a: string, b: string) => {
    if (!(a in parent) || !(b in parent)) return
    parent[find(a)] = find(b)
  }
  groups.forEach(g => {
    const present = g.memberIds.filter(id => id in parent)
    for (let i = 1; i < present.length; i++) union(present[0], present[i])
  })
  sponsorships.forEach(sp => union(sp.sponsorMemberId, sp.sponsoredMemberId))

  // Prefer the member set snapshotted on the settlement at generation time
  // (survives later group deletion); otherwise resolve the live entity.
  const entityMembers = (memberId: string, snapshot?: string[]): MemberBalance[] => {
    if (snapshot && snapshot.length > 0) {
      const fromSnapshot = result.filter(b => snapshot.includes(b.memberId))
      if (fromSnapshot.length > 0) return fromSnapshot
    }
    if (!(memberId in parent)) return []
    const root = find(memberId)
    return result.filter(b => find(b.memberId) === root)
  }

  settlements.forEach(s => {
    if (s.status !== 'confirmed') return

    // Payer side: the cash clears the entity's debts (largest first);
    // anything beyond the entity's debt is credit owned by the payer.
    let remaining = s.amount
    entityMembers(s.fromMemberId, s.fromGroupIds)
      .filter(b => b.netBalance < 0)
      .sort((a, b) => a.netBalance - b.netBalance)
      .forEach(b => {
        if (remaining <= 0) return
        const pay = Math.min(remaining, -b.netBalance)
        b.netBalance = roundMoney(b.netBalance + pay)
        remaining = roundMoney(remaining - pay)
      })
    if (remaining > 0 && balanceMap[s.fromMemberId]) {
      balanceMap[s.fromMemberId].netBalance =
        roundMoney(balanceMap[s.fromMemberId].netBalance + remaining)
    }

    // Receiver side: the cash consumes the entity's credits (largest first);
    // any excess received becomes the receiver's own debt.
    let incoming = s.amount
    entityMembers(s.toMemberId, s.toGroupIds)
      .filter(b => b.netBalance > 0)
      .sort((a, b) => b.netBalance - a.netBalance)
      .forEach(b => {
        if (incoming <= 0) return
        const take = Math.min(incoming, b.netBalance)
        b.netBalance = roundMoney(b.netBalance - take)
        incoming = roundMoney(incoming - take)
      })
    if (incoming > 0 && balanceMap[s.toMemberId]) {
      balanceMap[s.toMemberId].netBalance =
        roundMoney(balanceMap[s.toMemberId].netBalance - incoming)
    }
  })

  return result
}

/**
 * Live net balances: expense balances minus money already moved by confirmed
 * payments. totalPaid/totalOwed stay expense-based; only netBalance reflects
 * settlements. Every screen derives from this single source so they can never
 * disagree.
 */
export function calculateNetBalances(
  expenses: Expense[],
  hotelExpenses: HotelExpense[],
  members: Member[],
  settlements: ConfirmedTransfer[],
  groups: SettlementGroup[] = [],
  sponsorships: Sponsorship[] = []
): MemberBalance[] {
  return applyConfirmedTransfers(
    calculateBalances(expenses, hotelExpenses, members),
    settlements,
    groups,
    sponsorships
  )
}

/**
 * Applies sponsorships: sponsored member's balance is added to their sponsor.
 * Returns modified balances (sponsored member zeroed, sponsor's balance updated).
 */
export function applySponsorships(
  balances: MemberBalance[],
  sponsorships: Sponsorship[] = []
): MemberBalance[] {
  const result = balances.map(b => ({ ...b }))
  const balanceMap: Record<string, MemberBalance> = {}
  result.forEach(b => { balanceMap[b.memberId] = b })

  sponsorships.forEach(sp => {
    const sponsored = balanceMap[sp.sponsoredMemberId]
    const sponsor = balanceMap[sp.sponsorMemberId]
    if (!sponsored || !sponsor) return

    // Transfer sponsored member's net balance to sponsor
    sponsor.netBalance += sponsored.netBalance
    sponsor.totalPaid += sponsored.totalPaid
    sponsor.totalOwed += sponsored.totalOwed

    // Zero out the sponsored member
    sponsored.netBalance = 0
    sponsored.totalPaid = 0
    sponsored.totalOwed = 0
  })

  return result
}

/**
 * Minimized debt settlement algorithm.
 * Accounts for settlement groups (group members treated as one entity).
 * Returns final settlement routes.
 */
export function calculateSettlements(
  rawBalances: MemberBalance[],
  members: Member[] = [],
  groups: SettlementGroup[] = [],
  sponsorships: Sponsorship[] = []
): SettlementRoute[] {
  // Step 1: Apply sponsorships
  const balancesAfterSponsorship = applySponsorships(rawBalances, sponsorships)

  // Build member lookup
  const memberMap: Record<string, Member> = {}
  members.forEach(m => { memberMap[m.id] = m })

  // Step 2: Apply settlement groups
  // Merge group members' balances into a single virtual "group" balance
  const groupedBalances: Record<string, number> = {} // entityKey → net balance
  const entityToMembers: Record<string, string[]> = {} // entityKey → member ids

  // Map each member to their group (if any)
  const memberToGroup: Record<string, string> = {}
  groups.forEach(g => {
    g.memberIds.forEach(mid => { memberToGroup[mid] = g.id })
  })

  balancesAfterSponsorship.forEach(b => {
    const groupId = memberToGroup[b.memberId]
    const key = groupId ?? b.memberId

    groupedBalances[key] = (groupedBalances[key] ?? 0) + b.netBalance

    if (!entityToMembers[key]) entityToMembers[key] = []
    if (!entityToMembers[key].includes(b.memberId)) {
      entityToMembers[key].push(b.memberId)
    }
  })

  // Step 3: Run minimized-debt greedy algorithm on grouped entities
  const creditors: { key: string; amount: number }[] = []
  const debtors:   { key: string; amount: number }[] = []

  Object.entries(groupedBalances).forEach(([key, bal]) => {
    if (bal > 0.01)  creditors.push({ key, amount: bal })
    else if (bal < -0.01) debtors.push({ key, amount: -bal })
  })

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const routes: SettlementRoute[] = []
  let ci = 0, di = 0

  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci]
    const debt = debtors[di]
    const amount = Math.min(cred.amount, debt.amount)

    if (amount > 0.01) {
      // Resolve the primary member for each entity
      const fromMembers = entityToMembers[debt.key] || [debt.key]
      const toMembers   = entityToMembers[cred.key] || [cred.key]

      // Pick the first "real" member as representative
      const fromId = fromMembers[0]
      const toId   = toMembers[0]
      const fromM  = memberMap[fromId]
      const toM    = memberMap[toId]

      if (fromM && toM) {
        routes.push({
          id: generateId(),
          fromMemberId: fromId,
          toMemberId:   toId,
          fromName:     fromMembers.length > 1
            ? fromMembers.map(id => memberMap[id]?.name || id).join(' & ')
            : fromM.name,
          toName:       toMembers.length > 1
            ? toMembers.map(id => memberMap[id]?.name || id).join(' & ')
            : toM.name,
          fromColor:    fromM.avatarColor,
          toColor:      toM.avatarColor,
          fromUpiId:    fromM.upiId,
          toUpiId:      toM.upiId,
          amount:       Math.round(amount * 100) / 100,
          fromMemberIds: [...fromMembers],
          toMemberIds:   [...toMembers],
        })
      }
    }

    cred.amount -= amount
    debt.amount -= amount
    if (cred.amount < 0.01) ci++
    if (debt.amount < 0.01) di++
  }

  return routes
}

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORY / SUBCATEGORY SYSTEM
// ──────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'food', 'travel', 'stay', 'entertainment', 'shopping', 'alcohol', 'fuel', 'tickets', 'misc',
] as const

export const SUBCATEGORIES: Record<string, { id: string; label: string; icon: string }[]> = {
  food: [
    { id: 'breakfast', label: 'Breakfast', icon: '🍳' },
    { id: 'lunch',     label: 'Lunch',     icon: '🍛' },
    { id: 'dinner',    label: 'Dinner',    icon: '🍽️' },
    { id: 'snacks',    label: 'Snacks',    icon: '🥪' },
    { id: 'beverages', label: 'Beverages', icon: '🥤' },
  ],
  stay: [
    { id: 'hotel',    label: 'Hotel',    icon: '🏨' },
    { id: 'resort',   label: 'Resort',   icon: '🏝️' },
    { id: 'hostel',   label: 'Hostel',   icon: '🛏️' },
    { id: 'homestay', label: 'Homestay', icon: '🏡' },
  ],
  travel: [
    { id: 'flight', label: 'Flight', icon: '✈️' },
    { id: 'train',  label: 'Train',  icon: '🚆' },
    { id: 'bus',    label: 'Bus',    icon: '🚌' },
    { id: 'taxi',   label: 'Taxi',   icon: '🚕' },
    { id: 'auto',   label: 'Auto',   icon: '🛺' },
  ],
  entertainment: [
    { id: 'adventure',   label: 'Adventure',   icon: '🪂' },
    { id: 'sightseeing', label: 'Sightseeing', icon: '🏛️' },
    { id: 'watersports', label: 'Watersports', icon: '🏄' },
    { id: 'nightlife',   label: 'Nightlife',   icon: '🪩' },
  ],
  shopping: [
    { id: 'clothes',   label: 'Clothes',   icon: '👕' },
    { id: 'souvenirs', label: 'Souvenirs', icon: '🎁' },
    { id: 'local',     label: 'Local Market', icon: '🧺' },
  ],
  alcohol: [
    { id: 'beer',     label: 'Beer',     icon: '🍺' },
    { id: 'spirits',  label: 'Spirits',  icon: '🥃' },
    { id: 'cocktails', label: 'Cocktails', icon: '🍹' },
  ],
}

export function getSubcategoryLabel(category: string, subId?: string): string | null {
  if (!subId) return null
  const sub = SUBCATEGORIES[category]?.find(s => s.id === subId)
  return sub ? `${sub.icon} ${sub.label}` : null
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    food:          '🍽️',
    travel:        '✈️',
    stay:          '🏨',
    entertainment: '🎭',
    shopping:      '🛍️',
    alcohol:       '🍺',
    fuel:          '⛽',
    tickets:       '🎟️',
    misc:          '📌',
  }
  return icons[category] || '📌'
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    food:          'Food & Dining',
    travel:        'Transport',
    stay:          'Stay',
    entertainment: 'Activities',
    shopping:      'Shopping',
    alcohol:       'Alcohol',
    fuel:          'Fuel',
    tickets:       'Tickets',
    misc:          'Miscellaneous',
  }
  return labels[category] || category
}

/** Vivid two-stop gradient per category (the web's gradients, as hex pairs). */
export function getCategoryGradientColors(category: string): [string, string] {
  const gradients: Record<string, [string, string]> = {
    food:          ['#F97924', '#F23674'], // orange → pink
    travel:        ['#257BF4', '#0AC5EB'], // blue → cyan
    stay:          ['#1EB880', '#19B3B3'], // emerald → teal
    entertainment: ['#7C39EF', '#CB35E9'], // indigo → purple
    shopping:      ['#EE2F8F', '#F04251'], // magenta → rose
    alcohol:       ['#F9A410', '#F46A25'], // amber → orange
    fuel:          ['#EE522B', '#F39716'],
    tickets:       ['#6347EB', '#2C7EF2'],
    misc:          ['#7A47D1', '#5469D4'],
  }
  return gradients[category] || gradients.misc
}

/** CSS form of the category gradient (used by the PDF report). */
export function getCategoryGradient(category: string): string {
  const [a, b] = getCategoryGradientColors(category)
  return `linear-gradient(135deg, ${a}, ${b})`
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    food:          'hsl(25, 80%, 55%)',
    travel:        'hsl(195, 70%, 48%)',
    stay:          'hsl(158, 60%, 45%)',
    entertainment: 'hsl(280, 78%, 55%)',
    shopping:      'hsl(340, 75%, 55%)',
    alcohol:       'hsl(38, 85%, 48%)',
    fuel:          'hsl(15, 80%, 52%)',
    tickets:       'hsl(260, 65%, 58%)',
    misc:          'hsl(262, 83%, 58%)',
  }
  return colors[category] || 'hsl(262, 83%, 58%)'
}

export function getSplitTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    equal:      'Equal Split',
    custom:     'Custom Amount',
    percentage: 'By Percentage',
    quantity:   'By Quantity',
    room:       'Room Allocation',
  }
  return labels[type] || 'Equal Split'
}

export function getSplitTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    equal:      '⚖️',
    custom:     '✏️',
    percentage: '%',
    quantity:   '🔢',
    room:       '🛏️',
  }
  return icons[type] || '⚖️'
}

// Build UPI payment link. Percent-encoded (not form-encoded) so no UPI app
// shows a literal "+" for spaces; the payee VPA keeps a raw "@", which some
// UPI apps fail to decode.
export function buildUpiLink(upiId: string, name: string, amount: number, note: string): string {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0
  const clean = (s: string) => (s || '').trim().replace(/[\r\n\t]/g, '')
  const pa = encodeURIComponent(clean(upiId)).replace(/%40/g, '@')
  const pn = encodeURIComponent(clean(name))
  // GPay/PhonePe reject intents whose note has symbols or runs long.
  const tn = encodeURIComponent(clean(note).replace(/[^\p{L}\p{N} .,]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40))
  return `upi://pay?pa=${pa}&pn=${pn}&am=${safeAmount.toFixed(2)}&tn=${tn}&cu=INR`
}

/** Loose UPI VPA check: handle@provider. */
export function isValidUpiId(upiId: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test((upiId || '').trim())
}
