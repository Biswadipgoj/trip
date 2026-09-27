// Local-first writes with background cloud sync.
// TripMate ensures changes are saved locally immediately (optimistic UI),
// so adding expenses, stays, payments, units, or trips works 100% offline.
// When online, changes are synced to Supabase automatically in the background.
import type { Expense, HotelExpense, Member, PaymentStatus, Settlement, SettlementGroup, Trip } from '../types'
import { useStore } from './store'
import { useSyncStatus } from './synclog'
import {
  describeError, isRemoteEnabled, remoteAddManualMember, remoteCloseTrip, remoteCreateTrip,
  remoteDeleteAttachment, remoteDeleteExpense, remoteDeleteHotelExpense, remoteDeleteSettlementGroup,
  remoteDeleteSettlementStatus, remoteEnsureTrip, remotePushExpense, remotePushHotelExpense,
  remotePushSettlementGroup, remotePushSettlementStatus, remoteUpdateMemberUpi,
} from './remote'
import { toast } from './toast'

export type CloudErrorKind = 'offline' | 'config' | 'server'

export class CloudError extends Error {
  kind: CloudErrorKind
  constructor(message: string, kind: CloudErrorKind) {
    super(message)
    this.kind = kind
  }
}

export function cloudMessage(err: unknown): string {
  return err instanceof CloudError ? err.message : describeError(err)
}

/** Runs an operation; shows error toast on unexpected failure and returns null. */
export async function withCloud<T>(write: () => Promise<T> | T): Promise<T | null> {
  try {
    return await write()
  } catch (err) {
    console.warn('[withCloud] operation error:', err)
    toast.error(cloudMessage(err))
    return null
  }
}

// ─── Trips & members ──────────────────────────────────────────────────────────

export async function cloudCreateTrip(name: string, creatorName: string, mobile: string, password: string, pin: string) {
  // Always create locally first so the user can immediately use the trip
  const result = useStore.getState().createTrip(name, creatorName, mobile, password, pin)
  return result
}

export async function cloudCloseTrip(tripId: string): Promise<void> {
  useStore.getState().closeTrip(tripId)
  if (isRemoteEnabled() && useSyncStatus.getState().online) {
    try {
      await remoteCloseTrip(tripId)
    } catch {}
  }
}

export async function cloudAddMember(tripId: string, name: string): Promise<Member> {
  return useStore.getState().addMember(tripId, name)
}

export async function cloudUpdateUpi(memberId: string, upiId: string, upiName?: string): Promise<void> {
  useStore.getState().updateMemberUpi(memberId, upiId, upiName)
}

// ─── Expenses & stays ─────────────────────────────────────────────────────────

export async function cloudAddExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new CloudError('Enter a valid amount', 'server')
  }
  // Store addExpense persists to local state immediately and queues remote push
  return useStore.getState().addExpense(data)
}

export async function cloudAddHotel(data: Omit<HotelExpense, 'id' | 'createdAt'>): Promise<HotelExpense> {
  if (!Number.isFinite(data.totalAmount) || data.totalAmount <= 0) {
    throw new CloudError('Add at least one room with a cost', 'server')
  }
  return useStore.getState().addHotelExpense(data)
}

/** Deletes an expense or stay; local store updates and queues deletion for server */
export async function cloudDeleteItem(kind: 'expense' | 'hotel', id: string): Promise<void> {
  if (kind === 'expense') {
    useStore.getState().deleteExpense(id)
  } else {
    useStore.getState().deleteHotelExpense(id)
  }
}

// ─── Units (couples) ──────────────────────────────────────────────────────────

export async function cloudAddGroup(tripId: string, name: string, memberIds: string[]): Promise<SettlementGroup> {
  return useStore.getState().addSettlementGroup(tripId, name, memberIds)
}

export async function cloudRemoveGroup(id: string): Promise<void> {
  useStore.getState().removeSettlementGroup(id)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function cloudSetPaymentStatus(settlementId: string, status: PaymentStatus): Promise<void> {
  useStore.getState().updateSettlementStatus(settlementId, status)
}

export async function cloudDeleteSettlement(settlementId: string): Promise<void> {
  useStore.getState().deleteSettlement(settlementId)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function cloudRemoveAttachment(id: string): Promise<void> {
  useStore.getState().removeAttachment(id)
}

