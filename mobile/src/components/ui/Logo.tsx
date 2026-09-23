// The TripMate logo tile — the same artwork as the web's /logo.png.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { shadow } from '../../theme/colors'

const LOGO = require('../../../assets/images/logo.png')

interface LogoProps {
  size?: number
  glow?: boolean
  style?: StyleProp<ViewStyle>
}

export function Logo({ size = 96, glow = true, style }: LogoProps) {
  const radius = Math.round(size * 0.23)
  return (
    <View
      style={[{ width: size, height: size, borderRadius: radius, boxShadow: glow ? shadow.glowBrand : undefined }, style]}
      accessibilityRole="image"
      accessibilityLabel="TripMate"
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        <Image source={LOGO} style={styles.image} contentFit="cover" transition={0} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
})
