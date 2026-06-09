'use client'

import { motion, useSpring, useTransform, MotionValue } from 'framer-motion'
import { ReactNode, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PhysicsButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'brand' | 'ghost' | 'danger' | 'success'
  disabled?: boolean
  loading?: boolean
  id?: string
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

/**
 * PhysicsButton — The beating heart of the UI.
 * Feels physically soft. Spring rebound. Ripple. Glow reaction.
 */
export function PhysicsButton({
  children,
  onClick,
  className,
  variant = 'brand',
  disabled = false,
  loading = false,
  id,
  type = 'button',
  fullWidth = false,
}: PhysicsButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const ref = useRef<HTMLButtonElement>(null)
  const rippleId = useRef(0)

  const addRipple = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left
    const y = clientY - rect.top
    const id = rippleId.current++
    setRipples(r => [...r, { id, x, y }])
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700)
  }

  const variantStyles = {
    brand:   'bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow-sm',
    ghost:   'bg-white/8 border border-white/12 text-white/80',
    danger:  'bg-red-500/20 border border-red-500/30 text-red-400',
    success: 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400',
  }

  return (
    <motion.button
      ref={ref}
      id={id}
      type={type}
      disabled={disabled || loading}
      onMouseDown={(e) => { setIsPressed(true); addRipple(e) }}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={(e) => { setIsPressed(true); addRipple(e) }}
      onTouchEnd={() => setIsPressed(false)}
      onClick={onClick}
      whileHover={!disabled ? { y: -2, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.92, y: 0 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.5 }}
      className={cn(
        'relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold',
        'select-none cursor-pointer outline-none',
        'transition-shadow duration-200',
        variantStyles[variant],
        isPressed && 'shadow-none',
        disabled && 'opacity-40 cursor-not-allowed',
        fullWidth && 'w-full flex items-center justify-center',
        className
      )}
    >
      {/* Ripple layer */}
      {ripples.map(rp => (
        <span
          key={rp.id}
          className="absolute rounded-full bg-white/25 pointer-events-none animate-ripple-expand"
          style={{
            left: rp.x,
            top: rp.y,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
          }}
        />
      ))}

      {/* Shimmer sweep on hover */}
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
        initial={{ x: '-100%' }}
        whileHover={{ x: '200%' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full block"
          />
        ) : children}
      </span>
    </motion.button>
  )
}
