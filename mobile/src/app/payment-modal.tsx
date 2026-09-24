// Settle one payment: amount and who pays whom, the recipient's UPI ID, a
// one-tap "Pay via UPI app" + QR code, the UPI screenshot upload (proof), and
// the status steps Due → Paid → Confirmed. Coming back from the UPI app
// prompts for the screenshot; adding one marks the payment as paid.
import { useEffect, useRef, useState } from 'react'
import { AppState, Linking, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import {
  ArrowRight, Camera, CircleCheck, Copy, CreditCard, ExternalLink, QrCode, ShieldCheck, TriangleAlert, X,
} from 'lucide-react-native'
import { useStore } from '../lib/store'
import { proofsFor, useTripData } from '../lib/hooks'
import { attachImage } from '../lib/uploads'
import { cloudSetPaymentStatus, withCloud } from '../lib/cloud'
import { confirmAction } from '../lib/dialogs'
import { toast } from '../lib/toast'
import { buildUpiLink, formatCurrency, formatDate } from '../lib/utils'
import type { PreparedImage } from '../lib/media'
import { Screen } from '../components/ui/Screen'
import { GlassCard } from '../components/ui/GlassCard'
import { T } from '../components/ui/Text'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { QRCode } from '../components/ui/QRCode'
import { AttachmentPicker } from '../components/attachments/AttachmentPicker'
import { AttachmentStrip } from '../components/attachments/AttachmentStrip'
import { StatusBadge } from '../components/animated/PulseBadge'
import { CountUp } from '../components/animated/SlotCounter'
import { Collapsible, FadeIn } from '../components/animated/FadeInView'
import { Confetti } from '../components/animated/ConfettiBlast'
import { EmptyState } from '../components/animated/AnimatedEmptyState'
import { PressScale, tick } from '../components/animated/SpringPressable'
import { C, amber, brand500, emerald, ink } from '../theme/colors'
import { F } from '../theme/typography'

export default function PaymentModal() {
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const params = useLocalSearchParams<{ id?: string; from?: string; to?: string }>()
  const session = useStore(s => s.session)
  const { settlements, memberMap, attachments } = useTripData(session?.tripId)

  // Ids are stable across recalculations; direction is the fallback.
  const settlement =
    settlements.find(s => s.id === params.id) ??
    settlements.find(s => s.fromMemberId === params.from && s.toMemberId === params.to && s.status !== 'confirmed')

  const [showQr, setShowQr] = useState(false)
  const [awaitingProof, setAwaitingProof] = useState(false)
  const [confetti, setConfetti] = useState(0)
  // Which action is in flight: blocks double taps and shows a spinner.
  const [busy, setBusy] = useState<null | 'upi' | 'paid' | 'confirm' | 'proof'>(null)
  const leftForUpi = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const proofY = useRef(0)

  // Back from the UPI app → ask for the screenshot and bring that step into view.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && leftForUpi.current) {
        leftForUpi.current = false
        setBusy(null)
        setAwaitingProof(true)
        setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, proofY.current - 12), animated: true }), 250)
      }
    })
    return () => sub.remove()
  }, [])

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(kind)
    try {
      await fn()
    } catch (err) {
      console.warn('[payment]', err)
      toast.error('Something went wrong — please try again.')
    } finally {
      setBusy(b => (b === kind ? null : b))
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/settlements'))

  if (!settlement || !session) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <CloseButton onPress={close} />
        </View>
        <EmptyState
          icon={CircleCheck}
          color={C.emerald400}
          title="This payment is no longer due"
          subtitle="It was settled or recalculated after an expense changed."
          action={<Button title="Back to Payments" onPress={close} />}
        />
      </Screen>
    )
  }

  const from = memberMap[settlement.fromMemberId]
  const to = memberMap[settlement.toMemberId]
  const fromName = settlement.fromGroupIds?.length
    ? settlement.fromGroupIds.map(id => memberMap[id]?.name).filter(Boolean).join(' & ')
    : from?.name ?? 'Someone'
  const toName = settlement.toGroupIds?.length
    ? settlement.toGroupIds.map(id => memberMap[id]?.name).filter(Boolean).join(' & ')
    : to?.name ?? 'Someone'
  const iPay = session.memberId === settlement.fromMemberId
  const iReceive = session.memberId === settlement.toMemberId
  const proofs = proofsFor(attachments, settlement)
  const upiLink = to?.upiId ? buildUpiLink(to.upiId, to.upiName || to.name, settlement.amount, `TripMate - ${fromName}`) : null
  const status = settlement.status

  const payViaUpi = () => run('upi', async () => {
    if (!upiLink) return
    try {
      leftForUpi.current = true
      tick('medium')
      await Linking.openURL(upiLink)
      // Some phones return instantly without leaving the app; don't spin forever.
      setTimeout(() => setBusy(b => (b === 'upi' ? null : b)), 4000)
    } catch {
      leftForUpi.current = false
      toast.error('No UPI app found on this phone — scan the QR code from another phone, or pay by cash.')
      setShowQr(true)
    }
  })

  const copyUpi = async () => {
    if (!to?.upiId) return
    try {
      await Clipboard.setStringAsync(to.upiId)
      tick('success')
      toast.success('UPI ID copied')
    } catch {
      toast.error('Could not copy — long-press the UPI ID to select it.')
    }
  }

  const addProof = (image: PreparedImage) => run('proof', async () => {
    attachImage(
      image,
      {
        kind: 'payment_proof',
        tripId: settlement.tripId,
        settlementId: settlement.id,
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        amount: settlement.amount,
      },
      session.memberId
    )
    setAwaitingProof(false)
    if (status === 'pending') {
      const ok = await withCloud(async () => {
        await cloudSetPaymentStatus(settlement.id, 'paid')
        return true
      })
      if (!ok) {
        toast.success('Screenshot added — tap "Mark as paid" once you are back online')
        return
      }
      tick('success')
      toast.success(`Screenshot added and marked as paid — ${toName.split(' ')[0]} can now confirm it`)
    } else {
      toast.success('Screenshot added')
    }
  })

  const markPaid = () => run('paid', async () => {
    if (proofs.length === 0) {
      const ok = await confirmAction({
        title: 'Mark as paid without a screenshot?',
        message: 'A UPI screenshot helps the receiver confirm quickly. You can still add one later.',
        confirmLabel: 'Mark as paid',
      })
      if (!ok) return
    }
    const okDone = await withCloud(async () => {
      await cloudSetPaymentStatus(settlement.id, 'paid')
      return true
    })
    if (!okDone) return
    tick('success')
    toast.success('Marked as paid — waiting for confirmation')
  })

  const confirmReceived = () => run('confirm', async () => {
    const ok = await confirmAction({
      title: 'Confirm payment received?',
      message: `${toName} received ${formatCurrency(settlement.amount)} from ${fromName}. Confirmed payments are final and update everyone's balances.`,
      confirmLabel: 'Confirm',
    })
    if (!ok) return
    const okDone = await withCloud(async () => {
      await cloudSetPaymentStatus(settlement.id, 'confirmed')
      return true
    })
    if (!okDone) return
    tick('success')
    setConfetti(n => n + 1)
    toast.success('Payment confirmed 🎉')
  })

  return (
    <Screen edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.row}>
          <View style={styles.titleIcon}>
            <CreditCard size={18} color={C.brand500} />
          </View>
          <T variant="h2">Settle payment</T>
        </View>
        <CloseButton onPress={close} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        {/* Amount + who pays whom */}
        <FadeIn>
          <GlassCard strong radius={24} contentStyle={styles.hero}>
            <StatusBadge status={status} />
            <CountUp value={settlement.amount} prefix="₹" decimals={settlement.amount % 1 ? 2 : 0} variant="display" style={styles.amount} />
            <View style={styles.people}>
              <View style={styles.person}>
                <Avatar name={fromName} color={from?.avatarColor} size="lg" animate />
                <T variant="smallSemibold" center numberOfLines={2}>{fromName}{iPay ? '\n(you)' : ''}</T>
              </View>
              <ArrowRight size={22} color={C.brand500} />
              <View style={styles.person}>
                <Avatar name={toName} color={to?.avatarColor} size="lg" animate />
                <T variant="smallSemibold" center numberOfLines={2}>{toName}{iReceive ? '\n(you)' : ''}</T>
              </View>
            </View>
            {settlement.paidAt && status !== 'pending' ? (
              <T variant="small" color={ink(0.55)}>
                Paid {formatDate(settlement.paidAt)}{settlement.confirmedAt ? ` · confirmed ${formatDate(settlement.confirmedAt)}` : ''}
              </T>
            ) : null}
          </GlassCard>
        </FadeIn>

        {/* Step 1 — pay */}
        {status === 'pending' && (
          <FadeIn delay={80}>
            <GlassCard contentStyle={styles.gap12}>
              <StepTitle n={1} title="Pay with any UPI app" />
              {to?.upiId ? (
                <>
                  <PressScale onPress={() => void copyUpi()} style={styles.upiRow} haptic={false} accessibilityLabel="Copy UPI ID">
                    <View style={styles.flex}>
                      <T variant="tiny" color={ink(0.55)}>Pay to</T>
                      <T variant="bodyMedium" style={styles.mono} numberOfLines={1}>{to.upiId}</T>
                      {to.upiName ? <T variant="small" color={ink(0.6)}>{to.upiName}</T> : null}
                    </View>
                    <Copy size={16} color={C.brand500} />
                  </PressScale>
                  <Button title={`Pay ${formatCurrency(settlement.amount)} via UPI app`} icon={ExternalLink} size="lg" onPress={() => void payViaUpi()} loading={busy === 'upi'} disabled={!!busy && busy !== 'upi'} full />
                  <PressScale onPress={() => setShowQr(v => !v)} style={styles.qrToggle} haptic="selection">
                    <QrCode size={15} color={C.brand500} />
                    <T variant="smallMedium" color={C.brand500}>{showQr ? 'Hide QR code' : 'Show QR code to scan'}</T>
                  </PressScale>
                  <Collapsible open={showQr && !!upiLink}>
                    {upiLink ? (
                      <View style={styles.qr}>
                        <View style={styles.qrBox}>
                          <QRCode value={upiLink} size={184} />
                        </View>
                        <T variant="small" color={ink(0.6)} center>Scan with GPay, PhonePe, Paytm or any UPI app</T>
                      </View>
                    ) : null}
                  </Collapsible>
                </>
              ) : (
                <View style={styles.warning}>
                  <TriangleAlert size={16} color={C.amber600} />
                  <T variant="small" color={C.amber700} style={styles.flex}>
                    {toName.split(' ')[0]} hasn’t added a UPI ID yet. Pay by cash, or ask them to add it in Members.
                  </T>
                </View>
              )}
            </GlassCard>
          </FadeIn>
        )}

        {/* Step 2 — proof */}
        <View onLayout={e => { proofY.current = e.nativeEvent.layout.y }}>
        <FadeIn delay={140}>
          <GlassCard contentStyle={styles.gap12} glow={awaitingProof}>
            <StepTitle n={status === 'pending' ? 2 : 1} title="Payment screenshot" />
            {awaitingProof && status === 'pending' && (
              <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)} style={styles.prompt}>
                <Camera size={16} color={C.brand500} />
                <T variant="smallMedium" color={C.brand600} style={styles.flex}>
                  Paid? Add the UPI screenshot so {toName.split(' ')[0]} can confirm it.
                </T>
              </Animated.View>
            )}
            {proofs.length > 0 ? (
              <AttachmentStrip attachments={proofs} size={84} />
            ) : (
              <T variant="small" color={ink(0.6)}>
                {status === 'pending'
                  ? 'After paying, add the screenshot from your UPI app — it marks this payment as paid.'
                  : 'No screenshot was added for this payment.'}
              </T>
            )}
            {status !== 'confirmed' && (
              <AttachmentPicker
                context={{ kind: 'payment_proof', tripId: settlement.tripId, settlementId: settlement.id }}
                cameraLabel="Camera"
                galleryLabel="Screenshot"
                onPicked={image => void addProof(image)}
              />
            )}
          </GlassCard>
        </FadeIn>
        </View>

        {/* Step 3 — status */}
        <FadeIn delay={200}>
          {status === 'pending' && (
            <Button title="Mark as paid" icon={CircleCheck} variant={proofs.length ? 'brand' : 'ghost'} size="lg" onPress={() => void markPaid()} loading={busy === 'paid' || busy === 'proof'} disabled={!!busy} full />
          )}
          {status === 'paid' && (
            <GlassCard contentStyle={styles.gap12}>
              <View style={styles.row}>
                <ShieldCheck size={18} color={C.blue500} />
                <T variant="title" style={styles.flex}>
                  {iReceive ? 'Did you receive this payment?' : `Waiting for ${toName.split(' ')[0]} to confirm`}
                </T>
              </View>
              <T variant="small" color={ink(0.6)}>
                {iReceive
                  ? 'Check your UPI app or bank, then confirm. This settles it for everyone.'
                  : 'Anyone in the trip can confirm once the money has arrived.'}
              </T>
              <Button title="Confirm received" icon={CircleCheck} variant="success" size="lg" onPress={() => void confirmReceived()} loading={busy === 'confirm'} disabled={!!busy} full />
            </GlassCard>
          )}
          {status === 'confirmed' && (
            <View style={styles.done}>
              <CircleCheck size={22} color={C.emerald400} />
              <T variant="title" color={C.emerald500}>Payment confirmed — all square!</T>
            </View>
          )}
        </FadeIn>
      </ScrollView>
      <Confetti shot={confetti} />
    </Screen>
  )
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.stepDot}>
        <T style={styles.stepText} maxFontSizeMultiplier={1}>{n}</T>
      </View>
      <T variant="title">{title}</T>
    </View>
  )
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
      <X size={18} color={ink(0.65)} />
    </PressScale>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gap12: { gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  titleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: brand500(0.12), alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: ink(0.07), alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  hero: { alignItems: 'center', gap: 12 },
  amount: { fontSize: 40, lineHeight: 48 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  person: { alignItems: 'center', gap: 8, width: 110 },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand500(0.2),
    backgroundColor: brand500(0.05),
    padding: 12,
  },
  mono: { fontFamily: F.mono },
  qrToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 4 },
  qr: { alignItems: 'center', gap: 10 },
  qrBox: { padding: 12, borderRadius: 18, backgroundColor: C.white, boxShadow: '0px 6px 20px rgba(108,62,200,0.12)' },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: amber(0.3),
    backgroundColor: amber(0.12),
    padding: 10,
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: brand500(0.08),
    borderWidth: 1,
    borderColor: brand500(0.22),
    padding: 10,
  },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand500, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.white, fontSize: 12, lineHeight: 15, fontFamily: F.bold },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: emerald(0.3),
    backgroundColor: emerald(0.1),
    padding: 16,
  },
})
