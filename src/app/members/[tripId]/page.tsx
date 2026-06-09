'use client'
import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateBalances, formatCurrency, generateId } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { CountUp } from '@/components/animations/CountUp'
import { FadeIn } from '@/components/animations/FadeIn'
import { Users, Edit3, Check, X, Wallet, ArrowUpRight, ArrowDownRight, Link as LinkIcon, Plus } from 'lucide-react'

interface MembersPageProps {
  params: Promise<{ tripId: string }>
}

export default function MembersPage({ params }: MembersPageProps) {
  const { tripId } = React.use(params)
  const allMembers = useStore(s => s.members)
  const allMemberUnits = useStore(s => s.memberUnits)
  const allExpenses = useStore(s => s.expenses)
  const updateMemberUpi = useStore(s => s.updateMemberUpi)
  const addMemberUnit = useStore(s => s.addMemberUnit)
  const deleteMemberUnit = useStore(s => s.deleteMemberUnit)
  const session = useStore(s => s.session)

  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const memberUnits = useMemo(() => allMemberUnits.filter(u => u.tripId === tripId), [allMemberUnits, tripId])
  const expenses = useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])

  const [editingUpi, setEditingUpi] = useState<string | null>(null)
  const [upiInput, setUpiInput] = useState('')
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [unitName, setUnitName] = useState('')
  const [selectedMembersForUnit, setSelectedMembersForUnit] = useState<string[]>([])

  const balances = useMemo(() => calculateBalances(expenses, members, memberUnits), [expenses, members, memberUnits])

  const handleSaveUpi = (memberId: string) => {
    updateMemberUpi(memberId, upiInput.trim())
    setEditingUpi(null)
    setUpiInput('')
  }

  const handleCreateUnit = () => {
    if (!unitName.trim() || selectedMembersForUnit.length < 2) return
    addMemberUnit({
      tripId,
      name: unitName.trim(),
      memberIds: selectedMembersForUnit
    })
    setShowUnitModal(false)
    setUnitName('')
    setSelectedMembersForUnit([])
  }

  const toggleMemberForUnit = (id: string) => {
    setSelectedMembersForUnit(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Members</h1>
              <p className="text-slate-500 text-sm">{members.length} people · {formatCurrency(totalSpent)} total spent</p>
            </div>
          </div>
          <button
            onClick={() => setShowUnitModal(true)}
            className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-100 transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Create Unit
          </button>
        </div>
      </FadeIn>

      {/* Member & Unit Cards */}
      <div className="grid grid-cols-1 gap-4">
        {balances.map((balance, i) => {
          const isUnit = balance.memberId.startsWith('unit_')
          const member = members.find(m => m.id === balance.memberId)
          const unit = memberUnits.find(u => u.id === balance.memberId)
          
          if (!member && !unit) return null
          
          const isMe = session?.memberId === balance.memberId
          const isEditing = editingUpi === balance.memberId
          
          const displayName = isUnit ? unit?.name : member?.name
          const displayColor = isUnit ? '#94a3b8' : member?.avatarColor
          const isParticipantOfUnit = isUnit ? false : memberUnits.some(u => u.memberIds.includes(member!.id))

          return (
            <FadeIn key={balance.memberId} delay={i * 0.07}>
              <GlassCard className="p-5 bg-white border-black/5 shadow-card" hover>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar name={displayName || '?'} color={displayColor} size="lg" animate />
                    {isMe && (
                      <div className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white border border-surface-0">
                        You
                      </div>
                    )}
                    {isUnit && (
                      <div className="absolute -bottom-1 -right-1 bg-slate-700 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white border border-surface-0">
                        Unit
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{displayName}</h3>
                      </div>
                      {isUnit && (
                        <button onClick={() => deleteMemberUnit(balance.memberId)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                    {isUnit ? (
                      <p className="text-xs text-slate-500 mb-3">
                        {unit?.memberIds.map(id => members.find(m => m.id === id)?.name).join(' + ')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mb-3">
                        {member?.mobile} {isParticipantOfUnit && <span className="text-brand-500 ml-2">(Part of a Unit)</span>}
                      </p>
                    )}

                    {/* Balance stats */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Paid</p>
                        <p className="text-sm font-semibold text-slate-800">
                          ₹<CountUp end={balance.totalPaid} duration={1} decimals={0} />
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Owes</p>
                        <p className="text-sm font-semibold text-slate-800">
                          ₹<CountUp end={balance.totalOwed} duration={1} decimals={0} />
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Balance</p>
                        <div className="flex items-center gap-1">
                          {balance.netBalance > 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          ) : balance.netBalance < 0 ? (
                            <ArrowDownRight className="w-3 h-3 text-red-500 flex-shrink-0" />
                          ) : null}
                          <p
                            className={`text-sm font-bold ${
                              balance.netBalance > 0
                                ? 'text-emerald-600'
                                : balance.netBalance < 0
                                ? 'text-red-600'
                                : 'text-slate-400'
                            }`}
                          >
                            ₹<CountUp end={Math.abs(balance.netBalance)} duration={1} decimals={0} />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* UPI section - only editable by the member themselves */}
                {isMe && !isUnit && (
                  <div className="mt-4 pt-4 border-t border-black/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium">Your UPI ID</span>
                      </div>
                      {!isEditing && (
                        <button
                          id={`edit-upi-${balance.memberId}`}
                          onClick={() => {
                            setEditingUpi(balance.memberId)
                            setUpiInput(member?.upiId || '')
                          }}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 bg-brand-50 px-2 py-1 rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                          {member?.upiId ? 'Edit' : 'Add'}
                        </button>
                      )}
                    </div>

                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex gap-2"
                        >
                          <input
                            id="upi-input"
                            className="input-glass flex-1 text-xs py-2 bg-white"
                            placeholder="yourname@paytm"
                            value={upiInput}
                            onChange={e => setUpiInput(e.target.value)}
                            autoFocus
                          />
                          <button
                            id="save-upi-btn"
                            onClick={() => handleSaveUpi(balance.memberId)}
                            className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button
                            id="cancel-upi-btn"
                            onClick={() => setEditingUpi(null)}
                            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                          >
                            <X className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.p
                          key="display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-mono ${member?.upiId ? 'text-slate-800' : 'text-slate-400 italic'}`}
                        >
                          {member?.upiId || 'No UPI ID set'}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Show UPI for others */}
                {!isMe && !isUnit && member?.upiId && (
                  <div className="mt-4 pt-4 border-t border-black/5">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">UPI:</span>
                      <span className="text-xs font-mono text-slate-700 font-medium">{member.upiId}</span>
                    </div>
                  </div>
                )}
              </GlassCard>
            </FadeIn>
          )
        })}
      </div>

      {balances.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No members yet</p>
        </div>
      )}

      {/* ── Create Unit Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUnitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
            onClick={() => setShowUnitModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white shadow-elevated rounded-3xl p-6 w-full max-w-sm"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800">Create Member Unit</h2>
                <button
                  onClick={() => setShowUnitModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Group members into a single unit (e.g. Couple, Family). They will be treated as one entity when splitting expenses equally.
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Unit Name</label>
                  <input
                    className="input-glass bg-slate-50"
                    placeholder="e.g. John & Jane"
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Select Members</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {members.map(m => {
                      const isSelected = selectedMembersForUnit.includes(m.id)
                      const isAlreadyInUnit = memberUnits.some(u => u.memberIds.includes(m.id))
                      if (isAlreadyInUnit) return null

                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMemberForUnit(m.id)}
                          className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all ${
                            isSelected
                              ? 'bg-brand-100 border border-brand-300 text-brand-700'
                              : 'bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Avatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="truncate">{m.name}</span>
                          {isSelected && <Check className="w-3 h-3 ml-auto flex-shrink-0 text-brand-600" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={handleCreateUnit}
                  disabled={selectedMembersForUnit.length < 2 || !unitName.trim()}
                  className="btn-brand w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Create Unit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
