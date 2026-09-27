import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Globe, LogOut } from 'lucide-react-native'
import { C, brand500, ink, red } from '../../theme/colors'
import { TOP_BAR_HEIGHT } from '../../theme/spacing'
import { PressScale } from '../animated/SpringPressable'
import { Logo } from './Logo'
import { T } from './Text'
import { LanguagePicker } from './LanguagePicker'
import { useTranslation } from '../../lib/i18n'

interface TripTopBarProps {
  tripId?: string
  tripName: string
  subtitle: string
  onLogout: () => void
}

export function TripTopBar({ tripName, subtitle, onLogout }: TripTopBarProps) {
  const insets = useSafeAreaInsets()
  const [showLanguage, setShowLanguage] = useState(false)
  const { language, t } = useTranslation()

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.row}>
          <Logo size={32} glow={false} />
          <View style={styles.text}>
            <T variant="title" numberOfLines={1}>{tripName}</T>
            <T variant="tiny" color={ink(0.65)} numberOfLines={1} style={styles.subtitle}>{subtitle}</T>
          </View>

          {/* Quick Language Switcher for all 20 local languages */}
          <PressScale
            onPress={() => setShowLanguage(true)}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel="Choose language"
          >
            <Globe size={14} color={C.brand600} strokeWidth={2.3} />
            <T variant="smallMedium" color={C.brand600}>
              {language.slice(0, 3).toUpperCase()}
            </T>
          </PressScale>

          <PressScale onPress={onLogout} style={styles.logout} accessibilityRole="button" accessibilityLabel="Log out">
            <LogOut size={15} color={C.red500} strokeWidth={2.3} />
            <T variant="smallMedium" color={C.red500}>
              {t('logout')}
            </T>
          </PressScale>
        </View>
      </View>

      <LanguagePicker visible={showLanguage} onClose={() => setShowLanguage(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: ink(0.08),
    zIndex: 10,
  },
  row: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    fontSize: 11,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 62, 200, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 62, 200, 0.2)',
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: red(0.1),
    borderWidth: 1,
    borderColor: red(0.2),
  },
})
