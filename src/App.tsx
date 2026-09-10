import React, { useState, useEffect } from 'react';
import {
  BillItem,
  BillInvoice,
  CashEntry,
  CustomerDue,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  CashEntryType,
} from './types';
import { storageService } from './services/storageService';
import { thermalPrinterService } from './services/thermalPrinterService';
import { Header } from './components/Header';
import { BillingTab } from './components/BillingTab';
import { CashbookTab } from './components/CashbookTab';
import { CustomerDueTab } from './components/CustomerDueTab';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'billing' | 'cashbook' | 'due'>('billing');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [settings, setSettings] = useState<ThermalPrinterSettings>(storageService.getSettings());
  const [receiptBill, setReceiptBill] = useState<BillInvoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothDeviceInfo>({
    connected: false,
  });

  // Initial load
  useEffect(() => {
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
    await thermalPrinterService.connectBluetooth();
  };

  const handleDisconnectBluetooth = (forget = false) => {
    thermalPrinterService.disconnect(forget);
  };

  const handleTestPrint = async () => {
    await thermalPrinterService.printTestReceipt(settings);
  };

  // 1. BILLING HANDLERS
  const handlePrintBill = (bill: BillInvoice) => {
    // 1. Save bill in history
    storageService.saveBill(bill);

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

    // 4. Open Thermal Receipt preview & print trigger
    setReceiptBill(bill);
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

  const handleUpdatePaperWidth = (paperWidth: '58mm' | '80mm') => {
    const updated = { ...settings, paperWidth };
    storageService.saveSettings(updated);
    setSettings(updated);
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Header with 3 core tabs: Billing, Cashbook, Customer Due */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={billItems.length}
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
            onPrintBill={handlePrintBill}
            onClearBill={handleClearBill}
          />
        )}

        {activeTab === 'cashbook' && (
          <CashbookTab
            entries={cashEntries}
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
    </div>
  );
}
