'use client'

import { motion, Variants } from 'framer-motion'
import { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
  once?: boolean
}

const directionMap = {
  up:    { y: 24 },
  down:  { y: -24 },
  left:  { x: 24 },
  right: { x: -24 },
  none:  {},
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  className,
  once = true,
}: FadeInProps) {
  const initial = { opacity: 0, ...directionMap[direction] }
  const animate = { opacity: 1, x: 0, y: 0 }

  return (
    <motion.div
      initial={initial}
      whileInView={animate}
      viewport={{ once }}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerListProps {
  children: ReactNode[]
  staggerDelay?: number
  className?: string
  once?: boolean
}

export function StaggerList({
  children,
  staggerDelay = 0.08,
  className,
  once = true,
}: StaggerListProps) {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  }

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        ease: [0.21, 0.47, 0.32, 0.98],
        duration: 0.45,
      },
    },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once }}
      className={className}
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

interface ScaleInProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 30,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface SlideInProps {
  children: ReactNode
  from?: 'bottom' | 'top' | 'left' | 'right'
  delay?: number
  className?: string
}

export function SlideIn({ children, from = 'bottom', delay = 0, className }: SlideInProps) {
  const initial = {
    bottom: { y: '100%', opacity: 0 },
    top:    { y: '-100%', opacity: 0 },
    left:   { x: '-100%', opacity: 0 },
    right:  { x: '100%', opacity: 0 },
  }[from]

  return (
    <motion.div
      initial={initial}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={initial}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
