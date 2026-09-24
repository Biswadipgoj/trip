# Mobile Production Hardening & Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the TripMate Expo Android mobile app into a silky-smooth, compact, production-ready app by eliminating developer/debug artifacts (Live/Cloud sync chips and sheets), making image attachment 100% reliable through local-first persistence, optimizing rendering performance to solid 60fps, and compressing assets to reduce app footprint.

**Architecture:** 
1. Remove all visible dev/debug artifacts ("Live" sync chips, sync detail bottom sheets, "Cloud Synced" tags) in favor of silent, resilient background synchronization.
2. Replace GPU-heavy Android rendering constructs (`MaskedView` continuous sheen loops and multi-stop CSS `boxShadow`) with hardware-accelerated gradient typography and native elevation.
3. Decouple photo viewing from cloud bucket availability: bills and UPI screenshots persist permanently in local device storage (`File` / `Paths.document/tripmate-media`), displaying instantly with graceful background cloud sync retry.
4. Compress raw app icon and splash PNGs from 2.6 MB down to <150 KB.

**Tech Stack:** React Native 0.86, Expo SDK 57, Expo Router, Zustand 5, Reanimated 4, Expo File System, Expo Image, Supabase JS.

---

## Global Constraints
- Must remain 100% compatible with Expo SDK 57 and Android Hermes runtime.
- No syntax errors, no stray characters, strict TypeScript check (`tsc --noEmit`) must pass with 0 errors.
- All 28 existing vitest tests must pass without regressions.
- No dev/debug indicators visible to the end user in production screens.

---

### Task 1: Remove Dev & Sync Artifacts (Production UI Polish)

**Files:**
- Modify: `mobile/src/components/ui/AnimatedHeader.tsx`
- Modify: `mobile/src/app/index.tsx`
- Modify: `mobile/src/app/(tabs)/members.tsx`
- Modify: `mobile/src/app/join-trip.tsx`

**Interfaces:**
- `AnimatedHeader`: Clean header with title, back button, and optional action buttons without `SyncButton` or `SyncDetails` modal sheet.
- `index.tsx`: Clean trip cards displaying trip details without "Cloud Synced" tag.

- [ ] **Step 1: Simplify `AnimatedHeader.tsx`**
  Remove the `SyncButton`, `LivePulseDot`, `SpinningIcon`, and `SyncDetails` sheet. Ensure header maintains clean title and right actions.
- [ ] **Step 2: Clean `index.tsx` trip cards**
  Remove the `<T variant="tiny" color={C.emerald500}>Cloud Synced</T>` tag on home screen trip list cards.
- [ ] **Step 3: Update `members.tsx` and `join-trip.tsx` copy**
  Replace developer-facing strings ("Cloud sync is OFF in this build...") with consumer-friendly production copy ("Connect to internet to invite members" / "Connect to internet to join trip").
- [ ] **Step 4: Verify typecheck**
  Run: `npm run typecheck` in `mobile/`
  Expected: PASS with 0 errors.

---

### Task 2: 60 FPS Performance Optimization (BrandFooter, GlassCard & Animations)

**Files:**
- Modify: `mobile/src/components/ui/BrandFooter.tsx`
- Modify: `mobile/src/components/ui/GlassCard.tsx`
- Modify: `mobile/src/theme/colors.ts`

**Interfaces:**
- `BrandFooter`: GPU-friendly gradient signature without `MaskedView` or continuous translation loops on Android.
- `GlassCard`: Uses Android-friendly elevation and crisp borders instead of heavy CSS `boxShadow` strings.

- [ ] **Step 1: Optimize `BrandFooter.tsx`**
  Replace `MaskedView` with pure gradient text and optimized modal presentation, eliminating offscreen GPU buffer thrashing during scrolling.
- [ ] **Step 2: Optimize `GlassCard.tsx` and `shadow` styles**
  Update shadow definitions to use native elevation and lightweight drop-shadows that do not stutter on Android devices.
- [ ] **Step 3: Verify typecheck and tests**
  Run: `npm run typecheck && npm test`
  Expected: PASS

---

### Task 3: Local-First Media Persistence & Image Upload Robustness

**Files:**
- Modify: `mobile/src/lib/uploads.ts`
- Modify: `mobile/src/components/attachments/AttachmentStrip.tsx`
- Create: `supabase/MIGRATION_GUIDE.md`

**Interfaces:**
- `uploads.ts`: `attachImage()`, `attachmentUri()` guaranteed to serve local file immediately. Cloud upload failures do not mark media as broken or hide images.
- `MIGRATION_GUIDE.md`: Self-contained SQL script to run in Supabase Dashboard to create `trip-media` bucket and `attachments` table.

- [ ] **Step 1: Ensure local-first media availability in `uploads.ts`**
  Ensure `attachmentUri(a)` always returns `a.localUri` when available on device. Ensure upload errors (like missing bucket) are caught silently and retry with backoff without showing red error icons to the user.
- [ ] **Step 2: Refine `AttachmentStrip.tsx` and `viewer.tsx`**
  Ensure bill and UPI thumbnails render smoothly with fallback handling.
- [ ] **Step 3: Document Supabase Cloud Media Migration**
  Create `supabase/MIGRATION_GUIDE.md` with instructions and SQL to enable Supabase storage bucket `trip-media` and `attachments` table.
- [ ] **Step 4: Verify tests**
  Run: `npm test` in `mobile/`
  Expected: PASS (28/28 tests passing).

---

### Task 4: Asset Compaction & App Size Reduction

**Files:**
- Modify: `mobile/assets/images/adaptive-background.png`
- Modify: `mobile/assets/images/icon.png`
- Modify: `mobile/assets/images/splash-icon.png`
- Modify: `mobile/assets/images/logo.png`
- Modify: `mobile/scripts/generate-icons.mjs`

- [ ] **Step 1: Optimize and compress all asset images**
  Re-encode and compress PNG assets in `mobile/assets/images/` using optimized compression, reducing raw image assets from ~2.6 MB to <150 KB.
- [ ] **Step 2: Update `generate-icons.mjs` with compression settings**
  Ensure any future icon generation automatically applies compression.
- [ ] **Step 3: Verify asset size reduction**
  Inspect `mobile/assets/images/` file sizes and ensure total image footprint is minimized.

---

### Task 5: End-to-End Verification & Expo Android Export

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run complete typecheck**
  Run: `npm run typecheck` in `mobile/`
  Expected: 0 errors.
- [ ] **Step 2: Run all unit and integration tests**
  Run: `npm test` in `mobile/`
  Expected: 28/28 tests passed.
- [ ] **Step 3: Run Android bundle export**
  Run: `npx expo export -p android` in `mobile/`
  Expected: Clean Hermes bytecode bundle generated without warnings or missing modules.
