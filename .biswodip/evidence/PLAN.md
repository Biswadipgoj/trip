# Plan — TripMate Android + web: remove debug UI, fix bill images, fix UI, harden

Phases run: 0 bootstrap · 1–2 inspect (BASELINE.md) · 3 plan (this file) · 4 threat model (THREAT-MODEL.md) ·
5 implement · 6 verify · 7 design · 8 performance · 9 security review · 10 pentest · 11 fix · 12 regression ·
13 score · 14 release. Evidence for each lands in `.biswodip/evidence/`.

## 1. The request in engineering terms
User (trip organiser, Android + web) reports: the Android app shows a debugging "Live" section, bill images
don't work, and both apps have many UI issues. Goal: an Android app (and web) a trip group can rely on:
no developer surfaces, bill/UPI screenshots that always show and reliably reach every member, readable layouts.

## 2. Root causes found (evidence: code references + screenshots in scratchpad `before*/`)
**Debug surfaces (app):** dashboard hero shows a pulsing "Live Cloud Sync" badge (`(tabs)/dashboard.tsx:178`);
crash screen prints raw `error.message` (`_layout.tsx:120`); offline banner claims changes are saved on the phone
while `cloud.ts` refuses writes offline (false copy). **Web:** members/join pages show "Cloud sync is OFF … Open Sync
Doctor" linking to `/debug`, a route that does not exist (404).

**Bill images — web (most likely cause of "bill image doesn't work"):**
- B-W1 No compression: phone photos (3–8 MB, sometimes HEIC) are uploaded raw; the bucket rejects > 5 MB and
  non-JPEG/PNG/WebP → upload fails.
- B-W2 `localUri` is a `blob:` URL persisted to localStorage; after a reload it is dead, and `getSourceUrl`
  prefers it over the cloud URL → broken image even when the upload succeeded.
- B-W3 The `attachments` row is inserted right after a fire-and-forget expense push → FK race → row insert fails,
  no retry, thumbnail stuck on "Failed".
- B-W4 Sync re-inserts attachment rows whose image never uploaded → other devices get a row pointing at nothing.
- B-W5 Payment-proof folder differs from the app (`payment_proofs/` vs `payments/`).
**Bill images — app:**
- B-A1 `fileExists` caches `false` forever → a thumbnail that was checked once while the file was being moved
  switches to the cloud URL permanently (broken until restart when not yet uploaded).
- B-A2 No load-error fallback: if the public URL fails (private bucket, not yet uploaded) the thumbnail is blank.
**Both:** no signed-URL fallback when the bucket is not public.

**UI (screenshots):** app expenses — long payer name overlaps amount/date; FAB covers last card. App payments —
names break mid-word ("Biswod / ip Goj"). App dashboard — hero is a grey block when the remote photo can't load.
Web payments — names truncated to 2 letters on phones. Web members — unformatted money (₹19380), truncated
helper text. Download page — unreadable "Back" pill, unverifiable claims ("Verified APK", "100% offline").
Money shown as ₹6,682.5 (one decimal) on both.

**Security (THREAT-MODEL.md):** T1 anon can overwrite the APK (critical), T2–T4 trip-media policies too broad,
T5 error detail leaks, T6 hard-coded download length.

## 3. Change set
| Item | Class | Owner file(s) |
|---|---|---|
| Remove Live badge; generic crash screen; truthful offline banner | MUST | `mobile/src/app/(tabs)/dashboard.tsx`, `_layout.tsx`, `(tabs)/_layout.tsx` |
| Web: remove Sync Doctor copy + dead `/debug` links | MUST | `src/app/members/[tripId]/page.tsx`, `src/app/join-trip/page.tsx` |
| Web image compression (≤1600 px JPEG, ≤5 MB guarantee, HEIC → clear error) | MUST | new `src/lib/image.ts`, `src/app/expenses/[tripId]/page.tsx`, `AttachmentViewer.tsx` |
| Web: never persist/prefer dead `blob:` URLs | MUST | `src/lib/store.ts` (persist + source), `AttachmentViewer.tsx` |
| Web: FK-aware row insert with retry; sync only inserts rows whose image is stored | MUST | `src/lib/store.ts` |
| Web: proofs use `payments/` folder | MUST | `src/lib/store.ts` |
| App: don't cache negative file checks | MUST | `mobile/src/lib/uploads.ts` |
| Both: image load fallback (local → public → signed URL → retry placeholder) | MUST | `mobile/src/lib/remote.ts`, new `mobile/src/components/attachments/AttachmentImage.tsx`, `AttachmentStrip.tsx`, `viewer.tsx`; `src/lib/remote.ts`, `AttachmentViewer.tsx` |
| App UI: expense card overflow, FAB clearance, payment card layout, hero fallback | MUST | `(tabs)/expenses.tsx`, `(tabs)/settlements.tsx`, `(tabs)/dashboard.tsx` |
| Web UI: payment card layout on phones, members money format + wrapping, download page contrast/copy | MUST | `src/app/payments/[tripId]/page.tsx`, `src/app/members/[tripId]/page.tsx`, `src/app/download/DownloadPageClient.tsx` |
| Currency: 0 or 2 decimals, never 1 | MUST | `src/lib/utils.ts`, `mobile/src/lib/utils.ts` |
| Storage hardening migration (T1, T3, T4, T2-path) + upload script requires service role | MUST | new `supabase/migrations/20260925_harden_storage.sql`, `supabase/setup_media.sql`, `scripts/upload-apk-to-supabase.mjs`, `supabase/MIGRATION_GUIDE.md` |
| Download route: generic 500, length from parts | SHOULD | `src/app/api/download/tripmate-latest.apk/route.ts` |
| Web: sync when the tab regains focus (bills from phones appear without waiting 5 min) | SHOULD | `src/hooks/useTripSync.ts` |
| App version 4.0.2 / versionCode 402 for the next EAS build | SHOULD | `mobile/app.json`, `mobile/package.json` |
| Make storage objects immutable (drop UPDATE) | OPTIONAL → deferred (breaks installed 4.0.1) | documented only |
| Settlement maths, sync/merge architecture, core schema, auth model (T7) | DO NOT CHANGE | `utils.ts` money functions, `supabase/schema.sql` core tables |

