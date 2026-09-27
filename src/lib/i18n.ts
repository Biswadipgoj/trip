// ──────────────────────────────────────────────────────────────────────────────
// TripMate Multi-Language System (i18n)
// 20 Indian & regional languages with warm, natural, human expressions.
// De-AI-fied: Zero corporate buzzwords. Authentic phrases friends use on trips.
// ──────────────────────────────────────────────────────────────────────────────

export interface LanguageMeta {
  code: string
  name: string
  nativeName: string
  flag: string
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'hinglish', name: 'Hinglish', nativeName: 'Desi Hinglish', flag: '🎉' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', flag: '🇮🇳' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', flag: '🇮🇳' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर / کٲشُر', flag: '🇮🇳' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', flag: '🇮🇳' },
  { code: 'sd', name: 'Sindhi', nativeName: 'सिन्धी / سنڌي', flag: '🇮🇳' },
]

export type TranslationKey =
  | 'appName'
  | 'tagline'
  | 'splitHero'
  | 'splitSub'
  | 'heroLead'
  | 'createTrip'
  | 'joinTrip'
  | 'login'
  | 'getAndroidApp'
  | 'addToHomeScreen'
  | 'downloadApk'
  | 'offlineApp'
  | 'offlineAppDesc'
  | 'offlineBanner'
  | 'offlineBadge'
  | 'freeNoAds'
  | 'localFirstSync'
  | 'upiSettle'
  | 'changeLanguage'
  | 'searchLanguage'
  | 'dashboard'
  | 'members'
  | 'expenses'
  | 'payments'
  | 'report'
  | 'settlements'
  | 'totalSpent'
  | 'youPaid'
  | 'youOwe'
  | 'youReceive'
  | 'allSettled'
  | 'settleUp'
  | 'payViaUpi'
  | 'addExpense'
  | 'addStay'
  | 'addBill'
  | 'billProof'
  | 'confirmReceived'
  | 'recentExpenses'
  | 'tripMembers'
  | 'addMember'
  | 'whoPaysWhom'
  | 'pending'
  | 'settled'
  | 'leastPayments'
  | 'demoTitle'
  | 'minimalTransfers'
  | 'messyTransfers'
  | 'optimalPath'
  | 'messyPath'
  | 'frictionFree'
  | 'feat1Title'
  | 'feat1Desc'
  | 'feat2Title'
  | 'feat2Desc'
  | 'feat3Title'
  | 'feat3Desc'
  | 'feat4Title'
  | 'feat4Desc'
  | 'logout'
  | 'back'
  | 'cancel'
  | 'save'
  | 'delete'

