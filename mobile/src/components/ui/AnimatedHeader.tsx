// Trip top bar (web AppNav mobile header): logo, trip name, "me · CODE", a
// live cloud-sync indicator and a red Logout pill. Tapping the cloud opens
// the sync sheet — status, pending changes/uploads, recent activity, and
// "Sync now" / "Retry uploads".
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Cloud, CloudAlert, CloudCheck, CloudOff, CloudUpload, ImageUp, LogOut, RefreshCw, WifiOff,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { useSyncStatus } from '../../lib/synclog'
import { syncTrip } from '../../lib/sync'
import { retryUpload } from '../../lib/uploads'
import { formatRelativeTime } from '../../lib/utils'
import { C, ink, red, violet } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { TOP_BAR_HEIGHT } from '../../theme/spacing'
import { PressScale } from '../animated/SpringPressable'
import { Sheet } from './BottomSheet'
import { Button, type IconType } from './Button'
import { Logo } from './Logo'
import { T } from './Text'

interface TripTopBarProps {
  tripId: string
  tripName: string
  subtitle: string
  onLogout: () => void
}

export function TripTopBar({ tripId, tripName, subtitle, onLogout }: TripTopBarProps) {
  const insets = useSafeAreaInsets()
  const [syncOpen, setSyncOpen] = useState(false)
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Logo size={32} glow={false} />
        <View style={styles.text}>
          <T variant="title" numberOfLines={1}>{tripName}</T>
          <T variant="tiny" color={ink(0.65)} numberOfLines={1} style={styles.subtitle}>{subtitle}</T>
        </View>
        <SyncButton tripId={tripId} onPress={() => setSyncOpen(true)} />
        <PressScale onPress={onLogout} style={styles.logout} accessibilityRole="button" accessibilityLabel="Log out">
          <LogOut size={15} color={C.red500} strokeWidth={2.3} />
          <T variant="smallMedium" color={C.red500}>Logout</T>
        </PressScale>
      </View>
      <Sheet visible={syncOpen} onClose={() => setSyncOpen(false)} title="Cloud sync">
        <SyncDetails tripId={tripId} />
      </Sheet>
    </View>
  )
}

type SyncLook = { Icon: IconType; color: string; label: string; spin?: boolean }

function useSyncLook(): SyncLook {
  const remoteConfigured = useSyncStatus(s => s.remoteConfigured)
  const online = useSyncStatus(s => s.online)
  const syncing = useSyncStatus(s => s.syncing)
  const lastSyncOk = useSyncStatus(s => s.lastSyncOk)
  if (!remoteConfigured) return { Icon: CloudOff, color: C.amber600, label: 'Local only' }
  if (!online) return { Icon: WifiOff, color: C.amber600, label: 'Offline' }
  if (syncing) return { Icon: RefreshCw, color: C.brand500, label: 'Syncing', spin: true }
  if (lastSyncOk === false) return { Icon: CloudAlert, color: C.red500, label: 'Sync problem' }
  if (lastSyncOk === true) return { Icon: CloudCheck, color: C.emerald400, label: 'Synced' }
  return { Icon: Cloud, color: ink(0.5), label: 'Connecting' }
}

const LIVE_PULSE = {
  animationName: {
    '0%': { opacity: 0.9, transform: [{ scale: 1 }] },
    '70%': { opacity: 0, transform: [{ scale: 2.6 }] },
    '100%': { opacity: 0, transform: [{ scale: 2.6 }] },
  },
  animationDuration: '1.8s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-out',
} as const

const SPIN = {
  animationName: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
  animationDuration: '1s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'linear',
} as const

function SyncButton({ tripId, onPress }: { tripId: string; onPress: () => void }) {
  const look = useSyncLook()
  const reduced = useReducedMotion()
  const pending = useStore(
    s => s.outbox.filter(o => o.tripId === tripId).length
      + s.attachments.filter(a => a.tripId === tripId && a.upload !== 'uploaded').length
  )
  const remote = useSyncStatus(s => s.remoteConfigured)
  // Connected and up to date: a "Live" chip with a pulsing dot.
  const live = look.label === 'Synced'
  return (
    <PressScale
      onPress={onPress}
      haptic="selection"
      style={[styles.sync, { backgroundColor: withAlpha(look.color, 0.1), borderColor: withAlpha(look.color, 0.22) }]}
      accessibilityRole="button"
      accessibilityLabel={`Cloud sync: ${live ? 'live' : look.label}`}
    >
      {live ? (
        <>
          <View style={styles.liveDotBox}>
            {!reduced && <Animated.View style={[styles.liveDot, styles.liveHalo, LIVE_PULSE]} />}
            <View style={styles.liveDot} />
          </View>
          <T variant="tinySemibold" color={C.emerald500}>Live</T>
        </>
      ) : (
        <Animated.View style={look.spin && !reduced ? SPIN : undefined}>
          <look.Icon size={17} color={look.color} strokeWidth={2.2} />
        </Animated.View>
      )}
      {remote && pending > 0 && (
        <View style={styles.syncBadge}>
          <T style={styles.syncBadgeText} maxFontSizeMultiplier={1}>{pending > 9 ? '9+' : pending}</T>
        </View>
      )}
    </PressScale>
  )
}

