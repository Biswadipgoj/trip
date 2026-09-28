# Release Gate — TripMate web + Android (2026-09-28)

**Status: NOT RELEASE READY** — score 58/100, capped to **49** by one open Critical (cross-user data access through the public database key). Everything in this change set passed its gates; the cap comes from the data layer that security stages 2–5 are scheduled to close.

Base: `main` @ `04bcb3f` + this change set. Full command output: `release-run-2026-09-28.log` (local, gitignored).

## What this change set delivers
| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| Android production build makes an **APK, never an AAB** | `mobile/eas.json` production `android.buildType: "apk"` | Resolved with Expo's `@expo/eas-json` validator → `buildType: apk`, `developmentClient: false` | [x] VERIFIED (config) |
| Production APK ships **with** cloud sync | Supabase URL + web URL in `eas.json` base env; `scripts/check-build-env.mjs` as `eas-build-pre-install` refuses production/preview builds without the anon key | Guard run 3 ways: missing key → exit 1, complete → 0, development → 0 | [x] VERIFIED |
| APK actually built on EAS | — | Needs an Expo login / `EXPO_TOKEN`, not available here | [!] BLOCKED |
| Latest Expo SDK, healthy deps | SDK 57, 6 packages aligned to 57.0.25 | `expo-doctor` 21/21; `expo export -p android` exit 0 | [x] VERIFIED |
| Privacy Policy + Terms on web and app | `src/lib/legal.ts` (+ identical mobile copy), `/privacy`, `/terms`, app screens, footer links, consent line on create/join | Parity test; axe 0 violations; app screens rendered in browser run | [x] VERIFIED |
| Android login = web (mobile → live-first trips → PIN) | `mobile/src/app/login.tsx`, `mobile/src/lib/tripLogin.ts` | Parity test; exported app vs PostgreSQL + PostgREST: 9/9 | [x] VERIFIED (web render) · [?] UNVERIFIED on a physical Android device |
| SEO: correct domain, per-page canonicals, honest structured data | `src/config/site.ts`, layouts, sitemap, robots, OG image | `next start`: 10 pages 200 with own canonical on www.tripmate.boats; sitemap/robots correct; OG 1200×630 | [x] VERIFIED |
| SEO guide pages | `src/lib/guides.ts`, 3 routes | Worked example == settlement engine (unit test); FAQPage + BreadcrumbList JSON-LD parse | [x] VERIFIED |
| Session refresh race (found in this gate) | `SessionService.refresh` rotates at most once per grace window; middleware declines prefetches | Failing unit tests written first (2 red → green); e2e 29/29 ×4 consecutive | [x] VERIFIED |

## Defects found and fixed during the gate
1. **Live site told Google its address was `tripmate.app`** (canonical + sitemap). Fixed; every public page now self-canonicalises on `https://www.tripmate.boats`.
2. **Every page's canonical pointed at the home page** (root layout). Fixed with per-route canonicals.
3. **Fabricated structured data** — `AggregateRating 4.9 / 1,280` with no ratings behind it (Google spam policy). Removed, with the unowned `@tripmate` handle and the "iOS" claim.
4. **Production EAS build would ship without cloud config** (`.env` is not uploaded). Fixed + guarded.
5. **Refresh-token race could log users out** under parallel requests (rotation A→B→C while a request with A is in flight). Reproduced in a unit test, fixed at the root.
6. **Contrast failures** on `/`, `/login`, `/create-trip`, `/join-trip` (ratios 2.59–4.37 vs 4.5 required). Fixed; axe 0 violations on all 10 public pages.
7. **Reduced motion ignored on the web** (framer-motion + infinite CSS spin). Fixed with `MotionConfig reducedMotion="user"` and a CSS media rule; measured: spin `8s × infinite` → `0.01ms × 1`.
8. App creator card still said "Mastermind" / "Visit Owner"; logout copy referenced trip codes. Fixed.

## Verification (final run, all exit 0)
web typecheck · web lint · web unit **118/118** · clean `next build` · mobile typecheck · mobile lint · mobile unit **45/45** · `expo-doctor` **21/21** · `expo export -p android` · SQL storage **20/20** · SQL PINs **16/16** · e2e auth **29/29** (four consecutive runs) · axe WCAG 2.2 AA **0 violations × 10 pages** · 320px reflow **0px overflow × 10 pages** · keyboard walkthrough of `/login` (logical order, visible focus, Enter submits, error `role=alert`) · reduced motion measured.

Secret scan: 0 hits for secret keys / service-role JWTs / private keys in `.next/static`, the Android bundle, or the git tree.

