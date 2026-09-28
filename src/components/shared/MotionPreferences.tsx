'use client'

import { MotionConfig } from 'framer-motion'

/**
 * Honour the device's "reduce motion" setting for every framer-motion animation:
 * movement and scaling are skipped, fades still run so state changes stay visible.
 */
export function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
