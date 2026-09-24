// Payments (web /payments/[tripId]) — settlement transactions only: net
// balances, the minimum set of "who pays whom", UPI QR per payment, and the
// history of confirmed payments. Mobile: "Pay" opens a focused settle screen
// (UPI app + QR + screenshot upload); UPI screenshots show on each payment.
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { router } from 'expo-router'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CircleCheck, CreditCard, Paperclip, QrCode, Sparkles, Trash2,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { proofsFor, useTripData, type Due } from '../../lib/hooks'
import { syncTrip } from '../../lib/sync'
import { cloudDeleteSettlement, cloudSetPaymentStatus, withCloud } from '../../lib/cloud'
import { confirmAction } from '../../lib/dialogs'
import { toast } from '../../lib/toast'
import { buildUpiLink, formatCurrency, formatDate } from '../../lib/utils'
import type { Attachment, Member, Settlement } from '../../types'
import { GlassCard } from '../../components/ui/GlassCard'
import { T } from '../../components/ui/Text'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { QRCode } from '../../components/ui/QRCode'
import { PageHeader, PageScroll } from '../../components/ui/PageHeader'
import { AttachmentStrip } from '../../components/attachments/AttachmentStrip'
import { StatusBadge } from '../../components/animated/PulseBadge'
import { Collapsible, FadeIn, SMOOTH_LAYOUT, stagger } from '../../components/animated/FadeInView'
import { EmptyState } from '../../components/animated/AnimatedEmptyState'
import { Confetti } from '../../components/animated/ConfettiBlast'
import { PressScale, tick } from '../../components/animated/SpringPressable'
import { C, ink } from '../../theme/colors'
import { F } from '../../theme/typography'

function MoneyFlowArrow() {
  return <ArrowRight size={16} color={C.brand500} />
}

