import { BillInvoice, CashEntry, CustomerDue, ThermalPrinterSettings, SavedPrinterInfo } from '../types';

const STORAGE_KEYS = {
  BILLS: 'simple_pos_bills',
  CASHBOOK: 'simple_pos_cashbook',
  DUES: 'simple_pos_dues',
  SETTINGS: 'simple_pos_settings',
  SAVED_PRINTER: 'pos_saved_bluetooth_printer',
};

const DEFAULT_SETTINGS: ThermalPrinterSettings = {
  storeName: 'Shree Fashion & Garments',
  storePhone: '+91 98765 43210',
  storeAddress: 'Shop #12, Commercial Street, Bangalore',
  paperWidth: '58mm',
  currencySymbol: '₹',
  footerNote: 'Thank you for shopping with us! Visit again.',
  autoPrintOnCheckout: true,
};

class StorageService {
  // --- SETTINGS ---
  getSettings(): ThermalPrinterSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        this.saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(data);
      // Auto-migrate if old Bangladeshi currency or defaults exist
      if (parsed.currencySymbol === '৳' || !parsed.currencySymbol || parsed.storePhone?.includes('+880') || parsed.storeName === 'My Shop & General Store') {
        const migrated: ThermalPrinterSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          currencySymbol: '₹',
          storeName: parsed.storeName === 'My Shop & General Store' ? DEFAULT_SETTINGS.storeName : parsed.storeName,
          storePhone: parsed.storePhone?.includes('+880') ? DEFAULT_SETTINGS.storePhone : parsed.storePhone,
          storeAddress: parsed.storeAddress?.includes('Dhaka') ? DEFAULT_SETTINGS.storeAddress : parsed.storeAddress,
          footerNote: parsed.footerNote || DEFAULT_SETTINGS.footerNote,
        };
        this.saveSettings(migrated);
        return migrated;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: ThermalPrinterSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- BILLS & INVOICES ---
  getBills(): BillInvoice[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BILLS);
      if (data) {
        return JSON.parse(data);
      }

      // Seed initial demo invoices for realistic instant testing
      const now = Date.now();
      const demoBills: BillInvoice[] = [
        {
          id: 'inv-demo-1',
          invoiceNo: 'INV-1048',
          date: new Date(now - 1000 * 60 * 75).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestamp: now - 1000 * 60 * 75,
          customerName: 'Ananya Roy',
          customerPhone: '98301 54321',
          items: [
            { id: 'it-1', name: 'Cotton Printed Kurti', price: 650, qty: 2, total: 1300 },
            { id: 'it-2', name: 'Chiffon Dupatta Set', price: 350, qty: 1, total: 350 },
          ],
          subtotal: 1650,
          discount: 150,
          discountType: 'fixed',
          discountValue: 150,
          grandTotal: 1500,
          paymentMethod: 'upi',
          paymentStatus: 'PAID',
          paidAmount: 1500,
          changeAmount: 0,
        },
        {
          id: 'inv-demo-2',
          invoiceNo: 'INV-1047',
          date: new Date(now - 1000 * 60 * 180).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestamp: now - 1000 * 60 * 180,
          customerName: 'Ramesh Patel',
          customerPhone: '98450 11223',
          items: [
            { id: 'it-3', name: "Men's Casual Linen Shirt", price: 899, qty: 2, total: 1798 },
            { id: 'it-4', name: 'Slim Fit Denim Jeans', price: 1299, qty: 1, total: 1299 },
          ],
          subtotal: 3097,
          discount: 97,
          discountType: 'fixed',
          discountValue: 97,
          grandTotal: 3000,
          paymentMethod: 'cash',
          paymentStatus: 'PAID',
          paidAmount: 3000,
          changeAmount: 0,
        },
        {
          id: 'inv-demo-3',
          invoiceNo: 'INV-1046',
          date: new Date(now - 1000 * 60 * 60 * 26).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestamp: now - 1000 * 60 * 60 * 26,
          customerName: 'Pooja Sharma',
          customerPhone: '98451 23456',
          items: [
            { id: 'it-5', name: 'Designer Anarkali Gown', price: 1850, qty: 1, total: 1850 },
          ],
          subtotal: 1850,
          discount: 0,
          discountType: 'fixed',
          discountValue: 0,
          grandTotal: 1850,
          paymentMethod: 'due',
          paymentStatus: 'DUE',
          paidAmount: 0,
          changeAmount: 0,
        },
      ];

