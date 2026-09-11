import { Language } from '../types';

export const translations = {
  bn: {
    // Navigation Tabs
    tabBilling: 'বিলিং',
    tabInvoices: 'রশিদ হিস্ট্রি',
    tabCashbook: 'ক্যাশ খাতা',
    tabDue: 'বাকি ও পাওনাদার',
    tabPurchases: 'মাল কেনাকাটা (বাজার)',

    // Header & Actions
    appName: 'পিওএস ও বিল প্রিন্টার',
    printerReady: 'প্রিন্টার প্রস্তুত',
    printerDisconnected: 'প্রিন্টার সংযোগ বিচ্ছিন্ন',
    connecting: 'সংযুক্ত হচ্ছে...',
    connectPrinter: 'প্রিন্টার কানেক্ট করুন',
    printTestSlip: 'টেস্ট স্লিপ প্রিন্ট',
    pairDifferent: 'অন্য প্রিন্টার পেয়ার করুন',
    disconnect: 'ডিসকানেক্ট করুন',
    forgetPrinter: 'প্রিন্টার মুছে ফেলুন',
    settings: 'দোকান সেটিংস',
    userAccount: 'ইউজার অ্যাকাউন্ট',
    languageName: 'English',
    languageToggleTitle: 'Switch to English',

    // Purchase Trips / মাল কেনাকাটা ট্র্যাকার
    purchaseHeaderTitle: 'দোকানের মাল কেনাকাটা ও ব্যয় ট্র্যাকার',
    purchaseHeaderSubtitle:
      'বাজার থেকে দোকানের জন্য মাল কেনার বাজেট, সাথে নেওয়া ক্যাশ ও কোথায় কত খরচ হলো তার নির্ভুল হিসাব',
    startNewTripBtn: '+ নতুন কেনাকাটা / বাজার ট্রিপ শুরু করুন',
    activeTripsHeading: 'চলমান কেনাকাটার ট্রিপ (Active Shopping Trips)',
    completedTripsHeading: 'সম্পন্ন কেনাকাটার রেকর্ড (Completed Trips)',
    noActiveTrips:
      'বর্তমানে কোনো চলমান বাজার ট্রিপ নেই। আজকে দোকানে মাল কিনতে যাওয়ার আগে নিচের বাটনে ক্লিক করে সাথে নেওয়া ক্যাশ টাকা এন্ট্রি করুন।',
    noCompletedTrips: 'কোনো সম্পন্ন কেনাকাটার রেকর্ড নেই।',
    newTripModalTitle: 'আজকে মাল কিনতে যাচ্ছেন? সাথে কত টাকা নিয়ে যাচ্ছেন এন্ট্রি করুন',
    tripTitleLabel: 'বাজার বা কেনাকাটার উদ্দেশ্য (Trip Title) *',
    tripTitlePlaceholder: 'যেমন: চকবাজার থেকে পাইকারি শাড়ি ও থান কাপড় কেনা',
    tripMarketLabel: 'বাজার বা এলাকার নাম (Market / Location)',
    tripMarketPlaceholder: 'যেমন: চকবাজার / ইসলামপুর / নিউমার্কেট',
    initialCashLabel: 'সাথে কত টাকা নিয়ে যাচ্ছেন? (Initial Cash Taken) *',
    initialCashPlaceholder: 'যেমন: 10000',
    tripNoteLabel: 'অতিরিক্ত নোট (Optional Note)',
    tripNotePlaceholder: 'যেমন: রিকশা ও পরিবহন খরচ সহ মাল কেনা',
    startTripSubmit: 'ট্রিপ শুরু করুন (Start Trip)',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',

    // Trip Card & Expense breakdown
    cashTakenCard: 'সাথে নেওয়া ক্যাশ (Carried)',
    totalSpentCard: 'কোথায় কত ব্যয় হলো (Total Spent)',
    remainingCashCard: 'অবশিষ্ট ক্যাশ বা ফেরত (Balance)',
    tripStatusActive: 'বাজারে কেনাকাটা চলছে',
    tripStatusCompleted: 'কেনাকাটা সম্পন্ন',
    addExpenseBtn: '+ কোথায় খরচ হলো যোগ করুন',
    finishTripBtn: '✓ কেনাকাটা সম্পন্ন করুন',
    reopenTripBtn: 'পুনরায় চালু করুন',
    deleteTripBtn: 'ট্রিপ মুছুন',
    printTripSlipBtn: 'খরচের স্লিপ প্রিন্ট',
    syncToCashbookBtn: 'ক্যাশবুকে খরচ যোগ করুন',
    syncedBadge: 'ক্যাশবুকে খরচ যোগ হয়েছে',

    // Add Expense Modal
    addExpenseModalTitle: 'কোথায় ও কী বাবদ খরচ করলেন?',
    expenseTitleLabel: 'খরচ বা মালের বিবরণ (Item / Reason) *',
    expenseTitlePlaceholder: 'যেমন: সুতি জামদানি শাড়ি ৫ পিস / সুতি থান কাপড় ২০ গজ',
    expenseAmountLabel: 'খরচের পরিমাণ (Amount) *',
    expenseCategoryLabel: 'ব্যয়ের ধরন (Category)',
    expenseVendorLabel: 'দোকান / পাইকার / স্থান (Shop / Vendor / Place)',
    expenseVendorPlaceholder: 'যেমন: মেসার্স মোল্লা ব্রাদার্স, দোকান নং ১৪',
    expenseNoteLabel: 'নোট (Note)',
    expenseNotePlaceholder: 'যেমন: পাইকারি রেটে কেনা হলো',
    saveExpenseBtn: 'খরচ সংরক্ষণ করুন',

    // Categories
    catGoods: 'দোকানের মাল/পণ্য (Goods)',
    catTransport: 'গাড়ি/ভ্যান ভাড়া (Transport)',
    catFood: 'চা-নাস্তা ও খাবার (Meals)',
    catLabour: 'কুলি/লেবার মজুরি (Labour)',
    catPacking: 'প্যাকিং ও ব্যাগ (Packing)',
    catOther: 'অন্যান্য ব্যয় (Other)',

    // Quick tags
    quickItemsTitle: 'দ্রুত বাছাই:',
    tagGoodsSaree: 'শাড়ি/পোশাক পাইকারি',
    tagFabric: 'থান কাপড় লট',
    tagTransport: 'ভ্যান/সিএনজি ভাড়া',
    tagSnacks: 'চা-নাস্তা',
    tagLabour: 'লেবার/লোড আনলোড',

    // Cashbook & Billing common
    currency: 'মুদ্রা',
    total: 'মোট',
    date: 'তারিখ',
    status: 'অবস্থা',
    items: 'আইটেম',
    search: 'অনুসন্ধান করুন...',
  },
  en: {
    // Navigation Tabs
    tabBilling: 'Billing',
    tabInvoices: 'Invoices',
    tabCashbook: 'Cashbook',
    tabDue: 'Dues & Creditors',
    tabPurchases: 'Stock Purchases',

    // Header & Actions
    appName: 'POS & Thermal Printer',
    printerReady: 'Printer Ready',
    printerDisconnected: 'Disconnected',
    connecting: 'Connecting...',
    connectPrinter: 'Connect Printer',
    printTestSlip: 'Print Test Slip',
    pairDifferent: 'Pair Different Printer',
    disconnect: 'Disconnect',
    forgetPrinter: 'Forget Printer',
    settings: 'Store Settings',
    userAccount: 'User Account',
    languageName: 'বাংলা',
    languageToggleTitle: 'Switch to Bengali',

    // Purchase Trips / মাল কেনাকাটা ট্র্যাকার
    purchaseHeaderTitle: 'Stock Purchase & Market Trip Tracker',
    purchaseHeaderSubtitle:
      'Record cash taken for stock shopping, itemize where money was spent, and track remaining balance',
    startNewTripBtn: '+ Start Purchase / Shopping Trip',
    activeTripsHeading: 'Active Shopping Trips',
    completedTripsHeading: 'Completed Shopping Records',
    noActiveTrips:
      'No active market trips right now. Before heading out to buy stock, tap below to record your initial cash.',
    noCompletedTrips: 'No completed purchase records found.',
    newTripModalTitle: 'Going to buy stock? Record cash taken with you',
    tripTitleLabel: 'Shopping Purpose / Trip Title *',
    tripTitlePlaceholder: 'e.g. Wholesale Market - Sarees & Cotton Fabrics',
    tripMarketLabel: 'Market or Location Name',
    tripMarketPlaceholder: 'e.g. Wholesale Center / Downtown Market',
    initialCashLabel: 'How much cash are you taking? *',
    initialCashPlaceholder: 'e.g. 10000',
    tripNoteLabel: 'Additional Note (Optional)',
    tripNotePlaceholder: 'e.g. Including transport and wholesale goods',
    startTripSubmit: 'Start Trip Now',
    cancel: 'Cancel',
    confirm: 'Confirm',

    // Trip Card & Expense breakdown
    cashTakenCard: 'Initial Cash Taken',
    totalSpentCard: 'Where Spent (Total)',
    remainingCashCard: 'Remaining Cash Left',
    tripStatusActive: 'Shopping in Progress',
    tripStatusCompleted: 'Trip Completed',
    addExpenseBtn: '+ Record Where Spent',
    finishTripBtn: '✓ Complete Trip',
    reopenTripBtn: 'Reopen Trip',
    deleteTripBtn: 'Delete Trip',
    printTripSlipBtn: 'Print Expense Slip',
    syncToCashbookBtn: 'Sync to Cashbook as Expense',
    syncedBadge: 'Synced to Cashbook',

    // Add Expense Modal
    addExpenseModalTitle: 'Where and what was spent?',
    expenseTitleLabel: 'Item / Expense Reason *',
    expenseTitlePlaceholder: 'e.g. Cotton Sarees (5 pcs) / Fabric lot (20 yds)',
    expenseAmountLabel: 'Amount Spent *',
    expenseCategoryLabel: 'Expense Category',
    expenseVendorLabel: 'Shop / Wholesaler / Vendor / Place',
    expenseVendorPlaceholder: 'e.g. Molla Traders, Shop 14',
    expenseNoteLabel: 'Note (Optional)',
    expenseNotePlaceholder: 'e.g. Purchased at wholesale rate',
    saveExpenseBtn: 'Save Expense',

    // Categories
    catGoods: 'Shop Stock / Goods',
    catTransport: 'Transport / Rickshaw / Van',
    catFood: 'Tea, Snacks & Meals',
    catLabour: 'Labour / Porter',
    catPacking: 'Packing & Bags',
    catOther: 'Other Expenses',

    // Quick tags
    quickItemsTitle: 'Quick suggestions:',
    tagGoodsSaree: 'Wholesale Clothes/Sarees',
    tagFabric: 'Fabric Roll Lot',
    tagTransport: 'Van / Transport Fare',
    tagSnacks: 'Tea & Snacks',
    tagLabour: 'Porter / Labour',

    // Cashbook & Billing common
    currency: 'Currency',
    total: 'Total',
    date: 'Date',
    status: 'Status',
    items: 'Items',
    search: 'Search...',
  },
};

export const getCategoryBadge = (cat: string, lang: Language = 'bn') => {
  const t = translations[lang];
  switch (cat) {
    case 'goods':
      return {
        label: t.catGoods,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'transport':
      return {
        label: t.catTransport,
        className: 'bg-blue-100 text-blue-800 border-blue-200',
      };
    case 'food':
      return {
        label: t.catFood,
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'labour':
      return {
        label: t.catLabour,
        className: 'bg-purple-100 text-purple-800 border-purple-200',
      };
    case 'packing':
      return {
        label: t.catPacking,
        className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      };
    default:
      return {
        label: t.catOther,
        className: 'bg-stone-100 text-stone-800 border-stone-200',
      };
  }
};
