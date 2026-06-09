'use client'
import React from 'react';

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateBalances, formatCurrency } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { CountUp } from '@/components/animations/CountUp'
import { FadeIn } from '@/components/animations/FadeIn'
import { Users, Edit3, Check, X, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface MembersPageProps {
  params: Promise<{ tripId: string }>
}

export default function MembersPage({ params }: MembersPageProps) {
  const { tripId } = React.use(params)
  const members = useStore(s => s.getMembersByTrip(tripId))
  const expenses = useStore(s => s.getExpensesByTrip(tripId))
  const hotelExpenses = useStore(s => s.getHotelExpensesByTrip(tripId))
  const updateMemberUpi = useStore(s => s.updateMemberUpi)
  const session = useStore(s => s.session)

  const [editingUpi, setEditingUpi] = useState<string | null>(null)
  const [upiInput, setUpiInput] = useState('')

  const balances = useMemo(() => calculateBalances(expenses, hotelExpenses, members), [expenses, hotelExpenses, members])

  const handleSaveUpi = (memberId: string) => {
    updateMemberUpi(memberId, upiInput.trim())
    setEditingUpi(null)
    setUpiInput('')
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

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

      {/* Member Cards */}
      <div className="grid grid-cols-1 gap-4">
        {balances.map((balance, i) => {
          const member = members.find(m => m.id === balance.memberId)
          if (!member) return null
          const isMe = session?.memberId === balance.memberId
          const isEditing = editingUpi === balance.memberId

          return (
            <FadeIn key={balance.memberId} delay={i * 0.07}>
              <GlassCard className="p-5" hover>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar name={balance.name} color={balance.avatarColor} size="lg" animate />
                    {isMe && (
                      <div className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white border border-surface-0">
                        You
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{balance.name}</h3>
                    </div>
                    <p className="text-xs text-white/40 mb-3">{member.mobile}</p>

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

                {/* UPI section - only editable by the member themselves */}
                {isMe && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-xs text-white/40 font-medium">Your UPI ID</span>
                      </div>
                      {!isEditing && (
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
                            id="upi-input"
                            className="input-glass flex-1 text-xs py-2"
                            placeholder="yourname@paytm"
                            value={upiInput}
                            onChange={e => setUpiInput(e.target.value)}
                            autoFocus
                          />
                          <button
                            id="save-upi-btn"
                            onClick={() => handleSaveUpi(balance.memberId)}
                            className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button
                            id="cancel-upi-btn"
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
                          {member.upiId || 'No UPI ID set'}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Show UPI for others */}
                {!isMe && member.upiId && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-xs text-white/30">UPI:</span>
                      <span className="text-xs font-mono text-white/60">{member.upiId}</span>
                    </div>
                  </div>
                )}
              </GlassCard>
            </FadeIn>
          )
        })}
      </div>

      {members.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No members yet</p>
        </div>
      )}
    </div>
  )
}
