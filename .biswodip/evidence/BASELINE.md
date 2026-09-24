# Baseline — Phase 2 (Inspect)

Date: 2026-09-24 · Branch: `claude/beautiful-turing-ewx9a3` · Base commit: `cb649a8` (+ `94b05df` skills install)

## Identity
TripMate — group trip expense splitter. Web (Next.js 15, `src/`, Vercel) and Android app
(Expo SDK 57 / RN 0.86, `mobile/`, EAS builds). Both talk directly to Supabase (anon key,
allow-all RLS) — there is no application server. Money flow: expense splits → net balances →
greedy settlement routes → UPI deep links → payer marks paid → receiver confirms.
Media: bill photos and UPI payment screenshots → Supabase Storage bucket `trip-media` + `attachments` table.

## Commands and results (before any change)

| Check | Command | Result |
|---|---|---|
| Web typecheck | `npx tsc --noEmit` (root) | exit 0, 0 errors |
| Mobile typecheck | `cd mobile && npx tsc --noEmit` | exit 0, 0 errors |
| Web unit tests | `npx vitest run` | 4 files, **50 passed** |
| Mobile unit tests | `npx vitest run --config mobile/vitest.config.mts` | 3 files, **28 passed** |
| Integrations | `biswodip.mjs verify --root .` | 86/89 VERIFIED, 3 UNVERIFIED (Headroom/Strix CLIs, Docker), 0 FAILED |

Pre-existing failures: none.

## Visual audit (Playwright, seeded trip, 390×844 phone and 1280 desktop)
Screenshots: scratchpad `before/` (app via Expo web) and `before2/` (web, scrolled). Findings feed PLAN.md.

## Trust boundaries (for 03-threat-model)
`USER → Next.js client / RN app → Supabase REST + Storage (anon key) → Postgres (RLS allow_all)`.
Every client holds the anon key; authorization is by knowledge of trip code + password/PIN, enforced
client-side only. This is a pre-existing architectural property (see Strix reports in `strix_runs/`),
recorded here, not changed by this work.

## Secrets
Supabase URL/anon key come from `NEXT_PUBLIC_SUPABASE_*` (Vercel) and `EXPO_PUBLIC_SUPABASE_*` (EAS env).
None are present in this container (names checked, values never read). Live Supabase cannot be probed from here.
