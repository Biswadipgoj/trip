import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  MemberBalance, Expense, Member, SettlementRoute,
  SettlementGroup, Sponsorship, ParticipantSplit, MemberUnit
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

// Lighter pastel colors for the new theme
export const AVATAR_COLORS = [
  'hsl(240, 60%, 85%)', // soft pastel purple
  'hsl(158, 50%, 80%)', // mint green
  'hsl(340, 60%, 85%)', // pastel pink
  'hsl(25,  70%, 80%)', // soft peach
  'hsl(195, 60%, 85%)', // light blue
  'hsl(45,  70%, 80%)', // soft yellow
  'hsl(310, 50%, 85%)', // soft lavender
  'hsl(200, 50%, 85%)', // sky blue
]

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

// ──────────────────────────────────────────────────────────────────────────────
// BALANCE CALCULATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Maps participant IDs (which could be unit IDs or member IDs) into a flat list
 * of actual member IDs. Also returns the total weight.
 */
function resolveParticipants(
  participants: string[],
  memberUnits: MemberUnit[],
  members: Member[]
): { memberWeights: Record<string, number>, totalWeight: number } {
  const memberWeights: Record<string, number> = {}
  let totalWeight = 0

  participants.forEach(pid => {
    const unit = memberUnits.find(u => u.id === pid)
    if (unit) {
      // A unit acts as 1 entity in splits, so we divide that 1 weight equally among its members.
      const weightPerMember = 1 / unit.memberIds.length
      unit.memberIds.forEach(mid => {
        memberWeights[mid] = (memberWeights[mid] || 0) + weightPerMember
      })
      totalWeight += 1 // the whole unit counts as 1
    } else {
      // It's a regular member
      memberWeights[pid] = (memberWeights[pid] || 0) + 1
      totalWeight += 1
    }
  })

  return { memberWeights, totalWeight }
}

/**
 * Resolves the actual per-member share amounts for a single expense.
 * Returns a map of memberId → share amount.
 */
export function resolveExpenseSplits(
  expense: Expense,
  memberUnits: MemberUnit[],
  members: Member[]
): Record<string, number> {
  const shares: Record<string, number> = {}

  if (expense.splitType === 'room' && expense.rooms) {
    // Hotel/Room split
    expense.rooms.forEach(room => {
      if (room.occupantIds.length === 0) return
      
      const { memberWeights, totalWeight } = resolveParticipants(room.occupantIds, memberUnits, members)
      
      if (totalWeight > 0) {
        const costPerUnit = room.cost / totalWeight
        Object.entries(memberWeights).forEach(([mid, weight]) => {
          shares[mid] = (shares[mid] || 0) + (costPerUnit * weight)
        })
      }
    })
    return shares
  }

  if (expense.participants.length === 0) return shares

  const { memberWeights, totalWeight } = resolveParticipants(expense.participants, memberUnits, members)

  switch (expense.splitType) {
    case 'equal': {
      if (totalWeight > 0) {
        const costPerUnit = expense.amount / totalWeight
        Object.entries(memberWeights).forEach(([mid, weight]) => {
          shares[mid] = (shares[mid] || 0) + (costPerUnit * weight)
        })
      }
      break
    }

    case 'custom': {
      // splits[i].value is the direct amount for that member/unit
      expense.splits.forEach(s => {
        const unit = memberUnits.find(u => u.id === s.memberId)
        if (unit) {
          const perMember = s.value / unit.memberIds.length
          unit.memberIds.forEach(mid => {
            shares[mid] = (shares[mid] || 0) + perMember
          })
        } else {
          shares[s.memberId] = (shares[s.memberId] || 0) + s.value
        }
      })
      break
    }

    case 'percentage': {
      // splits[i].value is the percentage (0–100)
      expense.splits.forEach(s => {
        const val = (s.value / 100) * expense.amount
        const unit = memberUnits.find(u => u.id === s.memberId)
        if (unit) {
          const perMember = val / unit.memberIds.length
          unit.memberIds.forEach(mid => {
            shares[mid] = (shares[mid] || 0) + perMember
          })
        } else {
          shares[s.memberId] = (shares[s.memberId] || 0) + val
        }
      })
      break
    }

    case 'quantity': {
      // splits[i].value is the quantity (e.g. bottles, items)
      const totalQty = expense.splits.reduce((sum, s) => sum + s.value, 0)
      if (totalQty > 0) {
        expense.splits.forEach(s => {
          const val = (s.value / totalQty) * expense.amount
          const unit = memberUnits.find(u => u.id === s.memberId)
          if (unit) {
            const perMember = val / unit.memberIds.length
            unit.memberIds.forEach(mid => {
              shares[mid] = (shares[mid] || 0) + perMember
            })
          } else {
            shares[s.memberId] = (shares[s.memberId] || 0) + val
          }
        })
      }
      break
    }

    default: {
      // fallback to equal
      if (totalWeight > 0) {
        const costPerUnit = expense.amount / totalWeight
        Object.entries(memberWeights).forEach(([mid, weight]) => {
          shares[mid] = (shares[mid] || 0) + (costPerUnit * weight)
        })
      }
    }
  }

  return shares
}

