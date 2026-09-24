// Cloud-first writes. TripMate is Supabase-only: every change is saved on the
// server first and only then shown as done — nothing lives only on the phone.
// The local store is a read cache that makes screens load instantly; it is
// updated through the store's apply* methods once Supabase has accepted a write.
//
// Offline, or in a build without Supabase settings, writes fail with a clear
// CloudError instead of being kept on the device.
import type { Expense, HotelExpense, Member, PaymentStatus, Settlement, SettlementGroup, Trip } from '../types'
import { useStore } from './store'
import { useSyncStatus } from './synclog'
import { ALLOW_LOCAL_PREVIEW } from './config'
import {
  describeError, isRemoteEnabled, remoteAddManualMember, remoteCloseTrip, remoteCreateTrip,
  remoteDeleteAttachment, remoteDeleteExpense, remoteDeleteHotelExpense, remoteDeleteSettlementGroup,
  remoteDeleteSettlementStatus,
  remoteFindTripByCode, remotePushExpense, remotePushHotelExpense, remotePushSettlementGroup,
  remotePushSettlementStatus, remoteUpdateMemberUpi,
} from './remote'
import { generateId, generateTripCode, getAvatarColor } from './utils'
import { toast } from './toast'

export type CloudErrorKind = 'offline' | 'config' | 'server'

export class CloudError extends Error {
  kind: CloudErrorKind
  constructor(message: string, kind: CloudErrorKind) {
    super(message)
    this.kind = kind
  }
}

/** 'local' only in a developer preview build (EXPO_PUBLIC_ALLOW_LOCAL_PREVIEW=1). */
function mode(): 'cloud' | 'local' {
  if (!isRemoteEnabled()) {
    if (ALLOW_LOCAL_PREVIEW) return 'local'
    throw new CloudError('This build is not connected to the TripMate cloud.', 'config')
  }
  if (!useSyncStatus.getState().online) {
    throw new CloudError("You're offline. Connect to the internet to save changes.", 'offline')
  }
  return 'cloud'
}

async function must(push: Promise<boolean>, what: string) {
  let ok = false
  try {
    ok = await push
  } catch (err) {
    throw new CloudError(`Couldn't ${what}: ${describeError(err)}`, 'server')
  }
  if (!ok) throw new CloudError(`Couldn't ${what}. Check your connection and try again.`, 'server')
}

export function cloudMessage(err: unknown): string {
  return err instanceof CloudError ? err.message : describeError(err)
}

/** Runs a cloud write; on failure shows the reason as a toast and returns null. */
export async function withCloud<T>(write: () => Promise<T>): Promise<T | null> {
  try {
    return await write()
  } catch (err) {
    toast.error(cloudMessage(err))
    return null
  }
}

// ─── Trips & members ──────────────────────────────────────────────────────────

export async function cloudCreateTrip(name: string, creatorName: string, mobile: string, password: string, pin: string) {
  if (mode() === 'local') return useStore.getState().createTrip(name, creatorName, mobile, password, pin)

  const now = new Date().toISOString()
  const memberId = generateId()
  // Trip codes are random; on the rare clash with an existing trip, try another.
  for (let attempt = 0; attempt < 3; attempt++) {
    const trip: Trip = {
      id: generateId(), tripCode: generateTripCode(), name: name.trim(), password,
      creatorId: memberId, status: 'active', createdAt: now,
    }
    const member: Member = {
      id: memberId, tripId: trip.id, name: creatorName.trim(), mobile, pin,
      avatarColor: getAvatarColor(0), joinedAt: now,
    }
    if (await remoteCreateTrip(trip, member).catch(() => false)) {
      useStore.getState().applyTrip(trip, member)
      return { trip, member }
    }
    const clash = await remoteFindTripByCode(trip.tripCode).then(t => !!t && t.id !== trip.id).catch(() => false)
    if (!clash) break
  }
  throw new CloudError("Couldn't create the trip on the server. Check your connection and try again.", 'server')
}

export async function cloudCloseTrip(tripId: string) {
  if (mode() === 'local') return useStore.getState().closeTrip(tripId)
  await must(remoteCloseTrip(tripId), 'close the trip')
  useStore.getState().applyTripClosed(tripId, new Date().toISOString())
}

export async function cloudAddMember(tripId: string, name: string): Promise<Member> {
  if (mode() === 'local') return useStore.getState().addMember(tripId, name)
  const count = useStore.getState().members.filter(m => m.tripId === tripId).length
  const member: Member = {
    id: generateId(), tripId, name: name.trim(), mobile: '', pin: '',
    avatarColor: getAvatarColor(count), joinedAt: new Date().toISOString(),
  }
  await must(remoteAddManualMember(member), 'add the member')
  useStore.getState().applyMember(member)
  return member
}

