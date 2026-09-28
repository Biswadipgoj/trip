// Privacy Policy / Terms of Service screen: the same text as the web pages
// (src/lib/legal.ts), with each section rising in as the page opens.
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Screen } from '../ui/Screen'
import { BackLink } from '../ui/PageHeader'
import { GlassCard } from '../ui/GlassCard'
import { GradientText, T } from '../ui/Text'
import { Logo } from '../ui/Logo'
import { FadeIn, stagger } from '../animated/FadeInView'
import { C, ink } from '../../theme/colors'
import { LEGAL_UPDATED, type LegalDoc } from '../../lib/legal'

function Body({ lines }: { lines: string[] }) {
  return (
    <View style={styles.body}>
      {lines.map(line =>
        line.startsWith('• ') ? (
          <View key={line} style={styles.bulletRow}>
            <View style={styles.dot} />
            <T variant="body" color={ink(0.8)} style={styles.flex}>{line.slice(2)}</T>
          </View>
        ) : (
          <T key={line} variant="body" color={ink(0.8)}>{line}</T>
        ),
      )}
    </View>
  )
}

export function LegalScreen({ doc, other }: { doc: LegalDoc; other: { href: '/privacy' | '/terms'; label: string } }) {
  const insets = useSafeAreaInsets()
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <BackLink />
        <FadeIn>
          <View style={styles.brand}>
            <Logo size={32} />
            <T variant="title">TripMate</T>
          </View>
          <GradientText variant="display">{doc.title}</GradientText>
          <T variant="small" color={ink(0.55)} style={styles.updated}>Last updated {LEGAL_UPDATED}</T>
        </FadeIn>
        <FadeIn delay={80}>
          <GlassCard strong padding={16}>
            <T variant="bodyMedium" color={C.brand800}>{doc.summary}</T>
          </GlassCard>
        </FadeIn>
        {doc.sections.map((s, i) => (
          <FadeIn key={s.title} delay={stagger(i, 140)}>
            <GlassCard padding={18} accessibilityLabel={`${i + 1}. ${s.title}`}>
              <T variant="title" color={C.ink}>{i + 1}. {s.title}</T>
              <Body lines={s.body} />
            </GlassCard>
          </FadeIn>
        ))}
        <Link href={other.href} style={styles.other}>
          <T variant="bodyMedium" color={C.brand600}>Read the {other.label} →</T>
        </Link>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 12, gap: 14 },
  updated: { marginTop: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  body: { marginTop: 8, gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.brand400, marginTop: 7 },
  flex: { flex: 1 },
  other: { alignSelf: 'center', paddingVertical: 12 },
})
