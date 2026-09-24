// Thumbnails for bill photos / UPI screenshots with live upload state:
// waiting (amber), uploading (spinner), failed (red, tap to retry), synced
// (green check). Tap a thumbnail to open the full-screen viewer.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { ZoomIn, ZoomOut, useReducedMotion } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { CircleCheck, CloudUpload, ImageOff, RotateCw, Smartphone, X } from 'lucide-react-native'
import type { Attachment } from '../../types'
import type { PreparedImage } from '../../lib/media'
import { attachmentUri, retryUpload } from '../../lib/uploads'
import { isRemoteEnabled } from '../../lib/remote'
import { C, ink, violet } from '../../theme/colors'
import { T } from '../ui/Text'
import { tick } from '../animated/SpringPressable'

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

function Thumb({ attachment: a, size }: { attachment: Attachment; size: number }) {
  const reduced = useReducedMotion()
  const uri = attachmentUri(a)
  const cloud = isRemoteEnabled()
  const open = () => router.push({ pathname: '/viewer', params: { id: a.id } })

  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(15)} exiting={reduced ? undefined : ZoomOut.duration(150)}>
      <Pressable
        onPress={open}
        style={[styles.thumb, { width: size, height: size }]}
        accessibilityRole="imagebutton"
        accessibilityLabel={a.kind === 'bill' ? 'Bill photo' : 'Payment screenshot'}
      >
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={a.id} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.missing}>
            <ImageOff size={18} color={ink(0.4)} />
          </View>
        )}
        <StateBadge attachment={a} cloud={cloud} />
      </Pressable>
    </Animated.View>
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
  return null
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
          entering={reduced ? undefined : ZoomIn.springify().damping(15)}
          exiting={reduced ? undefined : ZoomOut.duration(150)}
          style={[styles.thumb, { width: size, height: size }]}
        >
          <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
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
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  failed: { backgroundColor: 'rgba(220,38,38,0.55)' },
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
