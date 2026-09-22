import {
  MemberBalance, Expense, Member, SettlementRoute,
  SettlementGroup, Sponsorship, HotelExpense, ParticipantSplit,
  Trip, InvitePayload, InviteParseResult, Settlement
} from '../types'

export function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toFixed(2)}`
  }
}

/** Compact Indian formatting for big numbers: ₹3,250 · ₹1.25L · ₹2.4Cr */
export function formatCompactINR(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 1 : 2)}Cr`
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 1 : 2)}L`
  return formatCurrency(amount)
}

export function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function generateTripCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'TRP-'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function getInitials(name: string): string {
  if (!name) return 'TM'
  return name
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const AVATAR_COLORS = [
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#F97316', // Orange
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#6366F1', // Indigo
]

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length]
}

// ──────────────────────────────────────────────────────────────────────────────
// INVITE LINKS & SHORT CODE SHARING
// ──────────────────────────────────────────────────────────────────────────────

const INVITE_VERSION = 2
const INVITE_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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

/** Encode base64 */
function toBase64Url(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch {
    return ''
  }
}

function fromBase64Url(token: string): string {
  let clean = token.trim().replace(/\s/g, '')
  clean = clean.replace(/-/g, '+').replace(/_/g, '/')
  while (clean.length % 4 !== 0) clean += '='
  try {
    return decodeURIComponent(escape(atob(clean)))
  } catch {
    return atob(clean)
  }
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

/** Shortened clean join link (Requested by user) */
export function createShortJoinLink(tripCode: string): string {
  return `https://tripmate.app/join?c=${tripCode}`
}

