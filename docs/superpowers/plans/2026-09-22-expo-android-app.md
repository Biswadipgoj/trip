# Expo Android Mobile Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, standalone, production-grade Android mobile application using the Expo framework (React Native) in `mobile/`, preserving 100% of the TripMate business logic with a vibrant, light, colorful theme, rich emojis, travel imagery, fluid animations, and a clean, account-agnostic Expo deployment configuration.

**Architecture:** Expo SDK 52 with Expo Router (file-based navigation), React Native Reanimated for 60 FPS animations, Zustand with AsyncStorage for native offline-first persistence, and 1-to-1 parity with the web mathematical split and settlement minimizer engine.

**Tech Stack:** Expo SDK 52, React Native 0.76, Expo Router, TypeScript, React Native Reanimated 3, Zustand 5, AsyncStorage, Lucide React Native, Expo Linear Gradient, React Native SVG.

**Spec:** [docs/superpowers/specs/2026-09-22-expo-android-app-design.md](file:///d:/tripmate/trip/docs/superpowers/specs/2026-09-22-expo-android-app-design.md)

## Global Constraints
- Do NOT alter or change any mathematical business logic (splits, room allocations, greedy settlement minimization, residual debt reconciliation, UPI link generation).
- All files for the mobile application reside strictly in the `mobile/` directory.
- The theme is Vibrant Light: high brightness, playful pastel & vivid gradients, crisp card surfaces, expressive emojis, and 60 FPS micro-animations.
- Expo and EAS configuration must be account-agnostic: no hardcoded `owner`, no personal EAS `projectId`.

---

### Task 1: Initialize Expo Project in `mobile/` & Base Configs

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/eas.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/babel.config.js` or `mobile/metro.config.js`

**Interfaces:**
- Produces: Runnable Expo environment with Expo Router and Reanimated dependencies installed.

- [ ] **Step 1: Create `mobile/package.json` with required Expo dependencies**
Include `expo`, `react`, `react-native`, `expo-router`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `expo-linear-gradient`, `lucide-react-native`, `react-native-svg`, `@react-native-async-storage/async-storage`, `zustand`, `expo-status-bar`, `expo-linking`, `expo-clipboard`, `expo-haptics`, `qrcode`, `date-fns`.

- [ ] **Step 2: Create `mobile/app.json` with clean, account-agnostic configuration**
Name "TripMate", slug "tripmate", package "com.tripmate.app", scheme "tripmate", newArchEnabled: true, orientation "portrait", plugins `["expo-router"]`. Zero account locks.

- [ ] **Step 3: Create `mobile/eas.json` and `mobile/tsconfig.json`**
Configure preview APK and production AAB build profiles in `eas.json`. Configure TypeScript paths alias `@/* -> ./src/*` in `tsconfig.json`.

- [ ] **Step 4: Run `npm install` inside `mobile/` to install dependencies**
Verify node_modules are installed cleanly without errors.

- [ ] **Step 5: Commit Task 1**
Commit configuration files with message: `feat(mobile): initialize Expo Android project with base configuration`.

---

### Task 2: Port Core Domain Types & 100% Business Logic Engine

**Files:**
- Create: `mobile/src/types/index.ts`
- Create: `mobile/src/lib/utils.ts`
- Test: `mobile/src/lib/utils.test.ts`

**Interfaces:**
- Produces: `calculateBalances`, `resolveExpenseSplits`, `resolveHotelSplits`, `calculateSettlements`, `applyConfirmedTransfers`, `buildUpiLink`, `formatCurrency`, `getCategoryIcon`, `getCategoryGradient`.

- [ ] **Step 1: Create `mobile/src/types/index.ts`**
Copy and export all domain interfaces from `src/types/index.ts`: `Trip`, `Member`, `Expense`, `ExpensePayer`, `ParticipantSplit`, `HotelExpense`, `Room`, `SettlementGroup`, `Sponsorship`, `Settlement`, `MemberBalance`, `SettlementRoute`, `SplitType`, `ExpenseCategory`, `PaymentStatus`.

- [ ] **Step 2: Create `mobile/src/lib/utils.ts` with 100% logic parity**
Port exact calculation logic from `src/lib/utils.ts`:
  - `distributeEqually` with paise-remainder assignment
  - `resolveExpenseSplits` for equal, custom, percentage, quantity
  - `resolveHotelSplits` for independent room occupant allocation
  - `calculateBalances` combining regular and hotel expenditures
  - `calculateSettlements` greedy debt minimization algorithm handling sponsorships and settlement groups
  - `applyConfirmedTransfers` for live residual debt tracking
  - `buildUpiLink` for `upi://pay` intent deep links
  - `SUBCATEGORIES`, `getCategoryIcon`, `getCategoryLabel`, `getCategoryGradient`

- [ ] **Step 3: Write parity test `mobile/src/lib/utils.test.ts`**
Write tests covering: equal split paise accuracy, custom split, percentage split, quantity split, hotel room split, and greedy settlement minimization.

- [ ] **Step 4: Run test to verify parity passes**
Run tests via vitest or node runner to confirm 100% calculation correctness.

- [ ] **Step 5: Commit Task 2**
Commit domain types and business logic engine with message: `feat(mobile): port complete business logic engine and types`.

---

### Task 3: Zustand Store with AsyncStorage Persistence

**Files:**
- Create: `mobile/src/lib/store.ts`
- Create: `mobile/src/lib/supabase.ts`

**Interfaces:**
- Produces: `useStore` Zustand hook for React Native components with persistent state.

- [ ] **Step 1: Create `mobile/src/lib/supabase.ts`**
Provide optional Supabase client setup reading `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 2: Create `mobile/src/lib/store.ts`**
Implement Zustand store with `@react-native-async-storage/async-storage` as the persistence storage engine:
  - State: `trips`, `members`, `expenses`, `hotelExpenses`, `settlements`, `settlementGroups`, `sponsorships`, `session`.
  - Actions: `createTrip`, `joinTrip`, `addMember`, `updateMemberUpi`, `addExpense`, `deleteExpense`, `addHotelExpense`, `deleteHotelExpense`, `addSettlementGroup`, `deleteSettlementGroup`, `addSponsorship`, `deleteSponsorship`, `updateSettlementStatus`, `setSession`, `logout`.

- [ ] **Step 3: Verify store imports and type-check**
Verify no TypeScript errors with `npx tsc --noEmit`.

- [ ] **Step 4: Commit Task 3**
Commit store implementation with message: `feat(mobile): implement Zustand state store with AsyncStorage persistence`.

---

### Task 4: Theme, Vibrant Light Design System & Animation Primitives

**Files:**
- Create: `mobile/src/theme/colors.ts`
- Create: `mobile/src/theme/typography.ts`
- Create: `mobile/src/components/animated/SpringPressable.tsx`
- Create: `mobile/src/components/animated/SlotCounter.tsx`
- Create: `mobile/src/components/animated/PulseBadge.tsx`
- Create: `mobile/src/components/animated/ConfettiBlast.tsx`
- Create: `mobile/src/components/ui/Avatar.tsx`
- Create: `mobile/src/components/ui/CategoryChip.tsx`
- Create: `mobile/src/components/ui/GlassCard.tsx`

**Interfaces:**
- Produces: Reusable UI design system with spring animations and colorful gradient cards.

- [ ] **Step 1: Create `colors.ts` and `typography.ts`**
Define vibrant light palette: background `#F8FAFC`, card `#FFFFFF`, text `#0F172A`, muted `#64748B`, pastel gradients (`sunset`, `ocean`, `mint`, `berry`, `amber`), soft shadows, radius scales.

- [ ] **Step 2: Create `SpringPressable.tsx` using `react-native-reanimated`**
Implement touchable component with `useAnimatedStyle` scale animation (`0.96` on press, `1.0` on release) with spring physics.

- [ ] **Step 3: Create `SlotCounter.tsx`**
Implement smooth rolling animated number counter for currency and balances.

- [ ] **Step 4: Create `PulseBadge.tsx` and `ConfettiBlast.tsx`**
Breathing scale pulse badge for active trip status; celebratory particle explosion when debts settle.

- [ ] **Step 5: Create `Avatar.tsx`, `CategoryChip.tsx`, and `GlassCard.tsx`**
Avatar with initials and background gradient; CategoryChip with emoji and vibrant gradient fill; GlassCard with soft colored drop shadow and border.

- [ ] **Step 6: Commit Task 4**
Commit UI and animation components with message: `feat(mobile): create vibrant light theme and animation primitives`.

---

### Task 5: Root Layout, Welcome Screen, Trip Creation & Join

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Create: `mobile/app/create-trip.tsx`
- Create: `mobile/app/join-trip.tsx`
- Create: `mobile/app/login.tsx`

**Interfaces:**
- Produces: Welcome / onboarding screen, trip creation flow, trip join flow, and PIN login screen.

- [ ] **Step 1: Create `mobile/app/_layout.tsx`**
Set up `GestureHandlerRootView`, `SafeAreaProvider`, `StatusBar` (dark content for vibrant light theme), and Stack navigation.

- [ ] **Step 2: Create `mobile/app/index.tsx`**
Hero header with emojis ("✈️🌴"), welcoming headline, active trips list from Zustand store, and prominent spring buttons for "Create New Trip" (Sunset gradient) and "Join Existing Trip" (Ocean gradient).

- [ ] **Step 3: Create `mobile/app/create-trip.tsx`**
Form with trip name, optional budget, creator name, phone, 4-digit PIN, and UPI ID. Generates unique trip code and saves to store, redirecting to Dashboard.

- [ ] **Step 4: Create `mobile/app/join-trip.tsx`**
Input for 6-character trip code or paste invite link, trip password verification, member name, phone, PIN, and UPI ID.

- [ ] **Step 5: Create `mobile/app/login.tsx`**
Select existing member in active trip, 4-digit PIN entry keypad, error shake animation on wrong PIN.

- [ ] **Step 6: Commit Task 5**
Commit onboarding and auth screens with message: `feat(mobile): implement root layout, landing, create-trip, and join-trip screens`.

---

### Task 6: Main App Tabs (Dashboard, Expenses, Members, Settlements)

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/dashboard.tsx`
- Create: `mobile/app/(tabs)/expenses.tsx`
- Create: `mobile/app/(tabs)/members.tsx`
- Create: `mobile/app/(tabs)/settlements.tsx`

**Interfaces:**
- Produces: 4 primary navigation tabs with animated bottom bar and live state.

- [ ] **Step 1: Create `mobile/app/(tabs)/_layout.tsx`**
Custom animated bottom tab bar with spring icons, active indicator pills, and haptic feedback.

- [ ] **Step 2: Create `mobile/app/(tabs)/dashboard.tsx`**
Trip hero card with trip code copy button, total spend, user net balance with `SlotCounter`, budget progress bar, category distribution breakdown, and quick action buttons.

- [ ] **Step 3: Create `mobile/app/(tabs)/expenses.tsx`**
Categorized expense stream with search bar, category filter chips (🍽️, ✈️, 🏨, 🎭, 🛍️, 🍺), expense cards showing payer, split type, and timestamp, plus floating action button (+) to log expenses or hotel stays.

- [ ] **Step 4: Create `mobile/app/(tabs)/members.tsx`**
Member cards showing avatar, phone, UPI ID, and live net balance. Action buttons to "Add Member", "Create Settlement Group" (couples/families), and "Link Sponsor".

- [ ] **Step 5: Create `mobile/app/(tabs)/settlements.tsx`**
Greedy minimized settlement routes showing who owes whom, live status pills (Pending / Paid / Confirmed), "Pay Now via UPI" button, confirmation actions, and full Confetti celebration when all balances reach zero.

- [ ] **Step 6: Commit Task 6**
Commit core tabs with message: `feat(mobile): implement main dashboard, expenses, members, and settlements tabs`.

---

### Task 7: Expense & Hotel Stay Modals

**Files:**
- Create: `mobile/app/add-expense.tsx`
- Create: `mobile/app/add-hotel.tsx`

**Interfaces:**
- Produces: Modals to record multi-split expenses and per-room hotel stays.

- [ ] **Step 1: Create `mobile/app/add-expense.tsx`**
Modal supporting:
  - Title and total amount input
  - Category selector with vibrant icons & subcategory chips
  - Paid-by member selector (with multi-payer toggle)
  - Split type picker: Equal (default), Custom Amount, Percentage, and Quantity
  - Interactive participant checklist with live calculated share previews
  - Save button with spring animation

- [ ] **Step 2: Create `mobile/app/add-hotel.tsx`**
Modal supporting:
  - Hotel / resort name
  - Paid-by selector
  - Dynamic room list: Add Room ("Room A", "Deluxe Suite", etc.), room cost, and multi-occupant assignment per room
  - Auto-calculates total amount and validates room costs

- [ ] **Step 3: Commit Task 7**
Commit expense modals with message: `feat(mobile): implement add expense and add hotel stay modals`.

---

### Task 8: UPI Native Payment Deep Link & Trip Analytics Report

**Files:**
- Create: `mobile/app/payment-modal.tsx`
- Create: `mobile/app/report.tsx`

**Interfaces:**
- Produces: Native UPI intent payment screen and comprehensive trip report.

- [ ] **Step 1: Create `mobile/app/payment-modal.tsx`**
Screen displaying:
  - Payment details (Payer -> Receiver, Amount formatted in INR)
  - QR Code generator using receiver's UPI ID and amount
  - Big vibrant "Pay with UPI" button executing `Linking.openURL(buildUpiLink(...))` to launch Google Pay / PhonePe / Paytm / BHIM directly
  - Copy UPI ID button
  - "Mark as Paid" and "Confirm Receipt" action triggers

- [ ] **Step 2: Create `mobile/app/report.tsx`**
Comprehensive trip summary report:
  - Total spending & average spend per day / per member
  - Category-by-category breakdown with colored progress bars
  - Highest spenders and top contributors
  - Final settlement summary

- [ ] **Step 3: Commit Task 8**
Commit payment and report screens with message: `feat(mobile): implement UPI payment deep linking and trip reports`.

---

### Task 9: Verification, TypeScript Check & Build Readiness

**Files:**
- Check: `mobile/tsconfig.json`
- Test: `mobile/src/lib/utils.test.ts`

- [ ] **Step 1: Run TypeScript compiler check in `mobile/`**
Execute `npx tsc --noEmit` inside `mobile/` to guarantee zero compilation or type errors.

- [ ] **Step 2: Run business logic unit tests**
Ensure all split calculations, greedy debt minimization, and residual reconciliations pass 100%.

- [ ] **Step 3: Inspect `mobile/app.json` and `mobile/eas.json`**
Verify configuration is completely account-agnostic and ready for the user to run `eas build`.

- [ ] **Step 4: Commit Task 9**
Commit final verification with message: `chore(mobile): verify TypeScript build and test suite`.
