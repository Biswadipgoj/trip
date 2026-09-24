# Release Report — TripMate (web + Android app)

Branch `claude/beautiful-turing-ewx9a3` · PR Biswadipgoj/trip#22 · 2026-09-24

## 1. Decision
**NOT RELEASE READY.** Score 58/100 from evidence, **capped at 49** because trip data has no server-side
authorization (T7, pre-existing): anyone holding the public anon key can read and change any trip,
mark payments confirmed and read members' mobile numbers and PINs.

This branch is still safe to merge: it removes a critical supply-chain hole (anyone could replace the
APK), stops bill photos and payment screenshots being deleted, fixes the upload pipeline and the UI,
and regresses nothing that was measured. The product as a whole is not release ready until T7 is fixed.

## 2. Project and stack
Next.js 15.5.26 web on Vercel · Expo SDK 57 / React Native 0.86 Android app via EAS · Supabase
(Postgres + Storage) called directly from both clients with the anon key.

## 3. Integrations
BISWODIP-ENGINEERING-skills v2.2.0 installed; `verify` 86/89 (Headroom and Strix CLIs installed later;
Docker not running). Strix: BLOCKED (no Docker daemon, no LLM key).

## 4. What was inspected
`BASELINE.md` (tsc/tests green before changes), `THREAT-MODEL.md`, Playwright screenshots of every web
and app screen at 390 px and 1280 px (`screens/`).

## 5. What changed and why
See `PLAN.md` §2–3 and the PR description. In short: storage policies and APK distribution locked down;
images kept when a trip closes; web image compression, FK-aware linking, dead-URL handling and
interrupted-upload repair; app image fallback and file-cache fix; debug UI removed; phone layouts,
money format, download page contrast and copy, PDF export fixed; perpetual animations removed;
critical dependencies patched; committed API keys removed from HEAD.

## 6. Architecture and trust-boundary decisions
No new services. Server-side controls added where they exist today: Storage RLS and a table CHECK.
The client-only authorization model is recorded as T7, not redesigned in this change.

## 7. Verification — evidence matrix
| Requirement | Implementation | Procedure | Result | Evidence | Status |
|---|---|---|---|---|---|
| AC1 no Live/debug UI in app | `mobile/src/app/(tabs)/dashboard.tsx`, `_layout.tsx` | grep + screenshot | 0 matches; badge gone | `screens/after-app-dashboard.jpg` | VERIFIED |
| AC2 crash screen hides errors | `mobile/src/app/_layout.tsx` (`__DEV__`) | code review | message only in dev | commit 848da3a | VERIFIED (review) |
| AC3 no `/debug` links on web | members, join-trip pages | `grep -rn /debug src/app` | 0 | VERIFY-commands.txt | VERIFIED |
| AC4 web photo prep | `src/lib/image.ts` | 10 unit tests + Chromium form run | 7.25 MB → 1600×1200, 273 KB; PDF refused | `web-bill-browser-check.txt` | VERIFIED |
| AC5 no dead blob URLs after reload | `recoverAfterReload` in `src/lib/store.ts` | unit test | passes | `src/lib/__tests__/attachments.test.ts` | VERIFIED |
| AC6 FK-aware link + retry | `linkAttachment` | unit tests (11/13 fail on old store) | passes | `web-attachments-old-code.txt` | VERIFIED |
| AC7 sync never links unstored images | `pushTripToRemote` | unit tests | passes | attachments.test.ts | VERIFIED |
| AC8 app re-checks missing files | `mobile/src/lib/uploads.ts` | unit test | passes | `mobile/__tests__/uploads.test.ts` | VERIFIED |
| AC9 local → public → signed → placeholder | `AttachmentViewer.tsx`, `AttachmentImage.tsx` | code + source-order tests | passes | uploads.test.ts | PARTIAL (signed-URL path not run against live Supabase) |
| AC10 no overlaps at 390 px | payments/expenses/members | before/after screenshots | fixed | `screens/` | VERIFIED |
| AC11 money 0 or 2 decimals | `formatCurrency`, `formatIndianNumber` | unit tests both apps | passes | utils tests | VERIFIED |
| AC12 storage policies | `20260925_harden_storage.sql` | PostgreSQL 16 as `anon`, old vs new | 20/20; old fails T1 | `sql-policy-test.txt` | VERIFIED (local Postgres, stub storage schema) |
| AC13 upload script needs service key | `scripts/upload-apk-to-supabase.mjs` | run without key | exit 1, no JWT in repo | VERIFY-commands.txt | VERIFIED |
| AC14 gates | — | clean checkout: npm ci, tsc, lint, tests, `next build`, `expo export -p android` | all exit 0; web 83, mobile 36 tests | VERIFY-commands.txt | VERIFIED |
| Images survive trip close | migration + both stores | SQL test + unit tests | kept | sql-policy-test.txt, uploads.test.ts | VERIFIED (live DB needs the migration run) |
| PDF export readable | `src/lib/pdfText.ts` | unit + browser export | 24 lines, 0 garbled | `pdf-export-check.txt` | VERIFIED |
| Upload to live Supabase | — | — | no credentials here | — | UNVERIFIED |
| App on a real Android phone | — | — | no EAS login / device | — | BLOCKED |