export default function PaymentsScreen() {
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const { balances, routes, dues, confirmed, settlements, memberMap, attachments } = useTripData(tripId)
  const generateSettlements = useStore(s => s.generateSettlements)
  const [qrFor, setQrFor] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(0)

  // Keep stored dues in step with the expense engine.
  useEffect(() => {
    if (tripId) generateSettlements(tripId)
  }, [tripId, generateSettlements])

  const confirmedCount = confirmed.length
  const nonZero = balances.filter(b => Math.abs(b.netBalance) > 0.01)

  const confirmDue = async (due: Due) => {
    if (!due.settlement) return
    const ok = await confirmAction({
      title: 'Confirm payment received?',
      message: `${due.route.toName} received ${formatCurrency(due.route.amount)} from ${due.route.fromName}. Confirmed payments are final.`,
      confirmLabel: 'Confirm',
    })
    if (!ok) return
    const success = await withCloud(async () => {
      await cloudSetPaymentStatus(due.settlement!.id, 'confirmed')
      return true
    })
    if (!success) return
    tick('success')
    setConfetti(n => n + 1)
    toast.success('Payment confirmed — balances updated 🎉')
  }

  const undoDue = async (due: Due) => {
    if (!due.settlement) return
    const success = await withCloud(async () => {
      await cloudSetPaymentStatus(due.settlement!.id, 'pending')
      return true
    })
    if (success) {
      tick('light')
      toast.info('Payment status reverted to Due')
    }
  }

  const removePayment = async (p: Settlement, fromName: string, toName: string) => {
    const ok = await confirmAction({
      title: 'Remove payment record?',
      message: `Remove this payment record of ${formatCurrency(p.amount)} from ${fromName} to ${toName}? Balances and dues will be recalculated.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const success = await withCloud(async () => {
      await cloudDeleteSettlement(p.id)
      return true
    })
    if (success) {
      tick('light')
      toast.success('Payment removed — dues recalculated')
    }
  }

  const openPay = (due: Due) => {
    if (!due.settlement) return
    router.push({
      pathname: '/payment-modal',
      params: { id: due.settlement.id, from: due.route.fromMemberId, to: due.route.toMemberId },
    })
  }

  return (
    <View style={styles.fill}>
      <PageScroll onRefresh={async () => { await syncTrip(tripId); if (tripId) generateSettlements(tripId) }}>
        <PageHeader
          icon={CreditCard}
          title="Payments"
          subtitle={
            routes.length === 0
              ? confirmedCount > 0
                ? `All settled · ${confirmedCount} payment${confirmedCount !== 1 ? 's' : ''} confirmed`
                : 'All balances are clear'
              : `${routes.length} payment${routes.length !== 1 ? 's' : ''} to settle${confirmedCount > 0 ? ` · ${confirmedCount} confirmed` : ''}`
          }
        />

        {/* Net balances — the settlement engine's input */}
        {nonZero.length > 0 && (
          <FadeIn delay={50}>
            <GlassCard>
              <T variant="title" style={styles.cardTitle}>Net Balances</T>
              <View style={styles.gap8}>
                {nonZero.map(b => (
                  <View key={b.memberId} style={styles.row}>
                    <Avatar name={b.name} color={b.avatarColor} size="xs" glow={false} />
                    <T variant="small" color={ink(0.72)} numberOfLines={1} style={styles.flex}>{b.name}</T>
                    <View style={styles.inline}>
                      {b.netBalance > 0 ? <ArrowUpRight size={12} color={C.emerald400} /> : <ArrowDownRight size={12} color={C.red500} />}
                      <T variant="smallSemibold" color={b.netBalance > 0 ? C.emerald400 : C.red500}>
                        {b.netBalance > 0 ? '+' : '−'}{formatCurrency(Math.abs(b.netBalance))}
                      </T>
                    </View>
                  </View>
                ))}
              </View>
              <View style={[styles.inline, styles.note]}>
                <Sparkles size={12} color={ink(0.5)} />
                <T variant="tiny" color={ink(0.5)}>Optimized to the minimum number of transactions</T>
              </View>
            </GlassCard>
          </FadeIn>
        )}

        {routes.length === 0 && (
          <EmptyState
            icon={CircleCheck}
            color={C.emerald400}
            title={confirmedCount > 0 ? 'Everything is settled 🎉' : 'No payments needed'}
            subtitle={confirmedCount > 0 ? 'All confirmed payments are recorded below' : 'Add expenses to see who pays whom'}
          />
        )}

        {/* Dues */}
        {dues.map((due, i) => {
          const to = memberMap[due.route.toMemberId]
          const proofs = due.settlement ? proofsFor(attachments, due.settlement) : []
          const upiLink = to?.upiId
            ? buildUpiLink(to.upiId, to.upiName || to.name, due.route.amount, `TripMate - ${due.route.fromName}`)
            : null
          return (
            <FadeIn key={due.key} delay={stagger(i, 100, 70)}>
              <DueCard
                due={due}
                to={to}
                me={session?.memberId}
                proofs={proofs}
                upiLink={upiLink}
                showQr={qrFor === due.key}
                onToggleQr={() => setQrFor(qrFor === due.key ? null : due.key)}
                onPay={() => openPay(due)}
                onConfirm={() => void confirmDue(due)}
                onUndo={() => void undoDue(due)}
              />
            </FadeIn>
          )
        })}

        {/* History */}
        {confirmed.length > 0 && (
          <FadeIn delay={150} style={styles.gap12}>
            <View style={styles.row}>
              <CircleCheck size={16} color={C.emerald400} />
              <T variant="title">Completed Payments</T>
            </View>
            {confirmed.map(p => {
              const from = memberMap[p.fromMemberId]
              const to = memberMap[p.toMemberId]
              if (!from || !to) return null
              const proofs = proofsFor(attachments, p)
              return (
                <GlassCard
                  key={p.id}
                  padding={14}
                  onPress={proofs[0] ? () => router.push({ pathname: '/viewer', params: { id: proofs[0].id } }) : undefined}
                  accessibilityLabel={proofs[0] ? 'Open payment screenshot' : undefined}
                >
                  <View style={styles.row}>
                    <Avatar name={from.name} color={from.avatarColor} size="sm" glow={false} />
                    <View style={styles.flex}>
                      <T variant="body" numberOfLines={1}>
                        <T variant="title">{from.name}</T>
                        <T variant="body" color={ink(0.6)}> paid </T>
                        <T variant="title">{to.name}</T>
                      </T>
                      <View style={styles.inline}>
                        {p.confirmedAt ? <T variant="small" color={ink(0.6)}>{formatDate(p.confirmedAt)}</T> : null}
                        {proofs.length > 0 && (
                          <>
                            <Paperclip size={11} color={C.brand500} />
                            <T variant="tinySemibold" color={C.brand500}>screenshot</T>
                          </>
                        )}
                      </View>
                    </View>
                    <T variant="title" color={C.emerald400}>{formatCurrency(p.amount)}</T>
                    <PressScale
                      onPress={() => void removePayment(p, from.name, to.name)}
                      haptic="medium"
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Remove payment record"
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={16} color={C.red500} />
                    </PressScale>
                    <Avatar name={to.name} color={to.avatarColor} size="sm" glow={false} />
                  </View>
                </GlassCard>
              )
            })}
          </FadeIn>
        )}
      </PageScroll>
      <Confetti shot={confetti} />
    </View>
  )
}

function DueCard({ due, to, me, proofs, upiLink, showQr, onToggleQr, onPay, onConfirm, onUndo }: {
  due: Due
  to?: Member
  me?: string
  proofs: Attachment[]
  upiLink: string | null
  showQr: boolean
  onToggleQr: () => void
  onPay: () => void
  onConfirm: () => void
  onUndo?: () => void
}) {
  const { route, status, settlement } = due
  const iPay = me === route.fromMemberId
  return (
    <Animated.View layout={SMOOTH_LAYOUT}>
      <GlassCard>
        {/* Two rows so names fit a phone: who pays whom, then how much. */}
        <View
          style={styles.flow}
          accessible
          accessibilityLabel={`${route.fromName}${iPay ? ' (you)' : ''} pays ${route.toName} ${formatCurrency(route.amount)}`}
        >
          <View style={styles.party}>
            <Avatar name={route.fromName} color={route.fromColor} size="sm" />
            <T variant="title" numberOfLines={1} style={styles.shrink}>{route.fromName}{iPay ? ' (you)' : ''}</T>
          </View>
          <MoneyFlowArrow />
          <View style={[styles.party, styles.partyRight]}>
            <T variant="title" numberOfLines={1} style={[styles.shrink, styles.rightAlign]}>{route.toName}</T>
            <Avatar name={route.toName} color={route.toColor} size="sm" />
          </View>
        </View>
        <View style={styles.amountRow}>
          <T variant="money">{formatCurrency(route.amount)}</T>
          {to?.upiId ? (
            <T variant="tiny" color={C.brand500} numberOfLines={1} style={[styles.upi, styles.shrink]}>{to.upiId}</T>
          ) : null}
        </View>

        {proofs.length > 0 && (
          <View style={styles.proofs}>
            <View style={styles.inline}>
              <Paperclip size={12} color={ink(0.6)} />
              <T variant="smallMedium" color={ink(0.6)}>UPI screenshot</T>
            </View>
            <AttachmentStrip attachments={proofs} size={52} />
          </View>
        )}

        <View style={styles.actions}>
          <StatusBadge status={status} />
          <View style={styles.actionRow}>
            {upiLink && (
              <PressScale onPress={onToggleQr} style={styles.inline} haptic="selection" accessibilityRole="button" accessibilityLabel="Show UPI QR code">
                <QrCode size={15} color={ink(0.6)} />
                <T variant="smallMedium" color={ink(0.6)}>UPI</T>
              </PressScale>
            )}
            {settlement && status === 'pending' && (
              <Button title={iPay ? 'Pay' : 'Settle'} size="sm" onPress={onPay} />
            )}
            {settlement && status === 'paid' && (
              <View style={styles.inline}>
                {onUndo && (
                  <Button title="Undo" variant="ghost" size="sm" onPress={onUndo} />
                )}
                <Button title="Confirm" variant="success" size="sm" icon={CircleCheck} onPress={onConfirm} />
              </View>
            )}
          </View>
        </View>

        <Collapsible open={showQr && !!upiLink}>
          {upiLink ? (
            <View style={styles.qr}>
              <View style={styles.qrBox}>
                <QRCode value={upiLink} size={150} />
              </View>
              <T variant="small" color={ink(0.6)}>Scan to pay via UPI</T>
              <T variant="smallMedium" color={C.brand500} onPress={onPay} suppressHighlighting>Open payment screen</T>
            </View>
          ) : null}
        </Collapsible>
      </GlassCard>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gap8: { gap: 9 },
  gap12: { gap: 12 },
  cardTitle: { marginBottom: 12 },
  note: { marginTop: 12 },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  party: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  partyRight: { justifyContent: 'flex-end' },
  shrink: { flexShrink: 1 },
  rightAlign: { textAlign: 'right' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 10, marginBottom: 14 },
  upi: { fontFamily: F.mono },
  proofs: { gap: 8, marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { padding: 6, borderRadius: 8 },
  qr: { alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: ink(0.08) },
  qrBox: { padding: 10, borderRadius: 16, backgroundColor: C.white },
})
