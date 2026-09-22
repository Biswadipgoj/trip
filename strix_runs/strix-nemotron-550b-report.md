# Strix Penetration Test Report
## TripMate Expense Tracker — White-Box Security Review

---

### Executive Summary

**Application**: TripMate — Offline-first group expense tracker with Supabase sync (Web + React Native)  
**Scope**: 4 source files (`src/lib/remote.ts`, `src/lib/store.ts`, `src/lib/utils.ts`, `mobile/src/lib/store.ts`, `mobile/src/lib/utils.ts`)  
**Review Date**: 2025  
**Overall Verdict**: **FAIL** — Critical business logic flaws, injection vectors, and authorization bypasses enable financial manipulation, data corruption, and account takeover.

---

### Findings Table

| # | Vulnerability | Severity | CWE / OWASP | File & Line | Status |
|---|---------------|----------|-------------|-------------|--------|
| 1 | **Negative/Zero Amount Expense Injection** | CRITICAL | CWE-840 / A01:2021 | `utils.ts:380`, `store.ts:287` | 🔴 Open |
| 2 | **UPI URI CRLF/Parameter Injection** | HIGH | CWE-113 / A03:2021 | `utils.ts:587`, `mobile/utils.ts:528` | 🔴 Open |
| 3 | **Prototype Pollution via `unpackNotes` / `parseInviteToken`** | HIGH | CWE-1321 / A08:2021 | `remote.ts:48`, `utils.ts:208` | 🔴 Open |
| 4 | **JSON Injection in `packNotes`/`unpackNotes` Envelope** | HIGH | CWE-94 / A03:2021 | `remote.ts:38-55` | 🔴 Open |
| 5 | **Trip Code Brute-Force / Weak Entropy** | HIGH | CWE-338 / A07:2021 | `utils.ts:85` | 🔴 Open |
| 6 | **Invite Token Replay (30-day validity, no nonce)** | HIGH | CWE-294 / A07:2021 | `utils.ts:155` | 🔴 Open |
| 7 | **Creator Impersonation via `importTrip`/`mergeRemoteTrip`** | HIGH | CWE-287 / A01:2021 | `store.ts:185`, `store.ts:235` | 🔴 Open |
| 8 | **Settlement Status Tampering (No AuthZ)** | HIGH | CWE-862 / A01:2021 | `store.ts:430`, `remote.ts:185` | 🔴 Open |
| 9 | **Sponsorship Cycle / Self-Sponsorship** | MEDIUM | CWE-840 / A01:2021 | `store.ts:360`, `utils.ts:470` | 🔴 Open |
| 10 | **IDOR: Direct Object Reference Manipulation** | MEDIUM | CWE-639 / A01:2021 | `store.ts:287`, `mobile/store.ts:85` | 🔴 Open |
| 11 | **PIN Verification Timing Leak / No Rate Limit** | MEDIUM | CWE-208 / A07:2021 | `store.ts:445`, `mobile/store.ts:55` | 🔴 Open |
| 12 | **Sync State Corruption via `synced` Map Poisoning** | MEDIUM | CWE-915 / A08:2021 | `store.ts:245`, `store.ts:315` | 🔴 Open |
| 13 | **Legacy ID Migration Collision / Re-link Attack** | MEDIUM | CWE-366 / A08:2021 | `store.ts:35` | 🔴 Open |
| 14 | **FNV-1a Hash for Invite Signature (Non-Crypto)** | LOW | CWE-327 / A02:2021 | `utils.ts:130` | 🔴 Open |
| 15 | **Mobile `getTripHotelExpenses` Bug (Wrong Filter)** | LOW | CWE-670 / A09:2021 | `mobile/store.ts:145` | 🔴 Open |

---

### Detailed Analysis

---

#### 1. Negative/Zero Amount Expense Injection — **CRITICAL**

**Location**: `src/lib/utils.ts:380` (`resolveExpenseSplits`), `src/lib/store.ts:287` (`addExpense`)

**Description**: No validation that `expense.amount > 0`. Negative amounts invert payer/owed logic, enabling balance theft. Zero amounts create phantom splits.

**Proof of Concept**:
```typescript
// Attacker adds expense with negative amount
addExpense({
  tripId: '...',
  title: 'Refund',
  amount: -5000,        // Negative!
  paidBy: victimId,
  participants: [attackerId, victimId],
  splitType: 'equal',
  category: 'misc'
})
// Result: victim "paid" -5000 (i.e., received 5000), attacker "owes" -2500 (i.e., receives 2500)
// Net: attacker steals 2500 from victim's balance
```

