import React, { useState, useEffect } from 'react';
import {
  BillItem,
  BillInvoice,
  CashEntry,
  CustomerDue,
  DueType,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  CashEntryType,
  ActiveTab,
  PaperWidth,
  UserProfile,
  Language,
  PurchaseTrip,
  PurchaseExpenseItem,
} from './types';
import { storageService } from './services/storageService';
import { thermalPrinterService } from './services/thermalPrinterService';
import { otpService } from './services/otpService';
import { Header, SortOption } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { BillingTab } from './components/BillingTab';
import { InvoicesTab } from './components/InvoicesTab';
import { CashbookTab } from './components/CashbookTab';
import { CustomerDueTab } from './components/CustomerDueTab';
import { PurchaseTripTab } from './components/PurchaseTripTab';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { EditInvoiceModal } from './components/EditInvoiceModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { AppLockScreen } from './components/AppLockScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { CalculatorModal } from './components/CalculatorModal';
import { DataSaverModal } from './components/DataSaverModal';
import { BluetoothHelpModal } from './components/BluetoothHelpModal';
import { useNetworkStatus } from './utils/useNetworkStatus';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bills, setBills] = useState<BillInvoice[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [settings, setSettings] = useState<ThermalPrinterSettings>(storageService.getSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [language, setLanguage] = useState<Language>(storageService.getLanguage());
  const [purchaseTrips, setPurchaseTrips] = useState<PurchaseTrip[]>(storageService.getPurchaseTrips());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isDataSaverOpen, setIsDataSaverOpen] = useState(false);
  const [isBluetoothHelpOpen, setIsBluetoothHelpOpen] = useState(false);
  const [receiptBill, setReceiptBill] = useState<BillInvoice | null>(null);
  const [editingBill, setEditingBill] = useState<BillInvoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintingBill, setIsPrintingBill] = useState(false);

  const networkStatus = useNetworkStatus();
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'error';
    bill?: BillInvoice;
  } | null>(null);

  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothDeviceInfo>({
    connected: false,
  });

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success',
    bill?: BillInvoice
  ) => {
    setToast({ id: 'toast-' + Date.now(), message, type, bill });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Initial load
  useEffect(() => {
    setBills(storageService.getBills());
    setCashEntries(storageService.getCashEntries());
    setCustomerDues(storageService.getCustomerDues());
    const currentSettings = storageService.getSettings();
    setSettings(currentSettings);
    if (!currentSettings.storeName || currentSettings.storeName.trim() === '') {
      setIsOnboardingOpen(true);
    }
    const prof = storageService.getUserProfile();
    setUserProfile(prof);
    setLanguage(storageService.getLanguage());
    setPurchaseTrips(storageService.getPurchaseTrips());

    // Auto sync from server if app data / browser cache was cleared
    const syncId = prof.phone || prof.email || '9707502246';
    storageService.restoreFromAccountVaultAsync(syncId).then((restored) => {
      if (restored) {
        setBills(storageService.getBills());
        setCashEntries(storageService.getCashEntries());
        setCustomerDues(storageService.getCustomerDues());
        setPurchaseTrips(storageService.getPurchaseTrips());
        setSettings(storageService.getSettings());
        setUserProfile(storageService.getUserProfile());
      }
    });

    thermalPrinterService.setStatusListener((status) => {
      setBluetoothStatus(status);
    });

    // Auto-reconnect to saved printer in background on initial boot
    const saved = storageService.getSavedPrinter();
    if (saved) {
      thermalPrinterService.autoReconnect().catch((err) => {
        console.log('Background auto-reconnect notice:', err);
      });
    }
  }, []);

  const handleSaveOnboarding = (data: {
    storeName: string;
    storePhone: string;
    storeAddress: string;
    ownerEmail?: string;
    ownerPin?: string;
    ownerName?: string;
  }) => {
    const updated: ThermalPrinterSettings = {
      ...settings,
      storeName: data.storeName,
      storePhone: data.storePhone,
      storeAddress: data.storeAddress || settings.storeAddress,
    };
    storageService.saveSettings(updated);
    setSettings(updated);

    if (data.ownerEmail || data.storePhone) {
      const loggedIn = storageService.loginUser(
        data.ownerEmail || '',
        data.ownerName || data.storeName || 'Store Owner',
        data.ownerPin || '1234',
        'Owner',
        data.storePhone
      );
      setUserProfile(loggedIn);
    }

    setIsOnboardingOpen(false);
    showToast(
      language === 'bn'
        ? `দোকান ও অ্যাকাউন্ট সেটআপ সম্পন্ন: ${data.storeName}`
        : `Shop & account setup completed: ${data.storeName}`,
      'success'
    );
  };

  // Connect Bluetooth Thermal Printer
  const handleConnectBluetooth = async () => {
    const res = await thermalPrinterService.connectBluetooth();
    if (res.success) {
      showToast(`Connected to ${res.deviceName || 'Thermal Printer'}! Silent print ready.`, 'success');
    } else if (res.isUnsupported) {
      setIsBluetoothHelpOpen(true);
      showToast(
        language === 'bn'
          ? 'ব্রাউজারে সরাসরি ব্লুটুথ সাপোর্ট করেনি — সমাধান গাইড দেখুন'
          : res.message,
        'info'
      );
    } else if (res.message && !res.message.includes('cancelled')) {
      showToast(res.message, 'info');
    }
  };

  const handleDisconnectBluetooth = (forget = false) => {
    thermalPrinterService.disconnect(forget);
    showToast(forget ? 'Printer disconnected and unpaired' : 'Printer disconnected', 'info');
  };

  const handleTestPrint = async () => {
    const res = await thermalPrinterService.printTestReceipt(settings);
    showToast(res.message, res.success ? 'success' : 'info');
  };

  // Authentication & Security Handlers
  const handleLoginUser = async (
    email: string,
    name?: string,
    pin?: string,
    role?: 'Owner' | 'Manager' | 'Cashier',
    phone?: string,
    isAppLockEnabled?: boolean,
    loginMethod?: 'email_pin' | 'otp',
    otpCode?: string
  ): Promise<boolean> => {
    // 1. Verify OTP with mock OTP service if logging in via OTP
    const targetPhoneOrId = (phone || email).trim();
    if (loginMethod === 'otp') {
      const otpValidation = otpService.validateOtp(targetPhoneOrId, otpCode || '');
      if (!otpValidation.success) {
        showToast(
          otpValidation.message ||
            (language === 'bn'
              ? 'ওটিপি কোড সঠিক নয়! অনুগ্রহ করে ৪ ডিজিটের সঠিক কোড দিন'
              : 'Invalid OTP code! Please enter the correct 4-digit code'),
          'error'
        );
        return false;
      }
    }

    // Attempt restoring account and invoices from server disk if client storage was cleared
    if (targetPhoneOrId) {
      await storageService.restoreFromAccountVaultAsync(targetPhoneOrId);
    }

    // 2. Perform account login and vault restoration
    const updated = storageService.loginUser(
      email,
      name,
      pin,
      role,
      phone,
      loginMethod,
      loginMethod === 'otp' ? true : undefined
    );

    if (isAppLockEnabled !== undefined) {
      storageService.updateUserSecurity({ isAppLockEnabled });
      updated.isAppLockEnabled = isAppLockEnabled;
    }
    setUserProfile(updated);

    // 3. Immediately refresh bills, daybook, dues, purchases, and settings into React state
    const restoredBills = storageService.getBills();
    const restoredCash = storageService.getCashEntries();
    const restoredDues = storageService.getCustomerDues();
    const restoredPurchases = storageService.getPurchaseTrips();
    const restoredSettings = storageService.getSettings();

    setBills(restoredBills);
    setCashEntries(restoredCash);
    setCustomerDues(restoredDues);
    setPurchaseTrips(restoredPurchases);
    setSettings(restoredSettings);
    setIsOnboardingOpen(false);

    const welcomeMsg =
      language === 'bn'
        ? `স্বাগতম, ${updated.name}! আপনার সংরক্ষিত অ্যাকাউন্ট, পুরানো ${restoredBills.length}টি ইনভয়েস ও ডে-বুক লোড হয়েছে।`
        : language === 'hi'
        ? `स्वागत है, ${updated.name}! आपके खाते के पुराने ইনভয়েস এবং ডে-বুক লোড হয়ে গেছে।`
        : `Welcome, ${updated.name}! Loaded ${restoredBills.length} saved invoices & daybook data.`;
    showToast(welcomeMsg, 'success');
    return true;
  };

  const handleUpdateSecurity = (updates: Partial<UserProfile>) => {
    const updated = storageService.updateUserSecurity(updates);
    setUserProfile(updated);
    showToast(
      language === 'bn'
        ? 'নিরাপত্তা সেটিংস আপডেট করা হয়েছে'
        : 'Security settings updated',
      'success'
    );
  };

  const handleLockApp = () => {
    setIsAppLocked(true);
    showToast(
      language === 'bn' ? 'অ্যাপ ভল্ট লক করা হয়েছে' : 'App vault has been locked',
      'info'
    );
  };

  const handleUnlockApp = () => {
    setIsAppLocked(false);
    showToast(
      language === 'bn' ? 'ভল্ট সফলভাবে আনলক হয়েছে' : 'Vault successfully unlocked',
      'success'
    );
  };

  const handleResetPin = (newPin: string) => {
    const updated = storageService.updateUserSecurity({ pin: newPin });
    setUserProfile(updated);
    showToast(
      language === 'bn' ? 'নতুন পিন সেট করা হয়েছে' : 'New PIN has been saved',
      'success'
    );
  };

  const handleLogoutUser = () => {
    const updated = storageService.logoutUser();
    setUserProfile(updated);
    showToast('লগআউট সফল হয়েছে', 'info');
  };

  const handleRegisterUser = async (data: {
    name: string;
    phone: string;
    email?: string;
    storeName?: string;
    pin?: string;
    role?: 'Owner' | 'Manager' | 'Cashier';
  }): Promise<boolean> => {
    // If user already had data on server, restore first so it's not wiped
    const lookupKey = data.phone || data.email || '';
    if (lookupKey) {
      await storageService.restoreFromAccountVaultAsync(lookupKey);
    }

    const newProfile = storageService.registerNewUser(data);
    setUserProfile(newProfile);

    // Refresh isolated states for the newly registered account
    const restoredBills = storageService.getBills();
    setBills(restoredBills);
    setCashEntries(storageService.getCashEntries());
    setCustomerDues(storageService.getCustomerDues());
    setPurchaseTrips(storageService.getPurchaseTrips());
    setSettings(storageService.getSettings());
    setIsOnboardingOpen(false);

    const welcomeMsg =
      language === 'bn'
        ? `অভিনন্দন ${newProfile.name}! "${data.storeName || 'দোকান'}" এর অ্যাকাউন্ট সক্রিয় হয়েছে (${restoredBills.length}টি ইনভয়েস পাওয়া গেছে)।`
        : `Congratulations ${newProfile.name}! Account active for "${data.storeName || 'Store'}" (${restoredBills.length} invoices found).`;
    showToast(welcomeMsg, 'success');
    return true;
  };

  // 1. BILLING HANDLERS
  const handlePrintBill = async (bill: BillInvoice) => {
    // 1. Save bill in history
    storageService.saveBill(bill);
    setBills(storageService.getBills());
    setSettings(storageService.getSettings());

    // 2. If paid via Cash or UPI, automatically record as Income in Cashbook
    if (bill.paymentMethod === 'cash' || bill.paymentMethod === 'upi' || bill.paymentMethod === 'card') {
      storageService.addCashEntry(
        'Income',
        bill.grandTotal,
        `POS ${bill.paymentMethod.toUpperCase()} Sale #${bill.invoiceNo}`
      );
      setCashEntries(storageService.getCashEntries());
    } else if (bill.paymentMethod === 'due' && bill.customerName) {
      // If payment is Due, automatically add to Customer Due Ledger
      storageService.addOrUpdateCustomerDue(
        bill.customerName,
        bill.grandTotal,
        bill.customerPhone || '',
        `Credit bill #${bill.invoiceNo}`
      );
      setCustomerDues(storageService.getCustomerDues());
    }

    // 3. Clear current bill
    setBillItems([]);

    // 4. Silent Print via active Bluetooth GATT streaming if connected
    if (thermalPrinterService.getIsConnected()) {
      setIsPrintingBill(true);
      const printResult = await thermalPrinterService.printViaBluetooth(bill, settings);
      setIsPrintingBill(false);

      if (printResult.success) {
        showToast(
          `Bill #${bill.invoiceNo} printed directly via ${bluetoothStatus.deviceName || 'Bluetooth'}!`,
          'success',
          bill
        );
      } else {
        showToast(`Bluetooth print failed: ${printResult.message}`, 'error', bill);
        // Fallback to preview modal
        setReceiptBill(bill);
      }
    } else {
      // If Bluetooth is not connected, open preview modal for browser print or connecting
      setReceiptBill(bill);
    }
  };

  const handleDeleteBill = (id: string) => {
    storageService.deleteBill(id);
    const updatedBills = storageService.getBills();
    setBills(updatedBills);
    if (receiptBill && (receiptBill.id === id || receiptBill.invoiceNo === id)) {
      setReceiptBill(null);
    }
    if (editingBill && (editingBill.id === id || editingBill.invoiceNo === id)) {
      setEditingBill(null);
    }
    showToast(
      language === 'bn'
        ? 'ইনভয়েস সফলভাবে ডিলিট করা হয়েছে'
        : 'Invoice deleted successfully',
      'info'
    );
  };

  const handleUpdateBill = (updatedBill: BillInvoice) => {
    storageService.saveBill(updatedBill);
    const freshBills = storageService.getBills();
    setBills(freshBills);
    if (receiptBill && (receiptBill.id === updatedBill.id || receiptBill.invoiceNo === updatedBill.invoiceNo)) {
      setReceiptBill(updatedBill);
    }
    showToast(
      language === 'bn' ? 'বিল সফলভাবে আপডেট হয়েছে' : 'Bill updated successfully',
      'success'
    );
  };

  const handleClearBill = () => {
    setBillItems([]);
  };

  // 2. CASHBOOK HANDLERS
  const handleAddCashEntry = (type: CashEntryType, amount: number, note: string) => {
    storageService.addCashEntry(type, amount, note);
    setCashEntries(storageService.getCashEntries());
  };

  const handleDeleteCashEntry = (id: string) => {
    storageService.deleteCashEntry(id);
    setCashEntries(storageService.getCashEntries());
  };

  // 3. CUSTOMER DUE & PAYABLE HANDLERS
  const handleAddOrUpdateDue = (
    name: string,
    amount: number,
    phone?: string,
    note?: string,
    type: DueType = 'receivable'
  ) => {
    storageService.addOrUpdateCustomerDue(name, amount, phone || '', note || '', type);
    setCustomerDues(storageService.getCustomerDues());
    if (type === 'payable') {
      showToast(`কাস্টমার পাওনাদার হিসেবে ${settings.currencySymbol}${amount.toFixed(2)} যুক্ত করা হয়েছে`, 'info');
    } else {
      showToast(`বাকি হিসেবে ${settings.currencySymbol}${amount.toFixed(2)} যুক্ত করা হয়েছে`, 'info');
    }
  };

  const handleRecordCustomerPayment = (id: string, amount: number, note?: string) => {
    const target = customerDues.find((d) => d.id === id);
    const isPayable = target?.type === 'payable';

    storageService.recordCustomerPayment(id, amount, note || '');
    setCustomerDues(storageService.getCustomerDues());

    // Cashbook sync:
    // If receiving money for due -> Cashbook Income
    // If paying creditor customer back -> Cashbook Expense
    if (isPayable) {
      storageService.addCashEntry(
        'Expense',
        amount,
        `পাওনাদারকে পরিশোধ: ${target?.name || 'Customer'} - ${note || 'Settlement'}`
      );
      showToast(`পাওনাদারকে ${settings.currencySymbol}${amount.toFixed(2)} পরিশোধ রেকর্ড করা হয়েছে`, 'success');
    } else {
      storageService.addCashEntry(
        'Income',
        amount,
        `বাকি আদায় জমা: ${target?.name || 'Customer'} - ${note || 'Due payment'}`
      );
      showToast(`বাকি আদায় ${settings.currencySymbol}${amount.toFixed(2)} ক্যাশবুকে জমা হয়েছে`, 'success');
    }
    setCashEntries(storageService.getCashEntries());
  };

  const handleDeleteCustomerDue = (id: string) => {
    storageService.deleteCustomerDue(id);
    setCustomerDues(storageService.getCustomerDues());
  };

  // 4. LANGUAGE SELECT & TOGGLE HANDLER
  const handleSelectLanguage = (nextLang: Language) => {
    storageService.setLanguage(nextLang);
    setLanguage(nextLang);
    const msg =
      nextLang === 'bn'
        ? 'বাংলা ভাষা সক্রিয় করা হয়েছে'
        : nextLang === 'hi'
        ? 'हिन्दी भाषा सक्रिय की गई है'
        : 'Switched to English language';
    showToast(msg, 'info');
  };

  const handleToggleLanguage = () => {
    const nextLang: Language = language === 'bn' ? 'en' : language === 'en' ? 'hi' : 'bn';
    handleSelectLanguage(nextLang);
  };

  // 5. STOCK PURCHASE / SHOPPING TRIP HANDLERS
  const handleCreatePurchaseTrip = (
    title: string,
    initialCash: number,
    marketLocation?: string,
    note?: string
  ) => {
    const newTrip = storageService.createPurchaseTrip(title, initialCash, marketLocation, note);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn'
        ? `নতুন বাজার ট্রিপ "${newTrip.title}" যুক্ত হয়েছে। সাথে নেওয়া ক্যাশ: ${settings.currencySymbol}${initialCash}`
        : `Shopping trip "${newTrip.title}" started. Cash taken: ${settings.currencySymbol}${initialCash}`,
      'success'
    );
  };

  const handleAddTripExpense = (
    tripId: string,
    expense: Omit<PurchaseExpenseItem, 'id' | 'timestamp' | 'dateFormatted'>
  ) => {
    const updated = storageService.addExpenseToTrip(tripId, expense);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `খরচ যোগ হয়েছে: ${expense.title} (${settings.currencySymbol}${expense.amount})`
          : `Expense recorded: ${expense.title} (${settings.currencySymbol}${expense.amount})`,
        'success'
      );
    }
  };

  const handleDeleteTripExpense = (tripId: string, expenseId: string) => {
    storageService.deleteExpenseFromTrip(tripId, expenseId);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn' ? 'খরচের বিবরণ মুছে ফেলা হয়েছে' : 'Expense item removed',
      'info'
    );
  };

  const handleUpdateTripStatus = (tripId: string, status: 'active' | 'completed') => {
    storageService.updateTripStatus(tripId, status);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      status === 'completed'
        ? (language === 'bn' ? 'কেনাকাটা সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে' : 'Trip completed')
        : (language === 'bn' ? 'ট্রিপ পুনরায় সক্রিয় করা হয়েছে' : 'Trip reopened'),
      'info'
    );
  };

  const handleDeletePurchaseTrip = (tripId: string) => {
    storageService.deletePurchaseTrip(tripId);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn' ? 'কেনাকাটার ট্রিপ মুছে ফেলা হয়েছে' : 'Trip record deleted',
      'info'
    );
  };

  const handleUpdatePurchaseTrip = (
    tripId: string,
    updates: {
      title?: string;
      initialCash?: number;
      marketLocation?: string;
      note?: string;
    }
  ) => {
    const updated = storageService.updatePurchaseTrip(tripId, updates);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `ট্রিপ ও ক্যাশ টাকা সফলভাবে সংশোধন করা হয়েছে (${settings.currencySymbol}${updated.initialCash})`
          : `Trip & cash updated successfully (${settings.currencySymbol}${updated.initialCash})`,
        'success'
      );
    }
  };

  const handleAddCashToTrip = (tripId: string, additionalCash: number) => {
    const updated = storageService.addCashToTrip(tripId, additionalCash);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `ক্যাশে আরো ${settings.currencySymbol}${additionalCash} যোগ হয়েছে! বর্তমান মোট ক্যাশ: ${settings.currencySymbol}${updated.initialCash}`
          : `Added ${settings.currencySymbol}${additionalCash} cash! Total cash: ${settings.currencySymbol}${updated.initialCash}`,
        'success'
      );
    }
  };

  const handleSyncTripToCashbook = (trip: PurchaseTrip) => {
    if (trip.totalSpent <= 0) {
      showToast(
        language === 'bn'
          ? 'কোনো খরচ না থাকায় ক্যাশবুকে যোগ করার প্রয়োজন নেই'
          : 'No expenses to sync',
        'info'
      );
      return;
    }
    const entry = storageService.addCashEntry(
      'Expense',
      trip.totalSpent,
      `দোকানের মাল কেনা: ${trip.title}${trip.marketLocation ? ` (${trip.marketLocation})` : ''} [সাথে নেওয়া: ${settings.currencySymbol}${trip.initialCash}, অবশিষ্ট: ${settings.currencySymbol}${trip.remainingCash}]`
    );
    storageService.setTripSyncedCashEntry(trip.id, entry.id);
    setCashEntries(storageService.getCashEntries());
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn'
        ? `ক্যাশবুকে ${settings.currencySymbol}${trip.totalSpent.toFixed(2)} খরচ হিসেবে যোগ করা হয়েছে!`
        : `Recorded ${settings.currencySymbol}${trip.totalSpent.toFixed(2)} as Cashbook Expense!`,
      'success'
    );
  };

  // Settings Handlers
  const handleSaveSettings = (newSettings: ThermalPrinterSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleUpdatePaperWidth = (paperWidth: PaperWidth) => {
    const updated = { ...settings, paperWidth };
    storageService.saveSettings(updated);
    setSettings(updated);
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Google Sheets / Workspace Top Header & Sub-header */}
      <Header
        settings={settings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userProfile={userProfile}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onSelectLanguage={handleSelectLanguage}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onLockApp={handleLockApp}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalInvoicesCount={bills.length}
        networkStatus={networkStatus}
        onOpenDataSaver={() => setIsDataSaverOpen(true)}
        onOpenBluetoothHelp={() => setIsBluetoothHelpOpen(true)}
      />

      {/* Main Workspace with proper bottom padding to prevent overlap with bottom bar */}
      <main className="flex-1 pb-20 sm:pb-24">
        {activeTab === 'billing' && (
          <BillingTab
            billItems={billItems}
            setBillItems={setBillItems}
            settings={settings}
            bluetoothStatus={bluetoothStatus}
            isPrinting={isPrintingBill}
            onPrintBill={handlePrintBill}
            onClearBill={handleClearBill}
            language={language}
            onOpenCalculator={() => setIsCalculatorOpen(true)}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            bills={bills}
            settings={settings}
            language={language}
            onViewReceipt={(bill) => setReceiptBill(bill)}
            onDeleteBill={handleDeleteBill}
            onUpdateBill={handleUpdateBill}
            onEditBill={(bill) => setEditingBill(bill)}
            onLoadIntoBilling={(bill) => {
              setBillItems(bill.items);
              setActiveTab('billing');
              showToast(
                language === 'bn'
                  ? 'আইটেমগুলো বিলিং কাউন্টারে লোড করা হয়েছে'
                  : 'Items loaded into billing counter',
                'info'
              );
            }}
            externalSearchTerm={searchTerm}
            viewMode={viewMode}
            sortOption={sortOption}
            onNavigateToBilling={() => setActiveTab('billing')}
          />
        )}

        {activeTab === 'cashbook' && (
          <CashbookTab
            entries={cashEntries}
            bills={bills}
            settings={settings}
            language={language}
            onAddEntry={handleAddCashEntry}
            onDeleteEntry={handleDeleteCashEntry}
          />
        )}

        {activeTab === 'due' && (
          <CustomerDueTab
            dues={customerDues}
            settings={settings}
            language={language}
            onAddOrUpdateDue={handleAddOrUpdateDue}
            onRecordPayment={handleRecordCustomerPayment}
            onDeleteDue={handleDeleteCustomerDue}
            onPrintDueSlip={(bill) => setReceiptBill(bill)}
          />
        )}

        {activeTab === 'purchases' && (
          <PurchaseTripTab
            trips={purchaseTrips}
            settings={settings}
            language={language}
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            onCreateTrip={handleCreatePurchaseTrip}
            onUpdateTrip={handleUpdatePurchaseTrip}
            onAddCashToTrip={handleAddCashToTrip}
            onAddExpense={handleAddTripExpense}
            onDeleteExpense={handleDeleteTripExpense}
            onUpdateTripStatus={handleUpdateTripStatus}
            onDeleteTrip={handleDeletePurchaseTrip}
            onSyncTripToCashbook={handleSyncTripToCashbook}
            onPrintTripSlip={(bill) => setReceiptBill(bill)}
          />
        )}
      </main>

      {/* App Footer with Explicit Creator Attribution (fahad uddin) */}
      <footer id="app-footer" className="w-full border-t border-stone-200/90 bg-white/85 backdrop-blur-xs py-4 px-4 pb-20 sm:pb-24 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-stone-600">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="text-stone-500 font-medium">
              {language === 'bn' ? 'অ্যাপটি তৈরি করেছেন:' : 'Created & Built by:'}
            </span>
            <span className="font-extrabold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-300 tracking-wide text-xs">
              fahad uddin
            </span>
            {userProfile.isLoggedIn && (
              <span className="text-stone-500 font-mono text-[11px] bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                {userProfile.email}
              </span>
            )}
          </div>
          <div className="text-[11px] text-stone-400 text-center sm:text-right">
            Designed & Created by <strong className="text-stone-700 font-bold">fahad uddin</strong> • All Rights Reserved
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Navigation Bar (Vyapar style - Tabs only) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={billItems.length}
        invoicesCount={bills.length}
        purchasesCount={purchaseTrips.filter((t) => t.status === 'active').length}
        duesCount={customerDues.filter((c) => c.totalDue > 0).length}
        language={language}
      />

      {/* User Login & Profile Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        userProfile={userProfile}
        onLogin={handleLoginUser}
        onRegister={handleRegisterUser}
        onLogout={handleLogoutUser}
        onUpdateSecurity={handleUpdateSecurity}
        onLockApp={handleLockApp}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* App Lock Screen (4-Digit PIN Security Vault) */}
      <AppLockScreen
        isLocked={isAppLocked}
        onUnlock={handleUnlockApp}
        userProfile={userProfile}
        settings={settings}
        language={language}
        onResetPin={handleResetPin}
      />

      {/* Thermal Receipt Print & Preview Dialog */}
      <PrintReceiptModal
        bill={receiptBill}
        onClose={() => setReceiptBill(null)}
        settings={settings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onUpdatePaperWidth={handleUpdatePaperWidth}
        onEditBill={(bill) => {
          setReceiptBill(null);
          setEditingBill(bill);
        }}
        onDeleteBill={(id) => {
          handleDeleteBill(id);
          setReceiptBill(null);
        }}
        language={language}
      />

      {/* Global Edit Invoice Modal */}
      {editingBill && (
        <EditInvoiceModal
          bill={editingBill}
          isOpen={Boolean(editingBill)}
          settings={settings}
          language={language}
          onClose={() => setEditingBill(null)}
          onSave={(updated) => {
            handleUpdateBill(updated);
            setEditingBill(null);
          }}
          onDelete={(id) => {
            handleDeleteBill(id);
            setEditingBill(null);
          }}
          onLoadInBilling={(bill) => {
            setBillItems(bill.items);
            setActiveTab('billing');
            setEditingBill(null);
            showToast(
              language === 'bn'
                ? 'আইটেমগুলো বিলিং কাউন্টারে লোড করা হয়েছে'
                : 'Items loaded into billing counter',
              'info'
            );
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenBluetoothHelp={() => setIsBluetoothHelpOpen(true)}
        language={language}
      />

      {/* Bluetooth Setup & Troubleshooting Guide Modal */}
      <BluetoothHelpModal
        isOpen={isBluetoothHelpOpen}
        onClose={() => setIsBluetoothHelpOpen(false)}
        language={language}
        onSystemPrintFallback={() => {
          window.print();
        }}
      />

      {/* First-Time Onboarding Modal with Voice Prompt */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onSave={handleSaveOnboarding}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* POS & Wholesale Quick Calculator Modal */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        settings={settings}
        language={language}
      />

      {/* Ultra Low-Data & Offline Engine Modal */}
      <DataSaverModal
        isOpen={isDataSaverOpen}
        onClose={() => setIsDataSaverOpen(false)}
        networkStatus={networkStatus}
        settings={settings}
        onUpdateSettings={handleSaveSettings}
        language={language}
        onShowToast={showToast}
      />

      {/* Instant Notification Toast */}
      {toast && (
        <div
          id="ble-toast"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
            ) : toast.type === 'error' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shrink-0"></span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0"></span>
            )}
            <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toast.bill && (
              <button
                onClick={() => {
                  setReceiptBill(toast.bill!);
                  setToast(null);
                }}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
              >
                View Slip
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
