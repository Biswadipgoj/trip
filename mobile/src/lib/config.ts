// Build-time configuration. EXPO_PUBLIC_* variables are inlined by Metro when
// the JS bundle is built — set them in mobile/.env for local runs and as EAS
// environment variables for cloud builds (see mobile/README.md).

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

/** Deployed web app origin (e.g. https://your-app.vercel.app), used to build
 *  invite links that open on any device. Without it, invites share the code. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').trim().replace(/\/+$/, '')

/** The app is offline-first: runs smoothly offline or local-only, and
 *  syncs with Supabase whenever credentials and internet are present. */
export const ALLOW_LOCAL_PREVIEW = true

/** Supabase Storage bucket for bill photos and UPI payment screenshots. */
export const MEDIA_BUCKET = 'trip-media'

/** Deep-link scheme (app.json "scheme"). */
export const APP_SCHEME = 'tripmate'
