// Keeps the app alive when a stray error escapes an event handler, timer or
// promise callback. In release builds React Native treats those as fatal and
// kills the process; render errors are already caught by the route
// ErrorBoundary. Before the root layout mounts, errors still go to the default
// handler so a broken start-up is never masked as a blank screen.
import { toast } from './toast'

type Handler = (error: unknown, isFatal?: boolean) => void
interface ErrorUtilsLike {
  getGlobalHandler(): Handler
  setGlobalHandler(handler: Handler): void
}

let mounted = false
let lastToastAt = 0

export function markAppMounted() {
  mounted = true
}

declare const __DEV__: boolean | undefined

const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
if (errorUtils) {
  const fallback = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error, isFatal) => {
    console.warn('[crashGuard]', isFatal ? 'fatal' : 'non-fatal', error)
    const now = Date.now()
    if (now - lastToastAt > 3000) {
      lastToastAt = now
      try {
        toast.error('Something went wrong — please try that again.')
      } catch {
        // the toast host itself failed; staying alive matters more
      }
    }
    // In dev mode, allow redbox. In production release, prevent OS process crash.
    if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof fallback === 'function') {
      fallback(error, isFatal)
    }
  })
}
