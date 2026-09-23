# TripMate for Android

The Expo / React Native app for TripMate — the same trips, money maths and look as the web app
(warm cream + violet → fuchsia liquid glass, Inter + Space Grotesk), built for phones.

- **Same trips as the web** — reads and writes the same Supabase project; balances, settlements and invite
  links are byte-for-byte compatible (enforced by `__tests__/parity.test.ts`, 400 random trips).
- **Bill photos & UPI screenshots** — snap or pick an image, it is compressed (≤1600 px JPEG) and saved on the
  phone first, then uploaded to Supabase Storage in the background with retries. Other members see it live.
- **Settle up in one tap** — "Pay via UPI app" opens GPay/PhonePe/Paytm with the amount filled in, plus a QR
  code; add the payment screenshot and the receiver confirms it.
- **Works offline** — every change is saved on the phone; deletes and edits made offline are queued and synced
  when you are back online (they can never be undone by a stale server copy).
- **Smooth & animated** — drifting liquid backdrop, springy buttons with haptics, count-up numbers, animated
  charts and progress, swipe-to-delete, confetti when a trip is fully settled. Honours "reduce motion".

## 1. One-time Supabase setup

Use the **same Supabase project as the web app**.

1. New project only: run `supabase/schema.sql` in the Supabase SQL editor.
2. Run **`supabase/migrations/20260923_mobile_media.sql`** (safe to run again). It adds the `attachments` table,
   the public `trip-media` storage bucket with upload/delete rules, and atomic write functions.

Without step 2 the app still syncs trips; photos stay on the phone and the sync sheet shows
"Image storage on server: Not set up".

## 2. Environment variables

The app needs the web app's public Supabase values (Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and, for invite links, the web app's URL.

**Local runs** — copy `.env.example` to `.env` (git-ignored) and fill it in.

**EAS cloud builds** — set them once per environment (or in the Expo dashboard → Project → Environment variables):

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL      --value https://xxxx.supabase.co --environment preview    --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>               --environment preview    --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_WEB_URL           --value https://your-app.vercel.app --environment preview --visibility plaintext
# repeat with --environment production for Play Store builds
```

The `preview` build profile uses the `preview` environment and `production` uses `production` (EAS defaults).
Values are baked into the app at build time — rebuild after changing them. Without them the app runs
local-only (one phone), exactly like the web app without Supabase.

## 3. Run it

```bash
cd mobile
npm install
npx expo start          # press "a" for an Android emulator, or scan the QR with Expo Go
```

Expo Go works for most things; the smoother keyboard handling (`react-native-keyboard-controller`) needs a
development build: `npx eas-cli@latest build -p android --profile development`.

## 4. Build the Android app

```bash
npx eas-cli@latest build -p android --profile preview      # installable APK
npx eas-cli@latest build -p android --profile production   # Play Store bundle (AAB)
```

Version 4.0.0 (versionCode 400) adds native modules (camera/gallery, file system, network, print), so it must
be installed as a new build — over-the-air updates don't reach older installs (`runtimeVersion: appVersion`).

## 5. Checks

```bash
npm run typecheck        # TypeScript
npm test                 # unit + web↔mobile parity tests (uses the repo-root vitest)
npx expo-doctor          # dependency / config health
```

`@react-native-async-storage/async-storage` intentionally stays on v3 (excluded from `expo install --check`):
earlier builds stored trips with v3's database, and downgrading would hide that data after an update.

## How sync works

- `lib/sync.ts` — on open, every 15 s in the foreground, on reconnect and on Supabase Realtime events:
  flush the offline outbox → pull the trip → merge → push anything the server is missing → upload images.
- `lib/store.ts` — the web store's logic plus the outbox, self-healing uploads (an expense that reached the
  server without its participants is repaired) and a monotonic payment-status merge.
- `lib/uploads.ts` — pending → uploading → uploaded, exponential backoff, waits until the expense / payment is
  on the server, survives app restarts, and recovers a photo if Android killed the app while the camera was open.
- Tap the **cloud icon** in the top bar for live status: last sync, queued changes, images waiting,
  storage setup, recent activity, "Sync now" and "Retry uploads".

## Project structure

```
mobile/
├── app.json · eas.json · .env.example · vitest.config.mts
├── assets/images/            # launcher, adaptive (fg/bg/monochrome), splash, logo — `npm run icons`
├── scripts/                  # trace-logo.py + generate-icons.mjs (icon pipeline)
├── __tests__/                # parity (web↔mobile) and store/sync tests
└── src/
    ├── app/                  # Expo Router screens
    │   ├── _layout.tsx       # fonts, hydration, splash, providers, toasts, error screen
    │   ├── index.tsx         # landing + trips on this phone
    │   ├── create-trip.tsx · join-trip.tsx · login.tsx
    │   ├── (tabs)/           # dashboard · members · expenses · settlements (Payments) · analytics (Report)
    │   ├── add-expense.tsx   # expense / hotel stay form + bill photos
    │   ├── payment-modal.tsx # settle a payment: UPI app, QR, screenshot, confirm
    │   └── viewer.tsx        # full-screen photo viewer (zoom, retry, delete)
    ├── components/           # ui/ (glass, text, buttons, charts, sheets…), animated/, attachments/
    ├── lib/                  # store, sync, uploads, media, remote, hooks, utils, toast, dialogs
    ├── theme/                # colors, typography, spacing (ported from the web's Tailwind theme)
    └── types/
```
