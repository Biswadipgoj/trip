# TripMate Mobile — Premium Android Group Expense Manager 🌴✈️

A modern, vibrant, production-ready Android mobile application built with the **Expo framework**, **React Native**, **Expo Router**, and **React Native Reanimated**.

---

## ✨ Features

- 🏖️ **100% Business Logic Fidelity**: Exact mathematical parity with the web version — paise-accurate equal split, custom amounts, percentages, quantities, and independent hotel room allocations.
- 🤝 **Settlement Groups & Sponsorships**: Couples/families settle as one financial unit; sponsors financially absorb another member's debt.
- ⚡ **Greedy Debt Minimizer**: Calculates the fewest possible transactions to settle all debts in seconds.
- 💳 **1-Tap Native UPI Payments**: Launch Google Pay, PhonePe, Paytm, or BHIM directly using native `upi://pay` deep links or scan on-screen QR codes.
- 🔗 **Shortened Sharing URLs**: Generate clean, compact join links (`https://tripmate.app/join?c=TRP-ABCD`) and WhatsApp-friendly share messages with emojis.
- 🎨 **Vibrant Light Design**: High brightness, playful pastel and vivid gradients (Sunset Tangerine, Ocean Azure, Mint Emerald, Berry Violet, Honey Gold), soft glowing drop shadows, and rich emojis across categories and badges.
- 🚀 **60 FPS Physics Animations**: Built with hardware-accelerated React Native Reanimated — tactile spring buttons, rolling slot counter balances, pulsing status badges, and full-screen celebration confetti.
- 🔒 **PIN-Protected Security**: 4-digit PIN security lock for each member with custom numeric touch keypad.
- 📱 **Account-Agnostic Expo Config**: Zero locked account credentials — ready for you to deploy with your personal Expo/EAS account anytime.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- [Expo Go](https://expo.dev/go) app on your Android phone, or Android Studio Emulator

### Running Locally
```bash
# Navigate to mobile directory
cd mobile

# Install dependencies (already installed)
npm install

# Start the Expo development server
npx expo start
```
Scan the QR code in the terminal using the **Expo Go** Android app to launch the app instantly with live fast-refresh.

---

## 📦 Building Standalone Android APK / App Bundle (EAS)

The configuration in `app.json` and `eas.json` is clean and account-agnostic (package `com.tripmate.app`), with no pre-linked account IDs.

When you are ready to build the APK under your personal Expo account:

```bash
# 1. Log in to your Expo account
npx eas login

# 2. Initialize project link to your Expo account
npx eas project:init

# 3. Build a standalone Android APK (preview profile)
npx eas build -p android --profile preview

# 4. Or build an Android App Bundle (AAB) for Google Play Store
npx eas build -p android --profile production
```

---

## 🗂️ Project Structure

```
mobile/
├── app.json                          # Clean Expo config (package: com.tripmate.app)
├── eas.json                          # Preview APK and Production AAB build profiles
├── package.json                      # React Native & Expo SDK dependencies
├── tsconfig.json                     # TypeScript config with @/* path aliases
└── src/
    ├── app/                          # Expo Router file-based screens
    │   ├── _layout.tsx               # Root stack layout, safe area & status bar
    │   ├── index.tsx                 # Welcome screen & active trips hub
    │   ├── create-trip.tsx           # Create Trip modal (Name, budget, PIN, UPI)
    │   ├── join-trip.tsx             # Join Trip modal (Smart code & short URL parser)
    │   ├── login.tsx                 # Member PIN security lock screen
    │   ├── (tabs)/                   # Primary app tabs
    │   │   ├── _layout.tsx           # Bottom tab bar with active indicator pills
    │   │   ├── dashboard.tsx         # Trip overview, net balance rolling counter, stats
    │   │   ├── expenses.tsx          # Expense stream, search, category filters
    │   │   ├── members.tsx           # Member cards, couples groups, sponsorships
    │   │   └── settlements.tsx       # Greedy routes, UPI pay button, celebration
    │   ├── add-expense.tsx           # Equal, custom, %, qty split modal
    │   ├── add-hotel.tsx             # Room allocation & per-room occupants modal
    │   ├── payment-modal.tsx         # UPI QR code & 1-tap native intent launcher
    │   └── report.tsx                # Trip analytics & category breakdown report
    ├── components/
    │   ├── animated/                 # SpringPressable, SlotCounter, PulseBadge, ConfettiBlast
    │   └── ui/                       # Avatar, CategoryChip, GlassCard
    ├── lib/
    │   ├── store.ts                  # Zustand state store with AsyncStorage persistence
    │   ├── utils.ts                  # 100% exact business logic calculations port
    │   ├── utils.test.ts             # Parity verification unit tests
    │   └── supabase.ts               # Optional Supabase client for multi-device sync
    └── theme/
        ├── colors.ts                 # Vibrant light pastel palette & gradients
        └── typography.ts             # Typography tokens
```
