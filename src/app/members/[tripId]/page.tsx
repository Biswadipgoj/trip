'use client'
import React from 'react';

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateNetBalances, formatCurrency, formatDate, createInviteLink } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { CountUp } from '@/components/animations/CountUp'
import { FadeIn } from '@/components/animations/FadeIn'
import {
  Users, Edit3, Check, X, Wallet, ArrowUpRight, ArrowDownRight,
  Link2, Crown, Heart, Trash2, Plus, UserPlus
} from 'lucide-react'

interface MembersPageProps {
  params: Promise<{ tripId: string }>
}

export default function MembersPage({ params }: MembersPageProps) {
  const { tripId } = React.use(params)
  const trip = useStore(s => s.trips.find(t => t.id === tripId))
  const allMembers = useStore(s => s.members)
  const allExpenses = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allSettlements = useStore(s => s.settlements)
  const allGroups = useStore(s => s.settlementGroups)
  const allSponsorships = useStore(s => s.sponsorships)
  const addSettlementGroup = useStore(s => s.addSettlementGroup)
  const removeSettlementGroup = useStore(s => s.removeSettlementGroup)
  const addMember = useStore(s => s.addMember)
  const updateMemberUpi = useStore(s => s.updateMemberUpi)
  const session = useStore(s => s.session)

  const members = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses = useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])
  const hotelExpenses = useMemo(() => allHotelExpenses.filter(h => h.tripId === tripId), [allHotelExpenses, tripId])
  const settlements = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])
  const units = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])

  const [editingUpi, setEditingUpi] = useState<string | null>(null)
  const [upiInput, setUpiInput] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [unitName, setUnitName] = useState('')
  const [unitMembers, setUnitMembers] = useState<string[]>([])
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  // Net balances reflect confirmed payments (group-aware), not just raw
  // expense math — a couple's combined payment settles both members.
  const balances = useMemo(
    () => calculateNetBalances(expenses, hotelExpenses, members, settlements, units, sponsorships),
    [expenses, hotelExpenses, members, settlements, units, sponsorships]
  )
  const balanceMap = useMemo(() => {
    const map: Record<string, typeof balances[0]> = {}
    balances.forEach(b => { map[b.memberId] = b })
    return map
  }, [balances])

  const handleSaveUpi = (memberId: string) => {
    updateMemberUpi(memberId, upiInput.trim())
    setEditingUpi(null)
    setUpiInput('')
  }

  const copyInviteLink = () => {
    if (!trip) return
    navigator.clipboard.writeText(createInviteLink(trip, window.location.origin))
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const isAdmin = !!trip && session?.memberId === trip.creatorId

  const handleAddMember = () => {
    if (!newMemberName.trim()) return
    addMember(tripId, newMemberName)
    setNewMemberName('')
    setShowAddMember(false)
  }

  const toggleUnitMember = (id: string) => {
    setUnitMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreateUnit = () => {
    if (!unitName.trim() || unitMembers.length < 2) return
    addSettlementGroup(tripId, unitName.trim(), unitMembers)
    setUnitName('')
    setUnitMembers([])
    setShowUnitForm(false)
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
    + hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Members</h1>
            <p className="text-white/40 text-sm">{members.length} people · {formatCurrency(totalSpent)} total spent</p>
          </div>
        </div>
      </FadeIn>

      {/* Invite friends */}
      {trip && (
        <FadeIn delay={0.05}>
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-brand-400" />
                  Invite friends
                </p>
                <p className="text-xs text-white/40 mt-0.5 truncate">
                  Share the join link — works on any device, valid 30 days
                </p>
              </div>
              <button
                id="copy-invite-link-btn"
                onClick={copyInviteLink}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  copiedInvite
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30'
                }`}
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {copiedInvite ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Admin: add member manually by name */}
      {isAdmin && (
        <FadeIn delay={0.08}>
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-accent-400" />
                  Add member
                </p>
                <p className="text-xs text-white/40 mt-0.5 truncate">
                  Add friends by name — they can join with the link later
                </p>
              </div>
              {!showAddMember && (
                <button
                  id="show-add-member-btn"
                  onClick={() => setShowAddMember(true)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-accent-500/15 text-accent-500 border border-accent-500/25 hover:bg-accent-500/25 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )}
            </div>
            <AnimatePresence>
              {showAddMember && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 mt-3">
                    <input
                      id="new-member-name-input"
                      className="input-glass flex-1 text-sm py-2"
                      placeholder="Member name, e.g. Aman"
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddMember() }}
                      maxLength={40}
                      autoFocus
                    />
                    <button
                      id="add-member-btn"
                      onClick={handleAddMember}
                      disabled={!newMemberName.trim()}
                      className="btn-brand text-xs py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                    <button
                      id="cancel-add-member-btn"
                      onClick={() => { setShowAddMember(false); setNewMemberName('') }}
                      className="btn-ghost text-xs py-2 px-3"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </FadeIn>
      )}

      {/* Member Cards */}
      <div className="grid grid-cols-1 gap-4">
        {balances.map((balance, i) => {
          const member = members.find(m => m.id === balance.memberId)
          if (!member) return null
          const isMe = session?.memberId === balance.memberId
          const isEditing = editingUpi === balance.memberId
          // A member can edit their own UPI; the group creator can edit everyone's.
          const canEditUpi = isMe || isAdmin

          return (
            <FadeIn key={balance.memberId} delay={i * 0.07}>
              <GlassCard className="p-5" hover>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar name={balance.name} color={balance.avatarColor} size="lg" animate />
                    {isMe && (
                      <div className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-pure-white border border-surface-0">
                        You
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white">{balance.name}</h3>
                      {trip?.creatorId === member.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          <Crown className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mb-3">
                      {member.mobile || 'Added by admin'} · Joined {formatDate(member.joinedAt)}
                    </p>

                    {/* Balance stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">Paid</p>
                        <p className="text-sm font-semibold text-white">
                          ₹<CountUp end={balance.totalPaid} duration={1} decimals={0} />
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">Owes</p>
                        <p className="text-sm font-semibold text-white">
                          ₹<CountUp end={balance.totalOwed} duration={1} decimals={0} />
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">Balance</p>
                        <div className="flex items-center gap-1">
                          {balance.netBalance > 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          ) : balance.netBalance < 0 ? (
                            <ArrowDownRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                          ) : null}
                          <p
                            className={`text-sm font-semibold ${
                              balance.netBalance > 0
                                ? 'text-emerald-400'
                                : balance.netBalance < 0
                                ? 'text-red-400'
                                : 'text-white/40'
                            }`}
                          >
                            ₹<CountUp end={Math.abs(balance.netBalance)} duration={1} decimals={0} />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* UPI section — editable by the member themselves OR the group creator */}
                {(canEditUpi || member.upiId) && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-xs text-white/40 font-medium">
                          {isMe ? 'Your UPI ID' : `${balance.name.split(' ')[0]}'s UPI ID`}
                        </span>
                        {!isMe && isAdmin && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-600/15 border border-brand-500/25 px-1.5 py-0.5 text-[9px] font-medium text-brand-400">
                            <Crown className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                      </div>
                      {canEditUpi && !isEditing && (
                        <button
                          id={`edit-upi-${balance.memberId}`}
                          onClick={() => {
                            setEditingUpi(balance.memberId)
                            setUpiInput(member.upiId || '')
                          }}
                          className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          {member.upiId ? 'Edit' : 'Add'}
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
                            id={`upi-input-${balance.memberId}`}
                            className="input-glass flex-1 text-xs py-2"
                            placeholder={isMe ? 'yourname@paytm' : `${balance.name.split(' ')[0].toLowerCase()}@upi`}
                            value={upiInput}
                            onChange={e => setUpiInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveUpi(balance.memberId) }}
                            autoFocus
                          />
                          <button
                            id={`save-upi-btn-${balance.memberId}`}
                            onClick={() => handleSaveUpi(balance.memberId)}
                            className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button
                            id={`cancel-upi-btn-${balance.memberId}`}
                            onClick={() => setEditingUpi(null)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5 text-white/40" />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.p
                          key="display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-mono ${member.upiId ? 'text-white' : 'text-white/30 italic'}`}
                        >
                          {member.upiId || (canEditUpi ? 'No UPI ID set — tap Add' : 'No UPI ID set')}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </GlassCard>
            </FadeIn>
          )
        })}
      </div>

      {/* Units — members merged into one settlement entity (e.g. a couple) */}
      {members.length >= 2 && (
        <FadeIn delay={0.15}>
          <GlassCard className="p-5" hover={false}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-accent-400" />
                Units
              </p>
              {!showUnitForm && (
                <button
                  id="add-unit-btn"
                  onClick={() => setShowUnitForm(true)}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Create unit
                </button>
              )}
            </div>
            <p className="text-xs text-white/40 mb-4">
              Group members (e.g. a couple) into one unit — they settle as a single entity
            </p>

            {/* Existing units */}
            <div className="space-y-2">
              {units.map(unit => {
                const unitMemberList = members.filter(m => unit.memberIds.includes(m.id))
                const combined = unit.memberIds.reduce((s, id) => s + (balanceMap[id]?.netBalance ?? 0), 0)
                const isExpanded = expandedUnit === unit.id
                return (
                  <div key={unit.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                    >
                      <div className="flex -space-x-2">
                        {unitMemberList.map(m => (
                          <Avatar key={m.id} name={m.name} color={m.avatarColor} size="xs" />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-white flex-1 truncate">{unit.name}</span>
                      <span className={`text-xs font-semibold ${
                        combined > 0.01 ? 'text-emerald-400' : combined < -0.01 ? 'text-red-400' : 'text-white/40'
                      }`}>
                        {combined > 0 ? '+' : ''}{formatCurrency(combined)}
                      </span>
                      <button
                        id={`remove-unit-${unit.id}`}
                        onClick={e => { e.stopPropagation(); removeSettlementGroup(unit.id) }}
                        className="text-white/30 hover:text-red-400 transition-colors"
                        aria-label="Remove unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Internal split hidden unless expanded */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                            {unitMemberList.map(m => {
                              const b = balanceMap[m.id]
                              return (
                                <div key={m.id} className="flex items-center justify-between text-xs">
                                  <span className="text-white/50">{m.name}</span>
                                  <span className={b && b.netBalance > 0.01 ? 'text-emerald-400' : b && b.netBalance < -0.01 ? 'text-red-400' : 'text-white/40'}>
                                    {b && b.netBalance > 0 ? '+' : ''}{formatCurrency(b?.netBalance ?? 0)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
              {units.length === 0 && !showUnitForm && (
                <p className="text-xs text-white/30 italic">No units yet</p>
              )}
            </div>

            {/* Create unit form */}
            <AnimatePresence>
              {showUnitForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                    <input
                      id="unit-name-input"
                      className="input-glass text-sm py-2"
                      placeholder='Unit name, e.g. "Rahul & Priya"'
                      value={unitName}
                      onChange={e => setUnitName(e.target.value)}
                      maxLength={40}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {members.map(m => {
                        const inAnotherUnit = units.some(u => u.memberIds.includes(m.id))
                        const selected = unitMembers.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            id={`unit-member-${m.id}`}
                            disabled={inAnotherUnit}
                            onClick={() => toggleUnitMember(m.id)}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all disabled:opacity-30 ${
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
                    <div className="flex gap-2">
                      <button
                        id="cancel-unit-btn"
                        onClick={() => { setShowUnitForm(false); setUnitName(''); setUnitMembers([]) }}
                        className="btn-ghost flex-1 text-xs py-2"
                      >
                        Cancel
                      </button>
                      <button
                        id="create-unit-btn"
                        onClick={handleCreateUnit}
                        disabled={!unitName.trim() || unitMembers.length < 2}
                        className="btn-brand flex-1 text-xs py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Create Unit
                      </button>
                    </div>
                    <p className="text-[10px] text-white/30">Pick at least 2 members. A member can only belong to one unit.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </FadeIn>
      )}

      {members.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No members yet</p>
        </div>
      )}
    </div>
  )
}
