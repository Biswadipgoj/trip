# TripMate

TripMate is a modern trip expense and settlement app built for groups who want to track shared spending without confusion. It helps friends, families, and travel groups split bills, manage room costs, settle balances, and keep everything in sync across devices.

Whether you're planning a trip, sharing hotel stays, or tracking everyday expenses on the go, TripMate gives you a clear view of who paid, who owes what, and how to settle everything with the least number of transactions.

## What the project does

TripMate lets a group create a trip, add members, and manage shared expenses in one place. Each expense can be split using different rules:

- Equal split
- Custom amount
- Percentage-based split
- Quantity-based split

The app also supports:

- Hotel and room cost allocation
- Member and settlement grouping
- Sponsorship-based support between travelers
- Smart auto-settlement logic to minimize debt
- UPI payment links and QR sharing
- PDF reports for trip summaries
- Offline-first behavior with optional Supabase sync
- Real-time collaboration across devices

## Why it exists

Travel groups often end up with messy spreadsheets, delayed reimbursements, and unclear balances. TripMate centralizes the money math so the group can focus on the trip instead of chasing payments.

It is designed for situations where:

- multiple people share costs across the same trip
- room allocations and hotel bills need to be split fairly
- not everyone pays the same amount for everything
- expenses need to be settled automatically and clearly
- payments need to be shared quickly and transparently

## Key features

### Group trip management
- Create a trip with a unique invite code
- Invite members and track their balances
- Manage traveler profiles with UPI details
- Track trip activity in a single dashboard

### Smart expense handling
- Add expenses with dates, categories, and notes
- Split payments among members using flexible logic
- Handle hotel rooms and occupant-level billing intelligently
- Support custom and aggregate allocations

### Settlement and reconciliation
- Automatically compute each member's net balance
- Support settlement groups such as couples or families
- Minimize debt and simplify repayment flows
- Highlight who needs to pay whom

### Payment experience
- Generate UPI payment links
- Show QR codes for payments
- Include payment details that are easy to share
- Support faster settlement flows during the trip

### Analytics and reporting
- View balance summaries and trip insights
- Export reports for documentation or closing a trip
- Evaluate trip performance and outstanding amounts

### Mobile + web support
- Web app for desktop and responsive usage
- Mobile app for on-the-go expense tracking
- Shared trip data and synchronization through Supabase
- Offline-friendly behavior with delayed sync when back online

## Architecture

This repository contains both the main web product and the mobile app:

- Web app: Next.js + TypeScript + Tailwind CSS
- Mobile app: Expo / React Native
- Backend and sync layer: Supabase
- State management: Zustand
- Motion and UI polish: Framer Motion

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- Framer Motion
- Recharts
- jsPDF + html2canvas
- Expo / React Native

## Project structure

```text
trip/
├── src/                  # Web app source
├── mobile/              # React Native app
├── supabase/            # Database schema and SQL configuration
├── public/              # Static assets
├── docs/                # Documentation
├── scripts/             # Helper scripts
├── package.json         # Web app dependencies and scripts
├── README.md            # Project overview
├── handoff.md           # Project handoff notes
└── setup.bat            # Windows helper script
```

## Use cases

TripMate is suitable for:

- family vacations
- friend group trips
- bachelor or bachelorette travel
- office outings and shared travel expenses
- any situation where multiple people need to split costs fairly

## Summary

TripMate is a complete travel expense manager designed to reduce financial friction during shared trips. It combines trip planning, expense splitting, settlement tracking, payment support, and collaborative sync in a polished user experience.

The goal is simple: make group money management transparent, automated, and stress-free.
