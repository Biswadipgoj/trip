# Threat model — Phase 3 (scoped to this change set)

Scope: bill photos / UPI payment screenshots (Storage + `attachments`), the Android APK distribution
path, and the client screens touched by this work. The core trip data model is described for context;
its authorization model is pre-existing and is recorded as an open risk, not changed here.

## Assets
| Asset | Where |
|---|---|
| Release APK parts (`tripmate-latest.apk.part1..3`) | Storage bucket `android-app`, streamed by `/api/download/tripmate-latest.apk` |
| Bill photos, UPI payment screenshots (proof that money moved) | Storage bucket `trip-media`, rows in `public.attachments` |
| Trip ledger: members, expenses, settlements (money state) | Postgres `public.*`, allow-all RLS for `anon` |
| Member mobile numbers + 4-digit PINs (login credentials) | `public.members` |
| Supabase anon key | Shipped in web JS bundle and APK — public by design |

## Actors
- **A1 Anonymous internet user** holding the public anon key (trivially extracted from the web bundle).
- **A2 Trip member** (knows trip code + password) acting maliciously, e.g. faking a payment proof.
- **A3 Compromised/abused upload script** run with the anon key.

## Trust boundaries
Browser and Android app are outside every boundary. There is no application server: clients call
Supabase REST/Storage directly, so **Postgres RLS and Storage policies are the only server-side controls.**

## Rows
| # | Asset | Actor | Entry point | Abuse case | Impact | Control today | Status → plan |
|---|---|---|---|---|---|---|---|
| T1 | APK parts | A1, A3 | `POST/PUT /storage/v1/object/android-app/...` | Overwrite `tripmate-latest.apk.part*` with a trojaned build; `/api/download` streams it to every user with a public cache header | **Critical** — malware distribution to all installers | Policies `android_app_insert` / `android_app_update` allow `anon` → **none** | **MUST CHANGE** — drop anon write policies; upload script requires service-role key |
| T2 | Payment screenshots | A1, A2 | Storage `upsert` on `trip-media/<trip>/payments/<id>.jpg` | Replace another member's proof image after the fact | High — fake proof in a money dispute | `tripmate_media_update` allows `anon` any path in bucket | **MUST CHANGE (compatible part)** — restrict INSERT/UPDATE to the exact path shape of an existing trip. Full immutability would break installed 4.0.1 APKs that upload with `upsert:true` → **ACCEPTED RISK (owner: repo owner)** until old builds are retired; follow-up SQL documented |
| T3 | Bill/proof images | A1 | Storage `DELETE` | Delete every image in the bucket | Medium — evidence loss | `tripmate_media_delete` allows `anon` any object | **MUST CHANGE** — DELETE only objects no `attachments` row references (clients delete the row first) |
| T4 | Upload quota | A1 | Storage INSERT of arbitrary paths/types | Fill bucket with junk under random paths | Low–Medium — cost | bucket 5 MB + image MIME types only | **MUST CHANGE** — path must be `<existing trip uuid>/(bills\|payments\|payment_proofs)/<uuid>.(jpg\|jpeg\|png\|webp)` |
| T5 | Error details | A1 | `/api/download` 500 body; app crash screen | Internal error text leaked to users | Low | `details: String(error)` returned; RN ErrorBoundary prints `error.message` | **MUST CHANGE** — generic messages; details only in logs / `__DEV__` |
| T6 | Download integrity | — | `/api/download` | Hard-coded `Content-Length` disagrees with real part sizes → truncated/corrupt APK ("App not installed") | Medium — broken installs | none | **SHOULD CHANGE** — derive length from the parts' own headers |
| T7 | Trip ledger + credentials | A1 | `anon` REST on `public.*` (allow-all RLS) | Read/modify any trip, read mobile numbers + PINs, mark payments confirmed | **Critical** | none server-side (pre-existing design; see `strix_runs/`) | **OPEN — out of scope** for this change; requires Supabase Auth or RPC-only access with server-side trip-secret checks and a migration of every client. Recorded as a release blocker in SCORE.md |

## Verification plan
- T1/T3/T4/T2-path: apply the migration to a local PostgreSQL 16 with a stub `storage` schema and
  exercise each policy as role `anon` (expected allow/deny recorded in `SQL-POLICY-TEST.md`).
- T5: code review + grep in VERIFY.md. T6: unit-level check of the length derivation.
- T7: not verified — status stays OPEN.
