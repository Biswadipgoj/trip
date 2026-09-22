# Expo Android Mobile Application Design Specification — TripMate

## 1. Overview & Objective
Build a complete, standalone, production-grade Android mobile application using the **Expo framework (React Native)** located in the `mobile/` subfolder of the `trip` repository.
The mobile app faithfully delivers all the features of the TripMate group expense manager while maintaining **100% fidelity to the existing business logic**, presenting a **vibrant, light, colorful theme with high brightness, playful pastel & vivid gradients, emojis, relevant travel imagery, and fluid 60 FPS animations**.
The Expo configuration is completely account-agnostic, allowing the user to seamlessly connect their personal Expo/EAS account whenever they decide to deploy or build an Android APK.

---

## 2. Technical Stack & Dependencies

### Core Framework & Navigation
* **Framework**: Expo SDK 52+ / React Native 0.76+
* **Routing / Navigation**: Expo Router (file-based navigation with typed routes, tab layout, modal screens)
* **Language**: TypeScript with strict mode enabled

### State & Persistence
* **State Management**: Zustand v5
* **Persistence**: `@react-native-async-storage/async-storage` (mirroring web `localStorage` schema)
* **Backend Sync (Optional)**: `@supabase/supabase-js` (configured with `EXPO_PUBLIC_` environment variables)

### UI, Animations & Styling
* **Animations**: `react-native-reanimated` v3 (spring physics, layout transitions, count-ups)
* **Gradients**: `expo-linear-gradient`
* **Icons**: `lucide-react-native` alongside rich Unicode emojis
* **Vector Graphics**: `react-native-svg`
* **Safe Area & Gestures**: `react-native-safe-area-context`, `react-native-gesture-handler`

---

## 3. Directory & File Structure

```
mobile/
├── app/                              # Expo Router file-based screens
│   ├── _layout.tsx                   # Root layout, providers, fonts, status bar
│   ├── index.tsx                     # Welcome & active trips list
│   ├── create-trip.tsx               # Create Trip screen (Name, Budget, PIN, UPI)
│   ├── join-trip.tsx                 # Join Trip screen (Code/Invite token, PIN, UPI)
│   ├── login.tsx                     # Member PIN login screen
│   ├── (tabs)/                       # Tab bar navigator
│   │   ├── _layout.tsx               # Animated tab bar with bouncy icons & active pills
│   │   ├── dashboard.tsx             # Trip Overview, total spend, user net balance, quick stats
│   │   ├── expenses.tsx              # Expense list, category filters, search
│   │   ├── members.tsx               # Member list, balances, group & sponsor creation
│   │   └── settlements.tsx           # Minimized settlement routes, live status, UPI deep-links
│   ├── add-expense.tsx               # Expense creation modal (Equal, Custom, %, Qty, Multi-payer)
│   ├── add-hotel.tsx                 # Hotel stays modal (Rooms, per-room cost & occupants)
│   ├── payment-modal.tsx             # UPI QR code & native payment deep link
│   └── report.tsx                    # Detailed expense report & category breakdowns
├── src/
│   ├── components/
│   │   ├── animated/                 # SpringButton, SlotCounter, FadeInDown, PulseBadge, ConfettiBlast
│   │   ├── cards/                    # GlassCard, ExpenseItemCard, MemberCard, SettlementRouteCard
│   │   ├── ui/                       # Avatar, Header, CategoryChip, FloatingActionButton, GradientView
│   │   └── modals/                   # SettlementGroupModal, SponsorshipModal
│   ├── lib/
│   │   ├── store.ts                  # Zustand store persisted via AsyncStorage
│   │   ├── utils.ts                  # 1:1 business logic calculation port
│   │   └── supabase.ts               # Supabase client setup
│   ├── theme/
│   │   ├── colors.ts                 # Vibrant light pastel palette
│   │   └── typography.ts             # Font sizes, line heights, font weights
│   └── types/
│       └── index.ts                  # Mirrored TypeScript domain models
├── app.json                          # Clean, account-agnostic Expo configuration
├── eas.json                          # Standard APK / AAB build configuration
├── package.json                      # Mobile dependencies
└── tsconfig.json                     # TypeScript configuration
```

---

## 4. Business Logic Preservation (Zero Modification Rule)

