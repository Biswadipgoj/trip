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

// One payer's contribution when an expense has multiple payers
export interface ExpensePayer {
  memberId: string
  amount: number
}

export interface Expense {
  id: string
  tripId: string
  title: string
  amount: number
  paidBy: string // primary payer member id (kept for backward compat)
  payers?: ExpensePayer[] // when present, overrides paidBy (multi-payer support)
  category: ExpenseCategory
  subcategory?: string // e.g. food → 'lunch', travel → 'train'
  participants: string[] // member ids who share this expense
  splitType: SplitType
  splits: ParticipantSplit[] // populated for custom/percentage/quantity splits
  createdAt: string
  notes?: string
}

// Room within a hotel booking
export interface Room {
  id: string
  name: string     // e.g. "Room A", "Deluxe Suite"
  cost: number     // this room's cost
  occupantIds: string[] // member ids staying in this room
}

// A hotel booking that contains multiple rooms
export interface HotelExpense {
  id: string
  tripId: string
  title: string          // e.g. "Goa Beach Resort"
  totalAmount: number    // sum of all room costs
  paidBy: string         // who made the payment
  rooms: Room[]
  createdAt: string
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
  budget?: number // planned trip budget in ₹ (optional, device-local)
}

export interface TripSession {
  tripId: string
  memberId: string
  tripCode: string
}

// Invite link payload — carried in the join URL so links work across devices.
// Never contains the trip password: `sig` is a hash of (tripCode + password)
// that the joining device verifies against the password the user types in.
export interface InvitePayload {
  v: number              // payload version
  trip: Omit<Trip, 'password'>
  exp: number            // expiry (unix ms)
  sig: string            // hash(tripCode|password) — proves a correct password without exposing it
}

export type InviteParseResult =
  | { ok: true; payload: InvitePayload }
  | { ok: false; reason: 'invalid' | 'expired' }

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
  // All members behind each side (>1 when a settlement group pays/receives
  // as one entity). Snapshotted onto the Settlement so a confirmed couple
  // payment keeps settling both members even if the group is later deleted.
  fromMemberIds?: string[]
  toMemberIds?: string[]
}

// ─── Attachments ─────────────────────────────────────────────────────────────
// Bill/receipt photos (kind 'bill', linked to an expense or hotel stay) and UPI
// payment screenshots (kind 'payment_proof', linked to a payment). Images live
// in the Supabase Storage bucket `trip-media`; rows in the `attachments` table.

export type AttachmentKind = 'bill' | 'payment_proof'

/** 'pending' = waiting to upload, 'uploaded' = stored in the cloud. */
export type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface Attachment {
  id: string
  tripId: string
  kind: AttachmentKind
  expenseId?: string
  hotelExpenseId?: string
  // Payment proofs: the payment they belong to. The settlement id can change
  // while a due is still open, so direction + amount are stored for matching.
  settlementId?: string
  fromMemberId?: string
  toMemberId?: string
  amount?: number
  /** Object path in the `trip-media` bucket, set once uploaded. */
  storagePath?: string
  /** On-device/browser copy (blob: or object URL), for instant local preview. */
  localUri?: string
  mimeType: string
  width?: number
  height?: number
  sizeBytes?: number
  uploadedBy?: string
  createdAt: string
  upload: UploadState
  uploadError?: string
  attempts?: number
  /** Earliest time (ms epoch) for the next upload retry. */
  nextAttemptAt?: number
}

export type DeletableTable = 'expenses' | 'hotel_expenses' | 'settlement_groups' | 'sponsorships' | 'attachments' | 'settlements'

export type OutboxOp =
  | { kind: 'delete'; table: DeletableTable; rowId: string }
  | { kind: 'memberUpi'; memberId: string; upiId: string; upiName?: string }
  | { kind: 'closeTrip' }
  | { kind: 'removeMedia'; paths: string[] }

export interface OutboxEntry {
  id: string
  tripId: string
  op: OutboxOp
  attempts: number
  lastError?: string
  createdAt: string
}