## 4. Acceptance criteria (testable)
- AC1 The app renders no sync/Live/diagnostic element: `grep -rn "cloudSync\|livePulse" mobile/src/app` returns nothing; dashboard screenshot has no badge.
- AC2 Crash screen text contains no `error.message` when `__DEV__` is false (code path reviewed).
- AC3 No web page links to `/debug`: `grep -rn "/debug" src/app` returns nothing.
- AC4 `prepareImageForUpload` (web): a 4000×3000 image → longest side 1600, JPEG; a non-image → rejected with a user message; an image it cannot decode (HEIC on Chrome) that is ≤5 MB in an allowed type uploads as-is, otherwise a clear error. Unit-tested (dimension/decision logic) + browser run.
- AC5 Rehydrated web state never contains a `blob:` `localUri` (unit test on the persist `partialize`).
- AC6 Web `addAttachment`: a row insert failing with FK `23503` is retried and ends `uploaded` once the parent exists (unit test, mocked remote).
- AC7 Web sync never inserts an attachments row whose image upload has not succeeded (unit test).
- AC8 App `attachmentUri` re-checks a file previously reported missing (unit test with mocked fs).
- AC9 Image source order local → public → signed → placeholder with retry, on both clients (code + test of the pure resolver).
- AC10 At 390 px: no overlapping or mid-word-broken names on app expenses/payments and web payments/members (after-screenshots).
- AC11 Money never shows exactly one decimal: `formatCurrency(6682.5)` → `₹6,682.50`, `formatCurrency(100)` → `₹100` (unit test both).
- AC12 Migration on local PostgreSQL 16 with stub `storage`: `anon` INSERT/UPDATE into `android-app` → denied; `anon` INSERT `trip-media/<existing trip>/bills/<uuid>.jpg` → allowed; bad path / unknown trip → denied; DELETE referenced object → denied; DELETE orphan → allowed. Re-running the migration succeeds (idempotent).
- AC13 Upload script exits non-zero without `SUPABASE_SERVICE_ROLE_KEY`; contains no embedded JWT.
- AC14 Gates: web tsc + lint + tests + `next build`; mobile tsc + lint + tests + `expo export -p android` all pass; test counts ≥ baseline (50 web / 28 mobile).

## 5. Test strategy
Unit (vitest, both suites) for AC4–AC9, AC11; SQL policy test on local Postgres for AC12; script check for AC13;
Playwright screenshots (phone + desktop, web + Expo web) for AC1, AC10; build/export gates for AC14.
Pentest: Strix (if Docker + LLM key available — otherwise BLOCKED, recorded) plus a manual adversarial pass
on the storage policies and the download route.

## 6. Rollback
Code: `git revert` of the implementation commits (no data migration in app code; persisted-state changes are
backward compatible — only `blob:` URLs are dropped, which were already dead). Database:
`20260925_harden_storage.sql` ends with a commented **ROLLBACK** block that recreates the previous policies.
Images written meanwhile are unaffected (paths and bucket unchanged).

## 7. Decisions taken without asking (recorded per §39)
- Keep the offline-read / online-write model of the app (cloud.ts); fix the copy to match it rather than change behaviour.
- Keep `upsert:true` uploads and the UPDATE policy (path-restricted) so installed 4.0.1 phones keep uploading.
- Do not bump the web download metadata (`APP_RELEASE`) — it must describe the APK actually in storage; a new APK
  needs an EAS build, which needs the owner's Expo credentials (not in this environment → BLOCKED here).
