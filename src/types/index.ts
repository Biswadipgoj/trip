// Core types for Trip Expense Manager

export type TripStatus = 'active' | 'closed'
export type PaymentStatus = 'pending' | 'paid' | 'confirmed'
export type ExpenseCategory = 'food' | 'travel' | 'stay' | 'entertainment' | 'shopping' | 'alcohol' | 'fuel' | 'tickets' | 'misc'
export type SplitType = 'equal' | 'custom' | 'percentage' | 'quantity' | 'room'

// Per-participant split data (used for custom/percentage/quantity splits)
export interface ParticipantSplit {
  memberId: string
  // For 'custom': direct amount
  // For 'percentage': percent (0-100)
  // For 'quantity': unit count (e.g. bottles)
  value: number
  // Resolved actual share amount (calculated)
  resolvedAmount?: number
}

export interface Member {
  id: string
  tripId: string
  name: string
  mobile: string
  pin: string
  upiId?: string
  upiName?: string
  avatarColor: string
  joinedAt: string
}

export interface MemberUnit {
  id: string
  tripId: string
  name: string           // e.g. "Rahul & Priya"
  memberIds: string[]    // members merged into this unit
}

export interface Expense {
  id: string
  tripId: string
  title: string
  amount: number
  paidBy: Record<string, number> // Map of memberId -> amount paid (supports multiple payers)
  category: ExpenseCategory
  participants: string[] // member ids (or unit ids) who share this expense
  splitType: SplitType
  splits: ParticipantSplit[] // populated for custom/percentage/quantity splits
  rooms?: Room[] // for hotel/room-based splits
  createdAt: string
  notes?: string
}

// Room within a hotel booking
export interface Room {
  id: string
  name: string     // e.g. "Room A", "Deluxe Suite"
  cost: number     // this room's cost
  occupantIds: string[] // member/unit ids staying in this room
}

// Settlement Group: multiple members treated as ONE financial entity at settlement time
// Does NOT affect individual expense participation
export interface SettlementGroup {
  id: string
  tripId: string
  name: string           // e.g. "Rahul & Priya"
  memberIds: string[]    // members in this group
}

// Sponsorship: sponsor absorbs sponsored member's debt/credit at settlement
// Sponsored member still participates individually in expenses
export interface Sponsorship {
  id: string
  tripId: string
  sponsorMemberId: string    // pays on behalf of sponsored
  sponsoredMemberId: string  // their balance merges into sponsor
}

export interface Settlement {
  id: string
  tripId: string
  fromMemberId: string
  toMemberId: string
  amount: number
  status: PaymentStatus
  paidAt?: string
  confirmedAt?: string
  // For group settlements, track which member IDs are involved
  fromGroupIds?: string[]
  toGroupIds?: string[]
}

export interface Trip {
  id: string
  tripCode: string
  name: string
  password: string
  creatorId: string
  status: TripStatus
  createdAt: string
  closedAt?: string
}

export interface TripSession {
  tripId: string
  memberId: string
  tripCode: string
}

// Computed types
export interface MemberBalance {
  memberId: string
  name: string
  avatarColor: string
  totalPaid: number
  totalOwed: number
  netBalance: number // positive = gets money back, negative = owes money
}

export interface SettlementRoute {
  id: string
  fromMemberId: string
  toMemberId: string
  fromName: string
  toName: string
  fromColor: string
  toColor: string
  fromUpiId?: string
  toUpiId?: string
  amount: number
}