/** Rich, beautiful shortened share message */
export function createTripShareMessage(tripName: string, tripCode: string): string {
  return `🌴 Join '${tripName}' on TripMate! ✈️\n\n🔑 Trip Code: ${tripCode}\n👉 Short Link: ${createShortJoinLink(tripCode)}\n\nTrack & settle group expenses in seconds! 💳`
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

/** Round to 2 decimals (paise-accurate). Safe against NaN/Infinity. */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ──────────────────────────────────────────────────────────────────────────────
// BALANCE & SPLIT CALCULATION (100% PARITY WITH WEB)
// ──────────────────────────────────────────────────────────────────────────────

export function resolveExpenseSplits(expense: Expense): Record<string, number> {
  const shares: Record<string, number> = {}
  if (expense.participants.length === 0) return shares

  switch (expense.splitType) {
    case 'equal': {
      distributeEqually(expense.amount, expense.participants, shares)
      break
    }
    case 'custom': {
      const splitMap: Record<string, number> = {}
      expense.splits.forEach(s => { splitMap[s.memberId] = s.value })
      expense.participants.forEach(pid => {
        shares[pid] = splitMap[pid] ?? 0
      })
      break
    }
    case 'percentage': {
      const splitMap: Record<string, number> = {}
      expense.splits.forEach(s => { splitMap[s.memberId] = s.value })
      expense.participants.forEach(pid => {
        const pct = splitMap[pid] ?? 0
        shares[pid] = (pct / 100) * expense.amount
      })
      break
    }
    case 'quantity': {
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
      distributeEqually(expense.amount, expense.participants, shares)
    }
  }

  return shares
}

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

export function calculateBalances(
  expenses: Expense[],
  hotelExpenses: HotelExpense[],
  members: Member[]
): MemberBalance[] {
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  members.forEach(m => { paid[m.id] = 0; owed[m.id] = 0 })

  // Regular expenses
  expenses.forEach(expense => {
    if (expense.payers && expense.payers.length > 0) {
      expense.payers.forEach(p => {
        paid[p.memberId] = (paid[p.memberId] ?? 0) + p.amount
      })
    } else {
      paid[expense.paidBy] = (paid[expense.paidBy] ?? 0) + expense.amount
    }

    const shares = resolveExpenseSplits(expense)
    Object.entries(shares).forEach(([pid, share]) => {
      owed[pid] = (owed[pid] ?? 0) + share
    })
  })

  // Hotel expenses
  hotelExpenses.forEach(hotel => {
    paid[hotel.paidBy] = (paid[hotel.paidBy] ?? 0) + hotel.totalAmount
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

export type ConfirmedTransfer = Pick<
  Settlement,
  'fromMemberId' | 'toMemberId' | 'amount' | 'status' | 'fromGroupIds' | 'toGroupIds'
>

export function applyConfirmedTransfers(
  balances: MemberBalance[],
  confirmedPayments: ConfirmedTransfer[]
): MemberBalance[] {
  if (confirmedPayments.length === 0) return balances

  const balMap: Record<string, MemberBalance> = {}
  balances.forEach(b => { balMap[b.memberId] = { ...b } })

  confirmedPayments.forEach(p => {
    if (p.status !== 'confirmed') return

    // Credit from (payer owes less)
    const fromMember = balMap[p.fromMemberId]
    if (fromMember) {
      fromMember.netBalance = roundMoney(fromMember.netBalance + p.amount)
    }

    // Debit to (receiver is owed less)
    const toMember = balMap[p.toMemberId]
    if (toMember) {
      toMember.netBalance = roundMoney(toMember.netBalance - p.amount)
    }
  })

  return Object.values(balMap)
}

// ──────────────────────────────────────────────────────────────────────────────
// GREEDY MINIMAL DEBT SETTLEMENT ALGORITHM
// ──────────────────────────────────────────────────────────────────────────────

export function calculateSettlements(
  balances: MemberBalance[],
  sponsorships: Sponsorship[] = [],
  settlementGroups: SettlementGroup[] = []
): SettlementRoute[] {
  const workingBalances: Record<string, number> = {}
  balances.forEach(b => { workingBalances[b.memberId] = b.netBalance })

  // 1. Apply sponsorships: transfer sponsored member's net balance to sponsor
  sponsorships.forEach(sp => {
    const sponsoredBalance = workingBalances[sp.sponsoredMemberId] || 0
    if (sponsoredBalance !== 0) {
      workingBalances[sp.sponsorMemberId] = roundMoney(
        (workingBalances[sp.sponsorMemberId] || 0) + sponsoredBalance
      )
      workingBalances[sp.sponsoredMemberId] = 0
    }
  })

  // 2. Settlement Groups: Merge group members into single virtual entity
  const memberToGroup: Record<string, SettlementGroup> = {}
  settlementGroups.forEach(g => {
    g.memberIds.forEach(mid => { memberToGroup[mid] = g })
  })

  const groupBalances: Record<string, { balance: number; memberIds: string[]; name: string }> = {}
  const individualBalances: Record<string, number> = {}

  Object.entries(workingBalances).forEach(([mid, bal]) => {
    const group = memberToGroup[mid]
    if (group) {
      if (!groupBalances[group.id]) {
        groupBalances[group.id] = { balance: 0, memberIds: [], name: group.name }
      }
      groupBalances[group.id].balance = roundMoney(groupBalances[group.id].balance + bal)
      groupBalances[group.id].memberIds.push(mid)
    } else {
      individualBalances[mid] = bal
    }
  })

  // 3. Separate creditors and debtors
  interface Party {
    id: string
    name: string
    amount: number
    isGroup: boolean
    memberIds: string[]
    representativeId: string
  }

  const memberMap: Record<string, MemberBalance> = {}
  balances.forEach(b => { memberMap[b.memberId] = b })

  const creditors: Party[] = []
  const debtors: Party[] = []

  // Add individual parties
  Object.entries(individualBalances).forEach(([mid, bal]) => {
    const m = memberMap[mid]
    if (!m) return
    if (bal > 0.01) {
      creditors.push({
        id: mid,
        name: m.name,
        amount: bal,
        isGroup: false,
        memberIds: [mid],
        representativeId: mid,
      })
    } else if (bal < -0.01) {
      debtors.push({
        id: mid,
        name: m.name,
        amount: Math.abs(bal),
        isGroup: false,
        memberIds: [mid],
        representativeId: mid,
      })
    }
  })

  // Add group parties
  Object.entries(groupBalances).forEach(([gid, gData]) => {
    const repId = gData.memberIds[0] || gid
    if (gData.balance > 0.01) {
      creditors.push({
        id: gid,
        name: gData.name,
        amount: gData.balance,
        isGroup: true,
        memberIds: gData.memberIds,
        representativeId: repId,
      })
    } else if (gData.balance < -0.01) {
      debtors.push({
        id: gid,
        name: gData.name,
        amount: Math.abs(gData.balance),
        isGroup: true,
        memberIds: gData.memberIds,
        representativeId: repId,
      })
    }
  })

  // Sort descending by amount for greedy minimization
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const routes: SettlementRoute[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci]
    const debt = debtors[di]
    const amount = roundMoney(Math.min(cred.amount, debt.amount))

    if (amount >= 0.01) {
      const fromM = memberMap[debt.representativeId]
      const toM = memberMap[cred.representativeId]

      routes.push({
        id: generateId(),
        fromMemberId: debt.representativeId,
        toMemberId: cred.representativeId,
        fromName: debt.name,
        toName: cred.name,
        fromColor: fromM?.avatarColor || AVATAR_COLORS[0],
        toColor: toM?.avatarColor || AVATAR_COLORS[1],
        amount,
        fromMemberIds: debt.memberIds,
        toMemberIds: cred.memberIds,
      })
    }

    cred.amount = roundMoney(cred.amount - amount)
    debt.amount = roundMoney(debt.amount - amount)

    if (cred.amount < 0.01) ci++
    if (debt.amount < 0.01) di++
  }

  return routes
}

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORY & SUBCATEGORY TAXONOMY
// ──────────────────────────────────────────────────────────────────────────────

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

/** Vivid two-stop gradient hex colors for React Native LinearGradient */
export function getCategoryGradientColors(category: string): [string, string] {
  const gradients: Record<string, [string, string]> = {
    food:          ['#FF6B6B', '#FFA07A'], // Coral -> Peach
    travel:        ['#3B82F6', '#06B6D4'], // Blue -> Cyan
    stay:          ['#10B981', '#14B8A6'], // Emerald -> Teal
    entertainment: ['#8B5CF6', '#D946EF'], // Purple -> Fuchsia
    shopping:      ['#EC4899', '#F43F5E'], // Pink -> Rose
    alcohol:       ['#F59E0B', '#EF4444'], // Amber -> Red
    fuel:          ['#F97316', '#F59E0B'], // Orange -> Amber
    tickets:       ['#6366F1', '#3B82F6'], // Indigo -> Blue
    misc:          ['#8B5CF6', '#6366F1'], // Purple -> Indigo
  }
  return gradients[category] || ['#6366F1', '#8B5CF6']
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    food:          '#FF6B6B',
    travel:        '#3B82F6',
    stay:          '#10B981',
    entertainment: '#8B5CF6',
    shopping:      '#EC4899',
    alcohol:       '#F59E0B',
    fuel:          '#F97316',
    tickets:       '#6366F1',
    misc:          '#8B5CF6',
  }
  return colors[category] || '#6366F1'
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

// Build UPI payment link
export function buildUpiLink(upiId: string, name: string, amount: number, note: string): string {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0
  const cleanUpi = encodeURIComponent((upiId || '').trim().replace(/[\r\n\t]/g, ''))
  const cleanName = encodeURIComponent((name || '').trim().replace(/[\r\n\t]/g, ''))
  const cleanAmount = safeAmount.toFixed(2)
  const cleanNote = encodeURIComponent((note || '').trim().replace(/[\r\n\t]/g, ''))
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&tn=${cleanNote}&cu=INR`
}