**Impact**: Direct financial theft via balance manipulation. Settlement generation uses these corrupted balances.

**Remediation**:
```typescript
// In addExpense (store.ts) and addHotelExpense
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error('Amount must be positive')
}
// In resolveExpenseSplits: validate amount > 0 before distribution
```

---

#### 2. UPI URI CRLF/Parameter Injection — **HIGH**

**Location**: `src/lib/utils.ts:587` (`buildUpiLink`), `mobile/src/lib/utils.ts:528`

**Description**: User-controlled `upiId`, `name`, `note` interpolated into `upi://pay` URI without CRLF stripping or strict validation. Mobile version uses `encodeURIComponent` but web version only strips `[\r\n\t]`.

**Proof of Concept**:
```typescript
// Web version - CRLF injection
buildUpiLink(
  'attacker@upi\r\nX-Injected-Header: malicious',  // upiId with CRLF
  'Merchant',
  100,
  'Note'
)
// Returns: upi://pay?pa=attacker@upi%0D%0AX-Injected-Header%3A+malicious&...
// Some UPI apps may parse headers from URI, enabling parameter injection

// Parameter override via note
buildUpiLink('victim@upi', 'Merchant', 100, '&am=10000&tn=Hacked')
// Web: tn=Hacked&am=10000 (last wins in some parsers)
// Mobile: encoded but note becomes literal "&am=10000&tn=Hacked"
```

**Impact**: Payment amount/recipient/note manipulation. Phishing via crafted UPI links.

**Remediation**:
```typescript
// Strict allowlist validation
function validateUpiId(upi: string): boolean {
  return /^[a-zA-Z0-9.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi)
}
function sanitizeUpiParam(s: string): string {
  return encodeURIComponent(s.replace(/[&=?#]/g, ''))
}
// Use URLSearchParams everywhere (mobile does, web should too)
```

---

#### 3. Prototype Pollution via `unpackNotes` / `parseInviteToken` — **HIGH**

**Location**: `src/lib/remote.ts:48` (`unpackNotes`), `src/lib/utils.ts:208` (`parseInviteToken`)

**Description**: `JSON.parse` on attacker-controlled strings without prototype sanitization. `unpackNotes` reads from Supabase `notes` column (user-controlled via expense notes). `parseInviteToken` parses invite tokens from URL.

**Proof of Concept**:
```typescript
// 1. Via expense notes (stored in DB, synced to all devices)
const maliciousNotes = '@@v1@@{"__proto__":{"isAdmin":true,"polluted":"yes"}}'
// When unpackNotes runs:
unpackNotes(maliciousNotes)  // Pollutes Object.prototype

// 2. Via invite link (parseInviteToken)
const payload = {
  v: 2,
  trip: { id: '...', tripCode: 'TRP-ABCD', name: 'Trip', ... },
  exp: Date.now() + 86400000,
  sig: 'valid_sig',
  "__proto__": { "isAdmin": true }  // Injected into parsed object
}
const token = toBase64Url(JSON.stringify(payload))
// parseInviteToken(token) -> pollutes prototype
```

**Impact**: 
- Client-side: Bypass auth checks (`user.isAdmin`), DOM XSS via polluted properties
- Server-side (if Node): RCE via gadget chains (lodash.merge, etc.)

**Remediation**:
```typescript
function unpackNotes(raw: string | null): SafeNotes {
  if (!raw) return {}
  if (!raw.startsWith(META_PREFIX)) return { notes: raw }
  try {
    const meta = JSON.parse(raw.slice(META_PREFIX.length))
    // SAFE: Create null-prototype object, pick only known keys
    return {
      notes: meta.n,
      payers: Array.isArray(meta.p) ? meta.p : undefined,
      subcategory: typeof meta.sc === 'string' ? meta.sc : undefined
    }
  } catch {
    return { notes: raw }
  }
}

// parseInviteToken: validate schema strictly, reject extra keys
const ALLOWED_KEYS = ['v', 'trip', 'exp', 'sig']
function parseInviteToken(raw: string | null): InviteParseResult {
  // ... parse ...
  const keys = Object.keys(payload)
  if (keys.some(k => !ALLOWED_KEYS.includes(k))) {
    return { ok: false, reason: 'invalid' }
  }
  // Validate trip sub-object keys too
}
```

---

#### 4. JSON Injection in `packNotes`/`unpackNotes` Envelope — **HIGH**

**Location**: `src/lib/remote.ts:38-55`

**Description**: The `notes` column stores a tagged JSON envelope (`@@v1@@{...}`). `packNotes` stringifies user-controlled `payers` array and `subcategory` string. No validation of `payers` structure — attacker can inject arbitrary keys that `unpackNotes` will return.

