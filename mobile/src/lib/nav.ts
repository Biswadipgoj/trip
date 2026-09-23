// Navigation helpers for entering / leaving a trip. Both reset the stack so
// Android's back button behaves: back from the dashboard leaves the app
// instead of bouncing through the landing page's redirect.
import { router } from 'expo-router'

function resetTo(href: '/dashboard' | '/login' | '/') {
  try {
    if (router.canDismiss()) router.dismissAll()
  } catch {
    /* nothing to dismiss */
  }
  router.replace(href)
}

/** Opens the trip tabs for the current session. */
export const enterTrip = () => resetTo('/dashboard')

/** After logout: back to the login screen with a clean stack. */
export const leaveTrip = () => resetTo('/login')
