// Payment method marks: the UPI arrows (orange + green) with the UPI
// wordmark, and a ₹ coin for cash. Drawn as vectors so they stay sharp at
// every size and need no image assets.
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { T } from './Text'
import { F } from '../../theme/typography'

export const UPI_ORANGE = '#F37021'
export const UPI_GREEN = '#0A8A43'

/** The two UPI arrows. `size` is the height in points. */
export function UpiArrows({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size * 0.9} height={size} viewBox="0 0 18 20" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7.2 1 L16.6 10 L7.2 19 Z" fill={UPI_GREEN} />
      <Path d="M1.4 1 L10.8 10 L1.4 19 Z" fill={UPI_ORANGE} />
    </Svg>
  )
}

/** UPI arrows + wordmark, e.g. on the payment method card and badges. */
export function UpiMark({ size = 18, color = '#4B4B4D', arrows = true }: { size?: number; color?: string; arrows?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="UPI">
      <T style={{ fontFamily: F.extrabold, fontSize: size, lineHeight: size * 1.15, color, letterSpacing: -0.3, transform: [{ skewX: '-10deg' }] }}>
        UPI
      </T>
      {arrows && <UpiArrows size={size * 0.95} />}
    </View>
  )
}

/** A ₹ coin: gold rim, embossed rupee sign. `size` is the diameter. */
export function RupeeCoin({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE9A8" />
          <Stop offset="0.55" stopColor="#F6C343" />
          <Stop offset="1" stopColor="#D99A12" />
        </LinearGradient>
      </Defs>
      <Circle cx="16" cy="16" r="15" fill="#C8870C" />
      <Circle cx="16" cy="16" r="13.2" fill="url(#coinFace)" />
      <Circle cx="16" cy="16" r="10.6" fill="none" stroke="#B87A09" strokeOpacity={0.45} strokeWidth={0.9} />
      {/* ₹: two bars, the bowl and the diagonal leg */}
      <Path
        d="M11 9.6 H21 M11 13.2 H21 M13.4 9.6 C18.6 9.6 18.6 16.6 13.4 16.6 H11.6 L19.4 23.2"
        stroke="#7A4E00"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
})
