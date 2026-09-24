// Thumbnails for bill photos / UPI screenshots with their upload state:
// waiting (amber clock), uploading (spinner), failed (red, retry in the
// viewer), uploaded (green check). Tap a thumbnail to open the viewer.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { CircleCheck, Clock, RotateCw, X } from 'lucide-react-native'
import type { Attachment } from '../../types'
import type { PreparedImage } from '../../lib/media'
import { isRemoteEnabled } from '../../lib/remote'
import { C, ink, violet } from '../../theme/colors'
import { tick } from '../animated/SpringPressable'
import { AttachmentImage } from './AttachmentImage'

interface AttachmentStripProps {
  attachments: Attachment[]
  size?: number
}

export function AttachmentStrip({ attachments, size = 64 }: AttachmentStripProps) {
  if (attachments.length === 0) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {attachments.map(a => (
        <Thumb key={a.id} attachment={a} size={size} />
      ))}
    </ScrollView>
  )
}

const STATE_LABEL: Record<Attachment['upload'], string> = {
  pending: 'waiting to upload',
  uploading: 'uploading',
  uploaded: 'uploaded',
  failed: 'upload failed, open to retry',
}

function Thumb({ attachment: a, size }: { attachment: Attachment; size: number }) {
  const cloud = isRemoteEnabled()
  const open = () => router.push({ pathname: '/viewer', params: { id: a.id } })
  const label = a.kind === 'bill' ? 'Bill photo' : 'Payment screenshot'

  return (
    <Pressable
      onPress={open}
      style={[styles.thumb, { width: size, height: size }]}
      accessibilityRole="imagebutton"
      accessibilityLabel={cloud ? `${label}, ${STATE_LABEL[a.upload]}` : label}
    >
      <AttachmentImage attachment={a} alt={label} style={StyleSheet.absoluteFill} />
      <StateBadge attachment={a} cloud={cloud} />
    </Pressable>
  )
}

function StateBadge({ attachment: a, cloud }: { attachment: Attachment; cloud: boolean }) {
  if (!cloud) return null
  if (a.upload === 'uploading') {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="small" color={C.white} />
      </View>
    )
  }
  if (a.upload === 'uploaded') {
    return (
      <View style={[styles.badge, { backgroundColor: C.emerald400 }]}>
        <CircleCheck size={11} color={C.white} strokeWidth={2.6} />
      </View>
    )
  }
  if (a.upload === 'failed') {
    return (
      <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
        <RotateCw size={10} color={C.white} strokeWidth={2.5} />
      </View>
    )
  }
  return (
    <View style={[styles.badge, { backgroundColor: C.amber500 }]}>
      <Clock size={10} color={C.white} strokeWidth={2.6} />
    </View>
  )
}

/** Images picked in a form before the expense exists (not yet attachments). */
export function DraftStrip({ images, onRemove, size = 64 }: { images: PreparedImage[]; onRemove: (uri: string) => void; size?: number }) {
  const reduced = useReducedMotion()
  if (images.length === 0) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {images.map(img => (
        <Animated.View
          key={img.uri}
          entering={reduced ? undefined : FadeIn.duration(150)}
          exiting={reduced ? undefined : FadeOut.duration(120)}
          style={[styles.thumb, { width: size, height: size }]}
        >
          <Image source={{ uri: img.uri }} alt="Bill photo to attach" style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          <Pressable
            onPress={() => {
              tick('light')
              onRemove(img.uri)
            }}
            hitSlop={8}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <X size={12} color={C.white} strokeWidth={3} />
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: { gap: 10, paddingVertical: 2 },
  thumb: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: violet(0.08),
    borderWidth: 1,
    borderColor: ink(0.1),
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.white,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(42,31,61,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(42,31,61,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
