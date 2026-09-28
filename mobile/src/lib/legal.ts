// Privacy Policy and Terms of Service, shown on the web pages (/privacy, /terms)
// and the Android app. mobile/src/lib/legal.ts must stay identical; a parity
// test (mobile/__tests__/legalParity.test.ts) fails if the two drift apart.
//
// Every statement here describes what the code actually does. When behaviour
// changes (new data, new provider, new retention), update this file and bump
// LEGAL_UPDATED.

export const LEGAL_UPDATED = '28 September 2026'
export const LEGAL_OPERATOR = 'Biswodip Goj'

export interface LegalSection {
  title: string
  /** Paragraphs; a line starting with "• " is rendered as a bullet. */
  body: string[]
}

export interface LegalDoc {
  title: string
  summary: string
  sections: LegalSection[]
}

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  summary:
    'TripMate collects only what it needs to split trip costs with your group. No ads, no tracking scripts, and we never sell your data.',
  sections: [
    {
      title: 'Who we are',
      body: [
        `TripMate is a group trip expense app on the web and on Android, built and run by ${LEGAL_OPERATOR} ("we", "us"). This policy explains what information TripMate handles, why, and the choices you have.`,
      ],
    },
    {
      title: 'Information you give us',
      body: [
        '• Your name and 10-digit mobile number, so your group knows who you are and you can find your trips when you log in.',
        '• A 4-digit PIN. On our servers it is stored only as a one-way hash, so nobody, including us, can read it back.',
        '• Trip details you and your group add: trip name, code and password, expenses (amounts, categories, notes, who paid and who shared), hotel stays and rooms, sponsorships, settlements, and whether each one was paid by UPI or in cash.',
        '• UPI IDs and names that members choose to add so others can pay them.',
        '• Bill photos and UPI payment screenshots you attach. Photos are compressed on your device before upload.',
      ],
    },
    {
      title: 'Information collected automatically',
      body: [
        '• Login cookies. The website keeps your login in two httpOnly cookies that page scripts cannot read: a short-lived access token and a refresh token that lasts up to 90 days while you keep using TripMate.',
        '• A session record for each logged-in browser: a hash of the refresh token, the trips it can open, your browser or app description (user agent) and when it was last used. This lets you log out and lets us end stolen sessions.',
        '• Abuse protection. To stop PIN guessing, we count login attempts against your network (IP) address and mobile number for a short time, and lock a member for 15 minutes after 5 wrong PINs.',
        '• Standard server logs kept by our hosting providers, such as request times and IP addresses.',
      ],
    },
    {
      title: 'Information kept on your device',
      body: [
        'So TripMate works offline, trips you open are saved on your phone or in your browser, together with your language choice and the mobile number you last logged in with. This stays on your device until you log out, clear the app data or uninstall. Your PIN is never saved on the device.',
      ],
    },
    {
      title: 'What we do not do',
      body: [
        '• No advertising and no third-party analytics or tracking scripts.',
        '• We do not sell or rent your information.',
        '• TripMate does not read your contacts, SMS or location. The Android app uses the camera and photos only when you choose to attach a bill or screenshot.',
      ],
    },
    {
      title: 'How we use information',
      body: [
        'Only to run TripMate: showing your trips to their members, calculating who owes whom, syncing between your devices, keeping your account secure and answering your requests. We do not use it for profiling or marketing.',
      ],
    },
    {
      title: 'Who can see your information',
      body: [
        '• Members of a trip can see that trip: member names and mobile numbers, expenses, stays, settlements, UPI IDs and attached photos.',
        '• Our service providers process data on our behalf: Supabase (database and file storage), Vercel (website hosting) and Expo (delivering Android app updates). Their servers may be outside India.',
        '• We may disclose information if the law requires it.',
      ],
    },
    {
      title: 'How long we keep it',
      body: [
        '• Trip data is kept until the trip is deleted or you ask us to delete it.',
        '• Login sessions end when you log out, or after 90 days without use.',
        '• Login-attempt counters are cleared within a day.',
      ],
    },
    {
      title: 'Security',
      body: [
        'We use HTTPS, hashed PINs, httpOnly cookies, rate limits and server-side access checks. No system is perfectly secure, so keep your PIN and trip password private and tell us if you suspect misuse.',
      ],
    },
    {
      title: 'Your choices and rights',
      body: [
        'You can ask to see, correct or delete your information, or withdraw consent, by contacting us. Depending on the law that applies to you, including India’s Digital Personal Data Protection Act, 2023, you may have further rights, and we will respond within a reasonable time.',
      ],
    },
    {
      title: 'Children',
      body: [
        'TripMate is not intended for anyone under 18 unless a parent or guardian has agreed to their use.',
      ],
    },
    {
      title: 'Changes to this policy',
      body: [
        'If we change how TripMate handles information, we will update this page and its date. Significant changes will be shown in the app before they take effect.',
      ],
    },
    {
      title: 'Contact',
      body: [`For questions or requests about your data, contact ${LEGAL_OPERATOR}, who runs TripMate.`],
    },
  ],
}

