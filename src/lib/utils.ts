import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  MemberBalance, Expense, Member, SettlementRoute,
  SettlementGroup, Sponsorship, HotelExpense, ParticipantSplit
} from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
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
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const AVATAR_COLORS = [
  'hsl(240, 78%, 58%)',
  'hsl(280, 78%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(25, 80%, 55%)',
  'hsl(158, 60%, 45%)',
  'hsl(195, 70%, 48%)',
  'hsl(45, 80%, 52%)',
  'hsl(310, 70%, 52%)',
]

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

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
      const share = expense.amount / expense.participants.length
      expense.participants.forEach(pid => { shares[pid] = share })
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
      const share = expense.amount / expense.participants.length
      expense.participants.forEach(pid => { shares[pid] = share })
    }
  }

  return shares
}

/**
 * Resolves per-member shares for hotel rooms.
 * Returns a map of memberId → total room cost owed.
 */
export function resolveHotelSplits(hotel: HotelExpense): Record<string, number> {
  const shares: Record<string, number> = {}

  hotel.rooms.forEach(room => {
    if (room.occupantIds.length === 0) return
    const perPerson = room.cost / room.occupantIds.length
    room.occupantIds.forEach(oid => {
      shares[oid] = (shares[oid] ?? 0) + perPerson
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
    // Payer gets credit
    paid[expense.paidBy] = (paid[expense.paidBy] ?? 0) + expense.amount

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
    totalPaid: paid[m.id] ?? 0,
    totalOwed: owed[m.id] ?? 0,
    netBalance: (paid[m.id] ?? 0) - (owed[m.id] ?? 0),
  }))
}

/**
 * Applies sponsorships: sponsored member's balance is added to their sponsor.
 * Returns modified balances (sponsored member removed, sponsor's balance updated).
 */
export function applySponshorships(
  balances: MemberBalance[],
  sponsorships: Sponsorship[]
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
  members: Member[],
  groups: SettlementGroup[],
  sponsorships: Sponsorship[]
): SettlementRoute[] {
  // Step 1: Apply sponsorships
  const balancesAfterSponsorship = applySponshorships(rawBalances, sponsorships)

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

      // Pick the first "real" member as representative (skip zero-balance sponsored)
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

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    food:          'hsl(25, 80%, 55%)',
    travel:        'hsl(195, 70%, 48%)',
    stay:          'hsl(158, 60%, 45%)',
    entertainment: 'hsl(280, 78%, 55%)',
    shopping:      'hsl(340, 75%, 55%)',
    alcohol:       'hsl(38, 85%, 52%)',
    fuel:          'hsl(15, 80%, 52%)',
    tickets:       'hsl(260, 78%, 60%)',
    misc:          'hsl(240, 78%, 58%)',
  }
  return colors[category] || 'hsl(240, 78%, 58%)'
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
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: amount.toFixed(2),
    tn: note,
    cu: 'INR',
  })
  return `upi://pay?${params.toString()}`
}
