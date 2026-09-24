// ──────────────────────────────────────────────────────────────────────────────
// Centralized TripMate Android Release Configuration
//
// All APK distribution details, version numbers, and Supabase Storage endpoints
// are declared here. Updating the release version or APK location requires editing
// only this file or supplying NEXT_PUBLIC_TRIPMATE_ANDROID_APK_URL.
// ──────────────────────────────────────────────────────────────────────────────

export interface AppReleaseMetadata {
  version: string
  versionCode: number
  releaseDate: string
  minimumAndroidVersion: string
  targetAndroidVersion: string
  fileName: string
  fileSizeFormatted: string
  approxBytes: number
  bucketName: string
  storagePath: string
  packageName: string
  appName: string
  features: string[]
}

export const APP_RELEASE: AppReleaseMetadata = {
  version: '4.0.1',
  versionCode: 401,
  releaseDate: 'September 2026',
  minimumAndroidVersion: 'Android 8.0 (Oreo) or later',
  targetAndroidVersion: 'Android 14 / 15',
  fileName: 'tripmate-latest.apk',
  fileSizeFormatted: '110 MB',
  approxBytes: 116028587,
  bucketName: 'android-app',
  storagePath: 'android-app/tripmate-latest.apk',
  packageName: 'com.tripmate.app',
  appName: 'TripMate',
  features: [
    'Trip, balances and bill photos stay viewable without signal',
    'Bill photos are compressed on the phone and upload when online',
    'Pay over UPI and attach the payment screenshot',
    'Settles up with the fewest payments',
  ],
}

/**
 * Returns the direct download URL for the TripMate Android APK.
 *
 * 1. Honors explicit NEXT_PUBLIC_TRIPMATE_ANDROID_APK_URL override if defined.
 * 2. Falls back to the official Supabase Storage public URL:
 *    `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/android-app/tripmate-latest.apk`
 */
export function getApkDownloadUrl(): string {
  const customUrl = process.env.NEXT_PUBLIC_TRIPMATE_ANDROID_APK_URL?.trim()
  if (customUrl) return customUrl

  // Return the official Next.js streaming endpoint which merges the Supabase Storage
  // parts into the complete 116MB APK without 404 NoSuchKey or client memory issues
  return '/api/download/tripmate-latest.apk'
}
