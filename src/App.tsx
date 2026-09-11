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
import { Header } from './components/Header';
import { BillingTab } from './components/BillingTab';
import { InvoicesTab } from './components/InvoicesTab';
import { CashbookTab } from './components/CashbookTab';
import { CustomerDueTab } from './components/CustomerDueTab';
import { PurchaseTripTab } from './components/PurchaseTripTab';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [bills, setBills] = useState<BillInvoice[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [settings, setSettings] = useState<ThermalPrinterSettings>(storageService.getSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [language, setLanguage] = useState<Language>(storageService.getLanguage());
  const [purchaseTrips, setPurchaseTrips] = useState<PurchaseTrip[]>(storageService.getPurchaseTrips());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [receiptBill, setReceiptBill] = useState<BillInvoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintingBill, setIsPrintingBill] = useState(false);
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
    setSettings(storageService.getSettings());
    setUserProfile(storageService.getUserProfile());
    setLanguage(storageService.getLanguage());
    setPurchaseTrips(storageService.getPurchaseTrips());

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

  // Connect Bluetooth Thermal Printer
  const handleConnectBluetooth = async () => {
    const res = await thermalPrinterService.connectBluetooth();
    if (res.success) {
      showToast(`Connected to ${res.deviceName || 'Thermal Printer'}! Silent print ready.`, 'success');
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

  // Authentication Handlers
  const handleLoginUser = (email: string, name?: string) => {
    const updated = storageService.loginUser(email, name);
    setUserProfile(updated);
    showToast(`স্বাগতম, ${updated.name}! (${updated.email})`, 'success');
  };

  const handleLogoutUser = () => {
    const updated = storageService.logoutUser();
    setUserProfile(updated);
    showToast('লগআউট সফল হয়েছে', 'info');
  };

  // 1. BILLING HANDLERS
  const handlePrintBill = async (bill: BillInvoice) => {
    // 1. Save bill in history
    storageService.saveBill(bill);
    setBills(storageService.getBills());

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
    setBills(storageService.getBills());
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

  // 4. LANGUAGE TOGGLE HANDLER
  const handleToggleLanguage = () => {
    const nextLang: Language = language === 'bn' ? 'en' : 'bn';
    storageService.setLanguage(nextLang);
    setLanguage(nextLang);
    showToast(
      nextLang === 'bn'
        ? 'বাংলা ভাষা সক্রিয় করা হয়েছে'
        : 'Switched to English language',
      'info'
    );
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
      {/* Header with 5 core tabs: Billing, Invoices, Cashbook, Customer Due, Purchases */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={billItems.length}
        invoicesCount={bills.length}
        purchasesCount={purchaseTrips.filter((t) => t.status === 'active').length}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={settings}
        userProfile={userProfile}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        language={language}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* Main Workspace */}
      <main className="flex-1 pb-8">
        {activeTab === 'billing' && (
          <BillingTab
            billItems={billItems}
            setBillItems={setBillItems}
            settings={settings}
            bluetoothStatus={bluetoothStatus}
            isPrinting={isPrintingBill}
            onPrintBill={handlePrintBill}
            onClearBill={handleClearBill}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            bills={bills}
            settings={settings}
            onViewReceipt={(bill) => setReceiptBill(bill)}
            onDeleteBill={handleDeleteBill}
          />
        )}

        {activeTab === 'cashbook' && (
          <CashbookTab
            entries={cashEntries}
            bills={bills}
            settings={settings}
            onAddEntry={handleAddCashEntry}
            onDeleteEntry={handleDeleteCashEntry}
          />
        )}

        {activeTab === 'due' && (
          <CustomerDueTab
            dues={customerDues}
            settings={settings}
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
            onCreateTrip={handleCreatePurchaseTrip}
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
      <footer id="app-footer" className="w-full border-t border-stone-200/90 bg-white/85 backdrop-blur-xs py-4 px-4 mt-auto">
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

      {/* User Login & Profile Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        userProfile={userProfile}
        onLogin={handleLoginUser}
        onLogout={handleLogoutUser}
      />

      {/* Thermal Receipt Print & Preview Dialog */}
      <PrintReceiptModal
        bill={receiptBill}
        onClose={() => setReceiptBill(null)}
        settings={settings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onUpdatePaperWidth={handleUpdatePaperWidth}
      />

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
