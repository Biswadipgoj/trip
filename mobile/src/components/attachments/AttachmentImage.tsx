// A bill photo / UPI screenshot that always ends in something useful: it loads
// from the on-device copy, then the public cloud URL, then a signed URL (for a
// bucket that isn't public), and otherwise shows a placeholder with a retry.
import { useState } from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image, type ImageContentFit } from 'expo-image'
import { ImageOff, RotateCw } from 'lucide-react-native'
import type { Attachment } from '../../types'
import { attachmentSources } from '../../lib/uploads'
import { mediaSignedUrl } from '../../lib/remote'
import { T } from '../ui/Text'
import { ink } from '../../theme/colors'

interface AttachmentImageProps {
  attachment: Attachment
  style?: StyleProp<ViewStyle>
  contentFit?: ImageContentFit
  /** Placeholder colours for dark (viewer) or light (thumbnail) surfaces. */
  tone?: 'light' | 'dark'
  /** Show "Tap to retry" text under the icon (full-size viewer). */
  showRetryLabel?: boolean
  alt: string
}

type LoadState = { key: string; index: number; signed: string | null; failed: boolean }

export function AttachmentImage({
  attachment: a, style, contentFit = 'cover', tone = 'light', showRetryLabel = false, alt,
}: AttachmentImageProps) {
  const sources = attachmentSources(a)
  const key = `${a.id}|${sources.join('|')}`
  const [state, setState] = useState<LoadState>({ key, index: 0, signed: null, failed: false })
  // New sources (uploaded, or the local copy appeared): start over.
  const current = state.key === key ? state : { key, index: 0, signed: null, failed: false }
  const uri = current.signed ?? sources[current.index] ?? null

  const onError = async () => {
    if (!current.signed && current.index + 1 < sources.length) {
      setState({ ...current, index: current.index + 1 })
      return
    }
    if (!current.signed && a.storagePath) {
      const signed = await mediaSignedUrl(a.storagePath)
      if (signed) {
        setState({ ...current, signed })
        return
      }
    }
    setState({ ...current, failed: true })
  }

  if (!uri || current.failed) {
    const color = tone === 'dark' ? 'rgba(255,255,255,0.7)' : ink(0.45)
    return (
      <Pressable
        onPress={() => setState({ key, index: 0, signed: null, failed: false })}
        style={[styles.missing, style]}
        accessibilityRole="button"
        accessibilityLabel={`${alt} could not be loaded. Tap to retry.`}
      >
        {showRetryLabel ? <RotateCw size={28} color={color} /> : <ImageOff size={18} color={color} />}
        {showRetryLabel && (
          <View style={styles.label}>
            <T variant="body" color={color} center>
              {a.storagePath ? "Couldn't load this image. Tap to retry." : 'This image is not uploaded yet.'}
            </T>
          </View>
        )}
      </Pressable>
    )
  }

  return (
    <View style={style}>
      <Image
        source={{ uri }}
        alt={alt}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={150}
        recyclingKey={a.id}
        cachePolicy="memory-disk"
        onError={() => void onError()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 12, paddingHorizontal: 24 },
})
