import React, { useState, useEffect } from 'react';
import {
  BillItem,
  BillInvoice,
  CashEntry,
  CustomerDue,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  CashEntryType,
  ActiveTab,
  PaperWidth,
} from './types';
import { storageService } from './services/storageService';
import { thermalPrinterService } from './services/thermalPrinterService';
import { Header } from './components/Header';
import { BillingTab } from './components/BillingTab';
import { InvoicesTab } from './components/InvoicesTab';
import { CashbookTab } from './components/CashbookTab';
import { CustomerDueTab } from './components/CustomerDueTab';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [bills, setBills] = useState<BillInvoice[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [settings, setSettings] = useState<ThermalPrinterSettings>(storageService.getSettings());
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

  // 3. CUSTOMER DUE HANDLERS
  const handleAddOrUpdateDue = (
    name: string,
    amount: number,
    phone?: string,
    note?: string
  ) => {
    storageService.addOrUpdateCustomerDue(name, amount, phone || '', note || '');
    setCustomerDues(storageService.getCustomerDues());
  };

  const handleRecordCustomerPayment = (id: string, amount: number, note?: string) => {
    storageService.recordCustomerPayment(id, amount, note || '');
    setCustomerDues(storageService.getCustomerDues());

    // Also record received money as Cashbook Income
    storageService.addCashEntry(
      'Income',
      amount,
      `Due payment collected: ${note || 'Customer payment'}`
    );
    setCashEntries(storageService.getCashEntries());
  };

  const handleDeleteCustomerDue = (id: string) => {
    storageService.deleteCustomerDue(id);
    setCustomerDues(storageService.getCustomerDues());
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
      {/* Header with 4 core tabs: Billing, Invoices, Cashbook, Customer Due */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={billItems.length}
        invoicesCount={bills.length}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={settings}
      />

      {/* Main Workspace */}
      <main className="flex-1 pb-12">
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
      </main>

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
