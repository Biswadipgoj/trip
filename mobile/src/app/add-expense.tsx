// Add an expense (web expenses modal) as a full screen: title, amount,
// category + subcategory, Stay mode with rooms & occupants, one or several
// payers, participants, equal / custom split with live totals, notes — and
// bill photos (kept as drafts, linked + uploaded once the expense is saved).
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { router, useLocalSearchParams } from 'expo-router'
import { BedDouble, Check, IndianRupee, Paperclip, Plus, Tag, Users, X } from 'lucide-react-native'
import type { ExpenseCategory, ExpensePayer, ParticipantSplit, Room, SplitType } from '../types'
import { useStore } from '../lib/store'
import { useTripData } from '../lib/hooks'
import { attachImage, consumeRecoveredBill } from '../lib/uploads'
import { deleteLocalFiles, type PreparedImage } from '../lib/media'
import { cloudAddExpense, cloudAddHotel, cloudMessage } from '../lib/cloud'
import { toast } from '../lib/toast'
import {
  CATEGORIES, SUBCATEGORIES, formatCurrency, generateId, getCategoryIcon, getSplitTypeIcon, getSplitTypeLabel,
} from '../lib/utils'
import { Screen } from '../components/ui/Screen'
import { KeyboardScroll } from '../components/ui/KeyboardScroll'
import { GlassCard } from '../components/ui/GlassCard'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Checkbox, SelectPill } from '../components/ui/CategoryChip'
import { T } from '../components/ui/Text'
import { AttachmentPicker } from '../components/attachments/AttachmentPicker'
import { DraftStrip } from '../components/attachments/AttachmentStrip'
import { Collapsible, FadeIn, SMOOTH_LAYOUT } from '../components/animated/FadeInView'
import { PressScale, tick } from '../components/animated/SpringPressable'
import { C, brand500, ink } from '../theme/colors'

const SPLIT_TYPES: SplitType[] = ['equal', 'custom']
const newRoom = (n: number): Room => ({ id: generateId(), name: `Room ${n}`, cost: 0, occupantIds: [] })
const cleanNumber = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')