export const TERMS_OF_SERVICE: LegalDoc = {
  title: 'Terms of Service',
  summary:
    'TripMate helps you record and split group costs. It never holds or moves your money, so check amounts before you pay.',
  sections: [
    {
      title: 'Agreement',
      body: [
        `These terms are an agreement between you and ${LEGAL_OPERATOR}, who operates TripMate. By creating, joining or using a trip on the website or the Android app, you accept them. If you do not agree, please do not use TripMate.`,
      ],
    },
    {
      title: 'Who can use TripMate',
      body: [
        'You must be 18 or older, or use TripMate with the permission of a parent or guardian.',
      ],
    },
    {
      title: 'What TripMate is, and is not',
      body: [
        '• TripMate is a tool for recording shared expenses and working out who owes whom.',
        '• It is not a bank, wallet or payment service and never holds or transfers money. You settle up through your own UPI app or in cash, directly with the person you pay.',
        '• Balances and suggested settlements are calculated from what your group enters. Check the amounts before you pay. We are not responsible for mistaken entries or payments.',
      ],
    },
    {
      title: 'Your account and PIN',
      body: [
        'Each trip membership is protected by your mobile number and a 4-digit PIN. Keep your PIN and the trip password private; you are responsible for what is done with them. Tell us promptly if you think someone else has accessed your trip.',
      ],
    },
    {
      title: 'Your content',
      body: [
        'You keep ownership of the details and photos you add. You allow us to store, process and show them to the members of your trip only to provide TripMate. Only upload content you have the right to share, and avoid uploading other people’s sensitive personal information beyond what the trip needs.',
      ],
    },
    {
      title: 'Acceptable use',
      body: [
        'Do not use TripMate to break the law, harass anyone, or upload harmful content. Do not try to access trips you are not a member of, guess PINs, overload or scrape the service, or interfere with its security.',
      ],
    },
    {
      title: 'The Android app',
      body: [
        'The TripMate Android app is an APK you download from tripmate.boats. Download it only from there. Android will ask you to allow the install, and app updates may arrive automatically.',
      ],
    },
    {
      title: 'Offline use',
      body: [
        'Changes you make offline are saved on your device and synced when you reconnect. If you clear the app data or lose the device before it syncs, those changes can be lost.',
      ],
    },
    {
      title: 'Availability and changes',
      body: [
        'TripMate is free. We may improve, change or stop parts of it, and we cannot promise it will always be available or error-free.',
      ],
    },
    {
      title: 'Disclaimer and liability',
      body: [
        'TripMate is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, or for losses from incorrect entries, payments made between users, or events outside our reasonable control. Nothing in these terms limits rights you have under law that cannot be excluded.',
      ],
    },
    {
      title: 'Ending your use',
      body: [
        'You can stop using TripMate at any time and ask us to delete your data. We may suspend access that breaks these terms or puts other users at risk.',
      ],
    },
    {
      title: 'Governing law',
      body: ['These terms are governed by the laws of India.'],
    },
    {
      title: 'Changes to these terms',
      body: [
        'We may update these terms. The date at the top shows the latest version; significant changes will be shown in the app before they apply.',
      ],
    },
    {
      title: 'Contact',
      body: [`For questions about these terms, contact ${LEGAL_OPERATOR}, who runs TripMate.`],
    },
  ],
}
