import React from 'react'
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { getInitials } from '../../lib/utils'

interface AvatarProps {
  name: string
  color?: string
  size?: number
  style?: StyleProp<ViewStyle>
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color = '#6366F1',
  size = 44,
  style,
}) => {
  const initials = getInitials(name)
  const fontSize = Math.round(size * 0.4)

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