export default function AddExpenseScreen() {
  const reduced = useReducedMotion()
  const params = useLocalSearchParams<{ category?: string }>()
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const { members } = useTripData(tripId)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(session?.memberId ?? '')
  const [multiPayer, setMultiPayer] = useState(false)
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [category, setCategory] = useState<ExpenseCategory>(params.category === 'stay' ? 'stay' : 'misc')
  const [subcategory, setSubcategory] = useState('')
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [participants, setParticipants] = useState<string[]>(() => members.map(m => m.id))
  const [splitValues, setSplitValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rooms, setRooms] = useState<Room[]>([newRoom(1)])
  const [drafts, setDrafts] = useState<PreparedImage[]>([])
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<TextInput>(null)
  const saved = useRef(false)
  const draftsRef = useRef<PreparedImage[]>([])
  draftsRef.current = drafts

  // A bill photo recovered after Android killed the app mid-capture.
  useEffect(() => {
    const recovered = consumeRecoveredBill()
    if (recovered) setDrafts(d => [...d, recovered])
  }, [])

  // Discarded drafts: remove their on-device copies.
  useEffect(
    () => () => {
      if (!saved.current && draftsRef.current.length > 0) deleteLocalFiles(draftsRef.current.map(d => d.uri))
    },
    []
  )

  const isStay = category === 'stay'
  const totalRoomCost = rooms.reduce((s, r) => s + (r.cost || 0), 0)
  const totalAmt = isStay ? totalRoomCost : parseFloat(amount) || 0

  const resolvedShares = useMemo(() => {
    const shares: Record<string, number> = {}
    if (participants.length === 0 || totalAmt === 0) return shares
    if (splitType === 'equal') {
      participants.forEach(id => { shares[id] = totalAmt / participants.length })
    } else if (splitType === 'custom') {
      participants.forEach(id => { shares[id] = parseFloat(splitValues[id] || '0') })
    }
    return shares
  }, [splitType, participants, splitValues, totalAmt])

  const splitSum = Object.values(resolvedShares).reduce((a, b) => a + b, 0)
  const splitDiff = Math.abs(splitSum - totalAmt)
  const payerSum = Object.values(payerAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const activePayers: ExpensePayer[] = Object.entries(payerAmounts)
    .map(([memberId, v]) => ({ memberId, amount: parseFloat(v) || 0 }))
    .filter(p => p.amount > 0)

  const toggleParticipant = (id: string) =>
    setParticipants(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]))
  const updateRoom = (id: string, patch: Partial<Room>) =>
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const toggleOccupant = (roomId: string, memberId: string) =>
    setRooms(prev =>
      prev.map(r =>
        r.id !== roomId
          ? r
          : { ...r, occupantIds: r.occupantIds.includes(memberId) ? r.occupantIds.filter(x => x !== memberId) : [...r.occupantIds, memberId] }
      )
    )

  const fail = (errs: Record<string, string>) => {
    setErrors(errs)
    tick('error')
    toast.error(Object.values(errs)[0])
  }

  const finish = (target: { expenseId?: string; hotelExpenseId?: string }, label: string) => {
    if (tripId) drafts.forEach(img => attachImage(img, { kind: 'bill', tripId, ...target }, session?.memberId))
    saved.current = true
    tick('success')
    toast.success(drafts.length > 0 ? `${label} added with ${drafts.length} bill photo${drafts.length !== 1 ? 's' : ''}` : `${label} added`)
    if (router.canGoBack()) router.back()
    else router.replace('/expenses')
  }

  const handleAdd = async () => {
    if (!tripId || saving) return
    setSaving(true)
    try {
      if (isStay) {
        const errs: Record<string, string> = {}
        if (!title.trim()) errs.title = 'Hotel / stay name is required'
        if (totalRoomCost <= 0) errs.amount = 'Add at least one room with a cost'
        if (!paidBy) errs.paidBy = 'Select who paid'
        if (Object.keys(errs).length > 0) return fail(errs)
        const hotel = await cloudAddHotel({ tripId, title: title.trim(), totalAmount: totalRoomCost, paidBy, rooms })
        finish({ hotelExpenseId: hotel.id }, 'Stay')
        return
      }

      const errs: Record<string, string> = {}
      if (!title.trim()) errs.title = 'Title is required'
      if (!totalAmt || totalAmt <= 0) errs.amount = 'Enter a valid amount'
      if (participants.length === 0) errs.participants = 'Select at least one participant'
      if (multiPayer) {
        if (activePayers.length === 0) errs.paidBy = 'Enter how much each payer contributed'
        else if (Math.abs(payerSum - totalAmt) > 0.5) {
          errs.paidBy = `Payer amounts must sum to ${formatCurrency(totalAmt)} (current: ${formatCurrency(payerSum)})`
        }
      } else if (!paidBy) {
        errs.paidBy = 'Select who paid'
      }
      if (splitType === 'custom' && splitDiff > 0.5) {
        errs.split = `Custom amounts must sum to ${formatCurrency(totalAmt)} (current: ${formatCurrency(splitSum)})`
      }
      if (Object.keys(errs).length > 0) return fail(errs)

      const splits: ParticipantSplit[] = participants.map(id => ({
        memberId: id,
        value: parseFloat(splitValues[id] || '0'),
        resolvedAmount: resolvedShares[id] ?? 0,
      }))
      // Primary payer = largest contributor (kept for backward compatibility)
      const primaryPayer = multiPayer ? [...activePayers].sort((a, b) => b.amount - a.amount)[0].memberId : paidBy
      const expense = await cloudAddExpense({
        tripId,
        title: title.trim(),
        amount: totalAmt,
        paidBy: primaryPayer,
        payers: multiPayer ? activePayers : undefined,
        category,
        subcategory: subcategory || undefined,
        participants,
        splitType,
        splits,
        notes: notes.trim(),
      })
      finish({ expenseId: expense.id }, 'Expense')
    } catch (err) {
      toast.error(cloudMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/expenses'))

  return (
    <Screen edges={['top']}>
      <View style={styles.topBar}>
        <T variant="h2">{isStay ? 'Add Stay / Hotel' : 'Add Expense'}</T>
        <PressScale onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <X size={18} color={ink(0.65)} />
        </PressScale>
      </View>

      <KeyboardScroll contentContainerStyle={styles.scroll}>
        {/* Title + amount */}
        <FadeIn>
          <GlassCard contentStyle={styles.gap16}>
            <Field
              label={isStay ? 'Hotel / Stay Name' : 'Expense Title'}
              icon={Tag}
              placeholder={isStay ? 'e.g. Goa Beach Resort' : 'e.g. Dinner at Olive Bar'}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              autoCapitalize="sentences"
              error={errors.title}
              returnKeyType={isStay ? 'done' : 'next'}
              onSubmitEditing={() => !isStay && amountRef.current?.focus()}
              submitBehavior={isStay ? 'blurAndSubmit' : 'submit'}
              testID="expense-title"
            />
            {!isStay && (
              <Field
                ref={amountRef}
                label="Amount (₹)"
                icon={IndianRupee}
                placeholder="0"
                value={amount}
                onChangeText={v => setAmount(cleanNumber(v))}
                keyboardType="decimal-pad"
                big
                prefix="₹"
                error={errors.amount}
                testID="expense-amount"
              />
            )}
          </GlassCard>
        </FadeIn>

        {/* Category */}
        <FadeIn delay={60}>
          <Animated.View layout={SMOOTH_LAYOUT}>
            <GlassCard>
              <T variant="smallMedium" color={ink(0.6)} style={styles.label}>Category</T>
              <View style={styles.grid3}>
                {CATEGORIES.map(cat => (
                  <SelectPill
                    key={cat}
                    selected={category === cat}
                    onPress={() => { setCategory(cat); setSubcategory(''); setErrors({}) }}
                    style={styles.cell3}
                    dense
                    accessibilityLabel={cat}
                  >
                    <T variant="body">{getCategoryIcon(cat)}</T>
                    <T variant="smallMedium" color={category === cat ? C.ink : ink(0.65)} numberOfLines={1} style={styles.capital}>{cat}</T>
                  </SelectPill>
                ))}
              </View>
              {!isStay && SUBCATEGORIES[category] && (
                <Collapsible open>
                  <T variant="smallMedium" color={ink(0.6)} style={[styles.label, styles.mt16]}>Type (optional)</T>
                  <View style={styles.wrap}>
                    {SUBCATEGORIES[category].map(sub => (
                      <SelectPill
                        key={sub.id}
                        shape="pill"
                        selected={subcategory === sub.id}
                        onPress={() => setSubcategory(subcategory === sub.id ? '' : sub.id)}
                      >
                        <T variant="small">{sub.icon}</T>
                        <T variant="smallMedium" color={subcategory === sub.id ? C.ink : ink(0.65)}>{sub.label}</T>
                      </SelectPill>
                    ))}
                  </View>
                </Collapsible>
              )}
            </GlassCard>
          </Animated.View>
        </FadeIn>

        {/* Stay: rooms + occupants */}
        {isStay && (
          <Animated.View layout={SMOOTH_LAYOUT}>
            <GlassCard contentStyle={styles.gap12}>
              <View style={styles.between}>
                <View style={styles.inline}>
                  <BedDouble size={14} color={ink(0.6)} />
                  <T variant="smallMedium" color={ink(0.6)}>Rooms</T>
                </View>
                <PressScale onPress={() => setRooms(prev => [...prev, newRoom(prev.length + 1)])} style={styles.inline} haptic="selection">
                  <Plus size={13} color={C.brand500} />
                  <T variant="smallMedium" color={C.brand500}>Add room</T>
                </PressScale>
              </View>
              {rooms.map(room => (
                <Animated.View key={room.id} layout={SMOOTH_LAYOUT} style={styles.room}>
                  <View style={styles.row}>
                    <Field
                      placeholder="Room name"
                      value={room.name}
                      onChangeText={v => updateRoom(room.id, { name: v })}
                      dense
                      containerStyle={styles.flex}
                    />
                    <Field
                      placeholder="Cost ₹"
                      value={room.cost ? String(room.cost) : ''}
                      onChangeText={v => updateRoom(room.id, { cost: parseFloat(cleanNumber(v)) || 0 })}
                      keyboardType="decimal-pad"
                      dense
                      containerStyle={styles.cost}
                      style={styles.right}
                    />
                    {rooms.length > 1 && (
                      <PressScale onPress={() => setRooms(prev => prev.filter(r => r.id !== room.id))} hitSlop={8} accessibilityLabel="Remove room">
                        <X size={17} color={C.red500} />
                      </PressScale>
                    )}
                  </View>
                  <T variant="tiny" color={ink(0.6)} style={styles.occLabel}>Occupants</T>
                  <View style={styles.wrap}>
                    {members.map(m => (
                      <SelectPill key={m.id} dense selected={room.occupantIds.includes(m.id)} onPress={() => toggleOccupant(room.id, m.id)}>
                        <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                        <T variant="small">{m.name}</T>
                      </SelectPill>
                    ))}
                  </View>
                </Animated.View>
              ))}
              {totalRoomCost > 0 && (
                <View style={styles.totalBox}>
                  <View style={styles.inline}>
                    <IndianRupee size={12} color={ink(0.6)} />
                    <T variant="small" color={ink(0.6)}>Total stay cost</T>
                  </View>
                  <T variant="title">{formatCurrency(totalRoomCost)}</T>
                </View>
              )}
              {errors.amount ? <T variant="small" color={C.red500}>{errors.amount}</T> : null}
            </GlassCard>
          </Animated.View>
        )}

        {/* Paid by */}
        <Animated.View layout={SMOOTH_LAYOUT}>
          <GlassCard>
            <View style={[styles.between, styles.labelRow]}>
              <View style={styles.inline}>
                <Users size={14} color={ink(0.6)} />
                <T variant="smallMedium" color={ink(0.6)}>Paid By</T>
              </View>
              {!isStay && (
                <SelectPill
                  dense
                  selected={multiPayer}
                  onPress={() => { setMultiPayer(v => !v); setPayerAmounts({}) }}
                >
                  <T variant="smallMedium" color={multiPayer ? C.brand600 : ink(0.6)}>Multiple payers</T>
                </SelectPill>
              )}
            </View>
            {!multiPayer || isStay ? (
              <View style={styles.grid2}>
                {members.map(m => (
                  <SelectPill key={m.id} selected={paidBy === m.id} onPress={() => setPaidBy(m.id)} style={styles.cell2}>
                    <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                    <T variant="body" numberOfLines={1} color={paidBy === m.id ? C.ink : ink(0.65)} style={styles.flex}>{m.name}</T>
                    {paidBy === m.id && <Check size={14} color={C.brand500} strokeWidth={2.6} />}
                  </SelectPill>
                ))}
              </View>
            ) : (
              <View style={styles.box}>
                <T variant="small" color={ink(0.65)}>Enter how much each person paid</T>
                {members.map(m => (
                  <View key={m.id} style={styles.row}>
                    <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                    <T variant="small" style={styles.flex} numberOfLines={1}>{m.name}</T>
                    <Field
                      placeholder="0"
                      prefix="₹"
                      value={payerAmounts[m.id] || ''}
                      onChangeText={v => setPayerAmounts(p => ({ ...p, [m.id]: cleanNumber(v) }))}
                      keyboardType="decimal-pad"
                      dense
                      containerStyle={styles.cost}
                      style={styles.right}
                    />
                  </View>
                ))}
                {totalAmt > 0 && (
                  <View style={[styles.between, styles.sumRow]}>
                    <T variant="small" color={Math.abs(payerSum - totalAmt) > 0.5 ? C.red500 : C.emerald400}>Total paid</T>
                    <T variant="smallSemibold" color={Math.abs(payerSum - totalAmt) > 0.5 ? C.red500 : C.emerald400}>
                      {formatCurrency(payerSum)} / {formatCurrency(totalAmt)}
                    </T>
                  </View>
                )}
              </View>
            )}
            {errors.paidBy ? <T variant="small" color={C.red500} style={styles.mt8}>{errors.paidBy}</T> : null}
          </GlassCard>
        </Animated.View>

        {/* Participants + split */}
        {!isStay && (
          <Animated.View layout={SMOOTH_LAYOUT}>
            <GlassCard contentStyle={styles.gap12}>
              <View style={styles.between}>
                <T variant="smallMedium" color={ink(0.6)}>Who's sharing this?</T>
                <View style={styles.row}>
                  <T variant="smallMedium" color={C.brand500} onPress={() => setParticipants(members.map(m => m.id))} suppressHighlighting>All</T>
                  <T variant="smallMedium" color={ink(0.6)} onPress={() => setParticipants([])} suppressHighlighting>None</T>
                </View>
              </View>
              <View style={styles.grid2}>
                {members.map(m => {
                  const included = participants.includes(m.id)
                  return (
                    <SelectPill key={m.id} selected={included} onPress={() => toggleParticipant(m.id)} style={styles.cell2}>
                      <Checkbox checked={included} />
                      <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                      <T variant="small" numberOfLines={1} color={included ? C.ink : ink(0.65)} style={styles.flex}>{m.name}</T>
                    </SelectPill>
                  )
                })}
              </View>
              {errors.participants ? <T variant="small" color={C.red500}>{errors.participants}</T> : null}

              <T variant="smallMedium" color={ink(0.6)} style={styles.mt4}>How to split?</T>
              <View style={styles.grid2}>
                {SPLIT_TYPES.map(st => (
                  <SelectPill key={st} selected={splitType === st} onPress={() => { setSplitType(st); setSplitValues({}) }} style={styles.cell2}>
                    <T variant="body">{getSplitTypeIcon(st)}</T>
                    <T variant="smallMedium" color={splitType === st ? C.ink : ink(0.65)}>{getSplitTypeLabel(st)}</T>
                  </SelectPill>
                ))}
              </View>

              <Collapsible open={splitType !== 'equal' && participants.length > 0}>
                <View style={styles.box}>
                  <T variant="small" color={ink(0.65)}>Enter amount for each person</T>
                  {participants.map(pid => {
                    const m = members.find(x => x.id === pid)
                    if (!m) return null
                    return (
                      <View key={pid} style={styles.row}>
                        <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                        <T variant="small" style={styles.flex} numberOfLines={1}>{m.name}</T>
                        <Field
                          placeholder="0"
                          prefix="₹"
                          value={splitValues[pid] || ''}
                          onChangeText={v => setSplitValues(p => ({ ...p, [pid]: cleanNumber(v) }))}
                          keyboardType="decimal-pad"
                          dense
                          containerStyle={styles.cost}
                          style={styles.right}
                        />
                      </View>
                    )
                  })}
                  {totalAmt > 0 && (
                    <View style={[styles.between, styles.sumRow]}>
                      <T variant="small" color={splitDiff > 0.5 ? C.red500 : C.emerald400}>Total</T>
                      <T variant="smallSemibold" color={splitDiff > 0.5 ? C.red500 : C.emerald400}>
                        {formatCurrency(splitSum)} / {formatCurrency(totalAmt)}
                      </T>
                    </View>
                  )}
                </View>
                {errors.split ? <T variant="small" color={C.red500} style={styles.mt8}>{errors.split}</T> : null}
              </Collapsible>

              {splitType === 'equal' && totalAmt > 0 && participants.length > 0 && (
                <Animated.View style={styles.preview}>
                  <T variant="small" color={C.brand600}>
                    Each person pays: <T variant="smallSemibold" color={C.brand600}>{formatCurrency(totalAmt / participants.length)}</T>
                    {` (${participants.length} people)`}
                  </T>
                </Animated.View>
              )}
            </GlassCard>
          </Animated.View>
        )}

        {/* Notes */}
        {!isStay && (
          <GlassCard>
            <Field
              label="Notes (optional)"
              placeholder="Any additional context..."
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              testID="expense-notes"
            />
          </GlassCard>
        )}

        {/* Bill photos */}
        <GlassCard contentStyle={styles.gap12}>
          <View style={styles.inline}>
            <Paperclip size={14} color={ink(0.6)} />
            <T variant="smallMedium" color={ink(0.6)}>Bill photos (optional)</T>
          </View>
          <DraftStrip images={drafts} onRemove={uri => { deleteLocalFiles([uri]); setDrafts(d => d.filter(x => x.uri !== uri)) }} />
          <AttachmentPicker
            context={{ kind: 'bill' }}
            cameraLabel="Snap bill"
            galleryLabel="From gallery"
            onPicked={image => setDrafts(d => [...d, image])}
          />
          <T variant="tiny" color={ink(0.5)}>Photos are compressed and uploaded securely to your cloud trip.</T>
        </GlassCard>

        <Button
          title={isStay ? 'Add Stay' : 'Add Expense'}
          icon={Plus}
          size="lg"
          loading={saving}
          onPress={handleAdd}
          full
          testID="submit-expense-btn"
        />
        {totalAmt > 0 && !reduced ? (
          <T variant="small" color={ink(0.55)} center>
            Total {formatCurrency(totalAmt)}
            {drafts.length > 0 ? ` · ${drafts.length} bill photo${drafts.length !== 1 ? 's' : ''}` : ''}
          </T>
        ) : null}
      </KeyboardScroll>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: ink(0.07), alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 14 },
  label: { marginBottom: 10 },
  labelRow: { marginBottom: 10 },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell3: { width: '31.6%' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell2: { width: '48.6%' },
  capital: { textTransform: 'capitalize', flexShrink: 1 },
  room: { borderRadius: 14, borderWidth: 1, borderColor: ink(0.1), backgroundColor: ink(0.03), padding: 12, gap: 8 },
  cost: { width: 118 },
  right: { textAlign: 'right' },
  occLabel: { marginTop: 2 },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand500(0.2),
    backgroundColor: brand500(0.07),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  box: { borderRadius: 14, borderWidth: 1, borderColor: ink(0.1), backgroundColor: ink(0.03), padding: 12, gap: 10 },
  sumRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: ink(0.08) },
  preview: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand500(0.2),
    backgroundColor: brand500(0.07),
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
})
