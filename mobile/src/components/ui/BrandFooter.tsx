// Brand signature (web BrandFooter): "Mastermind Behind The Code: Biswodip
// Goj", every word in its own vivid gradient. Tapping it floats a nameplate
// over a frosted veil, with a sheen gliding across the name.
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { C, FOOTER_WORDS, G, brand500, ink } from '../../theme/colors'
import { F } from '../../theme/typography'
import { PressScale } from '../animated/SpringPressable'
import { Overlay } from './BottomSheet'
import { GradientText, T } from './Text'

const WORDS = ['Mastermind', 'Behind', 'The', 'Code:', 'Biswodip', 'Goj']

export function BrandFooter({ bottomPadding = 24 }: { bottomPadding?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <PressScale
          onPress={() => setOpen(true)}
          scaleTo={0.95}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Mastermind Behind The Code: Biswodip Goj"
        >
          <View style={styles.words}>
            {WORDS.map((word, i) => (
              <GradientText key={word} colors={FOOTER_WORDS[i] as [string, string]} style={styles.word}>
                {word}
              </GradientText>
            ))}
          </View>
        </PressScale>
        <T variant="tiny" color={ink(0.5)} center style={styles.hint}>Tap the signature ✨</T>
      </View>
      <Overlay visible={open} onClose={() => setOpen(false)} tapToClose>
        <Nameplate />
      </Overlay>
    </>
  )
}

function Nameplate() {
  const reduced = useReducedMotion()
  const translateY = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    translateY.value = withRepeat(
      withTiming(-7, { duration: 2250, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [reduced, translateY])

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[styles.plate, floatStyle]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.94)', 'rgba(244,238,255,0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <T variant="tinySemibold" color={brand500(0.72)} center style={styles.kicker}>MASTERMIND BEHIND THE CODE</T>
      <ShimmerName />
      <View style={styles.divider}>
        <LinearGradient colors={['rgba(155,104,243,0)', 'rgba(155,104,243,0.6)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
        <T variant="body">✦</T>
        <LinearGradient colors={['rgba(217,70,239,0.6)', 'rgba(217,70,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
      </View>
      <T variant="small" color={ink(0.6)} center style={styles.close}>Tap anywhere to close</T>
    </Animated.View>
  )
}

/** "Biswodip Goj" with a gradient that slides across the letters (tmSheen). */
function ShimmerName() {
  const reduced = useReducedMotion()
  const [w, setW] = useState(0)
  const shimmerTx = useSharedValue(0)

  useEffect(() => {
    if (reduced || w <= 0) return
    shimmerTx.value = withRepeat(
      withTiming(-w * 1.2, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [w, reduced, shimmerTx])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTx.value }],
  }))

  const text = (
    <T style={styles.name} center>
      Biswodip Goj
    </T>
  )
  if (Platform.OS === 'web') return <T style={[styles.name, { color: C.brand500 }]} center>Biswodip Goj</T>
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)}>
      <MaskedView maskElement={text}>
        <View style={styles.nameBox}>
          {w > 0 && (
            <Animated.View
              style={[
                { position: 'absolute', top: 0, bottom: 0, left: 0, width: w * 2.2 },
                shimmerStyle,
              ]}
            >
              <LinearGradient
                colors={[...G.nameplate, G.nameplate[0]]}
                start={{ x: 0, y: 0.3 }}
                end={{ x: 1, y: 0.7 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
          <T style={[styles.name, styles.invisible]} center>Biswodip Goj</T>
        </View>
      </MaskedView>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 16 },
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 6,
    rowGap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  word: { fontFamily: F.extrabold, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  hint: { marginTop: 4 },
  plate: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 30,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    boxShadow: '0px 30px 90px rgba(108, 62, 200, 0.35)',
    minWidth: 280,
  },
  kicker: { letterSpacing: 3.2, marginBottom: 10 },
  name: { fontFamily: F.display, fontSize: 40, lineHeight: 46, color: C.ink },
  nameBox: { overflow: 'hidden' },
  invisible: { opacity: 0 },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  line: { height: 1, width: 40 },
  close: { marginTop: 12 },
})
