// Build-time configuration. EXPO_PUBLIC_* variables are inlined by Metro when
// the JS bundle is built — set them in mobile/.env for local runs and as EAS
// environment variables for cloud builds (see mobile/README.md).

/** TripMate server origin (https://www.tripmate.boats). All sync, login and
 *  photos go through it; invite links point at it. Without it the app runs
 *  local-only. The app holds no database key: the server checks every request. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').trim().replace(/\/+$/, '')

/** The app is offline-first: runs smoothly offline or local-only, and
 *  syncs with Supabase whenever credentials and internet are present. */
export const ALLOW_LOCAL_PREVIEW = true

/** Supabase Storage bucket for bill photos and UPI payment screenshots. */
export const MEDIA_BUCKET = 'trip-media'

/** Deep-link scheme (app.json "scheme"). */
export const APP_SCHEME = 'tripmate'
