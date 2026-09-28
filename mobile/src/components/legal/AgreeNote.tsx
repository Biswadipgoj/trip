// Shown before someone gives their name, number and PIN.
import { StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { C, ink } from '../../theme/colors'
import { F } from '../../theme/typography'

export function AgreeNote({ action }: { action: string }) {
  return (
    <Text style={styles.note} maxFontSizeMultiplier={1.35}>
      By tapping {action}, you agree to the{' '}
      <Text style={styles.link} accessibilityRole="link" onPress={() => router.push('/terms')}>Terms of Service</Text>
      {' '}and{' '}
      <Text style={styles.link} accessibilityRole="link" onPress={() => router.push('/privacy')}>Privacy Policy</Text>.
    </Text>
  )
}

const styles = StyleSheet.create({
  note: { fontFamily: F.regular, fontSize: 11, lineHeight: 16, color: ink(0.55), textAlign: 'center' },
  link: { fontFamily: F.semibold, color: C.brand600 },
})