The following core logic from `src/lib/utils.ts` is preserved with 100% mathematical and behavioral fidelity:
1. **Split Resolution Engine (`resolveExpenseSplits`)**:
   * `equal`: Paise-accurate remainder distribution (`distributeEqually`).
   * `custom`: Direct assigned amounts per participant.
   * `percentage`: Calculated proportional shares based on percentage values.
   * `quantity`: Weighted shares proportional to item/unit counts.
2. **Hotel Room Splits (`resolveHotelSplits`)**:
   * Independent per-room cost splitting across only the occupants assigned to that specific room.
3. **Net Balance Calculation (`calculateBalances`)**:
   * Aggregates member expenditures, multi-payer contributions, and total owed across regular and hotel expenses.
4. **Greedy Settlement Debt Minimizer (`calculateSettlements`)**:
   * Minimizes total transaction count using sorted creditor and debtor pointers.
   * Accounts for sponsorships (transferring net debt/credit from sponsored member to sponsor).
   * Accounts for settlement groups (merging couple/family balances into one entity for settlement).
5. **Live Residual Debt Reconciliation (`applyConfirmedTransfers`)**:
   * Dynamically applies confirmed payment transfers onto live balances to prevent stale settlement amounts.
6. **UPI Payment URL Generation (`buildUpiLink`)**:
   * Generates valid `upi://pay?pa=...&pn=...&am=...&cu=INR` URIs that trigger Android native payment apps.

---

## 5. UI, Aesthetic & Animation Design

### Theme & Colors (Vibrant Light)
* **Background**: `#F8FAFC` to `#F1F5F9` with soft radiant glow accents.
* **Card Surfaces**: Pure `#FFFFFF` with smooth pastel drop shadows (`elevation: 4`, `shadowRadius: 10`, `shadowOpacity: 0.08`), 20px rounded corners.
* **Vivid Gradients**:
  * Sunset Tangerine: `['#FF6B6B', '#FFA07A']`
  * Ocean Azure: `['#4E65FF', '#92EFFD']`
  * Mint Emerald: `['#0575E6', '#00F260']`
  * Berry Violet: `['#8A2387', '#E94057', '#F27121']`
  * Honey Amber: `['#F7971E', '#FFD200']`

### Rich Emojis & Imagery
* Category icons: 🍽️ Food & Dining, ✈️ Transport, 🏨 Stay, 🎭 Activities, 🛍️ Shopping, 🍺 Alcohol, ⛽ Fuel, 🎟️ Tickets, 📌 Misc.
* Subcategory icons: 🍳 Breakfast, 🍛 Lunch, 🍽️ Dinner, 🥪 Snacks, 🪂 Adventure, 🏄 Watersports, 🚕 Taxi, 🚆 Train, 🏖️ Beach, etc.
* Rich status icons: 🎉 Joined, 🏆 All Settled, 🤝 Entity Linked, 🔒 PIN Protected.

### Animations (60 FPS on Android)
* **SpringPressable**: Tactile spring scale (`0.96`) bounce on buttons and interactive cards.
* **SlotCounter**: Smooth count-up rolling animation for currency values and balances.
* **Staggered Entrance**: Screen elements smoothly slide down and fade in (`FadeInDown.delay(index * 60)`).
* **Pulsing Badges**: Gentle breathing scale animation on active trip and pending payment pills.
* **Confetti Celebration**: Particle fireworks explosion when all debts are settled.

---

## 6. Deployment & Expo Account Configuration

* **`app.json`**:
  * Name: `TripMate`
  * Slug: `tripmate`
  * Android package: `com.tripmate.app`
  * Version: `1.0.0`
  * No `owner` property specified.
  * No `extra.eas.projectId` hardcoded.
* **`eas.json`**:
  * Configured for `preview` (APK build) and `production` (AAB Play Store bundle).
  * Ready for the user to run `eas login` and `eas build -p android --profile preview`.

---

## 7. Verification & Testing Strategy

1. **Type & Compilation Check**: `npx tsc --noEmit` within `mobile/` to ensure zero type errors.
2. **Business Logic Unit Tests**: Run parity checks verifying that `calculateBalances` and `calculateSettlements` in `mobile/src/lib/utils.ts` produce the exact same results as `src/lib/utils.ts`.
3. **App Launch & Screen Smoke Testing**: Validate that Expo initializes cleanly without bundling errors.
