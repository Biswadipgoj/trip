// Camera / Gallery buttons for bill photos and UPI payment screenshots.
// Images are compressed and saved on the phone first (lib/media); the caller
// links them to an expense or payment (lib/uploads) which uploads them.
import { useState } from 'react'
import { Alert, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Camera, Image as ImageIcon } from 'lucide-react-native'
import {
  MediaPermissionError, openAppSettings, pickImage, savePickContext,
  type PickContext, type PickSource, type PreparedImage,
} from '../../lib/media'
import { describeError } from '../../lib/remote'
import { toast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { tick } from '../animated/SpringPressable'

interface AttachmentPickerProps {
  onPicked: (image: PreparedImage) => void
  /** Remembered while the camera is open, so the photo can be recovered if
   *  Android kills the app in the background. */
  context: PickContext
  cameraLabel?: string
  galleryLabel?: string
  tone?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function AttachmentPicker({
  onPicked, context, cameraLabel = 'Camera', galleryLabel = 'Gallery', tone, disabled, style,
}: AttachmentPickerProps) {
  const [busy, setBusy] = useState<PickSource | null>(null)

  const pick = async (source: PickSource) => {
    if (Platform.OS === 'web') {
      toast.info('Adding photos works in the Android app')
      return
    }
    setBusy(source)
    try {
      await savePickContext(context)
      const image = await pickImage(source)
      if (image) {
        tick('success')
        onPicked(image)
      }
    } catch (err) {
      if (err instanceof MediaPermissionError) {
        Alert.alert(
          'Permission needed',
          err.message,
          err.canAskAgain
            ? [{ text: 'OK' }]
            : [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void openAppSettings() }]
        )
      } else {
        toast.error(`Couldn't add the photo: ${describeError(err)}`)
      }
    } finally {
      await savePickContext(null)
      setBusy(null)
    }
  }

  return (
    <View style={[styles.row, style]}>
      <Button
        title={cameraLabel}
        icon={Camera}
        variant="soft"
        size="sm"
        tone={tone}
        loading={busy === 'camera'}
        disabled={disabled || busy !== null}
        onPress={() => void pick('camera')}
        style={styles.flex}
      />
      <Button
        title={galleryLabel}
        icon={ImageIcon}
        variant="soft"
        size="sm"
        tone={tone}
        loading={busy === 'library'}
        disabled={disabled || busy !== null}
        onPress={() => void pick('library')}
        style={styles.flex}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
})
