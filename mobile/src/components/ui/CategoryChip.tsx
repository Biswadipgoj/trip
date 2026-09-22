import React from 'react'
import { Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getCategoryIcon, getCategoryLabel, getCategoryGradientColors } from '../../lib/utils'

interface CategoryChipProps {
  category: string
  subcategory?: string
  size?: 'sm' | 'md'
  style?: StyleProp<ViewStyle>
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  category,
  subcategory,
  size = 'md',
  style,
}) => {
  const icon = getCategoryIcon(category)
  const label = getCategoryLabel(category)
  const gradient = getCategoryGradientColors(category)

  const isSmall = size === 'sm'

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.chip,
        isSmall ? styles.chipSm : styles.chipMd,
        style,
      ]}
    >
      <Text style={isSmall ? styles.iconSm : styles.iconMd}>{icon}</Text>
      <Text style={isSmall ? styles.labelSm : styles.labelMd} numberOfLines={1}>
        {label}
      </Text>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipMd: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iconSm: {
    fontSize: 12,
    marginRight: 4,
  },
  iconMd: {
    fontSize: 14,
    marginRight: 6,
  },
  labelSm: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  labelMd: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
})
