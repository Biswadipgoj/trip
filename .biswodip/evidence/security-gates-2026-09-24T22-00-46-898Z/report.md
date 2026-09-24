# Security Gates Report

- Generated: 2026-09-24T22:01:38.527Z
- Root: `/home/user/trip`
- Fail threshold: high

> Automated gates are evidence inputs. Release status is decided only by MASTER-PROMPT §31–§35.

## Gates

| Gate | Status | Detail |
|---|---|---|
| G1 Secrets in repository | FAILED | 8 candidate(s), worst medium |
| G2 Code risk hints | UNVERIFIED | 10 hint(s) need manual review |
| G3 Dependency vulnerabilities | FAILED | npm:RAN {"info":0,"low":0,"moderate":1,"high":3,"critical":2,"total":6} |
| G4 Build / lint / types / tests | VERIFIED | npm run lint:VERIFIED · npm run typecheck:VERIFIED · npm run test:VERIFIED · npm run build:VERIFIED |
| G5 Strix authorized pentest | SKIPPED | run with --strix --app-url http://127.0.0.1:<port> |
| G6 Manual gates (MASTER-PROMPT §5–§33) | OPEN | threat model, authorization matrix, adversarial pass and evidence matrix are human/agent work — not automatable |

## Secret candidates

| Severity | Rule | Location | Value (masked) | Tracked |
|---|---|---|---|---|
| medium | generic-secret-assignment | `scripts/list_nvidia_models.mjs:1` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_glm53.mjs:1` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_glm53.py:7` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_glm53_detail.mjs:1` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_glm53_flash.mjs:1` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_glm53_stream.py:6` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `scripts/test_nemotron.mjs:1` | nvap…(70 chars) | yes |
| medium | generic-secret-assignment | `src/lib/__tests__/adversarial.test.ts:22` | SUPE…(35 chars) | yes |

If a real secret is confirmed: rotate it, remove it from history and artifacts, add prevention, verify the replacement (SKILL §7). Never paste the value into this report.

## Code risk hints (UNVERIFIED — review each)

| Severity | Hint | Location | Why |
|---|---|---|---|
| medium | float-money | `mobile/src/app/add-expense.tsx:81` | floating-point money handling (SKILL §11) |
| medium | float-money | `mobile/src/lib/remote.ts:152` | floating-point money handling (SKILL §11) |
| medium | float-money | `mobile/src/lib/remote.ts:781` | floating-point money handling (SKILL §11) |
| medium | float-money | `mobile/src/lib/remote.ts:807` | floating-point money handling (SKILL §11) |
| medium | float-money | `mobile/src/lib/remote.ts:844` | floating-point money handling (SKILL §11) |
| medium | float-money | `src/app/expenses/[tripId]/page.tsx:90` | floating-point money handling (SKILL §11) |
| medium | float-money | `src/lib/remote.ts:119` | floating-point money handling (SKILL §11) |
| medium | float-money | `src/lib/remote.ts:664` | floating-point money handling (SKILL §11) |
| medium | float-money | `src/lib/remote.ts:690` | floating-point money handling (SKILL §11) |
| medium | float-money | `src/lib/remote.ts:727` | floating-point money handling (SKILL §11) |

## Dependency audits

| Ecosystem | Status | Detail |
|---|---|---|
| npm | RAN | npm audit --omit=dev `{"info":0,"low":0,"moderate":1,"high":3,"critical":2,"total":6}` |

## Project checks

### npm run lint — VERIFIED

exit 0 in 2.5s

```text
> trip-expense-manager@0.1.0 lint
> next lint

Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

✔ No ESLint warnings or errors
```

### npm run typecheck — VERIFIED

exit 0 in 2.4s

```text
> trip-expense-manager@0.1.0 typecheck
> tsc --noEmit
```

### npm run test — VERIFIED

exit 0 in 1.8s

```text
> trip-expense-manager@0.1.0 test
> vitest run


 RUN  v4.1.8 /home/user/trip


 Test Files  7 passed (7)
      Tests  77 passed (77)
   Start at  22:00:57
   Duration  1.18s (transform 1.00s, setup 103ms, import 1.37s, tests 259ms, environment 1ms)
```

### npm run build — VERIFIED

exit 0 in 39.9s

```text
├ ○ /login                               4.35 kB         239 kB
├ ƒ /members/[tripId]                     8.2 kB         234 kB
├ ƒ /payments/[tripId]                   9.48 kB         242 kB
├ ƒ /report/[tripId]                     13.3 kB         341 kB
└ ƒ /settlements/[tripId]                  408 B         102 kB
+ First Load JS shared by all             102 kB
  ├ chunks/1684-d8a387ab1387ad04.js      46.6 kB
  ├ chunks/4bd1b696-1a8155fb05ebea03.js  53.2 kB
  └ other shared chunks (total)          2.19 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Running in localStorage-only mode.
```
