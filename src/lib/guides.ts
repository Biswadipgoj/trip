// Search landing pages ("split bills with friends", "trip expense splitter",
// "Splitwise alternative"). Each is a genuinely useful guide, not a keyword list:
// Google ranks pages that answer the question. The worked examples are checked
// against the app's real settlement engine in src/lib/__tests__/guides.test.ts,
// so the numbers on the page are exactly what TripMate would show.

export interface GuideExample {
  caption: string
  people: string[]
  /** Each expense is split equally between everyone. */
  expenses: { paidBy: string; what: string; amount: number }[]
  /** What TripMate settles to (verified by test). */
  settlements: { from: string; to: string; amount: number }[]
}

export interface Guide {
  slug: string
  /** <title> and Open Graph title. */
  title: string
  description: string
  h1: string
  lead: string
  sections: { h2: string; body: string[] }[]
  example: GuideExample
  faqs: { q: string; a: string }[]
}

const GOA: GuideExample = {
  caption: 'Four friends, one weekend in Goa, ₹20,000 spent',
  people: ['Asha', 'Ravi', 'Meera', 'Dev'],
  expenses: [
    { paidBy: 'Asha', what: 'Villa for two nights', amount: 12000 },
    { paidBy: 'Meera', what: 'Seafood dinner', amount: 4800 },
    { paidBy: 'Ravi', what: 'Cabs and scooters', amount: 3200 },
  ],
  settlements: [
    { from: 'Dev', to: 'Asha', amount: 5000 },
    { from: 'Ravi', to: 'Asha', amount: 1800 },
    { from: 'Meera', to: 'Asha', amount: 200 },
  ],
}

