# Design review: app buttons, UPI/₹ method cards, network banner (2026-09-28)

Scope: `mobile/src/components/ui/{Button,PayMarks,NetworkBanner}.tsx`, `mobile/src/app/payment-modal.tsx`.
Checked in the Expo web export (same components as Android) with Playwright + axe-core 4.x, Pixel 7 viewport.

## Findings and fixes
| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | Offline signal sweep looped forever (perpetual motion, battery) | 3 sweeps, then the bars rest | code: `withRepeat(..., 3)` |
| 2 | Offline card covered the trip header (title, language, Log out) for the whole outage | Auto-tucks after 4 s into a small pill that glides below the top bar; tap to expand | tucked pill does not overlap Log out / EN / title (bounding boxes + screenshot) |
| 3 | "Preferred" tag text 3.72:1 (WCAG AA needs 4.5) | `#0B6147` on its tint (≈6.2:1) | axe: 0 violations on the payment screen |
| 4 | UPI arrows drawn twice on the UPI card | Arrows only in the mark tile; wordmark alone in the label row | screenshot |

## Checks
- States: method cards show spinner while busy, both disabled during any action (no double submit); cash asks for confirmation ("Paid ₹1,200 in cash?"); offline marking is queued by the existing outbox; recipient still has to confirm, so "Paid" never claims a settled payment.
- Keyboard (web): Close → Copy UPI ID → Pay via UPI → QR → Camera → Screenshot → Paid by UPI → Paid in cash; visible focus on each; Enter on the cash card opens its confirm dialog.
- Screen readers: cards announce "Paid by UPI, preferred. GPay, PhonePe, Paytm or any UPI app"; banner is a polite live region with a hint for tap-to-expand.
- Touch targets: method cards 380×86, pill ≥ 38 pt tall.
- Reduced motion: banner fades only (no spring, no sweep); offline → tuck → expand → back online → gone all pass with `reducedMotion: 'reduce'`.
- Copy: plain statements, no filler ("No internet" / "Keep going. Everything is saved on this phone and syncs when you’re back." / "Back online · Syncing your trip now"); Hindi provided, other languages fall back to English.
- Performance: no new dependencies (react-native-svg already installed); animations use transform/opacity only.
- Not verified: on a physical Android device (TalkBack, real network loss).
