'use client'
import React from 'react'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import {
  formatCurrency, formatDate, getCategoryColor, getCategoryIcon,
  getSplitTypeLabel, getSplitTypeIcon, getSubcategoryLabel, getCategoryGradient,
  generateId, SUBCATEGORIES
} from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import { ExpenseCategory, SplitType, ParticipantSplit, ExpensePayer, Room } from '@/types'
import {
  Plus, Receipt, Trash2, ChevronDown, X, Check,
  Users, IndianRupee, Tag, Info, Hotel, BedDouble
} from 'lucide-react'

interface ExpensesPageProps {
  params: Promise<{ tripId: string }>
}

const CATEGORIES: ExpenseCategory[] = [
  'food', 'travel', 'stay', 'entertainment',
  'shopping', 'alcohol', 'fuel', 'tickets', 'misc'
]

const SPLIT_TYPES: SplitType[] = ['equal', 'custom']

export default function ExpensesPage({ params }: ExpensesPageProps) {
  const { tripId } = React.use(params)

  // Raw store state + useMemo filtering avoids React 19 getSnapshot infinite loop
  const allExpenses      = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allMembers       = useStore(s => s.members)
  const addExpense       = useStore(s => s.addExpense)
  const deleteExpense    = useStore(s => s.deleteExpense)
  const addHotelExpense    = useStore(s => s.addHotelExpense)
  const deleteHotelExpense = useStore(s => s.deleteHotelExpense)
  const session          = useStore(s => s.session)

  const expenses = useMemo(() =>
    allExpenses
      .filter(e => e.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allExpenses, tripId]
  )
  const hotelExpenses = useMemo(() =>
    allHotelExpenses
      .filter(h => h.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allHotelExpenses, tripId]
  )
  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])

  const [showModal, setShowModal]   = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [swipedId, setSwipedId]     = useState<string | null>(null)

  // ── Expense form state ───────────────────────────────────────────────────────
  const [title, setTitle]           = useState('')
  const [amount, setAmount]         = useState('')
  const [paidBy, setPaidBy]         = useState(session?.memberId || '')
  const [multiPayer, setMultiPayer] = useState(false)
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [category, setCategory]     = useState<ExpenseCategory>('misc')
  const [subcategory, setSubcategory] = useState<string>('')
  const [splitType, setSplitType]   = useState<SplitType>('equal')
  const [participants, setParticipants] = useState<string[]>(members.map(m => m.id))
  const [splitValues, setSplitValues]   = useState<Record<string, string>>({})
  const [notes, setNotes]           = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Room state — used when category is "stay" (hotel booking mode) ──────────
  const [rooms, setRooms] = useState<Room[]>([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])

  const isStay = category === 'stay'
  const totalRoomCost = rooms.reduce((s, r) => s + (r.cost || 0), 0)
  const totalAmt = isStay ? totalRoomCost : (parseFloat(amount) || 0)

  // ── Live share preview ───────────────────────────────────────────────────────
  const resolvedShares = useMemo(() => {
    if (participants.length === 0 || totalAmt === 0) return {}
    const shares: Record<string, number> = {}

    if (splitType === 'equal') {
      const share = totalAmt / participants.length
      participants.forEach(id => { shares[id] = share })
    } else if (splitType === 'custom') {
      participants.forEach(id => { shares[id] = parseFloat(splitValues[id] || '0') })
    } else if (splitType === 'percentage') {
      participants.forEach(id => {
        const pct = parseFloat(splitValues[id] || '0')
        shares[id] = (pct / 100) * totalAmt
      })
    } else if (splitType === 'quantity') {
      const totalQty = participants.reduce((s, id) => s + parseFloat(splitValues[id] || '0'), 0)
      if (totalQty > 0) {
        participants.forEach(id => {
          const qty = parseFloat(splitValues[id] || '0')
          shares[id] = (qty / totalQty) * totalAmt
        })
      }
    }
    return shares
  }, [splitType, participants, splitValues, totalAmt])

  const splitSum = Object.values(resolvedShares).reduce((a, b) => a + b, 0)
  const splitDiff = Math.abs(splitSum - totalAmt)

  const payerSum = Object.values(payerAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const activePayers: ExpensePayer[] = Object.entries(payerAmounts)
    .map(([memberId, v]) => ({ memberId, amount: parseFloat(v) || 0 }))
    .filter(p => p.amount > 0)

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setTitle(''); setAmount(''); setPaidBy(session?.memberId || '')
    setMultiPayer(false); setPayerAmounts({})
    setCategory('misc'); setSubcategory(''); setSplitType('equal')
    setParticipants(members.map(m => m.id))
    setSplitValues({}); setNotes(''); setFormErrors({})
    setRooms([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])
  }

  const toggleParticipant = (id: string) => {
    setParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleAdd = () => {
    // "Stay" category = hotel booking with room-based splitting
    if (isStay) {
      const errs: Record<string, string> = {}
      if (!title.trim())      errs.title = 'Hotel / stay name is required'
      if (totalRoomCost <= 0) errs.amount = 'Add at least one room with a cost'
      if (!paidBy)            errs.paidBy = 'Select who paid'
      setFormErrors(errs)
      if (Object.keys(errs).length > 0) return

      addHotelExpense({ tripId, title: title.trim(), totalAmount: totalRoomCost, paidBy, rooms })
      setShowModal(false)
      resetForm()
      return
    }

    const errs: Record<string, string> = {}
    if (!title.trim())              errs.title = 'Title is required'
    if (!totalAmt || totalAmt <= 0) errs.amount = 'Enter a valid amount'
    if (participants.length === 0)  errs.participants = 'Select at least one participant'

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
    if (splitType === 'percentage') {
      const totalPct = participants.reduce((s, id) => s + parseFloat(splitValues[id] || '0'), 0)
      if (Math.abs(totalPct - 100) > 0.5) errs.split = `Percentages must sum to 100% (current: ${totalPct.toFixed(1)}%)`
    }

    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    const splits: ParticipantSplit[] = participants.map(id => ({
      memberId: id,
      value: parseFloat(splitValues[id] || '0'),
      resolvedAmount: resolvedShares[id] ?? 0,
    }))

    // Primary payer = largest contributor (kept for backward compat)
    const primaryPayer = multiPayer
      ? [...activePayers].sort((a, b) => b.amount - a.amount)[0].memberId
      : paidBy

    addExpense({
      tripId, title: title.trim(), amount: totalAmt,
      paidBy: primaryPayer,
      payers: multiPayer ? activePayers : undefined,
      category, subcategory: subcategory || undefined,
      participants, splitType, splits, notes: notes.trim(),
    })
    setShowModal(false)
    resetForm()
  }

  // ── Hotel helpers ────────────────────────────────────────────────────────────
  const addRoom = () =>
    setRooms(prev => [...prev, { id: generateId(), name: `Room ${prev.length + 1}`, cost: 0, occupantIds: [] }])

  const removeRoom = (id: string) =>
    setRooms(prev => prev.filter(r => r.id !== id))

  const updateRoom = (id: string, patch: Partial<Room>) =>
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const toggleOccupant = (roomId: string, memberId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r
      const has = r.occupantIds.includes(memberId)
      return { ...r, occupantIds: has ? r.occupantIds.filter(id => id !== memberId) : [...r.occupantIds, memberId] }
    }))
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
    + hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)

  // Combined feed: regular expenses + hotel bookings, newest first
  const feed = useMemo(() => {
    const items: Array<
      | { kind: 'expense'; createdAt: string; expense: typeof expenses[0] }
      | { kind: 'hotel'; createdAt: string; hotel: typeof hotelExpenses[0] }
    > = [
      ...expenses.map(e => ({ kind: 'expense' as const, createdAt: e.createdAt, expense: e })),
      ...hotelExpenses.map(h => ({ kind: 'hotel' as const, createdAt: h.createdAt, hotel: h })),
    ]
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [expenses, hotelExpenses])

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Expenses</h1>
              <p className="text-white/40 text-sm">
                {expenses.length + hotelExpenses.length} items · {formatCurrency(totalSpent)}
              </p>
            </div>
          </div>
          <button
            id="open-add-expense-btn"
            onClick={() => { resetForm(); setShowModal(true) }}
            className="btn-brand flex items-center gap-1.5 text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </FadeIn>

      {/* Combined expense + hotel list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {feed.map((item, i) => {
            if (item.kind === 'hotel') {
              const hotel = item.hotel
              const payer = members.find(m => m.id === hotel.paidBy)
              const isExpanded = expandedId === hotel.id
              return (
                <motion.div
                  key={hotel.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <GlassCard className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : hotel.id)}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-600/20 flex-shrink-0">
                        <Hotel className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{hotel.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {payer && (
                            <div className="flex items-center gap-1">
                              <Avatar name={payer.name} color={payer.avatarColor} size="xs" />
                              <span className="text-xs text-white/40">{payer.name}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-white/25">
                            <BedDouble className="w-3 h-3 inline mr-0.5" />
                            {hotel.rooms.length} room{hotel.rooms.length !== 1 ? 's' : ''} · stay split
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-white">{formatCurrency(hotel.totalAmount)}</p>
                        <p className="text-[10px] text-white/30">{formatDate(hotel.createdAt)}</p>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-white/30 flex-shrink-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-2">
                            {hotel.rooms.map(room => {
                              const occupants = members.filter(m => room.occupantIds.includes(m.id))
                              const perPerson = occupants.length > 0 ? room.cost / occupants.length : 0
                              return (
                                <div key={room.id} className="rounded-xl bg-white/5 p-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-white">{room.name}</span>
                                    <span className="text-sm font-semibold text-white">{formatCurrency(room.cost)}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {occupants.map(m => (
                                      <div key={m.id} className="flex items-center gap-1 text-xs text-white/50">
                                        <Avatar name={m.name} color={m.avatarColor} size="xs" />
                                        <span>{m.name}</span>
                                        <span className="text-white/30">({formatCurrency(perPerson)})</span>
                                      </div>
                                    ))}
                                    {occupants.length === 0 && (
                                      <span className="text-xs text-white/30 italic">No occupants assigned</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={e => { e.stopPropagation(); deleteHotelExpense(hotel.id) }}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              )
            }

            const expense = item.expense
            const payer = members.find(m => m.id === expense.paidBy)
            const participantMembers = members.filter(m => expense.participants.includes(m.id))
            const isExpanded = expandedId === expense.id
            const isSwiped = swipedId === expense.id
            const hasMultiplePayers = (expense.payers?.length ?? 0) > 1

            return (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60, scale: 0.95 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                className="relative"
              >
                {/* Swipe-revealed delete action */}
                <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center rounded-2xl bg-red-500/15">
                  <button
                    id={`swipe-delete-${expense.id}`}
                    onClick={() => { deleteExpense(expense.id); setSwipedId(null) }}
                    className="flex flex-col items-center gap-0.5 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-[10px] font-medium">Delete</span>
                  </button>
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: -80, right: 0 }}
                  dragElastic={0.1}
                  animate={{ x: isSwiped ? -80 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -40) setSwipedId(expense.id)
                    else setSwipedId(null)
                  }}
                  className="relative"
                >
                  <GlassCard className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer"
                      onClick={() => {
                        if (isSwiped) { setSwipedId(null); return }
                        setExpandedId(isExpanded ? null : expense.id)
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 liquid-sheen"
                        style={{ background: getCategoryGradient(expense.category) }}
                      >
                        {getCategoryIcon(expense.category)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{expense.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {hasMultiplePayers ? (
                            <span className="text-xs text-white/40">{expense.payers!.length} payers</span>
                          ) : payer && (
                            <div className="flex items-center gap-1">
                              <Avatar name={payer.name} color={payer.avatarColor} size="xs" />
                              <span className="text-xs text-white/40">{payer.name}</span>
                            </div>
                          )}
                          {expense.subcategory && (
                            <span className="text-[10px] font-medium text-brand-400 bg-brand-600/10 border border-brand-500/20 rounded-full px-1.5 py-0.5">
                              {getSubcategoryLabel(expense.category, expense.subcategory)}
                            </span>
                          )}
                          <span className="text-[10px] text-white/25">
                            {getSplitTypeIcon(expense.splitType)} {getSplitTypeLabel(expense.splitType)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-white">{formatCurrency(expense.amount)}</p>
                        <p className="text-[10px] text-white/30">{formatDate(expense.createdAt)}</p>
                      </div>

                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-white/30 flex-shrink-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
                            {hasMultiplePayers && (
                              <div>
                                <p className="text-xs text-white/40 mb-2">Paid by {expense.payers!.length} people</p>
                                <div className="space-y-1.5">
                                  {expense.payers!.map(p => {
                                    const m = members.find(x => x.id === p.memberId)
                                    if (!m) return null
                                    return (
                                      <div key={p.memberId} className="flex items-center gap-2">
                                        <Avatar name={m.name} color={m.avatarColor} size="xs" />
                                        <span className="text-xs text-white flex-1">{m.name}</span>
                                        <span className="text-xs font-medium text-emerald-400">
                                          {formatCurrency(p.amount)}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            <div>
                              <p className="text-xs text-white/40 mb-2">Split between {participantMembers.length} people</p>
                              <div className="space-y-1.5">
                                {participantMembers.map(m => {
                                  const split = expense.splits.find(s => s.memberId === m.id)
                                  const shareAmt = split?.resolvedAmount
                                    ?? (expense.amount / expense.participants.length)
                                  return (
                                    <div key={m.id} className="flex items-center gap-2">
                                      <Avatar name={m.name} color={m.avatarColor} size="xs" />
                                      <span className="text-xs text-white flex-1">{m.name}</span>
                                      {split && expense.splitType !== 'equal' && (
                                        <span className="text-[10px] text-white/40">
                                          {expense.splitType === 'quantity' ? `${split.value} units` : ''}
                                          {expense.splitType === 'percentage' ? `${split.value}%` : ''}
                                        </span>
                                      )}
                                      <span className="text-xs font-medium text-white">
                                        {formatCurrency(shareAmt)}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {expense.notes && (
                              <p className="text-xs text-white/40 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {expense.notes}
                              </p>
                            )}

                            <div className="flex justify-end pt-1">
                              <button
                                id={`delete-expense-${expense.id}`}
                                onClick={e => {
                                  e.stopPropagation()
                                  deleteExpense(expense.id)
                                }}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {feed.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Receipt className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 mb-1">No expenses yet</p>
            <p className="text-white/30 text-sm">Add your first expense to get started</p>
          </motion.div>
        )}
      </div>

      {/* Floating Add Expense button (mobile) */}
      <motion.button
        id="fab-add-expense"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        onClick={() => { resetForm(); setShowModal(true) }}
        className="lg:hidden fixed right-5 z-40 w-14 h-14 rounded-full btn-brand !p-0 flex items-center justify-center shadow-glow-brand"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* ── Add Expense Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">{isStay ? 'Add Stay / Hotel' : 'Add Expense'}</h2>
                <button
                  id="close-expense-modal"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    <Tag className="w-3.5 h-3.5 inline mr-1" />
                    {isStay ? 'Hotel / Stay Name' : 'Expense Title'}
                  </label>
                  <input
                    id="expense-title"
                    className="input-glass"
                    placeholder={isStay ? 'e.g. Goa Beach Resort' : 'e.g. Dinner at Olive Bar'}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  {formErrors.title && <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>}
                </div>

                {/* Amount (stay mode: auto-computed from rooms) */}
                {!isStay && (
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      <IndianRupee className="w-3.5 h-3.5 inline mr-1" />
                      Amount (₹)
                    </label>
                    <input
                      id="expense-amount"
                      className="input-glass text-xl font-bold"
                      placeholder="0"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                    {formErrors.amount && <p className="mt-1 text-xs text-red-400">{formErrors.amount}</p>}
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        id={`cat-${cat}`}
                        onClick={() => { setCategory(cat); setSubcategory('') }}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
                          category === cat
                            ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                            : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span>{getCategoryIcon(cat)}</span>
                        <span className="capitalize truncate">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subcategory (when the category has them, e.g. Food → Lunch) */}
                {!isStay && SUBCATEGORIES[category] && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="block text-xs font-medium text-white/60 mb-2">Type (optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {SUBCATEGORIES[category].map(sub => (
                        <button
                          key={sub.id}
                          id={`subcat-${sub.id}`}
                          onClick={() => setSubcategory(subcategory === sub.id ? '' : sub.id)}
                          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                            subcategory === sub.id
                              ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                              : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          <span>{sub.icon}</span>
                          <span>{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Stay mode: rooms + occupants (room-based splitting) */}
                {isStay && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-white/60">
                        <BedDouble className="w-3.5 h-3.5 inline mr-1" />
                        Rooms
                      </label>
                      <button onClick={addRoom} className="text-xs text-brand-400 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add room
                      </button>
                    </div>
                    <div className="space-y-3">
                      {rooms.map(room => (
                        <div key={room.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              className="input-glass flex-1 text-sm py-1.5"
                              value={room.name}
                              onChange={e => updateRoom(room.id, { name: e.target.value })}
                              placeholder="Room name"
                            />
                            <input
                              className="input-glass w-28 text-sm py-1.5 text-right"
                              type="number"
                              inputMode="decimal"
                              placeholder="Cost ₹"
                              value={room.cost || ''}
                              onChange={e => updateRoom(room.id, { cost: parseFloat(e.target.value) || 0 })}
                            />
                            {rooms.length > 1 && (
                              <button onClick={() => removeRoom(room.id)} className="text-red-400 hover:text-red-300">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 mb-1.5">Occupants</p>
                            <div className="flex flex-wrap gap-1.5">
                              {members.map(m => {
                                const selected = room.occupantIds.includes(m.id)
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => toggleOccupant(room.id, m.id)}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all ${
                                      selected
                                        ? 'bg-brand-600/30 border border-brand-500/40 text-white'
                                        : 'bg-white/5 border border-white/10 text-white/50'
                                    }`}
                                  >
                                    <Avatar name={m.name} color={m.avatarColor} size="xs" />
                                    {m.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalRoomCost > 0 && (
                      <div className="mt-3 rounded-xl bg-brand-600/10 border border-brand-500/20 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-white/60 flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" />
                          Total stay cost
                        </span>
                        <span className="text-sm font-bold text-white">{formatCurrency(totalRoomCost)}</span>
                      </div>
                    )}
                    {formErrors.amount && <p className="mt-1 text-xs text-red-400">{formErrors.amount}</p>}
                  </div>
                )}

                {/* Paid By */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/60">
                      <Users className="w-3.5 h-3.5 inline mr-1" />
                      Paid By
                    </label>
                    {!isStay && (
                      <button
                        id="toggle-multi-payer"
                        onClick={() => { setMultiPayer(v => !v); setPayerAmounts({}) }}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          multiPayer
                            ? 'bg-brand-600/30 border-brand-500/50 text-brand-400'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        Multiple payers
                      </button>
                    )}
                  </div>

                  {!multiPayer || isStay ? (
                    <div className="grid grid-cols-2 gap-2">
                      {members.map(m => (
                        <button
                          key={m.id}
                          id={`paid-by-${m.id}`}
                          onClick={() => setPaidBy(m.id)}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                            paidBy === m.id
                              ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                              : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          <Avatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="truncate">{m.name}</span>
                          {paidBy === m.id && <Check className="w-3 h-3 ml-auto flex-shrink-0 text-brand-400" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                      <p className="text-xs text-white/50 mb-2">Enter how much each person paid</p>
                      {members.map(m => (
                        <div key={m.id} className="flex items-center gap-3">
                          <Avatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="text-xs text-white flex-1">{m.name}</span>
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">₹</span>
                            <input
                              id={`payer-amt-${m.id}`}
                              type="number"
                              inputMode="decimal"
                              className="input-glass py-1.5 text-xs text-right pl-6"
                              placeholder="0"
                              value={payerAmounts[m.id] || ''}
                              onChange={e => setPayerAmounts(v => ({ ...v, [m.id]: e.target.value }))}
                            />
                          </div>
                        </div>
                      ))}
                      {totalAmt > 0 && (
                        <div className={`flex items-center justify-between pt-2 border-t border-white/10 text-xs ${Math.abs(payerSum - totalAmt) > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                          <span>Total paid</span>
                          <span>{formatCurrency(payerSum)} / {formatCurrency(totalAmt)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {formErrors.paidBy && <p className="mt-1 text-xs text-red-400">{formErrors.paidBy}</p>}
                </div>

                {/* Participants */}
                {!isStay && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/60">Who's sharing this?</label>
                    <div className="flex gap-3 text-xs">
                      <button id="select-all" onClick={() => setParticipants(members.map(m => m.id))} className="text-brand-400">All</button>
                      <button id="clear-all"  onClick={() => setParticipants([])} className="text-white/40">None</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {members.map(m => {
                      const included = participants.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          id={`participant-${m.id}`}
                          onClick={() => toggleParticipant(m.id)}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                            included
                              ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                              : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all ${included ? 'bg-brand-500' : 'border border-white/30'}`}>
                            {included && <Check className="w-3 h-3 text-pure-white" />}
                          </div>
                          <Avatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="truncate text-xs">{m.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  {formErrors.participants && <p className="mt-1 text-xs text-red-400">{formErrors.participants}</p>}
                </div>
                )}

                {/* Split Type */}
                {!isStay && (
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2">How to split?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPLIT_TYPES.map(st => (
                      <button
                        key={st}
                        id={`split-${st}`}
                        onClick={() => { setSplitType(st); setSplitValues({}) }}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                          splitType === st
                            ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                            : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span>{getSplitTypeIcon(st)}</span>
                        <span>{getSplitTypeLabel(st)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* Custom split inputs */}
                <AnimatePresence>
                  {!isStay && splitType !== 'equal' && participants.length > 0 && (
                    <motion.div
                      key="split-inputs"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <p className="text-xs text-white/50 mb-2">
                          {splitType === 'custom'     && 'Enter amount for each person'}
                          {splitType === 'percentage' && 'Enter % for each person (must sum to 100%)'}
                          {splitType === 'quantity'   && 'Enter quantity for each person (e.g. bottles)'}
                        </p>
                        {participants.map(pid => {
                          const m = members.find(x => x.id === pid)!
                          return (
                            <div key={pid} className="flex items-center gap-3">
                              <Avatar name={m.name} color={m.avatarColor} size="xs" />
                              <span className="text-xs text-white flex-1">{m.name}</span>
                              <div className="relative w-24">
                                {splitType === 'percentage' && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">%</span>
                                )}
                                {splitType === 'custom' && (
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">₹</span>
                                )}
                                <input
                                  id={`split-val-${pid}`}
                                  type="number"
                                  inputMode="decimal"
                                  className={`input-glass py-1.5 text-xs text-right ${splitType === 'custom' ? 'pl-6' : ''} ${splitType === 'percentage' ? 'pr-6' : ''}`}
                                  placeholder="0"
                                  value={splitValues[pid] || ''}
                                  onChange={e => setSplitValues(v => ({ ...v, [pid]: e.target.value }))}
                                />
                              </div>
                              <span className="text-xs text-white/50 w-16 text-right">
                                {resolvedShares[pid] ? formatCurrency(resolvedShares[pid]) : '—'}
                              </span>
                            </div>
                          )
                        })}

                        {totalAmt > 0 && (
                          <div className={`flex items-center justify-between pt-2 border-t border-white/10 text-xs ${splitDiff > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                            <span>Total</span>
                            <span>{formatCurrency(splitSum)} / {formatCurrency(totalAmt)}</span>
                          </div>
                        )}
                      </div>
                      {formErrors.split && <p className="mt-1 text-xs text-red-400">{formErrors.split}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Equal split preview */}
                {!isStay && splitType === 'equal' && totalAmt > 0 && participants.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl bg-brand-600/10 border border-brand-500/20 px-3 py-2 text-xs text-brand-400"
                  >
                    Each person pays: <strong>{formatCurrency(totalAmt / participants.length)}</strong>
                    {' '}({participants.length} people)
                  </motion.div>
                )}

                {/* Notes */}
                {!isStay && (
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Notes (optional)</label>
                  <input
                    id="expense-notes"
                    className="input-glass"
                    placeholder="Any additional context..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                )}

                {/* Submit */}
                <button
                  id="submit-expense-btn"
                  onClick={handleAdd}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {isStay ? 'Add Stay' : 'Add Expense'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
