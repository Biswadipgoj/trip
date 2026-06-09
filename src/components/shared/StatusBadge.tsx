'use client'

import { cn } from '@/lib/utils'
import { PaymentStatus } from '@/types'
import { motion } from 'framer-motion'

interface StatusBadgeProps {
  status: PaymentStatus | 'active' | 'closed'
  className?: string
}

const statusConfig = {
  pending:   { label: 'Pending',   dot: 'bg-amber-400',   bg: 'bg-amber-400/10',   text: 'text-amber-400',   border: 'border-amber-400/20' },
  paid:      { label: 'Paid',      dot: 'bg-blue-400',    bg: 'bg-blue-400/10',    text: 'text-blue-400',    border: 'border-blue-400/20' },
  confirmed: { label: 'Confirmed', dot: 'bg-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
  active:    { label: 'Active',    dot: 'bg-brand-400',   bg: 'bg-brand-400/10',   text: 'text-brand-400',   border: 'border-brand-400/20' },
  closed:    { label: 'Closed',   dot: 'bg-slate-400',   bg: 'bg-slate-400/10',   text: 'text-slate-400',   border: 'border-slate-400/20' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border',
        config.bg, config.text, config.border,
        className
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
        style={{ boxShadow: `0 0 6px currentColor` }}
      />
      {config.label}
    </motion.span>
  )
}
