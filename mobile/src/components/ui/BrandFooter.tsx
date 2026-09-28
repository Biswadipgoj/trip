// Brand signature: compact "Created by Dip ✦" pill, plus Privacy / Terms links.
// Tapping the pill opens the creator card (same wording as the web footer) with a link to biswadip.in.
import { useState } from 'react'
import { StyleSheet, View, Linking, Pressable } from 'react-native'
import Animated from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { G, brand500, ink } from '../../theme/colors'
import { F } from '../../theme/typography'
import { PressScale } from '../animated/SpringPressable'
import { Overlay } from './BottomSheet'
import { GradientText, T } from './Text'

export function BrandFooter({ bottomPadding = 24 }: { bottomPadding?: number }) {
  const [open, setOpen] = useState(false)

  const handleVisit = () => {
    Linking.openURL('https://biswadip.in').catch(() => {})
  }

  return (
    <>
      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <PressScale
          onPress={() => setOpen(true)}
          scaleTo={0.96}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Crafted by Dip — Biswodip Goj"
        >
          <View style={styles.compactPill}>
            <T variant="tiny" color={ink(0.65)}>Created by</T>
            <T variant="tinySemibold" color="#7C3BED">Dip</T>
            <T variant="tiny" color="#E935CB">✦</T>
          </View>
        </PressScale>
        <View style={styles.legal}>
          <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link" hitSlop={10}>
            <T variant="tiny" color={ink(0.55)}>Privacy Policy</T>
          </Pressable>
          <T variant="tiny" color={ink(0.35)}>·</T>
          <Pressable onPress={() => router.push('/terms')} accessibilityRole="link" hitSlop={10}>
            <T variant="tiny" color={ink(0.55)}>Terms of Service</T>
          </Pressable>
        </View>
      </View>

      <Overlay visible={open} onClose={() => setOpen(false)} tapToClose>
        <Animated.View style={styles.plate}>
          <LinearGradient
            colors={['rgba(255,255,255,0.97)', 'rgba(246,240,255,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Monogram Badge */}
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#7C3BED', '#E935CB', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGlow}
            >
              <View style={styles.avatarInner}>
                <T variant="h3" color="#7C3BED" style={styles.monogram}>BG</T>
              </View>
            </LinearGradient>
          </View>

          <T variant="tinySemibold" color={brand500(0.85)} center style={styles.kicker}>
            DESIGNED & ENGINEERED BY
          </T>

          <GradientText colors={G.nameplate} center style={styles.name}>
            Biswodip Goj
          </GradientText>

          <T variant="small" color={ink(0.7)} center style={styles.tagline}>
            Designed and built by one person. TripMate records a group’s trip expenses, even without signal, and settles every balance in the fewest payments, by UPI or cash.
          </T>

          <View style={styles.divider}>
            <LinearGradient colors={['rgba(155,104,243,0)', 'rgba(155,104,243,0.5)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
            <T variant="tiny" color="#E935CB">✦</T>
            <LinearGradient colors={['rgba(217,70,239,0.5)', 'rgba(217,70,239,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
          </View>

          {/* Portfolio link */}
          <PressScale onPress={handleVisit} scaleTo={0.96} haptic="medium" style={styles.btnWrap}>
            <LinearGradient
              colors={['#7C3BED', '#E935CB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <T variant="label" color="#FFFFFF">Explore the portfolio · biswadip.in ↗</T>
            </LinearGradient>
          </PressScale>

          <Pressable onPress={() => setOpen(false)} hitSlop={12}>
            <T variant="tiny" color={ink(0.4)} center style={styles.close}>Tap anywhere to close</T>
          </Pressable>
        </Animated.View>
      </Overlay>
    </>
  )
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 16 },
  legal: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124, 59, 237, 0.22)',
    shadowColor: '#6C3EC8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  plate: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    elevation: 10,
    shadowColor: '#6C3EC8',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    minWidth: 290,
    alignItems: 'center',
  },
  avatarWrap: { marginBottom: 12 },
  avatarGlow: {
    width: 60,
    height: 60,
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monogram: { fontFamily: F.display, fontWeight: '900', letterSpacing: 0.5 },
  kicker: { letterSpacing: 2.5, marginBottom: 4 },
  name: { fontFamily: F.display, fontSize: 32, lineHeight: 38 },
  tagline: { marginTop: 4, paddingHorizontal: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 14 },
  line: { height: 1, width: 44 },
  btnWrap: { width: '100%', marginTop: 4 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3BED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  close: { marginTop: 14 },
})
