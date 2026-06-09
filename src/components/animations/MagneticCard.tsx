'use client'

import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { ReactNode, useRef } from 'react'
import { cn } from '@/lib/utils'

interface MagneticCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  glow?: boolean
  tiltStrength?: number
  magnetStrength?: number
}

/**
 * MagneticCard — A living, physical card.
 * 3D tilt toward cursor. Shadow reacts. Glow pulses.
 */
export function MagneticCard({
  children,
  className,
  onClick,
  hover = true,
  glow = false,
  tiltStrength = 10,
  magnetStrength = 0.12,
}: MagneticCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Spring-smooth tilt values
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [tiltStrength, -tiltStrength]), {
    stiffness: 300, damping: 30
  })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-tiltStrength, tiltStrength]), {
    stiffness: 300, damping: 30
  })

  // Magnetic translation
  const translateX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-tiltStrength * magnetStrength * 80, tiltStrength * magnetStrength * 80]), {
    stiffness: 200, damping: 25
  })
  const translateY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-tiltStrength * magnetStrength * 80, tiltStrength * magnetStrength * 80]), {
    stiffness: 200, damping: 25
  })

  // Glow position follows cursor
  const glowX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])
  const glowY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !hover) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    mouseX.set(x)
    mouseY.set(y)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: hover ? rotateX : 0,
        rotateY: hover ? rotateY : 0,
        x: hover ? translateX : 0,
        y: hover ? translateY : 0,
        transformStyle: 'preserve-3d',
        transformPerspective: 1000,
      }}
      whileTap={onClick ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative rounded-2xl border border-white/10 overflow-hidden',
        'bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl',
        'shadow-glass',
        glow && 'shadow-glow-sm',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Dynamic cursor glow */}
      {hover && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: `radial-gradient(circle at ${glowX} ${glowY}, rgba(100,90,230,0.15) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Top edge highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Content layer — slightly above card in 3D */}
      <div style={{ transform: 'translateZ(20px)' }}>
        {children}
      </div>
    </motion.div>
  )
}