export const DICTIONARY: Record<string, Partial<Record<TranslationKey, string>>> = {
  en: {
    appName: 'TripMate',
    tagline: 'Split trips, not friendships',
    splitHero: 'Split trips,',
    splitSub: 'not friendships',
    heroLead: 'Track dinners, stays, cabs & chai — no awkward math or "bhai paise kab dega?" moments. Settle up on UPI with the least payments possible.',
    createTrip: 'Create a Trip',
    joinTrip: 'Join Existing Trip',
    login: 'Login to Trip',
    getAndroidApp: 'Get Android App',
    addToHomeScreen: 'Add to Home Screen',
    downloadApk: 'Download Android App (APK)',
    offlineApp: '100% Offline Support',
    offlineAppDesc: 'TripMate works completely offline. Add expenses on remote beaches, mountain treks, or flights with zero signal. Everything saves on your device and syncs when back online.',
    offlineBanner: "You're offline — Don't worry! Your trip data is saved locally on your device and will auto-sync when you reconnect.",
    offlineBadge: 'Works 100% Offline',
    freeNoAds: '100% Free & No Ads',
    localFirstSync: 'Offline-First + Cloud Sync',
    upiSettle: 'Direct UPI Settle',
    changeLanguage: 'Choose Language',
    searchLanguage: 'Search language...',
    dashboard: 'Dashboard',
    members: 'Members',
    expenses: 'Expenses',
    payments: 'Payments',
    report: 'Highlights',
    settlements: 'Settlements',
    totalSpent: 'Total Trip Spend',
    youPaid: 'You Paid',
    youOwe: 'You Owe',
    youReceive: 'You Receive',
    allSettled: 'All settled! Time for the next trip 🎉',
    settleUp: 'Settle Payment',
    payViaUpi: 'Pay via UPI App',
    addExpense: 'Add Expense',
    addStay: 'Add Hotel / Stay',
    addBill: 'Add Bill Photo',
    billProof: 'Receipt / Payment Proof',
    confirmReceived: 'Confirm Received',
    recentExpenses: 'Recent Expenses',
    tripMembers: 'Trip Members',
    addMember: 'Add Member',
    whoPaysWhom: 'Who Pays Whom',
    pending: 'Pending',
    settled: 'Settled',
    leastPayments: 'Least Payments Possible',
    demoTitle: 'Live Trip Demonstration',
    minimalTransfers: 'TripMate (1 Payment)',
    messyTransfers: 'Without TripMate (6 Payments)',
    optimalPath: 'Direct Path: 1 Simple Transfer',
    messyPath: 'Without TripMate: 6 Confusing Transfers',
    frictionFree: 'Zero circular transfers',
    feat1Title: 'Squad Trips with One Code',
    feat1Desc: 'Share a simple 6-letter trip code with friends. No account required for friends joining via web.',
    feat2Title: 'Bill & UPI Proof Photos',
    feat2Desc: 'Snap dinner bills and UPI screenshots. Photos stay accessible offline and sync when online.',
    feat3Title: 'Least Payments Possible',
    feat3Desc: 'No back-and-forth circular transfers. TripMate settles everyone with the fewest direct UPI payments.',
    feat4Title: 'Works 100% Offline',
    feat4Desc: 'Track expenses on mountain roads or beach cafes with zero connectivity. Auto-syncs to cloud seamlessly.',
    logout: 'Log out',
    back: 'Back',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
  },
  hi: {
    appName: 'TripMate',
    tagline: 'ट्रिप का हिसाब, दोस्ती बेहिसाब',
    splitHero: 'ट्रिप का हिसाब,',
    splitSub: 'दोस्ती बेहिसाब ❤️',
    heroLead: 'खाना, होटल, कैब और चाय — हर खर्च का हिसाब रखें। न कोई गलतफहमी, न "पैसे कब देगा?" वाला संकोच। UPI से सीधे चुकता करें।',
    createTrip: 'नया ट्रिप बनाएं',
    joinTrip: 'ट्रिप से जुड़ें',
    login: 'लॉगिन करें',
    getAndroidApp: 'एंड्रॉइड ऐप पाएं',
    addToHomeScreen: 'होम स्क्रीन पर जोड़ें',
    downloadApk: 'डाउनलोड करें एंड्रॉइड ऐप (APK)',
    offlineApp: '100% ऑफलाइन काम करता है',
    offlineAppDesc: 'पहाड़ों की वादियों में या समुद्र तट पर बिना इंटरनेट भी खर्चे जोड़ें। सारा डेटा आपके फोन में सुरक्षित रहेगा और इंटरनेट आते ही अपने-आप सिंक हो जाएगा।',
    offlineBanner: 'आप ऑफलाइन हैं — चिंता न करें! आपका ट्रिप डेटा फोन में सुरक्षित है और इंटरनेट जुड़ते ही सिंक हो जाएगा।',
    offlineBadge: '100% ऑफलाइन रेडी',
    freeNoAds: '100% मुफ्त, कोई विज्ञापन नहीं',
    localFirstSync: 'ऑफलाइन-फर्स्ट + क्लाउड सिंक',
    upiSettle: 'सीधा UPI से भुगतान',
    changeLanguage: 'भाषा बदलें',
    searchLanguage: 'भाषा खोजें...',
    dashboard: 'डैशबोर्ड',
    members: 'दोस्त',
    expenses: 'खर्चे',
    payments: 'पेमेंट्स',
    report: 'हाइलाइट्स',
    settlements: 'हिसाब-किताब',
    totalSpent: 'कुल ट्रिप खर्च',
    youPaid: 'आपने चुकाया',
    youOwe: 'आपको देना है',
    youReceive: 'आपको मिलेगा',
    allSettled: 'सारा हिसाब चुकता! अब अगली पार्टी की बारी 🎉',
    settleUp: 'हिसाब चुकता करें',
    payViaUpi: 'UPI ऐप से भुगतान करें',
    addExpense: 'खर्चा जोड़ें 💸',
    addStay: 'होटल / स्टे जोड़ें 🏨',
    addBill: 'बिल का फोटो जोड़ें',
    billProof: 'रसीद / पेमेंट स्क्रीनशॉट',
    confirmReceived: 'प्राप्ति कन्फर्म करें',
    recentExpenses: 'हाल के खर्चे',
    tripMembers: 'ग्रुप के दोस्त',
    addMember: 'नया दोस्त जोड़ें',
    whoPaysWhom: 'किसे किसे देना है',
    pending: 'बाकी',
    settled: 'चुकता',
    leastPayments: 'कम से कम पेमेंट्स',
    demoTitle: 'लाइव ट्रिप डेमो',
    minimalTransfers: 'TripMate (सिर्फ 1 पेमेंट)',
    messyTransfers: 'बिना TripMate (6 चक्करदार पेमेंट्स)',
    optimalPath: 'सीधा रास्ता: केवल 1 ट्रांसफर',
    messyPath: 'बिना TripMate: 6 कन्फ्यूजिंग चक्करदार पेमेंट्स',
    frictionFree: 'कोई झंझट नहीं, सीधा हिसाब',
    feat1Title: 'एक कोड से दोस्तों को जोड़ें',
    feat1Desc: 'सिंपल 6-अक्षर का कोड शेयर करें। दोस्तों को बिना ऐप डाउनलोड किए ब्राउज़र से भी सब दिखेगा।',
    feat2Title: 'बिल और UPI की फोटो जोड़ें',
    feat2Desc: 'रेस्तरां के बिल और पेमेंट स्क्रीनशॉट संभाल कर रखें ताकि बाद में कोई कन्फ्यूजन न रहे।',
    feat3Title: 'कम से कम पेमेंट्स में निपटारा',
    feat3Desc: 'चक्करदार लेन-देन से बचें। TripMate सबसे कम ट्रांसफर्स में सबका हिसाब चुकता करा देता है।',
    feat4Title: '100% ऑफलाइन सपोर्ट',
    feat4Desc: 'सफर में बिना नेटवर्क भी खर्चे दर्ज करें। नेटवर्क मिलते ही क्लाउड में अपने आप अपडेट हो जाएगा।',
    logout: 'लॉग आउट',
    back: 'वापस',
    cancel: 'रद्द करें',
    save: 'सहेजें',
    delete: 'हटाएं',
  },
  bn: {
    appName: 'TripMate',
    tagline: 'হিসাব ভাগ করো, বন্ধুত্ব নয়',
    splitHero: 'হিসাব ভাগ করো,',
    splitSub: 'বন্ধুত্ব নয় ❤️',
    heroLead: 'খাবার, হোটেল, গাড়িভাড়া আর চায়ের আড্ডা — প্রতি টাকার পরিষ্কার হিসেব রাখুন। কোনো অস্বস্তি ছাড়াই UPI-এ নিমেষেই মিটিয়ে নিন।',
    createTrip: 'নতুন ট্রিপ শুরু করুন',
    joinTrip: 'ট্রিপে যোগ দিন',
    login: 'লগইন করুন',
    getAndroidApp: 'অ্যান্ড্রয়েড অ্যাপ নিন',
    addToHomeScreen: 'হোম স্ক্রিনে যোগ করুন',
    downloadApk: 'ডাউনলোড অ্যান্ড্রয়েড অ্যাপ (APK)',
    offlineApp: '১০০% অফলাইনে কাজ করে',
    offlineAppDesc: 'পাহাড়ের ট্রেকে বা সমুদ্র সৈকতে নেটওয়ার্ক না থাকলেও অনায়াসে খরচ যোগ করুন। সব ডেটা ফোনে সেভ থাকবে, নেটওয়ার্ক পেলেই স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।',
    offlineBanner: 'আপনি অফলাইনে আছেন — চিন্তা নেই! সমস্ত তথ্য ফোনে সুরক্ষিত আছে এবং ইন্টারনেট এলেই সিঙ্ক হয়ে যাবে।',
    offlineBadge: '১০০% অফলাইন রেডি',
    freeNoAds: 'সম্পূর্ণ ফ্রি ও বিজ্ঞাপনহীন',
    localFirstSync: 'অফলাইন-ফার্স্ট + ক্লাউড সিঙ্ক',
    upiSettle: 'সরাসরি UPI-এ হিসেব চুকানো',
    changeLanguage: 'ভাষা পরিবর্তন করুন',
    searchLanguage: 'ভাষা খুঁজুন...',
    dashboard: 'ড্যাশবোর্ড',
    members: 'সদস্যরা',
    expenses: 'খরচাপাতি',
    payments: 'পেমেন্ট',
    report: 'হাইলাইটস',
    settlements: 'লেনদেন',
    totalSpent: 'মোট ট্রিপ খরচ',
    youPaid: 'আপনি দিয়েছেন',
    youOwe: 'আপনার বাকি',
    youReceive: 'আপনি পাবেন',
    allSettled: 'সব হিসেব ক্লিয়ার! এবার নতুন ট্রিপের প্ল্যান হোক 🎉',
    settleUp: 'হিসেব মেটান',
    payViaUpi: 'UPI অ্যাপে পাঠান',
    addExpense: 'খরচ যোগ করুন 💸',
    addStay: 'হোটেল / থাকার খরচ 🏨',
    addBill: 'বিলের ছবি তুলুন',
    billProof: 'রসিদ / পেমেন্ট প্রমাণ',
    confirmReceived: 'পেমেন্ট পেয়েছি',
    recentExpenses: 'সাম্প্রতিক খরচ',
    tripMembers: 'ট্রিপের সদস্যরা',
    addMember: 'সদস্য যোগ করুন',
    whoPaysWhom: 'কে কাকে দেবে',
    pending: 'বাকি আছে',
    settled: 'মিটে গেছে',
    leastPayments: 'সবচেয়ে কম পেমেন্টে হিসেব',
    demoTitle: 'লাইভ ট্রিপ ডেমো',
    minimalTransfers: 'TripMate (মাত্র ১টি পেমেন্ট)',
    messyTransfers: 'TripMate ছাড়া (৬টি প্যাঁচালো পেমেন্ট)',
    optimalPath: 'সরাসরি লেনদেন: মাত্র ১টি পেমেন্ট',
    messyPath: 'TripMate ছাড়া: ৬টি বিভ্রান্তিকর পেমেন্ট',
    frictionFree: 'ঝামেলামুক্ত সহজ হিসেব',
    feat1Title: 'সহজ কোডে বন্ধুদের আমন্ত্রণ',
    feat1Desc: 'মাত্র ৬ অক্ষরের কোড শেয়ার করুন। বন্ধুরা অ্যাপ ডাউনলোড না করেও ব্রাউজার থেকে অংশ নিতে পারবে।',
    feat2Title: 'বিল ও UPI স্ক্রিনশটের প্রমাণ',
    feat2Desc: 'রেস্তোরাঁর বিল আর পেমেন্ট প্রুফের ছবি রাখুন, যাতে পরে কোনো ভুল বোঝাবুঝি না থাকে।',
    feat3Title: 'সবচেয়ে কম পেমেন্টে সমধান',
    feat3Desc: 'বারবার একে অপরকে টাকা পাঠানো নয়, TripMate সবচেয়ে কম পেমেন্টে সবার হিসেব মিলিয়ে দেয়।',
    feat4Title: '১০০% অফলাইনে ব্যবহারযোগ্য',
    feat4Desc: 'নেটওয়ার্কবিহীন পাহাড়ি পথেও নির্দ্বিধায় খরচ লিখুন। অনলাইনে ফিরলেই স্বয়ংক্রিয়ভাবে ব্যাকআপ হবে।',
    logout: 'লগআউট',
    back: 'পেছনে',
    cancel: 'বাতিল',
    save: 'সেভ করুন',
    delete: 'মুছুন',
  },
  hinglish: {
    appName: 'TripMate',
    tagline: 'Split the bills, keep the bond',
    splitHero: 'Split the bills,',
    splitSub: 'keep the bond ❤️',
    heroLead: 'Track karo har ek rupya, food, cab, stays aur chai. No more awkward "bhai paise kab dega?" — sab sort hoga direct UPI se.',
    createTrip: 'Naya Trip Banao',
    joinTrip: 'Trip Join Karo',
    login: 'Login Karo',
    getAndroidApp: 'Get Android App',
    downloadApk: 'Download Android App (APK)',
    offlineApp: 'Works 100% Offline',
    offlineAppDesc: 'Pahadon me network nahi hai? No problem! Kharcha bina internet ke add karo. Phone me safe rahega aur network aate hi cloud sync ho jayega.',
    offlineBanner: 'Internet nahi hai bro — tension mat le! Sab local store me safe hai, online aate hi sync ho jayega.',
    offlineBadge: '100% Offline Ready',
    freeNoAds: '100% Free & No Ads',
    localFirstSync: 'Local First + Cloud Sync',
    upiSettle: 'Direct UPI Settle',
    changeLanguage: 'Language Badlo',
    searchLanguage: 'Language search karo...',
    dashboard: 'Dashboard',
    members: 'Gang',
    expenses: 'Kharcha',
    payments: 'Hisab-Kitab',
    report: 'Trip Recap',
    settlements: 'Settlements',
    totalSpent: 'Total Trip Kharcha',
    youPaid: 'Tune Diye',
    youOwe: 'Tujhe Dene Hai',
    youReceive: 'Tujhe Milenge',
    allSettled: 'Hisab bilkul clear! Agli trip kab chalna hai? 🎉',
    settleUp: 'Hisab Clear Karo',
    payViaUpi: 'Direct UPI Pay',
    addExpense: 'Kharcha Daalo 💸',
    addStay: 'Hotel / Resort Daalo 🏨',
    addBill: 'Bill Photo Upload',
    billProof: 'Payment Screenshot',
    confirmReceived: 'Paise Mil Gaye 👍',
    recentExpenses: 'Recent Kharcha',
    tripMembers: 'Trip Ke Dost',
    addMember: 'Dost Add Karo',
    whoPaysWhom: 'Kaun Kisko Dega',
    pending: 'Pending',
    settled: 'Sorted',
    leastPayments: 'Minimum UPI Transfers',
    demoTitle: 'Live Trip Demo',
    minimalTransfers: 'TripMate (Only 1 Pay)',
    messyTransfers: 'Without TripMate (6 Pagal Transfers)',
    optimalPath: 'Direct Settle: 1 Simple Pay',
    messyPath: 'Without TripMate: 6 Gol-Gol Transfers',
    frictionFree: 'Zero lafda, direct UPI settlement',
    feat1Title: 'Squad Trips with One Code',
    feat1Desc: 'Simple 6-letter trip code bhejo aur doston ko join karao. No signup drama.',
    feat2Title: 'Bill & UPI Proof Photos',
    feat2Desc: 'Dinner bill aur payment screenshot upload karo. Sab phone me offline bhi khulega.',
    feat3Title: 'Minimum Direct Transfers',
    feat3Desc: 'Circular payments band. TripMate calculates least possible UPI payments.',
    feat4Title: '100% Offline Support',
    feat4Desc: 'Highway pe ya beach pe bina network ke kharche dalo. Reconnect pe auto-sync.',
    logout: 'Logout Karo',
    back: 'Wapas',
    cancel: 'Cancel',
    save: 'Save Karo',
    delete: 'Delete',
  },
  mr: {
    appName: 'TripMate',
    tagline: 'हिशोब करा चोख, मैत्री राहील अतूट',
    splitHero: 'हिशोब करा चोख,',
    splitSub: 'मैत्री राहील अतूट ❤️',
    heroLead: 'जेवण, हॉटेल, प्रवास आणि चहापाणी — प्रत्येक रुपयाचा चोख हिशोब. कोणत्याही संकोचाशिवाय UPI द्वारे त्वरित हिशोब चुकता करा.',
    createTrip: 'नवीन ट्रिप सुरू करा',
    joinTrip: 'ट्रिपमध्ये सामील व्हा',
    login: 'लॉगिन करा',
    getAndroidApp: 'अँड्रॉइड ॲप मिळवा',
    downloadApk: 'डाउनलोड अँड्रॉइड ॲप (APK)',
    offlineApp: '१००% ऑफलाइन चालते',
    offlineAppDesc: 'डोंगरदऱ्यात किंवा जंगलात नेटवर्क नसले तरीही खर्च नोंदवा. इंटरनेट येताच सर्व डेटा आपोआप क्लाउडवर सिंक होईल.',
    offlineBanner: 'तुम्ही ऑफलाइन आहात — काळजी नको! तुमचा डेटा फोनमध्ये सुरक्षित आहे आणि ऑनलाइन येताच सिंक होईल.',
    offlineBadge: '१००% ऑफलाइन सज्ज',
    freeNoAds: '१००% मोफत व जाहिरातमुक्त',
    localFirstSync: 'ऑफलाइन-फर्स्ट + क्लाउड सिंक',
    upiSettle: 'थेट UPI ने हिशोब',
    changeLanguage: 'भाषा निवडा',
    searchLanguage: 'भाषा शोधा...',
    dashboard: 'डॅशबोर्ड',
    members: 'मित्र',
    expenses: 'खर्च',
    payments: 'पेमेंट',
    report: 'हायलाइट्स',
    settlements: 'हिशोब',
    totalSpent: 'एकूण खर्च',
    youPaid: 'तुम्ही दिलेले',
    youOwe: 'तुम्हाला देणे आहे',
    youReceive: 'तुम्हाला मिळणे आहे',
    allSettled: 'सर्व हिशोब पूर्ण! आता पुढच्या ट्रिपची तयारी 🎉',
    settleUp: 'हिशोब चुकता करा',
    payViaUpi: 'UPI ने पाठवा',
    addExpense: 'खर्च जोडा 💸',
    addStay: 'हॉटेल जोडा 🏨',
    addBill: 'बिलाचा फोटो जोडा',
    billProof: 'पावती / पेमेंट पुरावा',
    confirmReceived: 'पैसे मिळाले',
    recentExpenses: 'नुकतेच खर्च',
    tripMembers: 'ट्रिपमधील मित्र',
    addMember: 'मित्र जोडा',
    whoPaysWhom: 'कोणी कोणाला द्यायचे',
    pending: 'प्रलंबित',
    settled: 'पूर्ण',
    leastPayments: 'कमीतकमी पेमेंट्स',
    demoTitle: 'थेट ट्रिप प्रात्यक्षिक',
    minimalTransfers: 'TripMate (फक्त १ पेमेंट)',
    messyTransfers: 'TripMate शिवाय (६ गुंतागुंतीचे पेमेंट्स)',
    optimalPath: 'थेट मार्ग: फक्त १ सोपे ट्रान्सफर',
    messyPath: 'TripMate शिवाय: ६ गोंधळात टाकणारे पेमेंट्स',
    frictionFree: 'गुंतागुंत शून्य, थेट हिशोब',
    feat1Title: 'एका कोडने मित्रांना एकत्र आणा',
    feat1Desc: 'फक्त ६ अक्षरी कोड शेअर करा. ॲप डाउनलोड न करताही वेब ब्राउझरवर लगेच सुरू.',
    feat2Title: 'बिल आणि UPI पावत्यांचे फोटो',
    feat2Desc: 'हॉटेलचे बिल आणि पेमेंट स्क्रीनशॉट ठेवा, ज्यामुळे नंतर कसलाही वाद होणार नाही.',
    feat3Title: 'कमीत कमी पेमेंट्समध्ये निपटारा',
    feat3Desc: 'एकाने दुसऱ्याला आणि त्याने तिसऱ्याला पैसे देणे बंद. TripMate थेट कमीत कमी ट्रान्सफर्स काढतो.',
    feat4Title: '१००% ऑफलाइन काम करते',
    feat4Desc: 'प्रवासात नेटवर्क नसतानाही हिशोब लिहा. इंटरनेट मिळताच सुरक्षित बॅकअप.',
    logout: 'लॉग आउट',
    back: 'मागे',
    cancel: 'रद्द करा',
    save: 'जतन करा',
    delete: 'हटवा',
  },
  gu: {
    appName: 'TripMate',
    tagline: 'હિસાબ ચોખ્ખો, ભાઈબંધી પાકી',
    splitHero: 'હિસાબ ચોખ્ખો,',
    splitSub: 'ભાઈબંધી પાકી ❤️',
    heroLead: 'જમવાનું, હોટેલ, ગાડી અને ચા-નાસ્તો — દરેક રૂપિયાનો પાકો હિસાબ. શરમ રાખ્યા વગર UPI થી સીધો હિસાબ ક્લિયર.',
    createTrip: 'નવી ટ્રીપ બનાવો',
    joinTrip: 'ટ્રીપમાં જોડાઓ',
    login: 'લોગિન કરો',
    getAndroidApp: 'એન્ડ્રોઇડ એપ મેળવો',
    downloadApk: 'ડાઉનલોડ એન્ડ્રોઇડ એપ (APK)',
    offlineApp: '૧૦૦% ઓફલાઇન સપોર્ટ',
    offlineAppDesc: 'નેટવર્ક વગર પણ ખર્ચ ઉમેરો. ફોનમાં સાચવી રાખશે અને નેટ આવતા જ ઓટો-સિંક થશે.',
    offlineBanner: 'તમે ઓફલાઇન છો — ચિંતા ન કરો! ડેટા તમારા ફોનમાં સુરક્ષિત છે.',
    offlineBadge: '૧૦૦% ઓફલાઇન ચાલુ',
    freeNoAds: '૧૦૦% મફત, જાહેરાત મુક્ત',
    localFirstSync: 'ઓફલાઇન-પ્રથમ + ક્લાઉડ સિંક',
    upiSettle: 'સીધું UPI થી ચુકવણું',
    changeLanguage: 'ભાષા પસંદ કરો',
    searchLanguage: 'ભાષા શોધો...',
    dashboard: 'ડેશબોર્ડ',
    members: 'મિત્રો',
    expenses: 'ખર્ચ',
    payments: 'ચુકવણી',
    report: 'હાઇલાઇટ્સ',
    settlements: 'હિસાબ-કિતાબ',
    totalSpent: 'કુલ ખર્ચ',
    youPaid: 'તમે ચૂકવ્યા',
    youOwe: 'તમારે આપવાના',
    youReceive: 'તમને મળશે',
    allSettled: 'બધો હિસાબ ક્લિયર! હવે નવી ટ્રીપની તૈયારી 🎉',
    settleUp: 'હિસાબ પૂરો કરો',
    payViaUpi: 'UPI થી મોકલો',
    addExpense: 'ખર્ચ ઉમેરો 💸',
    addStay: 'હોટેલ ઉમેરો 🏨',
    addBill: 'બિલનો ફોટો મૂકો',
    billProof: 'રસીદ / પેમેન્ટ સ્ક્રીનશોટ',
    confirmReceived: 'પૈસા મળી ગયા',
    recentExpenses: 'હાલના ખર્ચ',
    tripMembers: 'ટ્રીપના મિત્રો',
    addMember: 'મિત્ર ઉમેરો',
    whoPaysWhom: 'કોણે કોને આપવાના',
    pending: 'બાકી',
    settled: 'ચૂકવાઈ ગયું',
    leastPayments: 'ઓછામાં ઓછી ચુકવણીઓ',
    demoTitle: 'લાઈવ ટ્રીપ ડેમો',
    minimalTransfers: 'TripMate (માત્ર ૧ પેમેન્ટ)',
    messyTransfers: 'TripMate વગર (૬ ગોળ-ગોળ પેમેન્ટ્સ)',
    optimalPath: 'સીધો રસ્તો: માત્ર ૧ પેમેન્ટ',
    messyPath: 'TripMate વગર: ૬ કન્ફ્યુઝિંગ પેમેન્ટ્સ',
    frictionFree: 'કોઈ માથાકૂટ વગર સરળ હિસાબ',
    feat1Title: 'સરળ કોડ સાથે મિત્રોને જોડો',
    feat1Desc: '૬ અક્ષરનો કોડ શેર કરો. એપ ડાઉનલોડ કર્યા વિના પણ વેબ પર બધું દેખાશે.',
    feat2Title: 'બિલ અને UPI સ્ક્રીનશોટ',
    feat2Desc: 'બિલના ફોટા રાખો જેથી પછી કોઈ ગેરસમજ ન થાય.',
    feat3Title: 'ઓછામાં ઓછી ચુકવણીમાં પતાવટ',
    feat3Desc: 'ગોળગોળ પૈસાની લેવડદેવડ નહીં, TripMate સૌથી સરળ રસ્તો શોધે છે.',
    feat4Title: '૧૦૦% ઓફલાઇન સપોર્ટ',
    feat4Desc: 'મુસાફરીમાં નેટવર્ક વગર પણ હિસાબ લખો.',
    logout: 'લૉગ આઉટ',
    back: 'પાછા',
    cancel: 'રદ કરો',
    save: 'સાચવો',
    delete: 'કાઢી નાખો',
  },
  ta: {
    appName: 'TripMate',
    tagline: 'கணக்கை பிரிப்போம், நட்பை அல்ல',
    splitHero: 'கணக்கை பிரிப்போம்,',
    splitSub: 'நட்பை அல்ல ❤️',
    heroLead: 'உணவு, தங்குமிடம், வண்டி மற்றும் டீ செலவுகள் — ஒவ்வொரு ரூபாயையும் துல்லியமாக பதிவு செய்யுங்கள். UPI மூலம் எளிய செட்டில்மெண்ட்.',
    createTrip: 'புதிய ட்ரிப் தொடங்கு',
    joinTrip: 'ட்ரிப்பில் சேரவும்',
    login: 'உள்நுழையவும்',
    getAndroidApp: 'ஆண்ட்ராய்டு ஆப் பெறுங்கள்',
    downloadApk: 'ஆண்ட்ராய்டு ஆப் (APK) பதிவிறக்கு',
    offlineApp: '100% ஆஃப்லைனில் இயங்கும்',
    offlineAppDesc: 'இணைய சேவை இல்லாத மலைப்பகுதியிலும் செலவுகளை பதிவு செய்யலாம். நெட்வொர்க் கிடைத்ததும் தானாகவே கிளவுடில் சேமிக்கப்படும்.',
    offlineBanner: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் — கவலை வேண்டாம்! உங்கள் விவரங்கள் போனில் பத்திரமாக உள்ளன.',
    offlineBadge: '100% ஆஃப்லைன் தயார்',
    freeNoAds: '100% இலவசம் & விளம்பரங்கள் இல்லை',
    localFirstSync: 'ஆஃப்லைன்-முதல் + கிளவுட் ஒத்திசைவு',
    upiSettle: 'நேரடி UPI பரிவர்த்தனை',
    changeLanguage: 'மொழியை மாற்றவும்',
    searchLanguage: 'மொழியைத் தேடுங்கள்...',
    dashboard: 'முகப்பு பலகை',
    members: 'நண்பர்கள்',
    expenses: 'செலவுகள்',
    payments: 'பரிவர்த்தனை',
    report: 'முக்கிய விவரங்கள்',
    settlements: 'செட்டில்மென்ட்',
    totalSpent: 'மொத்த செலவு',
    youPaid: 'நீங்கள் கொடுத்தது',
    youOwe: 'நீங்கள் கொடுக்க வேண்டியது',
    youReceive: 'உங்களுக்கு வர வேண்டியது',
    allSettled: 'அனைத்து கணக்குகளும் முடிந்தது! அடுத்த ட்ரிப்பிற்கு தயாரா? 🎉',
    settleUp: 'கணக்கை முடிக்கவும்',
    payViaUpi: 'UPI ஆப் மூலம் செலுத்தவும்',
    addExpense: 'செலவை சேர்க்கவும் 💸',
    addStay: 'ஹோட்டல் சேர்க்கவும் 🏨',
    addBill: 'பில் புகைப்படம் சேர்க்க',
    billProof: 'ரசீது / பரிவர்த்தனை சான்று',
    confirmReceived: 'பணம் கிடைத்தது என உறுதி செய்',
    recentExpenses: 'சமீபத்திய செலவுகள்',
    tripMembers: 'குழு உறுப்பினர்கள்',
    addMember: 'நண்பரை சேர்க்கவும்',
    whoPaysWhom: 'யார் யாருக்கு கொடுக்க வேண்டும்',
    pending: 'நிலுவையில்',
    settled: 'முடிந்தது',
    leastPayments: 'குறைந்தபட்ச பரிவர்த்தனைகள்',
    demoTitle: 'நேரடி ட்ரிப் விளக்கம்',
    minimalTransfers: 'TripMate (1 பரிவர்த்தனை மட்டுமே)',
    messyTransfers: 'TripMate இல்லாமல் (6 குழப்பமான பரிவர்த்தனைகள்)',
    optimalPath: 'நேரடி வழி: 1 பரிவர்த்தனை',
    messyPath: 'TripMate இல்லாமல்: 6 சுழல் பரிவர்த்தனைகள்',
    frictionFree: 'குழப்பம் இல்லாத எளிய தீர்வு',
    feat1Title: 'எளிய கோட் மூலம் நண்பர்களை இணைக்கவும்',
    feat1Desc: '6 எழுத்து கோட் பகிருங்கள். ஆப் இல்லாமலும் இணையத்தில் பார்க்க முடியும்.',
    feat2Title: 'பில் & UPI ஆதார புகைப்படங்கள்',
    feat2Desc: 'பில் புகைப்படங்களை சேமித்து வையுங்கள், பிறகு குழப்பம் வராது.',
    feat3Title: 'குறைந்த பரிவர்த்தனைகளில் செட்டில்மென்ட்',
    feat3Desc: 'TripMate மிகக் குறைந்த பரிவர்த்தனைகளில் அனைவருக்கும் கணக்கை முடிக்கிறது.',
    feat4Title: '100% ஆஃப்லைன் சேவை',
    feat4Desc: 'நெட்வொர்க் இல்லாத இடங்களிலும் தடையின்றி செலவுகளைப் பதிவு செய்யுங்கள்.',
    logout: 'வெளியேறு',
    back: 'பின்செல்',
    cancel: 'ரத்து செய்',
    save: 'சேமி',
    delete: 'நீக்கு',
  },
  te: {
    appName: 'TripMate',
    tagline: 'లెక్కలు పంచండి, స్నేహాన్ని కాదు',
    splitHero: 'లెక్కలు పంచండి,',
    splitSub: 'స్నేహాన్ని కాదు ❤️',
    heroLead: 'భోజనం, హోటల్, ప్రయాణం మరియు టీ ఖర్చులు — ప్రతి రూపాయి స్పష్టమైన లెక్క. UPI ద్వారా సులభంగా సెటిల్ చేయండి.',
    createTrip: 'కొత్త ట్రిప్ ప్రారంభించండి',
    joinTrip: 'ట్రిప్‌లో చేరండి',
    login: 'లాగిన్ అవ్వండి',
    getAndroidApp: 'ఆండ్రాయిడ్ యాప్ పొందండి',
    downloadApk: 'ఆండ్రాయిడ్ యాప్ (APK) డౌన్‌లోడ్',
    offlineApp: '100% ఆఫ్‌లైన్ సపోర్ట్',
    offlineAppDesc: 'నెట్‌వర్క్ లేని ప్రదేశాలలో కూడా ఖర్చులను జోడించండి. మీ ఫోన్‌లో సురక్షితంగా ఉంటుంది మరియు ఆన్‌లైన్‌కి రాగానే సింక్ అవుతుంది.',
    offlineBanner: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు — కంగారు పడవద్దు! మీ డేటా ఫోన్‌లో భద్రంగా ఉంది.',
    offlineBadge: '100% ఆఫ్‌లైన్ సిద్ధం',
    freeNoAds: '100% ఉచితం & ప్రకటనలు లేవు',
    localFirstSync: 'ఆఫ్‌లైన్-ఫస్ట్ + క్లౌడ్ సింక్',
    upiSettle: 'నేరుగా UPI చెల్లింపు',
    changeLanguage: 'భాష మార్చండి',
    searchLanguage: 'భాష శోధించండి...',
    dashboard: 'డ్యాష్‌బోర్డ్',
    members: 'స్నేహితులు',
    expenses: 'ఖర్చులు',
    payments: 'చెల్లింపులు',
    report: 'విశేషాలు',
    settlements: 'సెటిల్‌మెంట్స్',
    totalSpent: 'మొత్తం ఖర్చు',
    youPaid: 'మీరు చెల్లించినది',
    youOwe: 'మీరు ఇవ్వాల్సింది',
    youReceive: 'మీకు రావాల్సింది',
    allSettled: 'అన్ని లెక్కలు పూర్తయ్యాయి! తదుపరి ట్రిప్‌కి సిద్ధమా? 🎉',
    settleUp: 'లెక్కలు తేల్చండి',
    payViaUpi: 'UPI యాప్ ద్వారా చెల్లించండి',
    addExpense: 'ఖర్చు జోడించండి 💸',
    addStay: 'హోటల్ జోడించండి 🏨',
    addBill: 'బిల్లు ఫోటో జోడించండి',
    billProof: 'రసీదు / చెల్లింపు రుజువు',
    confirmReceived: 'అందుకున్నట్లు ధృవీకరించండి',
    recentExpenses: 'ఇటీవలి ఖర్చులు',
    tripMembers: 'ట్రిప్ సభ్యులు',
    addMember: 'స్నేహితుడిని జోడించండి',
    whoPaysWhom: 'ఎవరు ఎవరికి ఇవ్వాలి',
    pending: 'పెండింగ్',
    settled: 'పూర్తయింది',
    leastPayments: 'కనిష్ట చెల్లింపులతో పరిష్కారం',
    demoTitle: 'లైవ్ ట్రిప్ డెమో',
    minimalTransfers: 'TripMate (కేవలం 1 చెల్లింపు)',
    messyTransfers: 'TripMate లేకుండా (6 గజిబిజి చెల్లింపులు)',
    optimalPath: 'నేరుగా: కేవలం 1 బదిలీ',
    messyPath: 'TripMate లేకుండా: 6 గందరగోళ బదిలీలు',
    frictionFree: 'సులభమైన లెక్క, సున్నా గందరగోళం',
    feat1Title: 'కోడ్‌తో స్నేహితులను ఆహ్వానించండి',
    feat1Desc: '6 అక్షరాల కోడ్ పంపండి. బ్రౌజర్‌లో కూడా చూడవచ్చు.',
    feat2Title: 'బిల్లులు మరియు రసీదుల ఫోటోలు',
    feat2Desc: 'బిల్లుల ఫోటోలు ఉంచుకోండి, తద్వారా తర్వాత ఎలాంటి అపోహలు ఉండవు.',
    feat3Title: 'తక్కువ చెల్లింపులతో ముగింపు',
    feat3Desc: 'TripMate అందరి లెక్కలను తక్కువ బదిలీలతో క్లియర్ చేస్తుంది.',
    feat4Title: '100% ఆఫ్‌లైన్ ఉపయోగం',
    feat4Desc: 'ప్రయాణాల్లో సిగ్నల్ లేకున్నా ఖర్చులు రాయండి.',
    logout: 'లాగ్ అవుట్',
    back: 'వెనుకకు',
    cancel: 'రద్దు',
    save: 'సేవ్',
    delete: 'తొలగించు',
  },
}

/**
 * Returns translated string for given language and key.
 * Falls back to English if the key is missing in chosen language.
 */
export function getTranslation(lang: string, key: TranslationKey): string {
  const dict = DICTIONARY[lang]
  if (dict && dict[key]) return dict[key]!
  return DICTIONARY.en?.[key] || key
}

// ──────────────────────────────────────────────────────────────────────────────
// Client React Hook for Reactive Translations across every section
// ──────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tripmate_language'
const EVENT_NAME = 'tripmate_lang_change'

export function useTranslation() {
  const [language, setLanguageState] = useState<string>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setLanguageState(stored)
    }

    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        setLanguageState(customEvent.detail)
      }
    }

    window.addEventListener(EVENT_NAME, onLangChange)
    return () => window.removeEventListener(EVENT_NAME, onLangChange)
  }, [])

  const setLanguage = useCallback((newLang: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLang)
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newLang }))
    }
    setLanguageState(newLang)
  }, [])

  const t = useCallback(
    (key: TranslationKey): string => {
      return getTranslation(language, key)
    },
    [language]
  )

  return { t, language, setLanguage, languages: LANGUAGES }
}