export async function cloudUpdateUpi(memberId: string, upiId: string, upiName?: string) {
  if (mode() === 'local') return useStore.getState().updateMemberUpi(memberId, upiId, upiName)
  await must(remoteUpdateMemberUpi(memberId, upiId, upiName), 'save the UPI ID')
  useStore.getState().applyMemberUpi(memberId, upiId, upiName)
}

// ─── Expenses & stays ─────────────────────────────────────────────────────────

export async function cloudAddExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  if (mode() === 'local') return useStore.getState().addExpense(data)
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new CloudError('Enter a valid amount', 'server')
  const expense: Expense = { ...data, id: generateId(), createdAt: new Date().toISOString() }
  await must(remotePushExpense(expense), 'save the expense')
  useStore.getState().applyExpense(expense)
  return expense
}

export async function cloudAddHotel(data: Omit<HotelExpense, 'id' | 'createdAt'>): Promise<HotelExpense> {
  if (mode() === 'local') return useStore.getState().addHotelExpense(data)
  if (!Number.isFinite(data.totalAmount) || data.totalAmount <= 0) throw new CloudError('Add at least one room with a cost', 'server')
  const hotel: HotelExpense = { ...data, id: generateId(), createdAt: new Date().toISOString() }
  await must(remotePushHotelExpense(hotel), 'save the stay')
  useStore.getState().applyHotelExpense(hotel)
  return hotel
}

/** Deletes an expense or stay; the server removes its bill rows (cascade). */
export async function cloudDeleteItem(kind: 'expense' | 'hotel', id: string) {
  const st = useStore.getState()
  if (mode() === 'local') return kind === 'expense' ? st.deleteExpense(id) : st.deleteHotelExpense(id)
  const tripId = (kind === 'expense' ? st.expenses.find(e => e.id === id) : st.hotelExpenses.find(h => h.id === id))?.tripId
  await must(kind === 'expense' ? remoteDeleteExpense(id) : remoteDeleteHotelExpense(id), `delete the ${kind === 'expense' ? 'expense' : 'stay'}`)
  const paths = useStore.getState().applyRemoval(kind === 'expense' ? 'expenses' : 'hotel_expenses', id)
  // Image files go after their rows; the outbox retries until the bucket agrees.
  if (tripId && paths.length > 0) useStore.getState().enqueue(tripId, { kind: 'removeMedia', paths })
}

// ─── Units (couples) ──────────────────────────────────────────────────────────

export async function cloudAddGroup(tripId: string, name: string, memberIds: string[]): Promise<SettlementGroup> {
  if (mode() === 'local') return useStore.getState().addSettlementGroup(tripId, name, memberIds)
  const group: SettlementGroup = { id: generateId(), tripId, name, memberIds }
  await must(remotePushSettlementGroup(group), 'create the unit')
  useStore.getState().applySettlementGroup(group)
  return group
}

export async function cloudRemoveGroup(id: string) {
  if (mode() === 'local') return useStore.getState().removeSettlementGroup(id)
  await must(remoteDeleteSettlementGroup(id), 'remove the unit')
  useStore.getState().applyRemoval('settlement_groups', id)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function cloudSetPaymentStatus(settlementId: string, status: PaymentStatus) {
  const current = useStore.getState().settlements.find(x => x.id === settlementId)
  if (!current) throw new CloudError('This payment was just recalculated — open it again.', 'server')
  if (mode() === 'local') return useStore.getState().updateSettlementStatus(settlementId, status)
  const now = new Date().toISOString()
  const updated: Settlement = {
    ...current,
    status,
    paidAt: status === 'paid' || status === 'confirmed' ? (current.paidAt ?? now) : undefined,
    confirmedAt: status === 'confirmed' ? now : undefined,
  }
  await must(remotePushSettlementStatus(updated), 'update the payment')
  useStore.getState().applySettlement(updated)
}

export async function cloudDeleteSettlement(settlementId: string) {
  const current = useStore.getState().settlements.find(x => x.id === settlementId)
  if (!current) return
  if (mode() === 'local') return useStore.getState().deleteSettlement(settlementId)
  await must(remoteDeleteSettlementStatus(settlementId), 'delete the payment')
  useStore.getState().deleteSettlement(settlementId)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function cloudRemoveAttachment(id: string) {
  const st = useStore.getState()
  const a = st.attachments.find(x => x.id === id)
  if (!a) return
  // Not uploaded yet: nothing on the server to delete.
  const onServer = a.upload === 'uploaded' || !!a.storagePath || !!st.synced[id]
  if (!onServer || mode() === 'local') return st.removeAttachment(id)
  await must(remoteDeleteAttachment(id), 'delete the photo')
  const paths = useStore.getState().applyRemoval('attachments', id)
  if (paths.length > 0) useStore.getState().enqueue(a.tripId, { kind: 'removeMedia', paths })
}
