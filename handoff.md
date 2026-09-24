# Handoff — trip-expense-manager

_Last updated: 2026-09-24T22:24:32.777Z_

Read this first. Verify section 2 against the repository (`git status`, run the build) before trusting it, then continue from section 6.

## 1) Goal

<!-- biswodip:goal -->

_What are we trying to achieve, in the user's terms? Acceptance criteria, and what is explicitly out of scope. This section rarely changes._

- **Objective:** a TripMate Android app (Expo, `mobile/`) and web (Next.js, `src/`) the owner can hand to a trip group: no debug surfaces ("Live" section), bill photos and UPI screenshots that always show and reach every member, readable layouts on phones. Use the BISWODIP-ENGINEERING-skills system fully (installed in `.claude/`).
- **Acceptance criteria:** AC1–AC14 in `.biswodip/evidence/PLAN.md` §4 (all VERIFIED except AC9 PARTIAL — signed URLs not run against live Supabase).
- **Out of scope:** redesigning authorization (T7, see THREAT-MODEL.md); building/publishing the APK (needs the owner's EAS login).

## 2) Current state

<!-- biswodip:state -->

<!-- biswodip:auto:start -->

> Facts below are refreshed by `biswodip handoff update`. Everything outside this block is written by hand — do not let the tool own your reasoning.

- **Branch / commit:** `claude/beautiful-turing-ewx9a3` @ `dc495a4` — fix(security): attachment rows must point inside their own trip folder (ADV-1)
- **Last commit at:** 2026-09-24T22:19:26+00:00 · unpushed commits: 0
- **Uncommitted changes:** 3

| State | File |
|---|---|
| `M` | `mobile/src/app/index.tsx` |
| `??` | `.biswodip/evidence/RELEASE-REPORT.md` |
| `??` | `handoff.md` |

**Recent commits**

- `dc495a4 fix(security): attachment rows must point inside their own trip folder (ADV-1)`
- `4cc0669 fix(security,report): patch critical deps, remove committed API keys, readable PDF`
- `992bdac fix(ui): readable layouts on phones for web and app, honest copy`
- `848da3a fix(app): remove debug surfaces, reliable bill photos, calmer motion`
- `b39c69e fix(web): make bill photos and UPI screenshots upload and display reliably`
- `5e41566 fix(security): lock down APK and bill-photo storage, keep images when a trip closes`
- `244664c docs(evidence): baseline, threat model and plan for app/web hardening`
- `94b05df chore(skills): install BISWODIP-ENGINEERING-skills v2.2.0, remove previous ECC kit`

**Integrations**

- Taste Skill: PRESENT c184364c5865
- Emil Kowalski Skills: PRESENT d16ebe60d09a
- Headroom: PRESENT df8ebdf97da6
- Strix: PRESENT ae38fe70cd02
- No AI Slop: PRESENT 000650b15698

**Evidence:** 33 commands logged in `.biswodip/evidence/commands.log`
  - `2026-09-24T22:15:35.575Z · exit=1 · 1282ms · npm audit --json --omit=dev`
  - `2026-09-24T22:15:37.715Z · exit=0 · 2138ms · npm run lint`
  - `2026-09-24T22:15:40.392Z · exit=0 · 2676ms · npm run typecheck`
  - `2026-09-24T22:15:42.194Z · exit=0 · 1802ms · npm run test`
  - `2026-09-24T22:16:08.934Z · exit=0 · 26740ms · npm run build`

**Gate reports**

- `.biswodip/evidence/security-gates-2026-09-24T22-00-46-898Z/report.md`
- `.biswodip/evidence/security-gates-2026-09-24T22-15-34-127Z/report.md`

_Refreshed 2026-09-24T22:24:32.776Z_

<!-- biswodip:auto:end -->

_Where things actually stand. Statuses only from evidence: VERIFIED / PARTIAL / UNVERIFIED / BLOCKED / OPEN._

- **Lifecycle phase:** 13 release — report written (`.biswodip/evidence/RELEASE-REPORT.md`): **NOT RELEASE READY** (58/100, capped at 49 by T7). PR Biswadipgoj/trip#22; owner asked for it to be auto-merged when done.
- **Builds / tests (clean checkout of `dc495a4`):** web `npm ci` 0 · `tsc` 0 · `next lint` 0 · `vitest` 83 passed · `next build` 0; mobile `npm ci` 0 · `tsc` 0 · `expo lint` 0 (0 problems after the index.tsx fix) · vitest 36 passed · `expo export -p android` 0 (7.5 MB hbc); `bash supabase/tests/run-storage-policy-test.sh` 20/20.
- **Known broken / open:** T7 no server-side authorization (OPEN). Strix BLOCKED (no Docker daemon, no `STRIX_LLM`/`LLM_API_KEY`). Live Supabase and on-device checks UNVERIFIED/BLOCKED (no credentials, no EAS login). `expo-doctor` 19/21 — the two failures are the sandbox proxy blocking Expo's API.

## 3) Active files

<!-- biswodip:files -->

_The few files in play, each with its role and state. Paths, not prose. Mark anything that must not be touched._

| File | Role | State |
|---|---|---|
| `supabase/migrations/20260925_harden_storage.sql` | storage policies, path CHECK, drops trip-close image deletion | done — **owner must run it** |
| `supabase/tests/run-storage-policy-test.sh` | policy test on local PostgreSQL (`pg_ctlcluster 16 main start`) | 20/20 |
| `src/lib/store.ts` (addAttachment, retryAttachment, linkAttachment, healInterruptedAttachment) | web upload pipeline | done, tested |
| `src/lib/image.ts`, `src/lib/media.ts`, `src/components/attachments/AttachmentViewer.tsx` | web photo prep + display fallback | done |
| `mobile/src/lib/uploads.ts`, `mobile/src/components/attachments/AttachmentImage.tsx` | app image sources + fallback | done |
| `src/lib/utils.ts` money functions, `mobile/src/lib/utils.ts` money functions | settlement maths | **do not change** without the parity test (`mobile/__tests__/parity.test.ts`) |
| `.biswodip/evidence/*` | plan, threat model, review, pentest, report | current |

## 4) Changes made

<!-- biswodip:changes -->

_What actually changed, in order, and why. Commands run with exit codes. Evidence paths._

1. `94b05df` skills installed (v2.2.0), old ECC `.agents/` kit and empty gitlinks removed.
2. `244664c` BASELINE, THREAT-MODEL, PLAN.
3. `5e41566` storage hardening migration + policy test; upload script needs the service-role key; download route length/errors.
4. `b39c69e` web image pipeline (compression, blob URLs, FK-aware link, heal, signed-URL fallback, payments/ folder).
5. `848da3a` app: Live badge, crash text, offline copy; AttachmentImage; file cache; images kept on close; motion pass (no perpetual loops, instant tabs, opt-in haptics).
6. `992bdac` UI: payment cards (both), expense overflow, members money, download page `white` remap + copy, mobile-native CSS, money decimals.
7. `4cc0669` next 15.5.26, jspdf 4.2.1, postcss; NVIDIA keys removed from `scripts/`; PDF `pdfSafe`; versionCode 402; package name on download page.
8. `dc495a4` ADV-1 path CHECK + client `isSafeMediaPath`; SECURITY-REVIEW, PENTEST, gate reports.
9. (this commit) landing `useMemo` lint warnings, RELEASE-REPORT, handoff.

## 5) Failed attempts

<!-- biswodip:failed -->

_What was tried and did not work, with the error — not "didn't work". This is what stops the next session burning context on your dead ends._

- `rm -rf` of the old install and the skills clone was refused by the auto-mode classifier → re-cloned the latest skills into `/home/user/biswadipgoj/skills-latest` and installed with `--update` (skills byte-identical to commit `288245d`).
- `expo start` with `CI=1` does not watch files → screenshots showed the old UI. Restart it (`--clear`) after edits.
- `pkill -f "expo start"` killed the shell running it (exit 144) → kill by PID from `ps -eo pid,args`. `ss` is not installed.
- Running `next build` / upgrading Next while `next dev` ran broke the dev server (download test timed out) → stop dev, `rm -rf .next`, restart.
- `npm audit fix` crashes (`Cannot read properties of null (reading 'edgesOut')`) → targeted `npm update <pkg>` / explicit installs. `vitest@4.1.11` install conflicts; vitest 5 is a major → left on ^4.1.8 (moderate, dev-only).
- Pillow is not installed → generate test images with `sharp` from the root `node_modules`.
- Playwright `getByRole('alert')` matched Next's empty route announcer → read `[role=alert]` texts instead.
- Regex removal of `delay`/`duration` props missed multi-line JSX with `>` in expressions (analytics.tsx) → removed those lines by hand.

## 6) Next steps

<!-- biswodip:next -->

_Ordered, specific, immediately actionable. First item should be runnable now. Include questions blocked on the user._

1. Owner: run `supabase/migrations/20260925_harden_storage.sql` in the Supabase SQL editor (until then closing a trip still deletes its images on the server).
2. Owner: revoke the two NVIDIA API keys that were committed in `scripts/` (still in git history).
3. Owner: ship the app — `cd mobile && npx eas-cli@latest update --channel preview` (JS-only; reaches 4.0.1 installs) or `npx eas-cli@latest build -p android --profile preview` (versionCode 402), then `SUPABASE_SERVICE_ROLE_KEY=… npm run upload:apk`.
4. Verify on a phone: add an expense with a bill photo, open it on a second phone and on the web; mark a payment paid with a screenshot; close the trip and check the images remain.
5. Fix T7: Supabase Auth (or RPC-only writes that check the trip password/PIN server-side) + per-trip RLS; then re-run the release gate.
6. Run Strix once Docker and an LLM key are available (`.claude/skills/biswodip-pentest`).
7. Plan Next 16 upgrade (clears the remaining postcss/next advisories).

---

_Maintained with the Biswodip Goj Unified Engineering system (`biswodip handoff update`). No secrets in this file — reference the environment variable name instead._