## 8. Security testing
`SECURITY-REVIEW.md` (status per control) and `PENTEST.md`. Strix BLOCKED; manual pass on local targets.

## 9. Findings and fixes
| ID | Severity | Status |
|---|---|---|
| T1 anon can overwrite the release APK | Critical | Fixed (migration) — owner must run it |
| Images deleted when a trip closes | High (data loss) | Fixed (code + migration) — owner must run it |
| NVIDIA keys committed in `scripts/` | High | Removed from HEAD — **owner must revoke**; still in history |
| next 15.3.8 / jspdf 3 critical advisories | Critical | Fixed (15.5.26, 4.2.1) |
| ADV-1 attachment path traversal | Medium | Fixed (CHECK + client guard), exploit re-run denied |
| T3/T4 broad storage delete/insert | Medium | Fixed |
| T5 error detail leak | Low | Fixed |
| T6 wrong APK length header | Medium | Fixed |
| T7 no server-side authorization | Critical | **OPEN** (pre-existing) |
| postcss inside next (build-time) | High | Accepted until Next 16 upgrade |

## 10. Regression results
Clean checkout at `dc495a4` plus lint fix: web tsc/lint/83 tests/build exit 0; mobile tsc/lint (0 problems)/36
tests/Android export exit 0; SQL 20/20.

## 11. Performance
Perpetual animations removed (`withRepeat` call sites 9 → 1, the loading shimmer); money figures render
without a 1.2 s count; web photos 7 MB → ~0.3 MB before upload. Not measured on a device: frame times UNVERIFIED.

## 12. Design and accessibility
Before/after screenshots in `screens/`. Solid 40 px action buttons with focus rings, labelled file inputs
and image buttons, lightbox with Escape and focus return, 16 px inputs on touch, reduced motion
respected. No screen-reader session: PARTIAL.

## 13. Score by category (evidence-backed)
| Category | Weight | Score /10 | Points | Basis |
|---|---:|---:|---:|---|
| Security | 25 | 3 | 7.5 | Storage + supply chain fixed; T7 open |
| Correctness / business integrity | 20 | 7 | 14 | Parity + pipeline tests; payment state client-owned |
| Reliability / failure handling | 15 | 7 | 10.5 | Retries, repair, fallbacks tested; live Supabase unverified |
| Test / evidence quality | 15 | 7 | 10.5 | 139 automated checks, browser runs; no device |
| Architecture / maintainability | 10 | 7 | 7 | Small, documented changes |
| Performance | 5 | 5 | 2.5 | Loops removed; no device measurement |
| Accessibility / responsive UX | 5 | 5 | 2.5 | Fixes applied; no assistive-tech run |
| Design / interaction | 5 | 7 | 3.5 | Screenshot-verified |
| **Total** | | | **58** | **Capped at 49** (authorization bypass, T7) |

## 14. Release blockers (§33)
critical vulnerability — **yes** (T7) · exposed secret — **yes** until the NVIDIA keys are revoked ·
browser-accessible privileged credential — no · broken authorization / cross-tenant access /
client-authoritative financial decision / unsafe financial transition / authentication bypass — **yes** (T7) ·
known data-loss condition — fixed in code; **live until the migration is run** · unrecoverable migration — no ·
unbounded resource exhaustion — UNVERIFIED · disabled control — no · security regression — no ·
production debug functionality — no (removed) · unverified critical requirement — live upload UNVERIFIED ·
fabricated evidence — no.

## 15. Remaining risks, BLOCKED and UNVERIFIED items
T7 (OPEN) · Strix (BLOCKED) · on-device APK (BLOCKED) · live Supabase upload and signed URLs (UNVERIFIED) ·
postcss inside Next (accepted until Next 16) · NVIDIA keys in git history (owner revokes).

## 16. Evidence locations
`.biswodip/evidence/`: BASELINE, THREAT-MODEL, PLAN, SECURITY-REVIEW, PENTEST, VERIFY-commands,
sql-policy-test, web-bill-browser-check, pdf-export-check, web-attachments-old-code, screens/,
security-gates-*/. Tests: `src/lib/__tests__/`, `mobile/__tests__/`, `supabase/tests/`.

## 17. Operational notes
1. Run `supabase/migrations/20260925_harden_storage.sql` in the Supabase SQL editor (idempotent; rollback
   block at the end). Until then closing a trip still deletes its images on the server.
2. Revoke both NVIDIA API keys that were in `scripts/`.
3. App: `npx eas-cli@latest update --channel preview` reaches every phone on 4.0.1 (JS-only change), or
   build a new APK (`--profile preview`, versionCode 402) and upload it with `SUPABASE_SERVICE_ROLE_KEY`.
4. Next: fix T7 — Supabase Auth (or RPC-only access that checks the trip secret server-side) and RLS per trip.
