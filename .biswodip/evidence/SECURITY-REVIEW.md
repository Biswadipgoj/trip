# Security review — Phase 8

Scope: branch `claude/beautiful-turing-ewx9a3` (web `src/`, app `mobile/`, `supabase/`, `scripts/`).
Status syntax: `[x] VERIFIED` · `[~] PARTIAL` · `[!] BLOCKED/OPEN` · `[?] UNVERIFIED` · `[N/A]`.
Automated gates: `security-gates-2026-09-24T22-00-46-898Z/` (before) and `security-gates-2026-09-24T22-15-34-127Z/` (after).

| Area | Status | Evidence |
|---|---|---|
| Secrets — committed keys | `[x]` removed from HEAD · `[!]` still in git history | 10 files in `scripts/` held two NVIDIA API keys (gate G1, 8 findings). Now `process.env.NVIDIA_API_KEY` / `os.environ["NVIDIA_API_KEY"]`; `grep -rE "nvapi-[A-Za-z0-9_-]{8,}" scripts src mobile/src` → 0. History rewrite is not ours to do: **owner must revoke both keys**. |
| Secrets — Supabase | `[x]` | Only the anon key is shipped (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`), public by design. Embedded anon JWT fallback removed from `scripts/upload-apk-to-supabase.mjs`; script exits 1 without `SUPABASE_SERVICE_ROLE_KEY` (AC13). `grep SERVICE_ROLE src mobile/src` → no client reference. |
| Secrets — gate false positive | `[N/A]` | `src/lib/__tests__/adversarial.test.ts:22` is a fake password fixture that asserts invite tokens never contain the password. |
| Authentication | `[!]` OPEN (pre-existing, T7) | No server-side identity: trip code + password / mobile + PIN are compared on the client against rows any anon caller can read. Out of scope; release blocker. |
| Authorization — storage | `[x]` | `supabase/migrations/20260925_harden_storage.sql`; 17 checks as role `anon` on PostgreSQL 16 (`sql-policy-test.txt`): APK write/update/delete denied, bad/unknown-trip/traversal/non-image paths denied, referenced image delete denied; the old policies fail T1. |
| Authorization — tables | `[!]` OPEN (T7) | `allow_all_*` RLS for `anon` on every trip table (`supabase/schema.sql`). Any key holder can read/modify any trip, mark payments confirmed, read mobile numbers + PINs. |
| Database | `[x]` | supabase-js builds parameterised requests; `attachments` has `attachment_target` and `attachment_path_in_trip` CHECKs; atomic `tm_push_*` RPCs. |
| Money | `[~]` | Gate G2 flags 10 float reads (`parseFloat(row.amount)`). Stored as `NUMERIC(12,2)`; client maths rounds to paise (`roundMoney`) and web↔app parity is tested over 400 random trips (`mobile/__tests__/parity.test.ts`). Payment status transitions are client-decided (T7). Display fixed to 0 or 2 decimals (AC11). |
| Webhooks | `[N/A]` | None in the codebase. |
| API — `/api/download*` | `[x]` | No request input is used; part URLs come from env/constant (no SSRF surface). 503 with a plain message instead of `details: String(error)`; length from real part sizes (`src/lib/__tests__/apkParts.test.ts`). |
| API — rate limits | `[?]` | Relies on Supabase/Vercel platform limits; not measured here. |
| Files — uploads | `[x]` / `[~]` | Server: bucket 5 MB + `image/jpeg,png,webp` MIME allowlist + path regex with extension allowlist (no SVG/HTML). Client: re-encode to JPEG ≤1600 px (web: browser check 7.25 MB → 273 KB). Magic bytes are not checked server-side (MIME header is client-supplied) → `[~]`. Names are random UUIDs. |
| Files — downloads/privacy | `[~]` | `trip-media` is a public bucket (unguessable UUID paths). Anon `SELECT` also permits listing folder names; dominated by T7 (the tables themselves are world-readable). |
| Errors | `[x]` | App crash screen shows `error.message` only in `__DEV__` (`mobile/src/app/_layout.tsx`); upload errors mapped to plain messages (`uploadErrorMessage` in `src/lib/store.ts`). |
| Logging | `[~]` | `logSync` records tags/messages, no secrets observed; no server-side audit trail (no server). |
| Supply chain | `[~]` | Lockfiles committed. Web `npm audit`: critical 2→0, high 6→1 (postcss bundled in `next`, build-time CSS only; fix = Next 16 major), moderate: next (needs 16), vitest dev. Mobile: 0 high/critical, 15 moderate. No CI workflows in repo (`N/A` for action pinning). |
| Privacy | `[!]` OPEN (T7) | Mobile numbers and PINs readable by any anon caller; payment screenshots in a public bucket. |
| AI features | `[N/A]` | The shipped apps have none. `scripts/` call NVIDIA-hosted LLMs for developer scans only. |

## Result
Changed code: no new `High`/`Critical` finding. Pre-existing **T7 (no server-side authorization on trip data)** remains `OPEN` and caps the release score.