/**
 * Main balance calculator.
 */
export function calculateBalances(
  expenses: Expense[],
  members: Member[],
  memberUnits: MemberUnit[]
): MemberBalance[] {
  // Initialize
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  members.forEach(m => { paid[m.id] = 0; owed[m.id] = 0 })

  expenses.forEach(expense => {
    // Process multiple payers
    if (expense.paidBy) {
      Object.entries(expense.paidBy).forEach(([pid, amount]) => {
        paid[pid] = (paid[pid] ?? 0) + amount
      })
    }

    // Process shares
    const shares = resolveExpenseSplits(expense, memberUnits, members)
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
 */
export function calculateSettlements(
  rawBalances: MemberBalance[],
  members: Member[],
  groups: SettlementGroup[],
  sponsorships: Sponsorship[],
  memberUnits: MemberUnit[]
): SettlementRoute[] {
  // Step 1: Apply sponsorships
  const balancesAfterSponsorship = applySponshorships(rawBalances, sponsorships)

  // Build member lookup
  const memberMap: Record<string, Member> = {}
  members.forEach(m => { memberMap[m.id] = m })

  // Step 2: Apply settlement groups AND member units
  // Merge grouped members' balances into a single virtual "group" balance
  const groupedBalances: Record<string, number> = {} // entityKey → net balance
  const entityToMembers: Record<string, string[]> = {} // entityKey → member ids

  // Map each member to their group or unit (if any)
  const memberToGroup: Record<string, string> = {}
  
  // Member Units take precedence, or we can just treat them as groups
  memberUnits.forEach(u => {
    u.memberIds.forEach(mid => { memberToGroup[mid] = u.id })
  })
  
  groups.forEach(g => {
    g.memberIds.forEach(mid => { 
      // If already in a unit, it overrides groups or vice-versa.
      // For simplicity, we just assign to group.
      memberToGroup[mid] = g.id 
    })
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
      
      const fromUnitName = memberUnits.find(u => u.id === debt.key)?.name || groups.find(g => g.id === debt.key)?.name
      const toUnitName = memberUnits.find(u => u.id === cred.key)?.name || groups.find(g => g.id === cred.key)?.name

      if (fromM && toM) {
        routes.push({
          id: generateId(),
          fromMemberId: fromId,
          toMemberId:   toId,
          fromName:     fromUnitName || (fromMembers.length > 1
            ? fromMembers.map(id => memberMap[id]?.name || id).join(' & ')
            : fromM.name),
          toName:       toUnitName || (toMembers.length > 1
            ? toMembers.map(id => memberMap[id]?.name || id).join(' & ')
            : toM.name),
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

// Light theme colors for categories
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    food:          'hsl(25, 60%, 75%)',
    travel:        'hsl(195, 50%, 75%)',
    stay:          'hsl(158, 40%, 75%)',
    entertainment: 'hsl(280, 60%, 80%)',
    shopping:      'hsl(340, 60%, 80%)',
    alcohol:       'hsl(38, 70%, 75%)',
    fuel:          'hsl(15, 60%, 75%)',
    tickets:       'hsl(260, 60%, 80%)',
    misc:          'hsl(240, 60%, 80%)',
  }
  return colors[category] || 'hsl(240, 60%, 80%)'
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
