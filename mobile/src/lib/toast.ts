// Lightweight toast queue. Any module (screens, uploads, sync) can raise a
// toast; <ToastHost /> in the root layout renders the newest one.
import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
  /** Auto-dismiss delay in ms. */
  duration: number
}

interface ToastState {
  current: ToastItem | null
  show: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => void
  dismiss: (id?: number) => void
}

let seq = 0

export const useToastStore = create<ToastState>()(set => ({
  current: null,
  show: t =>
    set({
      current: {
        ...t,
        id: ++seq,
        duration: t.duration ?? (t.action ? 5200 : t.kind === 'error' ? 4200 : 2600),
      },
    }),
  dismiss: id =>
    set(s => (id === undefined || s.current?.id === id ? { current: null } : s)),
}))

type Opts = { action?: ToastAction; duration?: number }

const raise = (kind: ToastKind) => (message: string, opts?: Opts) =>
  useToastStore.getState().show({ kind, message, ...opts })

export const toast = {
  success: raise('success'),
  error: raise('error'),
  info: raise('info'),
  warning: raise('warning'),
}
