'use client'

import { cn, getInitials } from '@/lib/utils'
import { motion } from 'framer-motion'

interface AvatarProps {
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
  className?: string
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
}

export function Avatar({ name, color, size = 'md', animate = false, className }: AvatarProps) {
  const initials = getInitials(name)
  const bg = color || 'hsl(258, 65%, 58%)'

  const Component = animate ? motion.div : 'div'
  const animProps = animate
    ? {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
      }
    : {}

  return (
    <Component
      className={cn(
        'flex items-center justify-center rounded-full font-semibold',
        'ring-2 ring-pure-white/60 shrink-0',
        sizeMap[size],
        className
      )}
      style={{ background: bg, boxShadow: `0 4px 16px ${bg}50`, color: '#ffffff' }}
      {...animProps}
    >
      {initials}
    </Component>
  )
}
