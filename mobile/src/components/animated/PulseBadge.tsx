// StatusBadge — pill with a coloured dot (web StatusBadge), for trip status
// (active / closed) and payment status (due / paid / confirmed).
import { StyleSheet, View } from 'react-native'
import { C } from '../../theme/colors'
import { withAlpha } from '../../lib/color'
import { T } from '../ui/Text'

export type BadgeStatus = 'pending' | 'paid' | 'confirmed' | 'active' | 'closed'

const CONFIG: Record<BadgeStatus, { label: string; color: string }> = {
  pending: { label: 'Due', color: C.amber600 },
  paid: { label: 'Paid', color: C.blue500 },
  confirmed: { label: 'Confirmed', color: C.emerald400 },
  active: { label: 'Active', color: C.brand500 },
  closed: { label: 'Closed', color: C.slate400 },
}

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const { label: defaultLabel, color } = CONFIG[status]
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.25) }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <T variant="smallMedium" color={color}>{label ?? defaultLabel}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
