'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useStore.persist.rehydrate()
  }, [])
  return <>{children}</>
}
