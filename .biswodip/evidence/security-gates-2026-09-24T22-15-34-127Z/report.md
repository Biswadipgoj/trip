# Security Gates Report

- Generated: 2026-09-24T22:16:08.935Z
- Root: `/home/user/trip`
- Fail threshold: high

> Automated gates are evidence inputs. Release status is decided only by MASTER-PROMPT §31–§35.

## Gates

| Gate | Status | Detail |
|---|---|---|
| G1 Secrets in repository | FAILED | 1 candidate(s), worst medium |
| G2 Code risk hints | UNVERIFIED | 10 hint(s) need manual review |
| G3 Dependency vulnerabilities | FAILED | npm:RAN {"info":0,"low":0,"moderate":1,"high":1,"critical":0,"total":2} |
| G4 Build / lint / types / tests | VERIFIED | npm run lint:VERIFIED · npm run typecheck:VERIFIED · npm run test:VERIFIED · npm run build:VERIFIED |
| G5 Strix authorized pentest | SKIPPED | run with --strix --app-url http://127.0.0.1:<port> |
| G6 Manual gates (MASTER-PROMPT §5–§33) | OPEN | threat model, authorization matrix, adversarial pass and evidence matrix are human/agent work — not automatable |

## Secret candidates

| Severity | Rule | Location | Value (masked) | Tracked |
|---|---|---|---|---|
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
| npm | RAN | npm audit --omit=dev `{"info":0,"low":0,"moderate":1,"high":1,"critical":0,"total":2}` |

## Project checks

### npm run lint — VERIFIED

exit 0 in 2.1s

```text
> trip-expense-manager@0.1.0 lint
> next lint

Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

✔ No ESLint warnings or errors
`next lint` is deprecated and will be removed in Next.js 16.
For new projects, use create-next-app to choose your preferred linter.
For existing projects, migrate to the ESLint CLI:
npx @next/codemod@canary next-lint-to-eslint-cli .
```

### npm run typecheck — VERIFIED

exit 0 in 2.7s

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


 Test Files  8 passed (8)
      Tests  81 passed (81)
   Start at  22:15:40
   Duration  1.24s (transform 797ms, setup 138ms, import 1.26s, tests 314ms, environment 1ms)
```

### npm run build — VERIFIED

exit 0 in 26.7s

```text
├ ○ /login                               4.34 kB         239 kB
├ ƒ /members/[tripId]                    8.21 kB         234 kB
├ ƒ /payments/[tripId]                   9.48 kB         242 kB
├ ƒ /report/[tripId]                     13.4 kB         340 kB
└ ƒ /settlements/[tripId]                  400 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/1255-0046eeb68b7d2d4d.js      46.1 kB
  ├ chunks/4bd1b696-100b9d70ed4e49c1.js  54.2 kB
  └ other shared chunks (total)          2.19 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Running in localStorage-only mode.
```