      this.saveBillsList(demoBills);
      return demoBills;
    } catch {
      return [];
    }
  }

  saveBillsList(bills: BillInvoice[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
    } catch (e) {
      console.error('Failed to save bills list:', e);
    }
  }

  saveBill(bill: BillInvoice): void {
    const bills = this.getBills();
    // Ensure payment status is set
    if (!bill.paymentStatus) {
      bill.paymentStatus = bill.paymentMethod === 'due' ? 'DUE' : 'PAID';
    }

    const existingIndex = bills.findIndex((b) => b.id === bill.id || b.invoiceNo === bill.invoiceNo);
    if (existingIndex >= 0) {
      bills[existingIndex] = { ...bills[existingIndex], ...bill };
    } else {
      bills.unshift(bill);
    }

    // Keep up to 500 invoices for durable history
    if (bills.length > 500) {
      bills.splice(500);
    }
    this.saveBillsList(bills);
  }

  deleteBill(id: string): void {
    const bills = this.getBills().filter((b) => b.id !== id);
    this.saveBillsList(bills);
  }

  getBillById(id: string): BillInvoice | undefined {
    return this.getBills().find((b) => b.id === id);
  }

  // --- CASHBOOK (INCOME / EXPENSE) ---
  getCashEntries(): CashEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CASHBOOK);
      const defaultEntries: CashEntry[] = [
        {
          id: 'cash-1',
          type: 'Income',
          amount: 4500,
          note: 'Counter sale - 3x Cotton Kurtis & Dupatta',
          timestamp: Date.now() - 1000 * 60 * 180,
          dateFormatted: new Date(Date.now() - 1000 * 60 * 180).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        {
          id: 'cash-2',
          type: 'Expense',
          amount: 850,
          note: 'Alteration tailoring thread & packaging covers',
          timestamp: Date.now() - 1000 * 60 * 90,
          dateFormatted: new Date(Date.now() - 1000 * 60 * 90).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        {
          id: 'cash-3',
          type: 'Expense',
          amount: 12000,
          note: 'Wholesale cloth roll purchase from Surat vendor',
          timestamp: Date.now() - 1000 * 60 * 60 * 5,
          dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 5).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ];

      if (!data) {
        this.saveCashEntries(defaultEntries);
        return defaultEntries;
      }
      const parsed: CashEntry[] = JSON.parse(data);
      // Migrate if old grocery demo entries
      if (parsed.some((e) => e.note?.includes('Morning counter sales') || e.note?.includes('tea & cleaning supplies'))) {
        this.saveCashEntries(defaultEntries);
        return defaultEntries;
      }
      return parsed;
    } catch {
      return [];
    }
  }

  saveCashEntries(entries: CashEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify(entries));
  }

  addCashEntry(type: 'Income' | 'Expense', amount: number, note: string): CashEntry {
    const entries = this.getCashEntries();
    const newEntry: CashEntry = {
      id: 'cash-' + Date.now(),
      type,
      amount,
      note: note.trim() || (type === 'Income' ? 'Daily Garment Sale' : 'Store Cost'),
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    entries.unshift(newEntry);
    this.saveCashEntries(entries);
    return newEntry;
  }

  deleteCashEntry(id: string): void {
    const entries = this.getCashEntries().filter((e) => e.id !== id);
    this.saveCashEntries(entries);
  }

  // --- CUSTOMER DUE (KHATA) ---
  getCustomerDues(): CustomerDue[] {
    try {
      const defaultDues: CustomerDue[] = [
        {
          id: 'due-1',
          name: 'Pooja Sharma',
          phone: '98451 23456',
          dueAmount: 1850,
          lastUpdated: Date.now() - 1000 * 60 * 60 * 24,
          transactions: [
            {
              id: 'tx-1',
              type: 'added',
              amount: 1850,
              note: 'Designer Kurti & Anarkali suit set on credit',
              timestamp: Date.now() - 1000 * 60 * 60 * 24,
              dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleDateString(),
            },
          ],
        },
        {
          id: 'due-2',
          name: 'Rahul Verma',
          phone: '98200 98765',
          dueAmount: 3200,
          lastUpdated: Date.now() - 1000 * 60 * 60 * 48,
          transactions: [
            {
              id: 'tx-2',
              type: 'added',
              amount: 3200,
              note: "Men's formal shirts (2 pcs) and denim jeans",
              timestamp: Date.now() - 1000 * 60 * 60 * 48,
              dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 48).toLocaleDateString(),
            },
          ],
        },
      ];

      const data = localStorage.getItem(STORAGE_KEYS.DUES);
      if (!data) {
        this.saveCustomerDues(defaultDues);
        return defaultDues;
      }
      const parsed: CustomerDue[] = JSON.parse(data);
      // Migrate if old grocery demo names
      if (parsed.some((d) => d.name === 'Rafiqul Islam' || d.name === 'Akram Hossain')) {
        this.saveCustomerDues(defaultDues);
        return defaultDues;
      }
      return parsed;
    } catch {
      return [];
    }
  }

  saveCustomerDues(dues: CustomerDue[]): void {
    localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(dues));
  }

  addOrUpdateCustomerDue(name: string, amount: number, phone: string = '', note: string = ''): CustomerDue {
    const dues = this.getCustomerDues();
    const existingIndex = dues.findIndex(
      (d) => d.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    const now = Date.now();
    const newTx = {
      id: 'tx-' + now,
      type: 'added' as const,
      amount,
      note: note.trim() || 'Due added',
      timestamp: now,
      dateFormatted: new Date(now).toLocaleDateString() + ' ' + new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (existingIndex >= 0) {
      const existing = dues[existingIndex];
      existing.dueAmount += amount;
      if (phone) existing.phone = phone.trim();
      existing.lastUpdated = now;
      existing.transactions = existing.transactions || [];
      existing.transactions.unshift(newTx);
      dues[existingIndex] = existing;
      this.saveCustomerDues(dues);
      return existing;
    } else {
      const newDue: CustomerDue = {
        id: 'due-' + now,
        name: name.trim(),
        phone: phone.trim(),
        dueAmount: Math.max(0, amount),
        lastUpdated: now,
        transactions: [newTx],
      };
      dues.unshift(newDue);
      this.saveCustomerDues(dues);
      return newDue;
    }
  }

  recordCustomerPayment(id: string, paidAmount: number, note: string = ''): CustomerDue | null {
    const dues = this.getCustomerDues();
    const target = dues.find((d) => d.id === id);
    if (!target) return null;

    target.dueAmount = Math.max(0, target.dueAmount - paidAmount);
    target.lastUpdated = Date.now();
    target.transactions = target.transactions || [];
    target.transactions.unshift({
      id: 'tx-' + Date.now(),
      type: 'paid',
      amount: paidAmount,
      note: note.trim() || 'Payment received',
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    this.saveCustomerDues(dues);
    return target;
  }

  deleteCustomerDue(id: string): void {
    const dues = this.getCustomerDues().filter((d) => d.id !== id);
    this.saveCustomerDues(dues);
  }

  // --- SAVED PRINTER ---
  getSavedPrinter(): SavedPrinterInfo | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_PRINTER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  saveSavedPrinter(info: SavedPrinterInfo): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_PRINTER, JSON.stringify(info));
    } catch (e) {
      console.error('Failed to save printer info:', e);
    }
  }

  clearSavedPrinter(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SAVED_PRINTER);
    } catch (e) {
      console.error('Failed to clear saved printer:', e);
    }
  }
}

export const storageService = new StorageService();
