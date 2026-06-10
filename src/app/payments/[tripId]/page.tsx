'use client'
import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateNetBalances, calculateSettlements, formatCurrency, formatDate, buildUpiLink } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import {
  ArrowRight, CheckCircle2, Clock, CreditCard, QrCode,
  ArrowUpRight, ArrowDownRight, Sparkles
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface PaymentsPageProps {
  params: Promise<{ tripId: string }>
}

/**
 * Payment module — settlement transactions ONLY.
 *
 * This module never creates or stores expenses. It derives everything from
 * the expense engine: Expenses → Ledger → Balance Engine → Settlement Engine,
 * and outputs the minimum set of "who pays whom" transactions.
 */
export default function PaymentsPage({ params }: PaymentsPageProps) {
  const { tripId } = React.use(params)

  const allMembers       = useStore(s => s.members)
  const allExpenses      = useStore(s => s.expenses)
  const allHotelExpenses = useStore(s => s.hotelExpenses)
  const allGroups        = useStore(s => s.settlementGroups)
  const allSponsorships  = useStore(s => s.sponsorships)
  const allSettlements   = useStore(s => s.settlements)
  const updateStatus        = useStore(s => s.updateSettlementStatus)
  const generateSettlements = useStore(s => s.generateSettlements)

  const members       = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses      = useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])
  const hotelExpenses = useMemo(() => allHotelExpenses.filter(h => h.tripId === tripId), [allHotelExpenses, tripId])
  const groups        = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships  = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])
  const settlements   = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])

  const [showQr, setShowQr] = React.useState<string | null>(null)

  // Keep persisted settlements in sync with the expense engine
  React.useEffect(() => {
    generateSettlements(tripId)
  }, [tripId, generateSettlements])

  // Confirmed payments are immutable transaction history — cash that moved.
  const confirmedPayments = useMemo(
    () =>
      settlements
        .filter(s => s.status === 'confirmed')
        .sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || '')),
    [settlements]
  )

  // Expenses → Balance Engine, adjusted by confirmed transfers (group-aware),
  // so the settlement minimizer always runs on the LIVE residual debt.
  const balances = useMemo(
    () => calculateNetBalances(expenses, hotelExpenses, members, settlements, groups, sponsorships),
    [expenses, hotelExpenses, members, settlements, groups, sponsorships]
  )

  // Balance Engine → Settlement Engine (minimum transactions still due)
  const routes = useMemo(
    () => calculateSettlements(balances, members, groups, sponsorships),
    [balances, members, groups, sponsorships]
  )

  const memberMap = useMemo(() => {
    const map: Record<string, typeof members[0]> = {}
    members.forEach(m => { map[m.id] = m })
    return map
  }, [members])

  const pendingCount   = settlements.filter(s => s.status === 'pending').length
  const confirmedCount = confirmedPayments.length
  const nonZeroBalances = balances.filter(b => Math.abs(b.netBalance) > 0.01)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Payments</h1>
            <p className="text-white/40 text-sm">
              {routes.length === 0
                ? confirmedCount > 0
                  ? `All settled · ${confirmedCount} payment${confirmedCount !== 1 ? 's' : ''} confirmed`
                  : 'All balances are clear'
                : `${routes.length} payment${routes.length !== 1 ? 's' : ''} still due · ${pendingCount} pending · ${confirmedCount} confirmed`}
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Balance summary — input to the settlement engine */}
      {nonZeroBalances.length > 0 && (
        <FadeIn delay={0.05}>
          <GlassCard className="p-5" hover={false}>
            <h2 className="text-sm font-semibold text-white mb-3">Net Balances</h2>
            <div className="space-y-2">
              {nonZeroBalances.map(b => (
                <div key={b.memberId} className="flex items-center gap-2.5">
                  <Avatar name={b.name} color={b.avatarColor} size="xs" />
                  <span className="text-xs text-white/70 flex-1 truncate">{b.name}</span>
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${b.netBalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {b.netBalance > 0
                      ? <ArrowUpRight className="w-3 h-3" />
                      : <ArrowDownRight className="w-3 h-3" />}
                    {b.netBalance > 0 ? '+' : '−'}{formatCurrency(Math.abs(b.netBalance))}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-3 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Optimized to the minimum number of transactions
            </p>
          </GlassCard>
        </FadeIn>
      )}

      {/* Empty state */}
      {routes.length === 0 && (
        <FadeIn delay={0.1}>
          <div className="text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white/60 mb-1">
              {confirmedCount > 0 ? 'Everything is settled 🎉' : 'No payments needed'}
            </p>
            <p className="text-white/30 text-sm">
              {confirmedCount > 0
                ? 'All confirmed payments are recorded below'
                : 'Add expenses to see who pays whom'}
            </p>
          </div>
        </FadeIn>
      )}

      {/* Settlement Transactions */}
      <div className="space-y-3">
        {routes.map((route, i) => {
          // A route matches a stored due only when it's the SAME payment:
          // same direction AND same amount, and not yet confirmed.
          const settlement = settlements.find(
            s =>
              s.status !== 'confirmed' &&
              s.fromMemberId === route.fromMemberId &&
              s.toMemberId === route.toMemberId &&
              Math.abs(s.amount - route.amount) < 0.01
          )
          const status = settlement?.status || 'pending'
          const toMember = memberMap[route.toMemberId]
          const upiLink  = toMember?.upiId
            ? buildUpiLink(toMember.upiId, toMember.upiName || toMember.name, route.amount, `TripMate - ${route.fromName}`)
            : null
          const isShowingQr = showQr === route.id

          return (
            <FadeIn key={route.id} delay={0.1 + i * 0.07}>
              <GlassCard className="p-5">
                {/* From → To */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={route.fromName} color={route.fromColor} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{route.fromName}</p>
                    <p className="text-xs text-white/40">pays</p>
                  </div>
                  <div className="flex flex-col items-center px-2">
                    <p className="text-lg font-bold text-white">{formatCurrency(route.amount)}</p>
                    <ArrowRight className="w-4 h-4 text-brand-400 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-white truncate">{route.toName}</p>
                    {toMember?.upiId && (
                      <p className="text-xs text-brand-400 font-mono truncate">{toMember.upiId}</p>
                    )}
                  </div>
                  <Avatar name={route.toName} color={route.toColor} size="md" />
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    status === 'confirmed'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : status === 'paid'
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}>
                    {status === 'confirmed'
                      ? <><CheckCircle2 className="w-3 h-3" /> Confirmed</>
                      : status === 'paid'
                      ? <><CreditCard className="w-3 h-3" /> Paid</>
                      : <><Clock className="w-3 h-3" /> Due</>
                    }
                  </div>

                  <div className="flex items-center gap-2">
                    {/* QR code toggle (only if recipient has UPI) */}
                    {upiLink && (
                      <button
                        onClick={() => setShowQr(isShowingQr ? null : route.id)}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        UPI
                      </button>
                    )}

                    {/* Action buttons */}
                    {settlement && status === 'pending' && (
                      <button
                        onClick={() => updateStatus(settlement.id, 'paid')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/25 border border-brand-500/30 text-brand-400 hover:bg-brand-600/40 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                    {settlement && status === 'paid' && (
                      <button
                        onClick={() => updateStatus(settlement.id, 'confirmed')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </div>

                {/* QR code panel */}
                <AnimatePresence>
                  {isShowingQr && upiLink && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
                        <div className="rounded-2xl p-3" style={{ background: '#ffffff' }}>
                          <QRCodeSVG value={upiLink} size={140} />
                        </div>
                        <p className="text-xs text-white/40">Scan to pay via UPI</p>
                        <a
                          href={upiLink}
                          className="text-xs text-brand-400 underline underline-offset-2"
                        >
                          Open in UPI app
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </FadeIn>
          )
        })}
      </div>

      {/* Completed payments — immutable history of confirmed transfers */}
      {confirmedPayments.length > 0 && (
        <FadeIn delay={0.15}>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 pt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Completed Payments
            </h2>
            {confirmedPayments.map(payment => {
              const fromM = memberMap[payment.fromMemberId]
              const toM   = memberMap[payment.toMemberId]
              if (!fromM || !toM) return null
              return (
                <GlassCard key={payment.id} className="p-4" hover={false}>
                  <div className="flex items-center gap-3">
                    <Avatar name={fromM.name} color={fromM.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="font-semibold">{fromM.name}</span>
                        <span className="text-white/40"> paid </span>
                        <span className="font-semibold">{toM.name}</span>
                      </p>
                      {payment.confirmedAt && (
                        <p className="text-xs text-white/40">{formatDate(payment.confirmedAt)}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-emerald-400 flex-shrink-0">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Avatar name={toM.name} color={toM.avatarColor} size="sm" />
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </FadeIn>
      )}
    </div>
  )
}
