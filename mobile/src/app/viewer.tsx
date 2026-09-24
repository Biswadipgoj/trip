// Full-screen viewer for a bill photo or UPI screenshot: pinch or double-tap
// to zoom, drag to pan, swipe down to close. Shows who added it and its
// upload state (retry if it failed), and can delete it.
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { CircleCheck, CloudUpload, ImageOff, RotateCw, Smartphone, Trash2, X } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { attachmentUri, retryUpload } from '../lib/uploads'
import { cloudRemoveAttachment, withCloud } from '../lib/cloud'
import { isRemoteEnabled } from '../lib/remote'
import { confirmAction } from '../lib/dialogs'
import { formatDate, formatRelativeTime } from '../lib/utils'
import { T } from '../components/ui/Text'
import { PressScale, tick } from '../components/animated/SpringPressable'
import { C, whiteA } from '../theme/colors'

const MAX_ZOOM = 5
const SPRING = { damping: 20, stiffness: 220 }

export default function Viewer() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const attachment = useStore(s => s.attachments.find(a => a.id === id))
  const uploader = useStore(s => (attachment?.uploadedBy ? s.members.find(m => m.id === attachment.uploadedBy) : undefined))

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)
  const dismissY = useSharedValue(0)

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale))
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1, SPRING)
        tx.value = withSpring(0, SPRING)
        ty.value = withSpring(0, SPRING)
        savedScale.value = 1
        savedTx.value = 0
        savedTy.value = 0
      } else {
        savedScale.value = scale.value
      }
    })

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate(e => {
      if (savedScale.value > 1) {
        tx.value = savedTx.value + e.translationX
        ty.value = savedTy.value + e.translationY
      } else {
        dismissY.value = e.translationY
      }
    })
    .onEnd(e => {
      if (savedScale.value > 1) {
        savedTx.value = tx.value
        savedTy.value = ty.value
      } else if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 1000) {
        dismissY.value = withTiming(Math.sign(e.translationY || 1) * height, { duration: 180 }, () => scheduleOnRN(close))
      } else {
        dismissY.value = withSpring(0, SPRING)
      }
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = savedScale.value <= 1
      const next = zoomIn ? 2.5 : 1
      scale.value = withSpring(next, SPRING)
      savedScale.value = next
      if (!zoomIn) {
        tx.value = withSpring(0, SPRING)
        ty.value = withSpring(0, SPRING)
        savedTx.value = 0
        savedTy.value = 0
      }
    })

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value + dismissY.value }, { scale: scale.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dismissY.value), [0, height * 0.5], [1, 0.25], Extrapolation.CLAMP),
  }))

  if (!attachment) {
    return (
      <View style={[styles.fill, styles.backdrop, styles.center]}>
        <StatusBar style="light" />
        <ImageOff size={36} color={whiteA(0.6)} />
        <T variant="bodyMedium" color={whiteA(0.8)} style={styles.missingText}>This image was removed</T>
        <PressScale onPress={close} style={styles.pill}>
          <T variant="smallSemibold" color={C.white}>Close</T>
        </PressScale>
      </View>
    )
  }

  const uri = attachmentUri(attachment)
  const cloud = isRemoteEnabled()
  const title = attachment.kind === 'bill' ? 'Bill photo' : 'UPI payment screenshot'

  const remove = async () => {
    const ok = await confirmAction({
      title: `Delete this ${attachment.kind === 'bill' ? 'bill photo' : 'screenshot'}?`,
      message: 'It will be removed for everyone in the trip.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const okDone = await withCloud(async () => {
      await cloudRemoveAttachment(attachment.id)
      return true
    })
    if (!okDone) return
    tick('warning')
    close()
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.fill, styles.center]}>
          {uri ? (
            <Animated.View style={[{ width, height }, imageStyle]}>
              <Image source={{ uri }} style={styles.fill} contentFit="contain" transition={200} cachePolicy="memory-disk" />
            </Animated.View>
          ) : (
            <View style={styles.center}>
              <ImageOff size={36} color={whiteA(0.6)} />
              <T variant="body" color={whiteA(0.75)} style={styles.missingText}>Image not available yet</T>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <PressScale onPress={close} style={styles.round} accessibilityRole="button" accessibilityLabel="Close">
          <X size={20} color={C.white} />
        </PressScale>
        <T variant="title" color={C.white} numberOfLines={1} style={styles.title}>{title}</T>
        <PressScale onPress={() => void remove()} style={styles.round} accessibilityRole="button" accessibilityLabel="Delete">
          <Trash2 size={18} color={C.white} />
        </PressScale>
      </View>

      {/* Info */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={styles.infoCard}>
          <UploadState upload={attachment.upload} cloud={cloud} />
          <T variant="small" color={whiteA(0.75)}>
            {uploader ? `Added by ${uploader.name} · ` : ''}{formatDate(attachment.createdAt)} ({formatRelativeTime(attachment.createdAt)})
          </T>
          {attachment.upload === 'failed' && cloud && (
            <PressScale onPress={() => { tick('light'); retryUpload(attachment.id) }} style={styles.pill} accessibilityRole="button">
              <RotateCw size={14} color={C.white} />
              <T variant="smallSemibold" color={C.white}>Sync now</T>
            </PressScale>
          )}
        </View>
      </View>
    </View>
  )
}

function UploadState({ upload, cloud }: { upload: string; cloud: boolean }) {
  if (!cloud) return null
  if (upload === 'uploaded') {
    return (
      <View style={styles.state}>
        <CircleCheck size={14} color="#6EE7B7" />
        <T variant="smallSemibold" color="#6EE7B7">Synced to cloud</T>
      </View>
    )
  }
  if (upload === 'uploading') {
    return (
      <View style={styles.state}>
        <CloudUpload size={14} color="#FCD34D" />
        <T variant="smallSemibold" color="#FCD34D">Syncing…</T>
      </View>
    )
  }
  if (upload === 'failed') {
    return (
      <View style={styles.state}>
        <RotateCw size={14} color="#FCD34D" />
        <T variant="smallSemibold" color="#FCD34D" numberOfLines={1}>
          Saved on device · will sync when online
        </T>
      </View>
    )
  }
  return null
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: 'rgba(8, 5, 16, 0.96)' },
  missingText: { marginTop: 12, marginBottom: 16 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  title: { flex: 1, textAlign: 'center' },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  infoCard: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', padding: 14, gap: 6 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
})