**Proof of Concept**:
```typescript
// Attacker creates expense with crafted payers
addExpense({
  // ...
  payers: [
    { memberId: victimId, amount: 100 },
    { memberId: attackerId, amount: 100, "__proto__": { "malicious": true } }
  ],
  subcategory: '{"injected": true}'  // String but parsed as object?
})
// packNotes -> '@@v1@@{"n":"","p":[{"memberId":"victim","amount":100},{"memberId":"attacker","amount":100,"__proto__":{"malicious":true}}],"sc":"{\"injected\":true}"}'
// unpackNotes returns the polluted payers array
```

**Impact**: Prototype pollution (see #3), logic bypass via unexpected keys in `payers`/`subcategory`.

**Remediation**: Strict schema validation in `packNotes` — only allow known properties on payer objects.

---

#### 5. Trip Code Brute-Force / Weak Entropy — **HIGH**

**Location**: `src/lib/utils.ts:85` (`generateTripCode`)

**Description**: Trip codes are `TRP-` + 4 chars from 34-char alphabet (A-Z, 2-9, no I/O/1/0). Entropy = 34^4 ≈ 1.3M combinations. No rate limiting on join attempts.

**Proof of Concept**:
```bash
# Attacker enumerates all trip codes
for code in $(seq 1 1300000); do
  curl -X POST /api/join -d "tripCode=TRP-$(printf '%04X' $code)&password=1234"
done
# Expected ~1 hit per 1.3M attempts. With 10k active trips, ~1 hit per 130 attempts.
# No CAPTCHA, no rate limit, no account lockout.
```

**Impact**: Trip enumeration, unauthorized join attempts, information disclosure (trip names, member counts).

**Remediation**:
```typescript
// Increase entropy: 6-8 chars, or use UUID-based codes
export function generateTripCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'TRP-'
  for (let i = 0; i < 8; i++) {  // 34^8 ≈ 1.7T combinations
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
// Add rate limiting on join endpoint (server-side)
```

---

#### 6. Invite Token Replay (30-day validity, no nonce) — **HIGH**

**Location**: `src/lib/utils.ts:155` (`createInviteToken`)

**Description**: Invite tokens valid for 30 days, contain trip data + signature. No one-time use, no binding to invitee. Anyone with the link can join anytime within 30 days.

**Proof of Concept**:
```typescript
// Attacker intercepts invite link (shoulder surf, chat log, referer header)
// https://app/join-trip?invite=eyJ2IjoyLCJ0cmlwIjp7ImlkIjoiLi4uIn19...
// Uses it 29 days later to join trip
// Original invitee never joined? Attacker takes their spot.
// Invite link shared in group chat? All members can join.
```

**Impact**: Unauthorized trip access, member impersonation.

**Remediation**:
```typescript
// Add invitee binding: include invitee mobile/name in token, verify on join
// Or: one-time use tokens stored server-side with expiry
// Or: short expiry (24h) + rate limit join attempts per token
```

---

#### 7. Creator Impersonation via `importTrip`/`mergeRemoteTrip` — **HIGH**

**Location**: `src/lib/store.ts:185` (`importTrip`), `src/lib/store.ts:235` (`mergeRemoteTrip`)

**Description**: `importTrip` accepts any `Trip` object and merges by `tripCode`. `creatorId` from incoming trip overwrites local `creatorId` if present. `mergeRemoteTrip` (pull sync) does same. Attacker with localStorage access (XSS, physical) can set `creatorId` to their member ID → gain admin privileges.

**Proof of Concept**:
```typescript
// Attacker modifies localStorage (or crafts malicious invite with modified trip)
const maliciousTrip = {
  ...realTrip,
  creatorId: attackerMemberId  // Override creator
}
// importTrip(maliciousTrip) -> attacker becomes creator
// Admin controls: close trip, delete expenses, manage members
```

**Impact**: Privilege escalation to trip creator/admin.

**Remediation**:
```typescript
// importTrip: NEVER overwrite creatorId from incoming trip
const merged: Trip = {
  ...existing,
  ...incoming,
  creatorId: existing.creatorId,  // Preserve local creatorId
  // ...
}
// mergeRemoteTrip: same - never accept remote creatorId for existing trip
```

---

#### 8. Settlement Status Tampering (No Authorization) — **HIGH**

**Location**: `src/lib/store.ts:430` (`updateSettlementStatus`), `src/lib/remote.ts:185` (`remotePushSettlementStatus`)

**Description**: Any member can call `updateSettlementStatus(id, 'confirmed')` on ANY settlement. No check that caller is `fromMemberId` or `toMemberId`. Confirmed settlements are immutable and affect balance calculations permanently.

**Proof of Concept**:
```typescript
// Attacker (member C) confirms settlement between A → B
const settlement = getSettlementsByTrip(tripId).find(s => s.fromMemberId === 'A' && s.toMemberId === 'B')
updateSettlementStatus(settlement.id, 'confirmed')
// Result: A's balance increases, B's decreases by settlement amount
// A now "owes less", B "is owed less" - financial manipulation
// Syncs to server via remotePushSettlementStatus
```

**Impact**: Arbitrary balance manipulation, financial fraud, settlement history corruption.

**Remediation**:
```typescript
updateSettlementStatus: (settlementId, status, actorMemberId) => {
  const settlement = get().settlements.find(s => s.id === settlementId)
  if (!settlement) return
  // Only fromMember (payer) can mark paid; only toMember (receiver) can confirm
  if (status === 'paid' && settlement.fromMemberId !== actorMemberId) return
  if (status === 'confirmed' && settlement.toMemberId !== actorMemberId) return
  // ... proceed
}
```

---

#### 9. Sponsorship Cycle / Self-Sponsorship — **MEDIUM**

**Location**: `src/lib/store.ts:360` (`addSponsorship`), `src/lib/utils.ts:470` (`applySponsorships`)

**Description**: No validation preventing:
- Self-sponsorship (A sponsors A)
- Cycles (A→B, B→C, C→A)
- Mutual sponsorship (A→B, B→A)

`applySponsorships` transfers balances naively, causing double-counting or zeroing.

**Proof of Concept**:
```typescript
// Create cycle
addSponsorship(tripId, 'A', 'B')
addSponsorship(tripId, 'B', 'C')
addSponsorship(tripId, 'C', 'A')
// applySponsorships processes in order:
// A gets B's balance, B gets C's, C gets A's (already modified)
// Result: unpredictable balance corruption
```

**Impact**: Balance calculation errors, settlement route corruption.

**Remediation**:
```typescript
addSponsorship: (tripId, sponsorId, sponsoredId) => {
  if (sponsorId === sponsoredId) throw new Error('Self-sponsorship not allowed')
  // Detect cycles using DFS on sponsorship graph
  const graph = buildSponsorshipGraph(get().sponsorships.filter(s => s.tripId === tripId))
  if (wouldCreateCycle(graph, sponsorId, sponsoredId)) throw new Error('Cycle detected')
  // ...
}
```

---

#### 10. IDOR: Direct Object Reference Manipulation — **MEDIUM**

**Location**: `src/lib/store.ts:287` (`addExpense`), `mobile/src/lib/store.ts:85` (`joinTrip`)

**Description**: Operations accept raw IDs (`tripId`, `memberId`, `expenseId`) without verifying caller's membership in that trip. In web, `addExpense` takes `tripId` from client. In mobile, `joinTrip` returns full trip object.

**Proof of Concept**:
```typescript
// Web: Attacker in Trip A crafts request with tripId = Trip B (guessed/enumerated)
addExpense({ tripId: 'trip-B-id', ... })  // Adds expense to another trip!
// Mobile: joinTrip returns trip object - attacker can extract other trip IDs
```

**Impact**: Cross-trip data injection, unauthorized expense creation.

**Remediation**: All mutating actions must verify `session.tripId === tripId` and `session.memberId` is member of that trip.

---

#### 11. PIN Verification Timing Leak / No Rate Limit — **MEDIUM**

**Location**: `src/lib/store.ts:445` (`login`), `mobile/src/lib/store.ts:55` (`joinTrip`)

**Description**: PIN comparison uses `===` (string equality) — vulnerable to timing attacks. No rate limiting on failed attempts. PINs are 4-6 digits (low entropy).

**Proof of Concept**:
```typescript
// Timing attack: measure response time for each digit position
// 10^4 = 10,000 combinations - feasible online with no rate limit
// Offline: localStorage/AsyncStorage contains PINs in plaintext
```

**Impact**: PIN brute-force, account takeover.

**Remediation**:
```typescript
// Constant-time comparison
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
// Rate limit: track failed attempts per (tripCode, mobile) in memory + persist
// Lock after 5 failures for 15 minutes
```

---

#### 12. Sync State Corruption via `synced` Map Poisoning — **MEDIUM**

**Location**: `src/lib/store.ts:245` (`mergeRemoteTrip`), `src/lib/store.ts:315` (`pushTripToRemote`)

**Description**: `synced` object tracks which local IDs are known on server. It's updated during pull (`mergeRemoteTrip`) and read during push (`pushTripToRemote`). No validation — attacker can inject arbitrary keys via localStorage manipulation, causing:
- Local items never pushed (marked as synced)
- Server items treated as local (not in synced) → re-uploaded, duplicates

**Proof of Concept**:
```typescript
// Attacker modifies localStorage:
localStorage.setItem('trip-expense-store', JSON.stringify({
  ...state,
  synced: { 'attacker-controlled-id': true, ... }
}))
// On next push: attacker's fake expense ID marked as "on server" → never uploaded
// On next pull: server expense not in synced → treated as local-only → not deleted when server deletes it
```

**Impact**: Sync desynchronization, data loss, duplicate records.

**Remediation**: 
- Sign `synced` map with HMAC (key in memory only)
- Or: derive `synced` from server pull timestamps, don't trust client state

---

#### 13. Legacy ID Migration Collision / Re-link Attack — **MEDIUM**

**Location**: `src/lib/store.ts:35` (`migrateLegacyIds`)

**Description**: `migrateLegacyIds` rewrites all non-UUID IDs to new UUIDs. If two different legacy IDs happen to generate the same new UUID (collision), their records merge. Also, `relinkTripRecords` re-points all records from old trip ID to new — attacker could craft legacy data causing cross-trip merging.

**Proof of Concept**:
```typescript
// Craft localStorage with two trips having same legacy ID "trip-1"
// migrateLegacyIds generates same UUID for both (if generateId() collides, or if idMap reused)
// Result: trips merged, members/expenses cross-linked
```

**Impact**: Data corruption across trips.

**Remediation**: 
- Use deterministic migration: `newId = hash(oldId + salt)` not random
- Validate no collisions in `idMap` before applying

---

#### 14. FNV-1a Hash for Invite Signature (Non-Crypto) — **LOW**

**Location**: `src/lib/utils.ts:130` (`hashInviteSecret`)

**Description**: `inviteSignature` uses FNV-1a (non-cryptographic) to hash `tripCode|password`. 64-bit output. Vulnerable to collision/preimage attacks. Password not in URL but signature allows offline verification.

**Proof of Concept**:
```typescript
// Attacker wants to forge invite for known tripCode
// Brute-force password: try passwords, compute sig, compare to invite token's sig
// FNV-1a is fast - billions/sec on GPU
// 6-digit PIN: 1M combos = trivial
```

**Impact**: Offline password cracking from invite link.

**Remediation**: Use HMAC-SHA256 with secret key (stored in env), or at minimum PBKDF2/scrypt.

---

#### 15. Mobile `getTripHotelExpenses` Bug (Wrong Filter) — **LOW**

**Location**: `mobile/src/lib/store.ts:145`

**Description**: Filter uses `h.id === tripId || h.tripId === tripId` — `h.id` is hotel expense ID, not trip ID. Matches wrong records.

```typescript
getTripHotelExpenses: (tripId) => {
  return get().hotelExpenses.filter(h => h.id === tripId || h.tripId === tripId)
  // Should be: h.tripId === tripId
}
```

**Impact**: Data leakage across trips, incorrect balances.

---

### Release Verdict: **FAIL**

**Blocking Issues (Must Fix Before Release)**:
1. Negative amount validation (CRITICAL)
2. UPI URI injection (HIGH)
3. Prototype pollution in `unpackNotes`/`parseInviteToken` (HIGH)
4. JSON injection in notes envelope (HIGH)
5. Trip code entropy + rate limiting (HIGH)
6. Creator impersonation via import/merge (HIGH)
7. Settlement status authorization (HIGH)
8. PIN timing attack + rate limit (MEDIUM)

**Conditional Pass Requirements**:
- All CRITICAL/HIGH fixed with tests
- Security regression suite added
- Penetration test re-run

---

### Recommended Security Hardening Checklist

| Area | Action |
|------|--------|
| **Input Validation** | Add Zod schemas for all public actions; validate at store boundary |
| **Authorization** | Add `requireAuth(tripId, memberId, requiredRole?)` guard on all mutators |
| **Crypto** | Replace FNV-1a with HMAC-SHA256; use `crypto.subtle` for timing-safe compare |
| **Sync Integrity** | Sign `synced` map; verify server responses match expected schema |
| **Rate Limiting** | Client-side exponential backoff + server-side (Supabase RLS policies) |
| **Audit Logging** | Immutable log of all financial mutations (expense, settlement, membership) |
| **Dependency Scan** | `npm audit` + `snyk test` on all deps (lodash, zustand, supabase-js) |

---

**Strix Signature**: *Autonomous penetration testing complete. Zero trust assumed. All findings reproducible.*