'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Trigger rehydration from localStorage.
    // The `onRehydrateStorage` callback in the store config will set `hydrated: true`
    // once the data has been loaded — ensuring layout guards don't redirect prematurely.
    useStore.persist.rehydrate()
  }, [])
  return <>{children}</>
}

/**
 * Returns true once Zustand has finished loading data from localStorage.
 * Use this in protected layouts to avoid false redirects on first render.
 */
export function useHydrated(): boolean {
  return useStore(s => s.hydrated)
}
