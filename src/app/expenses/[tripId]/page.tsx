'use client'
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import {
  formatCurrency, formatDate, getCategoryColor, getCategoryIcon,
  getSplitTypeLabel, getSplitTypeIcon, generateId
} from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import { ExpenseCategory, SplitType, ParticipantSplit, Room } from '@/types'
import {
  Plus, Receipt, Trash2, ChevronDown, X, Check,
  Users, DollarSign, Tag, Info, BedDouble
} from 'lucide-react'

interface ExpensesPageProps {
  params: Promise<{ tripId: string }>
}

const CATEGORIES: ExpenseCategory[] = [
  'food', 'travel', 'stay', 'entertainment',
  'shopping', 'alcohol', 'fuel', 'tickets', 'misc'
]

const SPLIT_TYPES: SplitType[] = ['equal', 'custom', 'percentage', 'quantity', 'room']

export default function ExpensesPage({ params }: ExpensesPageProps) {
  const { tripId } = React.use(params)

  const allExpenses    = useStore(s => s.expenses)
  const allMembers     = useStore(s => s.members)
  const allMemberUnits = useStore(s => s.memberUnits)
  const addExpense     = useStore(s => s.addExpense)
  const deleteExpense  = useStore(s => s.deleteExpense)
  const session        = useStore(s => s.session)

  const expenses = useMemo(() =>
    allExpenses
      .filter(e => e.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allExpenses, tripId]
  )
  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const memberUnits = useMemo(() => allMemberUnits.filter(u => u.tripId === tripId), [allMemberUnits, tripId])
  
  // Combine individuals and units into a list of "Entities" that can participate
  const participantEntities = useMemo(() => {
    return [
      ...memberUnits.map(u => ({ id: u.id, name: u.name, isUnit: true, avatarColor: '#bbb' })),
      ...members.map(m => ({ id: m.id, name: m.name, isUnit: false, avatarColor: m.avatarColor }))
    ]
  }, [members, memberUnits])

  const [showModal, setShowModal]   = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle]           = useState('')
  const [amount, setAmount]         = useState('')
  
  // Multiple payers state: memberId -> amount
  const [payers, setPayers]         = useState<Record<string, string>>({ [session?.memberId || '']: '' })
  
  const [category, setCategory]     = useState<ExpenseCategory>('misc')
  const [splitType, setSplitType]   = useState<SplitType>('equal')
  
  // Array of member/unit IDs
  const [participants, setParticipants] = useState<string[]>(participantEntities.map(e => e.id))
  
  const [splitValues, setSplitValues]   = useState<Record<string, string>>({})
  const [rooms, setRooms]               = useState<Room[]>([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])
  const [notes, setNotes]               = useState('')
  const [formErrors, setFormErrors]     = useState<Record<string, string>>({})

  const totalAmt = parseFloat(amount) || 0

  // ── Handlers ───────────────────────────────────────────────────────────────
  
  const togglePayer = (memberId: string) => {
    setPayers(prev => {
      const next = { ...prev }
      if (next[memberId] !== undefined) {
        delete next[memberId]
      } else {
        next[memberId] = ''
      }
      return next
    })
  }

  // Live share preview
  const resolvedShares = useMemo(() => {
    if (splitType === 'room') {
      const shares: Record<string, number> = {}
      rooms.forEach(room => {
        if (room.occupantIds.length === 0) return
        const roomCost = room.cost || 0
        const perOccupant = roomCost / room.occupantIds.length
        room.occupantIds.forEach(oid => {
          shares[oid] = (shares[oid] || 0) + perOccupant
        })
      })
      return shares
    }

    if (participants.length === 0 || totalAmt === 0) return {}
    const shares: Record<string, number> = {}

    // Compute weights: MemberUnit counts as 1 weight
    let totalWeight = 0
    participants.forEach(pid => {
      totalWeight += 1
    })

    if (splitType === 'equal') {
      if (totalWeight > 0) {
        const share = totalAmt / totalWeight
        participants.forEach(id => { shares[id] = share })
      }
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
  }, [splitType, participants, splitValues, totalAmt, rooms])

  const splitSum = Object.values(resolvedShares).reduce((a, b) => a + b, 0)
  const splitDiff = Math.abs(splitSum - totalAmt)
  
  const payersSum = Object.values(payers).reduce((a, val) => a + (parseFloat(val) || 0), 0)

  const resetForm = () => {
    setTitle(''); setAmount(''); 
    setPayers({ [session?.memberId || '']: '' })
    setCategory('misc'); setSplitType('equal')
    setParticipants(participantEntities.map(m => m.id))
    setSplitValues({}); setNotes(''); setFormErrors({}); 
    setRooms([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])
  }

  const toggleParticipant = (id: string) => {
    setParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleAdd = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (!totalAmt || totalAmt <= 0) errs.amount = 'Enter a valid amount'
    
    if (Object.keys(payers).length === 0) {
      errs.paidBy = 'Select at least one payer'
    } else if (Object.keys(payers).length === 1) {
      // If 1 payer, we can auto-fill their amount to totalAmt.
      payers[Object.keys(payers)[0]] = totalAmt.toString()
    } else {
      if (Math.abs(payersSum - totalAmt) > 0.5) {
        errs.paidBy = `Payers must sum to ${formatCurrency(totalAmt)} (current: ${formatCurrency(payersSum)})`
      }
    }

    if (splitType === 'room') {
      const roomsTotal = rooms.reduce((s, r) => s + (r.cost || 0), 0)
      if (Math.abs(roomsTotal - totalAmt) > 0.5) {
        errs.split = `Room costs must sum to ${formatCurrency(totalAmt)}`
      }
    } else {
      if (participants.length === 0) errs.participants = 'Select at least one participant'
      
      if (splitType === 'custom' && splitDiff > 0.5) {
        errs.split = `Custom amounts must sum to ${formatCurrency(totalAmt)} (current: ${formatCurrency(splitSum)})`
      }
      if (splitType === 'percentage') {
        const totalPct = participants.reduce((s, id) => s + parseFloat(splitValues[id] || '0'), 0)
        if (Math.abs(totalPct - 100) > 0.5) errs.split = `Percentages must sum to 100% (current: ${totalPct.toFixed(1)}%)`
      }
    }

    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    const splits: ParticipantSplit[] = participants.map(id => ({
      memberId: id,
      value: parseFloat(splitValues[id] || '0'),
      resolvedAmount: resolvedShares[id] ?? 0,
    }))
    
    const finalPayers: Record<string, number> = {}
    Object.entries(payers).forEach(([pid, val]) => {
      finalPayers[pid] = parseFloat(val) || totalAmt
    })

    addExpense({
      tripId, title: title.trim(), amount: totalAmt,
      paidBy: finalPayers, category, 
      participants: splitType === 'room' ? [] : participants, 
      splitType, splits, 
      rooms: splitType === 'room' ? rooms : undefined,
      notes: notes.trim(),
    })
    setShowModal(false)
    resetForm()
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Expenses</h1>
              <p className="text-slate-500 text-sm">
                {expenses.length} expenses · {formatCurrency(totalSpent)}
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

      {/* Expense List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {expenses.map((expense, i) => {
            const isExpanded = expandedId === expense.id
            const payersArr = Object.entries(expense.paidBy || {})

            return (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60, scale: 0.95 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                onDragEnd={(e, info) => {
                  if (info.offset.x < -80) {
                    deleteExpense(expense.id)
                  }
                }}
              >
                <GlassCard className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: getCategoryColor(expense.category) }}
                    >
                      {getCategoryIcon(expense.category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{expense.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {payersArr.length} payer(s)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          • {getSplitTypeIcon(expense.splitType)} {getSplitTypeLabel(expense.splitType)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900">{formatCurrency(expense.amount)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(expense.createdAt)}</p>
                    </div>

                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-400 flex-shrink-0"
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
                        <div className="px-4 pb-4 border-t border-black/5 pt-3 space-y-3">
                          
                          {/* Paid By section */}
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5 font-medium">Paid by:</p>
                            <div className="space-y-1">
                              {payersArr.map(([pid, amt]) => {
                                const m = members.find(x => x.id === pid)
                                return (
                                  <div key={pid} className="flex items-center gap-2">
                                    <Avatar name={m?.name || '?'} color={m?.avatarColor || '#ccc'} size="xs" />
                                    <span className="text-xs text-slate-700 flex-1">{m?.name || pid}</span>
                                    <span className="text-xs font-medium text-slate-800">{formatCurrency(amt)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Split section */}
                          <div className="pt-2">
                            <p className="text-xs text-slate-500 mb-1.5 font-medium">Split Details:</p>
                            
                            {expense.splitType === 'room' ? (
                              <div className="space-y-2">
                                {expense.rooms?.map(r => (
                                  <div key={r.id} className="text-xs bg-black/5 rounded-lg p-2">
                                    <div className="flex justify-between font-medium text-slate-700 mb-1">
                                      <span>{r.name}</span>
                                      <span>{formatCurrency(r.cost)}</span>
                                    </div>
                                    <div className="text-slate-500">
                                      Occupants: {r.occupantIds.map(oid => participantEntities.find(e => e.id === oid)?.name || oid).join(', ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {expense.splits?.map(split => {
                                  const entity = participantEntities.find(e => e.id === split.memberId)
                                  return (
                                    <div key={split.memberId} className="flex items-center gap-2">
                                      <Avatar name={entity?.name || '?'} color={entity?.avatarColor || '#ccc'} size="xs" />
                                      <span className="text-xs text-slate-700 flex-1">{entity?.name || split.memberId}</span>
                                      {expense.splitType !== 'equal' && (
                                        <span className="text-[10px] text-slate-400">
                                          {expense.splitType === 'quantity' ? `${split.value} units` : ''}
                                          {expense.splitType === 'percentage' ? `${split.value}%` : ''}
                                        </span>
                                      )}
                                      <span className="text-xs font-medium text-slate-800">
                                        {formatCurrency(split.resolvedAmount ?? 0)}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {expense.notes && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 bg-black/5 p-2 rounded-lg">
                              <Info className="w-3 h-3 flex-shrink-0" />
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
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors bg-red-50 px-2 py-1 rounded"
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
          })}
        </AnimatePresence>

        {expenses.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 mb-1 font-medium">No expenses yet</p>
            <p className="text-slate-400 text-sm">Add your first expense to get started</p>
          </motion.div>
        )}
      </div>

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
              className="bg-surface-0 shadow-elevated rounded-3xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800">Add Expense</h2>
                <button
                  id="close-expense-modal"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    <Tag className="w-3.5 h-3.5 inline mr-1" />
                    Expense Title
                  </label>
                  <input
                    id="expense-title"
                    className="input-glass"
                    placeholder="e.g. Dinner at Olive Bar"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  {formErrors.title && <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    <DollarSign className="w-3.5 h-3.5 inline mr-1" />
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
                  {formErrors.amount && <p className="mt-1 text-xs text-red-500">{formErrors.amount}</p>}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        id={`cat-${cat}`}
                        onClick={() => setCategory(cat)}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
                          category === cat
                            ? 'bg-brand-100 border border-brand-300 text-brand-700'
                            : 'bg-black/5 border border-black/5 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>{getCategoryIcon(cat)}</span>
                        <span className="capitalize truncate">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paid By (Multiple Payers Support) */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    Paid By
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {members.map(m => {
                      const isSelected = payers[m.id] !== undefined
                      return (
                        <button
                          key={m.id}
                          id={`paid-by-${m.id}`}
                          onClick={() => togglePayer(m.id)}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                            isSelected
                              ? 'bg-brand-100 border border-brand-300 text-brand-700'
                              : 'bg-black/5 border border-black/5 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Avatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="truncate">{m.name}</span>
                          {isSelected && <Check className="w-3 h-3 ml-auto flex-shrink-0 text-brand-600" />}
                        </button>
                      )
                    })}
                  </div>
                  
                  {/* Payer amounts if multiple */}
                  {Object.keys(payers).length > 1 && (
                    <div className="space-y-2 bg-brand-50 p-3 rounded-xl border border-brand-100 mt-2">
                      <p className="text-xs text-brand-600 font-medium mb-2">Specify who paid how much:</p>
                      {Object.keys(payers).map(pid => {
                        const m = members.find(x => x.id === pid)
                        return (
                          <div key={pid} className="flex items-center gap-2">
                            <span className="text-xs text-slate-700 flex-1">{m?.name || pid}</span>
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                className="input-glass py-1.5 text-xs text-right pl-6 bg-white"
                                placeholder="0"
                                value={payers[pid]}
                                onChange={e => setPayers(prev => ({ ...prev, [pid]: e.target.value }))}
                              />
                            </div>
                          </div>
                        )
                      })}
                      <div className={`text-xs text-right mt-1 ${Math.abs(payersSum - totalAmt) > 0.5 ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>
                        Total: {formatCurrency(payersSum)} / {formatCurrency(totalAmt)}
                      </div>
                    </div>
                  )}
                  {formErrors.paidBy && <p className="mt-1 text-xs text-red-500">{formErrors.paidBy}</p>}
                </div>

                {/* Split Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">How to split?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SPLIT_TYPES.map(st => (
                      <button
                        key={st}
                        id={`split-${st}`}
                        onClick={() => { setSplitType(st); setSplitValues({}) }}
                        className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-all ${
                          splitType === st
                            ? 'bg-brand-100 border border-brand-300 text-brand-700'
                            : 'bg-black/5 border border-black/5 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>{getSplitTypeIcon(st)}</span>
                        <span className="truncate">{getSplitTypeLabel(st)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participants / Room Logic */}
                {splitType === 'room' ? (
                  <div className="space-y-3 bg-black/5 p-3 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-600">Rooms</label>
                      <button 
                        onClick={() => setRooms(prev => [...prev, { id: generateId(), name: `Room ${prev.length + 1}`, cost: 0, occupantIds: [] }])}
                        className="text-xs text-brand-600 font-medium"
                      >
                        + Add Room
                      </button>
                    </div>
                    {rooms.map((room, idx) => (
                      <div key={room.id} className="border border-black/10 rounded-lg p-3 bg-white">
                        <div className="flex gap-2 mb-2">
                          <input 
                            className="input-glass flex-1 py-1 px-2 text-xs" 
                            value={room.name} 
                            onChange={e => setRooms(prev => prev.map(r => r.id === room.id ? { ...r, name: e.target.value } : r))}
                          />
                          <input 
                            type="number"
                            className="input-glass w-24 py-1 px-2 text-xs text-right" 
                            placeholder="Cost"
                            value={room.cost || ''} 
                            onChange={e => setRooms(prev => prev.map(r => r.id === room.id ? { ...r, cost: parseFloat(e.target.value) || 0 } : r))}
                          />
                          {rooms.length > 1 && (
                            <button onClick={() => setRooms(prev => prev.filter(r => r.id !== room.id))} className="text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mb-1">Occupants</div>
                        <div className="flex flex-wrap gap-1">
                          {participantEntities.map(e => {
                            const isSelected = room.occupantIds.includes(e.id)
                            return (
                              <button
                                key={e.id}
                                onClick={() => {
                                  setRooms(prev => prev.map(r => {
                                    if (r.id !== room.id) return r
                                    return {
                                      ...r,
                                      occupantIds: isSelected ? r.occupantIds.filter(id => id !== e.id) : [...r.occupantIds, e.id]
                                    }
                                  }))
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] transition-colors ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {e.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-right text-slate-500 pt-1">
                      Total Rooms Cost: {formatCurrency(rooms.reduce((s, r) => s + (r.cost || 0), 0))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-600">Who's sharing this?</label>
                      <div className="flex gap-3 text-xs">
                        <button id="select-all" onClick={() => setParticipants(participantEntities.map(m => m.id))} className="text-brand-600 font-medium">All</button>
                        <button id="clear-all"  onClick={() => setParticipants([])} className="text-slate-400">None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {participantEntities.map(m => {
                        const included = participants.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            id={`participant-${m.id}`}
                            onClick={() => toggleParticipant(m.id)}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                              included
                                ? 'bg-brand-100 border border-brand-300 text-brand-700'
                                : 'bg-black/5 border border-black/5 text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all ${included ? 'bg-brand-500' : 'border border-black/10'}`}>
                              {included && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="truncate text-xs">{m.name} {m.isUnit && '(Unit)'}</span>
                          </button>
                        )
                      })}
                    </div>
                    {formErrors.participants && <p className="mt-1 text-xs text-red-500">{formErrors.participants}</p>}
                  </div>
                )}

                {/* Custom split inputs */}
                <AnimatePresence>
                  {splitType !== 'equal' && splitType !== 'room' && participants.length > 0 && (
                    <motion.div
                      key="split-inputs"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 space-y-2 mt-3">
                        <p className="text-xs text-brand-600 mb-2">
                          {splitType === 'custom'     && 'Enter amount for each entity'}
                          {splitType === 'percentage' && 'Enter % for each entity (must sum to 100%)'}
                          {splitType === 'quantity'   && 'Enter quantity for each entity (e.g. bottles)'}
                        </p>
                        {participants.map(pid => {
                          const m = participantEntities.find(x => x.id === pid)!
                          return (
                            <div key={pid} className="flex items-center gap-3">
                              <span className="text-xs text-slate-700 flex-1">{m.name}</span>
                              <div className="relative w-24">
                                {splitType === 'percentage' && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                                )}
                                {splitType === 'custom' && (
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                                )}
                                <input
                                  id={`split-val-${pid}`}
                                  type="number"
                                  inputMode="decimal"
                                  className={`input-glass bg-white py-1.5 text-xs text-right ${splitType === 'custom' ? 'pl-6' : ''} ${splitType === 'percentage' ? 'pr-6' : ''}`}
                                  placeholder="0"
                                  value={splitValues[pid] || ''}
                                  onChange={e => setSplitValues(v => ({ ...v, [pid]: e.target.value }))}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-16 text-right">
                                {resolvedShares[pid] ? formatCurrency(resolvedShares[pid]) : '—'}
                              </span>
                            </div>
                          )
                        })}

                        {totalAmt > 0 && (
                          <div className={`flex items-center justify-between pt-2 border-t border-brand-200 text-xs ${splitDiff > 0.5 ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>
                            <span>Total</span>
                            <span>{formatCurrency(splitSum)} / {formatCurrency(totalAmt)}</span>
                          </div>
                        )}
                      </div>
                      {formErrors.split && <p className="mt-1 text-xs text-red-500">{formErrors.split}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes (optional)</label>
                  <input
                    id="expense-notes"
                    className="input-glass"
                    placeholder="Any additional context..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <button
                  id="submit-expense-btn"
                  onClick={handleAdd}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Expense
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