## Absolute blockers
| Blocker | Answer | Evidence |
|---|---|---|
| Cross-user / cross-tenant access | **YES** | RLS policies `tripmate_*_all` (`supabase/migrations/20260928_production_security_hardening.sql` ~L778+) allow the anon key to read/write every trip's rows (members' names, mobile numbers, UPI IDs, expenses). The key is public in every browser and APK. |
| Broken authorization | **YES** (same root cause) | Server-side login exists, but the data API does not use it. |
| Client-authoritative financial decision | **YES** (same root cause) | Expenses/settlements are written directly by clients without server validation. |
| Exposed production secret | Contained, not rotated | A service-role key was pasted into chat on 2026-09-28; a new `sb_secret_` key is in use. The legacy key stays valid until legacy keys are disabled (stage 5). |
| Authentication bypass / privileged endpoint / debug functionality / disabled control | No | e2e 29/29; no debug routes found |
| Known data-loss condition | No new one | Offline edits are lost only if app data is cleared before sync (documented in Terms). |
| Fabricated test evidence | No | All results above are from recorded commands. |

## Accepted / open items
- [ ] OPEN (High, not reachable at runtime): PostCSS ≤ 8.5.22 inside Next 15.5.26 (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q). Build-time only on our own CSS; fix requires Next 16. Owner acceptance needed.
- [ ] OPEN (Moderate ×15): Expo tooling deps (`decode-uri-component`, `uuid`). Track Expo SDK patch releases.
- [!] BLOCKED: EAS APK build and install on a real Android phone (needs Expo credentials + a device).
- [?] UNVERIFIED: login against the live Supabase project; backup **restore** test; monitoring/alerting (none configured).

## Score (evidence-based, 0–10 × weight)
Security 3 → 7.5 · Correctness 7 → 14 · Reliability 6 → 9 · Tests/evidence 8 → 12 · Architecture 6 → 6 · Performance 3 → 1.5 · Accessibility 8 → 4 · Design 7 → 3.5 = **57.5 → capped at 49** (unresolved Critical: cross-user access).

## Path to RELEASE READY
1. Stage 2: move all trip reads/writes behind `/api/*` with the cookie session (server-authoritative money writes).
2. Stage 4: Android app on the same API with tokens in `expo-secure-store`; ship the new APK.
3. Stage 5: revoke anon on all tables, drop `tripmate_*_all`, disable legacy API keys (kills the leaked key); SQL tests prove anon gets nothing.
4. Build the APK on EAS, install on a real phone, run the login + sync checklist.
5. Add error monitoring and test a backup restore.

## Addendum — round 3 (same day)
| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| Settle by **UPI or cash** (web + app) | `PaymentMethod` on `Settlement`; `payment_method` column (`20261001_settlement_payment_method.sql`, falls back if not yet run); web "Paid by UPI" / "Paid in cash"; app buttons + cash confirm, badge "Paid · Cash" | Store tests web 3 + app 1 (method survives regeneration, confirmation, sync; cleared on undo/amount change); migration applied twice on PostgreSQL 16 (check constraint rejects other values); browser run: cash → "Paid · Cash" | [x] VERIFIED |
| Only the owner's name, no other details | Legal text: no website link, no location; page data author without URL | Parity test; grep | [x] VERIFIED |
| "No Play Store account needed" removed | home, download page, Terms | grep: 0 mentions in src/ and mobile/src | [x] VERIFIED |
| Logo wherever "TripMate" is shown | share image (real logo), legal + guide headers (web), app legal screens | OG PNG 1200×630 inspected; tsc/lint | [x] VERIFIED |
| Copy pass (no AI slop) | legal, guides, creator card, OG | colon reveals, em dashes in titles, "actually", unverifiable portfolio claim removed | [x] VERIFIED |
| Contrast on trip screens | `text-white/60→/75`, `/50→/70` (122 uses), StatusBadge -400→-700 text, Log out rose-700, confirm button emerald-700, pie charts labelled + out of Tab order | axe WCAG 2.2 AA: 0 violations on dashboard, expenses, members, report, payments (due + paid) and 10 public pages | [x] VERIFIED |

Final run (all exit 0): web unit **121/121**, clean build, app **46/46**, `expo-doctor` 21/21, `expo export -p android`, SQL 20/20 + 16/16, e2e auth **29/29**.

APK build: [!] BLOCKED here by design — the production APK must be signed with the key EAS already holds for `com.tripmate.app`; a locally signed APK could not update existing installs. Owner runs `cd mobile && npm run build:apk`.

Release status unchanged: **NOT RELEASE READY** (cap 49: cross-user data access through the anon key; stages 2–5).
