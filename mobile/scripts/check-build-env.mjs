// Runs on EAS before `npm install` (the `eas-build-pre-install` hook).
// A production APK without the Supabase settings would silently run in
// single-phone mode with no cloud sync, so refuse to build one.
const profile = process.env.EAS_BUILD_PROFILE ?? ''
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_WEB_URL']

if (profile !== 'production' && profile !== 'preview') process.exit(0)

const missing = required.filter(name => !(process.env[name] ?? '').trim())
const badUrl = !/^https:\/\/\S+\.supabase\.co\/?$/.test(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
const badKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim().length < 20

if (missing.length || badUrl || badKey) {
  console.error(`\n✖ TripMate ${profile} build is missing its cloud settings.`)
  if (missing.length) console.error(`  Not set: ${missing.join(', ')}`)
  if (!missing.includes('EXPO_PUBLIC_SUPABASE_URL') && badUrl) console.error('  EXPO_PUBLIC_SUPABASE_URL must look like https://<ref>.supabase.co')
  if (!missing.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY') && badKey) console.error('  EXPO_PUBLIC_SUPABASE_ANON_KEY looks too short')
  console.error(`  Set it once with:\n    npx eas-cli@latest env:create --environment ${profile} --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon or publishable key> --visibility plaintext\n`)
  process.exit(1)
}
console.log(`✔ TripMate ${profile} build: cloud settings present (${process.env.EXPO_PUBLIC_SUPABASE_URL})`)