function SyncDetails({ tripId }: { tripId: string }) {
  const look = useSyncLook()
  const status = useSyncStatus()
  const outbox = useStore(s => s.outbox)
  const attachments = useStore(s => s.attachments)
  const pendingChanges = outbox.filter(o => o.tripId === tripId).length
  const tripMedia = attachments.filter(a => a.tripId === tripId)
  const waiting = tripMedia.filter(a => a.upload === 'pending' || a.upload === 'uploading').length
  const failed = tripMedia.filter(a => a.upload === 'failed')

  const headline = !status.remoteConfigured
    ? 'Cloud sync is off in this build'
    : !status.online
      ? "You're offline"
      : status.syncing
        ? 'Syncing…'
        : status.lastSyncOk === false
          ? 'Last sync had a problem'
          : status.lastSyncOk
            ? 'Everything is synced'
            : 'Connecting to the cloud…'
  const detail = !status.remoteConfigured
    ? 'TripMate is cloud-powered by Supabase to keep all friends in sync. Connect Supabase credentials in settings.'
    : !status.online
      ? 'Connect to the internet to sync live changes with your friends.'
      : status.lastSyncOk === false && status.lastError
        ? status.lastError
        : `Last synced ${formatRelativeTime(status.lastSyncAt)}`

  return (
    <View style={styles.details}>
      <View style={[styles.statusCard, { backgroundColor: withAlpha(look.color, 0.08), borderColor: withAlpha(look.color, 0.2) }]}>
        <look.Icon size={22} color={look.color} strokeWidth={2.2} />
        <View style={styles.flex}>
          <T variant="title">{headline}</T>
          <T variant="small" color={ink(0.65)}>{detail}</T>
        </View>
      </View>

      <InfoRow icon={CloudUpload} label="Changes waiting to upload" value={String(pendingChanges)} tone={pendingChanges ? C.amber600 : undefined} />
      <InfoRow
        icon={ImageUp}
        label="Bills & screenshots waiting"
        value={failed.length ? `${waiting} · ${failed.length} failed` : String(waiting)}
        tone={failed.length ? C.red500 : waiting ? C.amber600 : undefined}
      />
      <InfoRow
        icon={CloudCheck}
        label="Image storage on server"
        value={status.mediaReady === true ? 'Ready' : status.mediaReady === false ? 'Not set up' : 'Not checked yet'}
        tone={status.mediaReady === false ? C.red500 : status.mediaReady ? C.emerald400 : undefined}
      />
      {status.mediaReady === false && (
        <T variant="small" color={ink(0.62)} style={styles.hint}>
          Run supabase/migrations/20260923_mobile_media.sql in the Supabase SQL editor to enable bill photos and UPI
          screenshots. Photos upload automatically once it's done.
        </T>
      )}

      <View style={styles.actions}>
        <Button
          title="Sync now"
          icon={RefreshCw}
          loading={status.syncing}
          disabled={!status.remoteConfigured || !status.online}
          onPress={() => void syncTrip(tripId)}
          style={styles.flex}
        />
        {failed.length > 0 && (
          <Button title="Retry uploads" variant="ghost" icon={ImageUp} onPress={() => failed.forEach(a => retryUpload(a.id))} style={styles.flex} />
        )}
      </View>

      {status.events.length > 0 && (
        <View style={styles.events}>
          <T variant="label" color={ink(0.5)}>Recent activity</T>
          {status.events.slice(0, 6).map((e, i) => (
            <View key={`${e.at}-${i}`} style={styles.event}>
              <View style={[styles.eventDot, { backgroundColor: e.level === 'error' ? C.red500 : C.emerald400 }]} />
              <T variant="small" color={e.level === 'error' ? C.red600 : ink(0.7)} numberOfLines={2} style={styles.flex}>
                {e.tag}{e.detail ? ` — ${e.detail}` : ''}
              </T>
              <T variant="tiny" color={ink(0.45)}>{formatRelativeTime(e.at)}</T>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function InfoRow({ icon: Icon, label, value, tone }: { icon: IconType; label: string; value: string; tone?: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon size={16} color={ink(0.55)} strokeWidth={2.2} />
      <T variant="body" color={ink(0.75)} style={styles.flex}>{label}</T>
      <T variant="smallSemibold" color={tone ?? ink(0.8)}>{value}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1,
    borderBottomColor: ink(0.08),
    zIndex: 10,
  },
  row: { height: TOP_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  text: { flex: 1, minWidth: 0 },
  subtitle: { fontSize: 11 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: red(0.1),
    borderWidth: 1,
    borderColor: red(0.2),
  },
  sync: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotBox: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald400 },
  liveHalo: { position: 'absolute', backgroundColor: 'rgba(29,165,120,0.45)' },
  syncBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.amber500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.white,
  },
  syncBadgeText: { color: C.white, fontSize: 9, lineHeight: 11, fontFamily: 'Inter_700Bold' },
  details: { gap: 12, paddingTop: 4 },
  statusCard: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  flex: { flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: violet(0.05),
  },
  hint: { paddingHorizontal: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  events: { gap: 8, marginTop: 6 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDot: { width: 6, height: 6, borderRadius: 3 },
})
