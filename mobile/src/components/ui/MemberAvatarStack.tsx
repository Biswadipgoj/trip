// Overlapping avatars (web: flex -space-x-2), e.g. the members of a unit.
import { StyleSheet, View } from 'react-native'
import type { Member } from '../../types'
import { C, ink } from '../../theme/colors'
import { Avatar, type AvatarSize } from './Avatar'
import { T } from './Text'

interface AvatarStackProps {
  members: Pick<Member, 'id' | 'name' | 'avatarColor'>[]
  size?: AvatarSize
  max?: number
}

export function AvatarStack({ members, size = 'xs', max = 4 }: AvatarStackProps) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  const overlap = size === 'xs' ? -7 : -10
  return (
    <View style={styles.row}>
      {shown.map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : overlap, zIndex: shown.length - i }}>
          <Avatar name={m.name} color={m.avatarColor} size={size} glow={false} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.more, { marginLeft: overlap }]}>
          <T variant="tinySemibold" color={ink(0.7)}>+{extra}</T>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  more: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
})
