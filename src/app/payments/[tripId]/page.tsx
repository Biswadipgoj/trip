'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { formatCurrency, formatDate, generateId } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import { Hotel, Plus, Trash2, X, Users, BedDouble, ChevronDown } from 'lucide-react'
import type { Room } from '@/types'

interface PaymentsPageProps {
  params: Promise<{ tripId: string }>
}

export default function PaymentsPage({ params }: PaymentsPageProps) {
  const { tripId } = React.use(params)

  const members           = useStore(s => s.getMembersByTrip(tripId))
  const hotelExpenses     = useStore(s => s.getHotelExpensesByTrip(tripId))
  const addHotelExpense   = useStore(s => s.addHotelExpense)
  const deleteHotelExpense = useStore(s => s.deleteHotelExpense)
  const session           = useStore(s => s.session)

  const [showModal, setShowModal]   = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [title, setTitle]     = useState('')
  const [paidBy, setPaidBy]   = useState(session?.memberId || '')
  const [rooms, setRooms]     = useState<Room[]>([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])

  const totalCost = rooms.reduce((s, r) => s + (r.cost || 0), 0)

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

  const resetForm = () => {
    setTitle('')
    setPaidBy(session?.memberId || '')
    setRooms([{ id: generateId(), name: 'Room 1', cost: 0, occupantIds: [] }])
  }

  const handleAdd = () => {
    if (!title.trim() || totalCost <= 0 || !paidBy) return
    addHotelExpense({ tripId, title: title.trim(), totalAmount: totalCost, paidBy, rooms })
    setShowModal(false)
    resetForm()
  }

  const totalHotelSpend = hotelExpenses.reduce((s, h) => s + h.totalAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
              <Hotel className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Hotel & Rooms</h1>
              <p className="text-white/40 text-sm">
                {hotelExpenses.length} bookings · {formatCurrency(totalHotelSpend)}
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="btn-brand flex items-center gap-1.5 text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </FadeIn>

      {/* Hotel List */}
      <div className="space-y-3">
        {hotelExpenses.map((hotel, i) => {
          const payer = members.find(m => m.id === hotel.paidBy)
          const isExpanded = expandedId === hotel.id
          return (
            <FadeIn key={hotel.id} delay={i * 0.06}>
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
                        {hotel.rooms.length} room{hotel.rooms.length !== 1 ? 's' : ''}
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
            </FadeIn>
          )
        })}

        {hotelExpenses.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Hotel className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 mb-1">No hotel bookings yet</p>
            <p className="text-white/30 text-sm">Add a hotel to split room costs</p>
          </motion.div>
        )}
      </div>

      {/* Add Hotel Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
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
                <h2 className="text-lg font-bold text-white">Add Hotel Booking</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Hotel name */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Hotel Name</label>
                  <input
                    className="input-glass"
                    placeholder="e.g. Goa Beach Resort"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                {/* Paid By */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    Paid By
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setPaidBy(m.id)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all ${
                          paidBy === m.id
                            ? 'bg-brand-600/30 border border-brand-500/50 text-white'
                            : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <Avatar name={m.name} color={m.avatarColor} size="xs" />
                        <span className="truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rooms */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/60">Rooms</label>
                    <button onClick={addRoom} className="text-xs text-brand-400 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add room
                    </button>
                  </div>
                  <div className="space-y-3">
                    {rooms.map((room, ri) => (
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
                </div>

                {/* Total */}
                {totalCost > 0 && (
                  <div className="rounded-xl bg-brand-600/10 border border-brand-500/20 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-white/60">Total</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(totalCost)}</span>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={!title.trim() || totalCost <= 0 || !paidBy}
                  className="btn-brand w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Hotel Booking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
