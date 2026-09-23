// Cross-platform confirmation dialog: the native Alert on phones, the
// browser's confirm() in the web preview (react-native-web has no Alert).
import { Alert, Platform } from 'react-native'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function confirmAction({
  title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(message ? `${title}\n\n${message}` : title)
      : true
    return Promise.resolve(ok)
  }
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
}
