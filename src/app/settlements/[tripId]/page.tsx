'use client'
import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { calculateBalances, calculateSettlements, formatCurrency, buildUpiLink } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import { Avatar } from '@/components/shared/Avatar'
import { FadeIn } from '@/components/animations/FadeIn'
import { ArrowRight, CheckCircle2, Clock, CreditCard, QrCode, ArrowLeftRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface SettlementsPageProps {
  params: Promise<{ tripId: string }>
}

export default function SettlementsPage({ params }: SettlementsPageProps) {
  const { tripId } = React.use(params)

  const allMembers      = useStore(s => s.members)
  const allExpenses     = useStore(s => s.expenses)
  const allGroups       = useStore(s => s.settlementGroups)
  const allSponsorships = useStore(s => s.sponsorships)
  const allSettlements  = useStore(s => s.settlements)
  const allMemberUnits  = useStore(s => s.memberUnits)
  const updateStatus    = useStore(s => s.updateSettlementStatus)
  const generateSettlements = useStore(s => s.generateSettlements)

  const members      = useMemo(() => allMembers.filter(m => m.tripId === tripId), [allMembers, tripId])
  const expenses     = useMemo(() => allExpenses.filter(e => e.tripId === tripId), [allExpenses, tripId])
  const groups       = useMemo(() => allGroups.filter(g => g.tripId === tripId), [allGroups, tripId])
  const sponsorships = useMemo(() => allSponsorships.filter(s => s.tripId === tripId), [allSponsorships, tripId])
  const settlements  = useMemo(() => allSettlements.filter(s => s.tripId === tripId), [allSettlements, tripId])
  const memberUnits  = useMemo(() => allMemberUnits.filter(u => u.tripId === tripId), [allMemberUnits, tripId])

  const [showQr, setShowQr] = React.useState<string | null>(null)

  // Ensure settlements are up-to-date
  React.useEffect(() => {
    generateSettlements(tripId)
  }, [tripId, generateSettlements, expenses, members, groups, sponsorships, memberUnits])

  const routes = useMemo(() => {
    const balances = calculateBalances(expenses, members, memberUnits)
    return calculateSettlements(balances, members, groups, sponsorships, memberUnits)
  }, [expenses, members, groups, sponsorships, memberUnits])

  const memberMap = useMemo(() => {
    const map: Record<string, typeof members[0]> = {}
    members.forEach(m => { map[m.id] = m })
    return map
  }, [members])

  const pendingCount   = settlements.filter(s => s.status === 'pending').length
  const confirmedCount = settlements.filter(s => s.status === 'confirmed').length

  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Settlements</h1>
              <p className="text-slate-500 text-sm">All balances are clear</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-1">No settlements needed</p>
            <p className="text-slate-400 text-sm">Add expenses to see who owes what</p>
          </div>
        </FadeIn>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Settlements</h1>
            <p className="text-slate-500 text-sm">
              {pendingCount} pending · {confirmedCount} confirmed
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Settlement Cards */}
      <div className="space-y-3">
        {routes.map((route, i) => {
          const settlement = settlements.find(
            s => s.fromMemberId === route.fromMemberId && s.toMemberId === route.toMemberId
          )
          const status = settlement?.status || 'pending'
          const fromMember = memberMap[route.fromMemberId]
          const toMember   = memberMap[route.toMemberId]
          const upiLink    = toMember?.upiId
            ? buildUpiLink(toMember.upiId, toMember.upiName || toMember.name, route.amount, `TripSplit - ${route.fromName}`)
            : null
          const isShowingQr = showQr === route.id

          return (
            <FadeIn key={route.id} delay={i * 0.07}>
              <GlassCard className="p-5 bg-white border-black/5 shadow-card">
                {/* From → To */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={route.fromName} color={route.fromColor} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{route.fromName}</p>
                    <p className="text-xs text-slate-400">pays</p>
                  </div>
                  <div className="flex flex-col items-center px-2">
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(route.amount)}</p>
                    <ArrowRight className="w-4 h-4 text-brand-500 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-slate-800 truncate">{route.toName}</p>
                    {toMember?.upiId && (
                      <p className="text-[10px] text-brand-500 font-mono truncate">{toMember.upiId}</p>
                    )}
                  </div>
                  <Avatar name={route.toName} color={route.toColor} size="md" />
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between pt-1">
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    status === 'confirmed'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : status === 'paid'
                      ? 'bg-brand-50 text-brand-600 border border-brand-200'
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    {status === 'confirmed'
                      ? <><CheckCircle2 className="w-3 h-3" /> Confirmed</>
                      : status === 'paid'
                      ? <><CreditCard className="w-3 h-3" /> Paid</>
                      : <><Clock className="w-3 h-3" /> Pending</>
                    }
                  </div>

                  <div className="flex items-center gap-2">
                    {/* QR code toggle (only if recipient has UPI) */}
                    {upiLink && (
                      <button
                        onClick={() => setShowQr(isShowingQr ? null : route.id)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors bg-brand-50 px-2 py-1.5 rounded-lg border border-brand-100"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        UPI
                      </button>
                    )}

                    {/* Action buttons */}
                    {settlement && status === 'pending' && (
                      <button
                        onClick={() => updateStatus(settlement.id, 'paid')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                    {settlement && status === 'paid' && (
                      <button
                        onClick={() => updateStatus(settlement.id, 'confirmed')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
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
                      <div className="mt-4 pt-4 border-t border-black/5 flex flex-col items-center gap-2">
                        <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5">
                          <QRCodeSVG value={upiLink} size={140} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Scan to pay via UPI</p>
                        <a
                          href={upiLink}
                          className="text-xs text-brand-600 font-medium hover:underline underline-offset-2"
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
    </div>
  )
}