export const GUIDES: Guide[] = [
  {
    slug: 'split-bills-with-friends',
    title: 'Split Bills with Friends: Free Bill Splitter App (UPI)',
    description:
      'Split bills with friends in seconds. Add who paid, and TripMate works out who owes whom and the fewest payments to settle, by UPI or cash. Free, no ads, works offline.',
    h1: 'Split bills with friends, without the awkward maths',
    lead:
      'Dinners, rent, cabs, groceries, a weekend away: whenever a group shares costs, someone ends up doing sums on a napkin. TripMate keeps a shared list of who paid for what and tells everyone exactly who owes whom.',
    sections: [
      {
        h2: 'How to split a bill with friends in TripMate',
        body: [
          '1. Create a trip (or group) and share the code or invite link on WhatsApp.',
          '2. Whoever pays adds the expense: amount, what it was for, and who it was shared between.',
          '3. TripMate keeps a running balance for every person.',
          '4. When you are done, tap Settle up. TripMate shows the fewest payments needed. Pay through GPay, PhonePe or Paytm with the amount filled in, or hand over cash and mark it paid in cash.',
        ],
      },
      {
        h2: 'Split equally, or exactly how it happened',
        body: [
          'Not every bill is even. Split equally, by exact amounts, by percentage or by quantity; record one bill paid by two people; and split hotel rooms by who actually stayed in them. Couples can settle as one unit.',
        ],
      },
      {
        h2: 'Settle up in the fewest payments',
        body: [
          'If five friends each paid for different things, paying everyone back one by one could take a dozen transfers. TripMate nets everything out first, so most groups settle in a few payments. Record each one as paid by UPI (with a screenshot as proof) or in cash, and the balance updates for everyone.',
        ],
      },
    ],
    example: GOA,
    faqs: [
      {
        q: 'Is TripMate free?',
        a: 'Yes. TripMate is free to use on the web and on Android, with no ads.',
      },
      {
        q: 'Do my friends need to install an app?',
        a: 'No. Anyone can join from the browser with the trip code or invite link. There is also an Android app if they prefer.',
      },
      {
        q: 'Does TripMate handle the money?',
        a: 'No. TripMate never holds or moves money. You pay your friend directly, through your own UPI app or in cash.',
      },
      {
        q: 'Can I add expenses without internet?',
        a: 'Yes. Expenses are saved on your phone and sync to your group when you are back online.',
      },
    ],
  },
  {
    slug: 'trip-expense-splitter',
    title: 'Trip Expense Splitter and Group Travel Expense Calculator',
    description:
      'Split hotel rooms, cabs, meals and tickets on group trips. TripMate works out each share and the fewest payments to settle, by UPI or cash. Free and offline.',
    h1: 'The trip expense splitter for group travel',
    lead:
      'Group trips are the best, until the last evening, when everyone tries to work out who paid for the hotel, the cabs and the fourth round of chai. TripMate tracks it while you travel, so settling up takes a minute.',
    sections: [
      {
        h2: 'Built for Indian group trips',
        body: [
          '• Hotel stays split by room, including rooms with different prices.',
          '• Categories for stays, food, travel, fuel, tickets, shopping and more, with a report of where the money went.',
          '• A trip budget, so the group can see how much is left.',
          '• 20 Indian languages, including Hindi, Bengali, Marathi, Tamil and Telugu.',
        ],
      },
      {
        h2: 'Works offline',
        body: [
          'Mountain passes, beaches and flights rarely have signal. TripMate works fully offline: add expenses and bill photos anywhere, and everything syncs when you reconnect.',
        ],
      },
      {
        h2: 'Snap the bill, keep the proof',
        body: [
          'Attach bill photos to expenses and UPI screenshots to payments, so there is never an argument about what was paid.',
        ],
      },
    ],
    example: GOA,
    faqs: [
      {
        q: 'How do I calculate each person’s share of a trip?',
        a: 'Add every expense with who paid and who it was for. TripMate adds up what each person paid and what they owe, and the difference is their balance. The settle-up screen turns those balances into the fewest payments.',
      },
      {
        q: 'Can we split a hotel room by who stayed in it?',
        a: 'Yes. Add the stay with its rooms and who slept in each, and TripMate splits each room’s cost between its occupants.',
      },
      {
        q: 'Can more than one person pay for the same expense?',
        a: 'Yes. Record multiple payers on one expense and TripMate credits each of them.',
      },
      {
        q: 'Is there an app?',
        a: 'TripMate works in any browser, and there is a free Android app. On iPhone, add it to your Home Screen from Safari.',
      },
    ],
  },
  {
    slug: 'splitwise-alternative',
    title: 'Free Splitwise Alternative for India | TripMate',
    description:
      'Looking for a free Splitwise alternative in India? TripMate splits trip expenses, settles up by UPI or cash, works offline and supports 20 Indian languages.',
    h1: 'A free Splitwise alternative, made for India',
    lead:
      'If you are looking for a different way to split group expenses, TripMate is a free option built around how people in India travel and pay: UPI settlements, offline use and regional languages.',
    sections: [
      {
        h2: 'What TripMate offers',
        body: [
          '• Free, with no ads.',
          '• Settle up by UPI (GPay, PhonePe or Paytm open with the amount filled in) or in cash.',
          '• Works fully offline and syncs later.',
          '• Hotel rooms, multiple payers, couples and sponsorships.',
          '• Bill photos and payment screenshots attached to expenses.',
          '• 20 Indian languages.',
          '• No sign-up email or password: log in with your mobile number and a 4-digit PIN.',
        ],
      },
      {
        h2: 'Switching is simple',
        body: [
          'Create a trip, share the invite link on your group chat, and start adding expenses. Friends can join from the browser in seconds; nobody needs to install anything.',
        ],
      },
    ],
    example: GOA,
    faqs: [
      {
        q: 'Is TripMate really free?',
        a: 'Yes, TripMate is free on the web and Android, and it has no ads.',
      },
      {
        q: 'Can we settle by UPI or cash?',
        a: 'Both. Paying by UPI opens your UPI app with the payee and amount filled in. Paying in cash, you mark it paid in cash. TripMate itself never handles money.',
      },
      {
        q: 'Can I use it without internet?',
        a: 'Yes. TripMate is offline-first: add expenses anywhere and they sync when you reconnect.',
      },
    ],
  },
]

export const guideBySlug = (slug: string) => GUIDES.find(g => g.slug === slug)
