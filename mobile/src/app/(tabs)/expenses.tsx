// Expenses (web /expenses/[tripId]): one feed of expenses and hotel stays,
// newest first. Tap to expand (payers, split, notes), swipe left to delete.
// Mobile: bill photos per item — thumbnails with upload state, camera/gallery.
import { useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { BedDouble, ChevronDown, Hotel, Info, Paperclip, Plus, Receipt, Trash2 } from 'lucide-react-native'
import type { Expense, HotelExpense, Member, Attachment } from '../../types'
import { useStore } from '../../lib/store'
import { useTripData } from '../../lib/hooks'
import { syncTrip } from '../../lib/sync'
import { cloudDeleteItem, withCloud } from '../../lib/cloud'
import { attachImage } from '../../lib/uploads'
import { confirmAction } from '../../lib/dialogs'
import {
  formatCurrency, formatDate, getCategoryGradientColors, getCategoryIcon, getSplitTypeIcon,
  getSplitTypeLabel, getSubcategoryLabel,
} from '../../lib/utils'
import { GlassCard } from '../../components/ui/GlassCard'
import { T } from '../../components/ui/Text'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { Chip } from '../../components/ui/CategoryChip'
import { PageHeader } from '../../components/ui/PageHeader'
import { BrandFooter } from '../../components/ui/BrandFooter'
import { Sheen } from '../../components/ui/StatCard'
import { AttachmentPicker } from '../../components/attachments/AttachmentPicker'
import { AttachmentStrip } from '../../components/attachments/AttachmentStrip'
import { Collapsible, FadeIn, SMOOTH_LAYOUT, stagger } from '../../components/animated/FadeInView'
import { SwipeToDelete } from '../../components/animated/SwipeCard'
import { FAB } from '../../components/animated/FloatingActionButton'
import { EmptyState } from '../../components/animated/AnimatedEmptyState'
import { PressScale, tick } from '../../components/animated/SpringPressable'
import { C, brand600, ink } from '../../theme/colors'
import { SCREEN_PADDING } from '../../theme/spacing'

type FeedItem =
  | { kind: 'expense'; id: string; createdAt: string; expense: Expense }
  | { kind: 'hotel'; id: string; createdAt: string; hotel: HotelExpense }

const ROTATE = { transitionProperty: 'transform', transitionDuration: 220 } as const
const DELETE_MESSAGE =
  'This removes it for everyone in the trip, along with its bill photos, and recalculates who owes whom.'

export default function ExpensesScreen() {
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const { expenses, hotelExpenses, members, memberMap, totalSpent, billsByParent } = useTripData(tripId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const feed = useMemo<FeedItem[]>(
    () =>
      [
        ...expenses.map(e => ({ kind: 'expense' as const, id: e.id, createdAt: e.createdAt, expense: e })),
        ...hotelExpenses.map(h => ({ kind: 'hotel' as const, id: h.id, createdAt: h.createdAt, hotel: h })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [expenses, hotelExpenses]
  )

  const refresh = async () => {
    setRefreshing(true)
    try {
      await syncTrip(tripId)
    } finally {
      setRefreshing(false)
    }
  }

  /** Deletes on the server first; the row only disappears once Supabase agrees. */
  const deleteNow = async (item: FeedItem) => {
    const done = await withCloud(async () => {
      await cloudDeleteItem(item.kind, item.id)
      return true
    })
    if (done && expandedId === item.id) setExpandedId(null)
    return !!done
  }

  /** Delete button in the expanded card (the swipe action confirms on its own). */
  const remove = async (item: FeedItem) => {
    const title = item.kind === 'expense' ? item.expense.title : item.hotel.title
    const ok = await confirmAction({
      title: item.kind === 'expense' ? `Delete “${title}”?` : `Delete stay “${title}”?`,
      message: DELETE_MESSAGE,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    if (await deleteNow(item)) tick('warning')
  }

  const itemCount = expenses.length + hotelExpenses.length

  return (
    <View style={styles.fill}>
      <Animated.FlatList
        data={feed}
        keyExtractor={item => item.id}
        itemLayoutAnimation={LinearTransition.duration(240)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[C.brand500, C.fuchsia]} tintColor={C.brand500} progressBackgroundColor={C.white} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <PageHeader
              icon={Receipt}
              title="Expenses"
              subtitle={`${itemCount} item${itemCount !== 1 ? 's' : ''} · ${formatCurrency(totalSpent)}`}
              right={<Button title="Add" icon={Plus} size="sm" onPress={() => router.push('/add-expense')} testID="open-add-expense-btn" />}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            subtitle="Add your first expense to get started"
            action={<Button title="Add expense" icon={Plus} onPress={() => router.push('/add-expense')} />}
          />
        }
        ListFooterComponent={<BrandFooter bottomPadding={0} />}
        ItemSeparatorComponent={Separator}
        renderItem={({ item, index }) => (
          <FadeIn delay={stagger(index, 0, 40)}>
            <SwipeToDelete
              onDelete={() => deleteNow(item)}
              confirmTitle={item.kind === 'expense' ? `Delete “${item.expense.title}”?` : `Delete stay “${item.hotel.title}”?`}
              confirmMessage={DELETE_MESSAGE}
            >
              {item.kind === 'expense' ? (
                <ExpenseCard
                  expense={item.expense}
                  members={members}
                  memberMap={memberMap}
                  bills={billsByParent[item.id] ?? []}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onDelete={() => void remove(item)}
                />
              ) : (
                <HotelCard
                  hotel={item.hotel}
                  members={members}
                  memberMap={memberMap}
                  bills={billsByParent[item.id] ?? []}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onDelete={() => void remove(item)}
                />
              )}
            </SwipeToDelete>
          </FadeIn>
        )}
      />
      <FAB onPress={() => router.push('/add-expense')} />
    </View>
  )
}

const Separator = () => <View style={styles.separator} />

interface CardProps {
  members: Member[]
  memberMap: Record<string, Member>
  bills: Attachment[]
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}

function ExpenseCard({ expense, members, memberMap, bills, expanded, onToggle, onDelete }: CardProps & { expense: Expense }) {
  const payer = memberMap[expense.paidBy]
  const participants = members.filter(m => expense.participants.includes(m.id))
  const multiPayer = (expense.payers?.length ?? 0) > 1
  const sub = getSubcategoryLabel(expense.category, expense.subcategory)
  return (
    <Animated.View layout={SMOOTH_LAYOUT}>
      <GlassCard padding={0}>
        <PressScale onPress={onToggle} scaleTo={0.985} haptic="selection" style={styles.cardRow} accessibilityRole="button" accessibilityState={{ expanded }}>
          <LinearGradient colors={getCategoryGradientColors(expense.category)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.catTile}>
            <Sheen period={6} />
            <T style={styles.emoji}>{getCategoryIcon(expense.category)}</T>
          </LinearGradient>
          <View style={styles.flex}>
            <T variant="title" numberOfLines={1}>{expense.title}</T>
            <View style={styles.meta}>
              {multiPayer ? (
                <T variant="small" color={ink(0.6)}>{expense.payers!.length} payers</T>
              ) : payer ? (
                <View style={styles.inline}>
                  <Avatar name={payer.name} color={payer.avatarColor} size="xs" glow={false} />
                  <T variant="small" color={ink(0.6)} numberOfLines={1}>{payer.name}</T>
                </View>
              ) : null}
              {sub ? <Chip label={sub} /> : null}
              <T variant="tiny" color={ink(0.55)}>{getSplitTypeIcon(expense.splitType)} {getSplitTypeLabel(expense.splitType)}</T>
              {bills.length > 0 && (
                <View style={styles.inline}>
                  <Paperclip size={11} color={C.brand500} />
                  <T variant="tinySemibold" color={C.brand500}>{bills.length}</T>
                </View>
              )}
            </View>
          </View>
          <View style={styles.amount}>
            <T variant="title">{formatCurrency(expense.amount)}</T>
            <T variant="tiny" color={ink(0.5)}>{formatDate(expense.createdAt)}</T>
          </View>
          <Animated.View style={[ROTATE, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
            <ChevronDown size={16} color={ink(0.5)} />
          </Animated.View>
        </PressScale>

        <Collapsible open={expanded}>
          <View style={styles.details}>
            {multiPayer && (
              <View style={styles.gap6}>
                <T variant="small" color={ink(0.6)}>Paid by {expense.payers!.length} people</T>
                {expense.payers!.map(p => {
                  const m = memberMap[p.memberId]
                  if (!m) return null
                  return (
                    <View key={p.memberId} style={styles.personRow}>
                      <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                      <T variant="small" style={styles.flex}>{m.name}</T>
                      <T variant="smallSemibold" color={C.emerald400}>{formatCurrency(p.amount)}</T>
                    </View>
                  )
                })}
              </View>
            )}
            <View style={styles.gap6}>
              <T variant="small" color={ink(0.6)}>Split between {participants.length} people</T>
              {participants.map(m => {
                const split = expense.splits.find(s => s.memberId === m.id)
                const share = split?.resolvedAmount ?? expense.amount / Math.max(1, expense.participants.length)
                return (
                  <View key={m.id} style={styles.personRow}>
                    <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                    <T variant="small" style={styles.flex}>{m.name}</T>
                    {split && expense.splitType === 'quantity' ? <T variant="tiny" color={ink(0.6)}>{split.value} units</T> : null}
                    {split && expense.splitType === 'percentage' ? <T variant="tiny" color={ink(0.6)}>{split.value}%</T> : null}
                    <T variant="smallSemibold">{formatCurrency(share)}</T>
                  </View>
                )
              })}
            </View>
            {expense.notes ? (
              <View style={styles.inline}>
                <Info size={12} color={ink(0.6)} />
                <T variant="small" color={ink(0.6)} style={styles.flex}>{expense.notes}</T>
              </View>
            ) : null}
            <Bills tripId={expense.tripId} bills={bills} target={{ expenseId: expense.id }} />
            <DeleteLink onPress={onDelete} />
          </View>
        </Collapsible>
      </GlassCard>
    </Animated.View>
  )
}

function HotelCard({ hotel, members, memberMap, bills, expanded, onToggle, onDelete }: CardProps & { hotel: HotelExpense }) {
  const payer = memberMap[hotel.paidBy]
  return (
    <Animated.View layout={SMOOTH_LAYOUT}>
      <GlassCard padding={0}>
        <PressScale onPress={onToggle} scaleTo={0.985} haptic="selection" style={styles.cardRow} accessibilityRole="button" accessibilityState={{ expanded }}>
          <View style={[styles.catTile, { backgroundColor: brand600(0.16) }]}>
            <Hotel size={20} color={C.brand500} />
          </View>
          <View style={styles.flex}>
            <T variant="title" numberOfLines={1}>{hotel.title}</T>
            <View style={styles.meta}>
              {payer && (
                <View style={styles.inline}>
                  <Avatar name={payer.name} color={payer.avatarColor} size="xs" glow={false} />
                  <T variant="small" color={ink(0.6)} numberOfLines={1}>{payer.name}</T>
                </View>
              )}
              <View style={styles.inline}>
                <BedDouble size={11} color={ink(0.55)} />
                <T variant="tiny" color={ink(0.55)}>
                  {hotel.rooms.length} room{hotel.rooms.length !== 1 ? 's' : ''} · stay split
                </T>
              </View>
              {bills.length > 0 && (
                <View style={styles.inline}>
                  <Paperclip size={11} color={C.brand500} />
                  <T variant="tinySemibold" color={C.brand500}>{bills.length}</T>
                </View>
              )}
            </View>
          </View>
          <View style={styles.amount}>
            <T variant="title">{formatCurrency(hotel.totalAmount)}</T>
            <T variant="tiny" color={ink(0.5)}>{formatDate(hotel.createdAt)}</T>
          </View>
          <Animated.View style={[ROTATE, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
            <ChevronDown size={16} color={ink(0.5)} />
          </Animated.View>
        </PressScale>

        <Collapsible open={expanded}>
          <View style={styles.details}>
            {hotel.rooms.map(room => {
              const occupants = members.filter(m => room.occupantIds.includes(m.id))
              const perPerson = occupants.length > 0 ? room.cost / occupants.length : 0
              return (
                <View key={room.id} style={styles.room}>
                  <View style={styles.between}>
                    <T variant="bodyMedium">{room.name}</T>
                    <T variant="title">{formatCurrency(room.cost)}</T>
                  </View>
                  <View style={styles.occupants}>
                    {occupants.map(m => (
                      <View key={m.id} style={styles.inline}>
                        <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                        <T variant="small" color={ink(0.65)}>{m.name}</T>
                        <T variant="small" color={ink(0.5)}>({formatCurrency(perPerson)})</T>
                      </View>
                    ))}
                    {occupants.length === 0 && <T variant="small" color={ink(0.5)} style={styles.italic}>No occupants assigned</T>}
                  </View>
                </View>
              )
            })}
            <Bills tripId={hotel.tripId} bills={bills} target={{ hotelExpenseId: hotel.id }} />
            <DeleteLink onPress={onDelete} />
          </View>
        </Collapsible>
      </GlassCard>
    </Animated.View>
  )
}

/** Bill photos for an expense/stay: thumbnails + add from camera/gallery. */
function Bills({ tripId, bills, target }: { tripId: string; bills: Attachment[]; target: { expenseId?: string; hotelExpenseId?: string } }) {
  const me = useStore(s => s.session?.memberId)
  return (
    <View style={styles.bills}>
      <View style={styles.inline}>
        <Paperclip size={13} color={ink(0.6)} />
        <T variant="smallMedium" color={ink(0.6)}>
          {bills.length > 0 ? `Bill photos (${bills.length})` : 'Bill photos'}
        </T>
      </View>
      <AttachmentStrip attachments={bills} size={68} />
      <AttachmentPicker
        context={{ kind: 'bill', tripId, ...target }}
        cameraLabel="Snap bill"
        galleryLabel="From gallery"
        onPicked={image => attachImage(image, { kind: 'bill', tripId, ...target }, me)}
      />
    </View>
  )
}

function DeleteLink({ onPress }: { onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={styles.deleteLink} haptic={false} accessibilityRole="button" accessibilityLabel="Delete">
      <Trash2 size={14} color={C.red500} />
      <T variant="smallMedium" color={C.red500}>Delete</T>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  list: { padding: SCREEN_PADDING, paddingTop: 20, paddingBottom: 110 },
  header: { marginBottom: 18 },
  separator: { height: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  catTile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emoji: { fontSize: 19, lineHeight: 24 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginTop: 3 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  amount: { alignItems: 'flex-end' },
  details: {
    borderTopWidth: 1,
    borderTopColor: ink(0.08),
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
  },
  gap6: { gap: 7 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  room: { borderRadius: 12, backgroundColor: ink(0.04), padding: 12, gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  occupants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  italic: { fontStyle: 'italic' },
  bills: { gap: 10 },
  deleteLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingVertical: 4 },
})
