// Runs on EAS before `npm install` (the `eas-build-pre-install` hook).
// A production APK without the server URL would silently run in single-phone
// mode with no cloud sync, so refuse to build one.
const profile = process.env.EAS_BUILD_PROFILE ?? ''
if (profile !== 'production' && profile !== 'preview') process.exit(0)

const url = (process.env.EXPO_PUBLIC_WEB_URL ?? '').trim()
if (!/^https:\/\/[^/\s]+$/.test(url)) {
  console.error(`\n✖ TripMate ${profile} build is missing its server URL.`)
  console.error('  EXPO_PUBLIC_WEB_URL must be the site origin, e.g. https://www.tripmate.boats (no trailing slash).')
  console.error('  It is set in mobile/eas.json under build.base.env.\n')
  process.exit(1)
}
console.log(`✔ TripMate ${profile} build: syncs through ${url}`)
