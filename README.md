# TripMate — Premium Group Expense Manager

A modern, premium, production-ready trip expense management application built with Next.js 15, Tailwind CSS, Framer Motion, and Supabase.

![TripMate Banner](https://img.shields.io/badge/TripMate-Premium%20Expense%20Manager-6366f1?style=for-the-badge)

---

## ✨ Features

### Core
- 🗺️ **Create & Join Trips** — Unique trip codes, password-protected
- 👥 **Member Management** — Avatars, UPI IDs, live balances
- 💸 **Multi-Split Expenses** — Equal, Custom Amount, Percentage, Quantity splits
- 🏨 **Hotel & Room Management** — Flexible room allocation with per-occupant billing
- 🤝 **Settlement Groups** — Couples/families settle as one entity
- 🎗️ **Sponsorship Mode** — One member financially covers another
- 📊 **Auto Settlement** — Minimized-debt greedy algorithm
- 📱 **UPI Payments** — QR codes, deep links, pay button
- 🏆 **Auto Trip Closure** — Celebration when all balances settle
- 📄 **PDF Reports** — Full trip analytics export

### Motion & UX
- 🎭 **Physics Animations** — Every interaction has spring-based feedback
- 🌊 **Ripple Effects** — Touch-reactive ripple on all interactive elements
- 🎰 **Slot Counter** — Numbers roll like a slot machine on change
- 🃏 **Magnetic Cards** — 3D tilt + cursor attraction on hover
- 🎊 **Confetti Celebration** — Trip completion experience
- ⚡ **60 FPS** — GPU-accelerated animations throughout

---

## 🚀 Quick Start

### Prerequisites
- [Node.js 18+](https://nodejs.org/en/download) (LTS recommended)
- [Supabase](https://supabase.com) account (optional — app works offline with localStorage)

### Installation

```bash
# Clone the repository
git clone https://github.com/Biswadipgoj/trip.git
cd trip

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Supabase Setup (Required for cross-device join & sync)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) → Run
3. Copy your project URL and anon key
4. Create `.env.local` (and set the same variables in Vercel → Project → Settings → Environment Variables):

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

With Supabase configured, **Join Trip** validates the invite code/link against
the real trip in the database, attaches the member to that **existing** trip
(never creating a new one), and syncs members, expenses and settlements across
all devices. Without these variables the app runs in **localStorage mode**:
fully functional on a single device, but invite links can't share live data
across devices.

---

## 🗂️ Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── login/              # Auth screens
│   ├── create-trip/
│   ├── join-trip/
│   ├── dashboard/[tripId]/ # Trip dashboard
│   ├── members/[tripId]/   # Member management
│   ├── expenses/[tripId]/  # Expense tracking
│   ├── settlements/[tripId]/ # Settlement routes
│   ├── payments/[tripId]/  # UPI payments
│   └── report/[tripId]/    # PDF report
├── components/
│   ├── animations/         # Framer Motion components
│   │   ├── PhysicsButton   # Spring button with ripple
│   │   ├── MagneticCard    # 3D tilt card
│   │   ├── SlotCounter     # Rolling number animation
│   │   ├── ConfettiBlast   # Celebration effects
│   │   └── FadeIn          # Entrance animations
│   └── shared/             # Reusable UI components
├── lib/
│   ├── store.ts            # Zustand state (persisted)
│   ├── utils.ts            # Business logic + calculations
│   └── supabase.ts         # Supabase client + types
├── hooks/
│   ├── useRipple.ts        # Ripple effect hook
│   └── usePhysics.ts       # Magnetic + tilt hooks
├── types/
│   └── index.ts            # TypeScript definitions
└── supabase/
    └── schema.sql          # Complete Supabase SQL schema
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| State | Zustand (persisted localStorage) |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |
| QR Codes | qrcode.react |
| PDF Export | jsPDF + html2canvas |

---

## 💡 Key Business Logic

### Split Types
| Type | Description | Example |
|---|---|---|
| Equal | Amount ÷ participants | Dinner for 4 |
| Custom | Direct amount per person | Exact contributions |
| Percentage | % of total per person | Ownership shares |
| Quantity | Proportional to units | Beer bottles |

### Settlement Algorithm
Uses a **minimized-debt greedy algorithm** that:
1. Calculates raw balances from all expenses + hotel rooms
2. Applies sponsorships (sponsored member's debt → sponsor)
3. Merges settlement groups (couples/families as one entity)
4. Runs greedy creditor-debtor matching to minimize total transactions

### Hotel Room Splitting
```
Room A: ₹3000 / 3 occupants = ₹1000 each
Room B: ₹2000 / 2 occupants = ₹1000 each
```
Each room calculated independently — no equal-room assumptions.

---

## 🗄️ Database Schema

See [`supabase/schema.sql`](./supabase/schema.sql) for the complete schema including:
- Tables with proper constraints and indexes
- RLS policies for Supabase anon access
- Realtime subscription configuration
- Views: `member_balances`, `trip_summary`
- Optional seed data for testing

---

## 📱 Running

```bash
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © [Biswadip Goj](https://github.com/Biswadipgoj)
