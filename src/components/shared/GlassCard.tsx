'use client'

import { cn } from '@/lib/utils'
import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  onClick?: () => void
}

export function GlassCard({ children, className, hover = true, glow = false, onClick, ...props }: GlassCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative rounded-2xl border border-white/50 bg-gradient-glass backdrop-blur-xl',
        'shadow-glass overflow-hidden',
        glow && 'shadow-glow-sm',
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {/* Subtle top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      {children}
    </motion.div>
  )
}
