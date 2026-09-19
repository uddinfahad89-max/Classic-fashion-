import {
  BillInvoice,
  CashEntry,
  CustomerDue,
  DueType,
  ThermalPrinterSettings,
  SavedPrinterInfo,
  UserProfile,
  Language,
  PurchaseTrip,
  PurchaseExpenseItem,
  SavedAccountItem,
} from '../types';

const STORAGE_KEYS = {
  BILLS: 'simple_pos_bills',
  CASHBOOK: 'simple_pos_cashbook',
  DUES: 'simple_pos_dues',
  SETTINGS: 'simple_pos_settings',
  SAVED_PRINTER: 'pos_saved_bluetooth_printer',
  USER: 'simple_pos_user',
  PURCHASES: 'simple_pos_purchase_trips',
  LANG: 'simple_pos_language',
};

const VAULT_KEYS = {
  ACCOUNTS_INDEX: 'simple_pos_accounts_index',
  ACCOUNT_PREFIX: 'simple_pos_vault_',
};

export interface AccountVaultData {
  identifier: string;
  email: string;
  phone: string;
  name: string;
  role: 'Owner' | 'Manager' | 'Cashier';
  pin: string;
  isAppLockEnabled?: boolean;
  settings: ThermalPrinterSettings;
  bills: BillInvoice[];
  cashEntries: CashEntry[];
  customerDues: CustomerDue[];
  purchaseTrips: PurchaseTrip[];
  lastActive: number;
}

const DEFAULT_USER: UserProfile = {
  email: '',
  name: '',
  phone: '',
  role: 'Owner',
  pin: '',
  isAppLockEnabled: false,
  isLoggedIn: false,
  loginTime: Date.now(),
};

const DEFAULT_SETTINGS: ThermalPrinterSettings = {
  storeName: '',
  storePhone: '',
  storeAddress: '',
  signatoryName: '',
  upiId: '',
  paperWidth: '58mm',
  currencySymbol: 'Rs',
  currencyName: 'Rupees',
  footerNote: 'Thank you for shopping with us! Visit again.',
  autoPrintOnCheckout: true,
  defaultInvoiceFormat: 'tax_invoice',
  isDataSaverEnabled: false,
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1001,
};

class StorageService {
  // --- SETTINGS ---
  getSettings(): ThermalPrinterSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(data);
      // Only reset placeholder store name if empty
      if (parsed.storeName === 'MY SHOP / STORE NAME') {
        parsed.storeName = '';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: ThermalPrinterSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.syncActiveAccountVault();
  }

  // --- BILLS & INVOICES ---
  getBills(): BillInvoice[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BILLS);
      if (data !== null) {
        return JSON.parse(data);
      }

      // Seed initial demo invoices for realistic instant testing only on first load
      const now = Date.now();
      const demoBills: BillInvoice[] = [
        {
          id: 'inv-sale-306',
          invoiceNo: '306',
          date: '22-08-2026',
          time: '02:58 PM',
          timestamp: new Date('2026-08-22T14:58:00').getTime(),
          customerName: 'RUMANA BEGAM',
          customerPhone: '9876543210',
          items: [
            { id: 'it-306-1', name: 'Ganji set', price: 200.0, qty: 2, total: 400.0 },
            { id: 'it-306-2', name: 'Seka ganji', price: 20.0, qty: 4, total: 80.0 },
            { id: 'it-306-3', name: 'Stal orna', price: 200.0, qty: 1, total: 200.0 },
            { id: 'it-306-4', name: 'Cotton orna', price: 125.0, qty: 2, total: 250.0 },
            { id: 'it-306-5', name: 'Nitee', price: 200.0, qty: 1, total: 200.0 },
            { id: 'it-306-6', name: 'Frk', price: 180.0, qty: 1, total: 180.0 },
            { id: 'it-306-7', name: 'Seka', price: 90.0, qty: 1, total: 90.0 },
          ],
          subtotal: 1400.0,
          discount: 140.0,
          discountType: 'percent',
          discountValue: 10.0,
          grandTotal: 1260.0,
          paymentMethod: 'due',
          paymentStatus: 'DUE',
          paidAmount: 0.0,
          changeAmount: 0.0,
          balance: 1260.0,
          previousBalance: 0.0,
          currentBalance: 1260.0,
        },
        {
          id: 'inv-demo-1',
          invoiceNo: 'INV-1048',
          date: '22-08-2026',
          time: '01:45 PM',
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
          balance: 0,
          previousBalance: 0,
          currentBalance: 0,
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
      this.syncActiveAccountVault();
    } catch (e) {
      console.error('Failed to save bills list:', e);
    }
  }

  // Get next sequential invoice number ensuring no duplicate
  getNextInvoiceNumber(): string {
    const settings = this.getSettings();
    const prefix = settings.invoicePrefix ?? 'INV-';
    const bills = this.getBills();

    // Extract all existing invoice numeric counters to find the true max
    let maxNum = 1000;
    if (typeof settings.nextInvoiceNumber === 'number' && settings.nextInvoiceNumber > maxNum) {
      maxNum = settings.nextInvoiceNumber - 1;
    }

    for (const b of bills) {
      if (!b.invoiceNo) continue;
      // Extract trailing digits
      const match = b.invoiceNo.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${nextNum}`;
  }

  saveBill(bill: BillInvoice): void {
    const bills = this.getBills();
    // Ensure payment status is set
    if (!bill.paymentStatus) {
      bill.paymentStatus = bill.paymentMethod === 'due' ? 'DUE' : 'PAID';
    }

    // Match strictly by unique bill.id.
    const existingIndex = bills.findIndex((b) => b.id === bill.id);
    if (existingIndex >= 0) {
      // Ensure bill has an invoice number
      if (!bill.invoiceNo || !bill.invoiceNo.trim()) {
        bill.invoiceNo = bills[existingIndex].invoiceNo || this.getNextInvoiceNumber();
      }
      bills[existingIndex] = { ...bills[existingIndex], ...bill };
    } else {
      // Auto-assign invoice number if empty or whitespace
      if (!bill.invoiceNo || !bill.invoiceNo.trim()) {
        bill.invoiceNo = this.getNextInvoiceNumber();
      } else {
        // If an invoice with the exact same invoiceNo exists, generate the next unique sequence
        const duplicateInvoice = bills.find((b) => b.invoiceNo === bill.invoiceNo);
        if (duplicateInvoice) {
          bill.invoiceNo = this.getNextInvoiceNumber();
        }
      }

      bills.unshift(bill);

      // Increment nextInvoiceNumber in settings if this invoice used the sequence
      try {
        const settings = this.getSettings();
        const match = bill.invoiceNo.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            const currentNext = settings.nextInvoiceNumber || 1001;
            if (num >= currentNext) {
              settings.nextInvoiceNumber = num + 1;
              this.saveSettings(settings);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to advance invoice counter in settings:', err);
      }
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
    this.syncActiveAccountVault();
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
          type: 'receivable',
          dueAmount: 1850,
          lastUpdated: Date.now() - 1000 * 60 * 60 * 24,
          transactions: [
            {
              id: 'tx-1',
              type: 'added',
              dueType: 'receivable',
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
          type: 'receivable',
          dueAmount: 3200,
          lastUpdated: Date.now() - 1000 * 60 * 60 * 48,
          transactions: [
            {
              id: 'tx-2',
              type: 'added',
              dueType: 'receivable',
              amount: 3200,
              note: "Men's formal shirts (2 pcs) and denim jeans",
              timestamp: Date.now() - 1000 * 60 * 60 * 48,
              dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 48).toLocaleDateString(),
            },
          ],
        },
        {
          id: 'due-3',
          name: 'Kabir Ahmed',
          phone: '98453 77889',
          type: 'payable',
          dueAmount: 1200,
          lastUpdated: Date.now() - 1000 * 60 * 60 * 12,
          transactions: [
            {
              id: 'tx-3',
              type: 'added',
              dueType: 'payable',
              amount: 1200,
              note: 'অর্ডারের জন্য অগ্রিম জমা (Advance deposit for suit stitching)',
              timestamp: Date.now() - 1000 * 60 * 60 * 12,
              dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 12).toLocaleDateString(),
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
      // Ensure all dues have valid type
      return parsed.map((d) => ({
        ...d,
        type: d.type || 'receivable',
      }));
    } catch {
      return [];
    }
  }

  saveCustomerDues(dues: CustomerDue[]): void {
    localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(dues));
    this.syncActiveAccountVault();
  }

  addOrUpdateCustomerDue(
    name: string,
    amount: number,
    phone: string = '',
    note: string = '',
    type: DueType = 'receivable'
  ): CustomerDue {
    const dues = this.getCustomerDues();
    const existingIndex = dues.findIndex(
      (d) => d.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    const now = Date.now();
    const txNote =
      note.trim() ||
      (type === 'payable'
        ? 'কাস্টমার পাওনাদার / অগ্রিম জমা (Payable / Advance)'
        : 'বাকি যোগ (Due added)');

    const newTx = {
      id: 'tx-' + now,
      type: 'added' as const,
      dueType: type,
      amount,
      note: txNote,
      timestamp: now,
      dateFormatted:
        new Date(now).toLocaleDateString() +
        ' ' +
        new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (existingIndex >= 0) {
      const existing = dues[existingIndex];
      existing.type = existing.type || 'receivable';

      // If same type, add
      if (existing.type === type) {
        existing.dueAmount += amount;
      } else {
        // Opposite type net-off
        if (amount > existing.dueAmount) {
          existing.dueAmount = amount - existing.dueAmount;
          existing.type = type;
        } else {
          existing.dueAmount -= amount;
        }
      }

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
        type,
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

    target.type = target.type || 'receivable';
    target.dueAmount = Math.max(0, target.dueAmount - paidAmount);
    target.lastUpdated = Date.now();
    target.transactions = target.transactions || [];

    const defaultNote =
      target.type === 'payable'
        ? 'পাওনাদারকে পরিশোধ / সমন্বয় (Paid to Creditor / Settle)'
        : 'বাকি আদায় / পেমেন্ট জমা (Payment received)';

    target.transactions.unshift({
      id: 'tx-' + Date.now(),
      type: 'paid',
      dueType: target.type,
      amount: paidAmount,
      note: note.trim() || defaultNote,
      timestamp: Date.now(),
      dateFormatted:
        new Date().toLocaleDateString() +
        ' ' +
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    this.saveCustomerDues(dues);
    return target;
  }

  deleteCustomerDue(id: string): void {
    const dues = this.getCustomerDues().filter((d) => d.id !== id);
    this.saveCustomerDues(dues);
  }

  // --- ACCOUNT VAULT & PERSISTENCE ENGINE ---
  normalizeIdentifier(input: string): string {
    if (!input) return '';
    return input.trim().toLowerCase().replace(/[\s+()_-]/g, '');
  }

  isFahadAccount(id: string): boolean {
    if (!id) return false;
    const norm = this.normalizeIdentifier(id);
    return (
      norm.includes('9707502246') ||
      norm.includes('uddinfahad') ||
      norm.includes('fahad') ||
      norm.endsWith('9707502246')
    );
  }

  getFahadHistoricSeed(): AccountVaultData {
    const fahadSettings: ThermalPrinterSettings = {
      storeName: 'Classic fashion',
      storePhone: '9707502246',
      storeAddress: 'Main Market, Goalpara, Assam',
      signatoryName: 'Fahad Uddin',
      upiId: '9707502246@upi',
      paperWidth: '58mm',
      currencySymbol: '₹',
      currencyName: 'INR',
      footerNote: 'ধন্যবাদ! আবার আসবেন (Thank you! Visit again)',
      autoPrintOnCheckout: false,
      defaultInvoiceFormat: 'tax_invoice',
      nextInvoiceNumber: 1049,
    };

    const fahadBills: BillInvoice[] = [
      {
        id: 'inv-sale-306',
        invoiceNo: '306',
        date: '22-08-2026',
        time: '02:58 PM',
        timestamp: new Date('2026-08-22T14:58:00').getTime(),
        customerName: 'RUMANA BEGAM',
        customerPhone: '9876543210',
        items: [
          { id: 'it-306-1', name: 'Ganji set', price: 200.0, qty: 2, total: 400.0 },
          { id: 'it-306-2', name: 'Seka ganji', price: 20.0, qty: 4, total: 80.0 },
          { id: 'it-306-3', name: 'Stal orna', price: 200.0, qty: 1, total: 200.0 },
          { id: 'it-306-4', name: 'Cotton orna', price: 125.0, qty: 2, total: 250.0 },
          { id: 'it-306-5', name: 'Nitee', price: 200.0, qty: 1, total: 200.0 },
          { id: 'it-306-6', name: 'Frk', price: 180.0, qty: 1, total: 180.0 },
          { id: 'it-306-7', name: 'Seka', price: 90.0, qty: 1, total: 90.0 },
        ],
        subtotal: 1400.0,
        discount: 140.0,
        discountType: 'fixed',
        discountValue: 140.0,
        grandTotal: 1260.0,
        paymentMethod: 'cash',
        paymentStatus: 'PAID',
        paidAmount: 1260.0,
        changeAmount: 0.0,
      },
      {
        id: 'inv-sale-1048',
        invoiceNo: 'INV-1048',
        date: '19-09-2026',
        time: '11:20 AM',
        timestamp: Date.now() - 1000 * 60 * 180,
        customerName: 'Tanvir Ahmed',
        customerPhone: '9845012345',
        items: [{ id: 'it-1', name: 'Cotton Kurti & Pajama Set', price: 1450, qty: 1, total: 1450 }],
        subtotal: 1450,
        discount: 0,
        grandTotal: 1450,
        paymentMethod: 'cash',
        paymentStatus: 'PAID',
        paidAmount: 1450,
        changeAmount: 0,
      },
      {
        id: 'inv-sale-1047',
        invoiceNo: 'INV-1047',
        date: '19-09-2026',
        time: '10:05 AM',
        timestamp: Date.now() - 1000 * 60 * 250,
        customerName: 'Priya Sharma',
        customerPhone: '9123456789',
        items: [{ id: 'it-2', name: 'Georgette Embroidered Dupatta', price: 450, qty: 1, total: 450 }],
        subtotal: 450,
        discount: 0,
        grandTotal: 450,
        paymentMethod: 'upi',
        paymentStatus: 'PAID',
        paidAmount: 450,
        changeAmount: 0,
      },
      {
        id: 'inv-sale-1046',
        invoiceNo: 'INV-1046',
        date: '18-09-2026',
        time: '06:40 PM',
        timestamp: Date.now() - 1000 * 60 * 60 * 20,
        customerName: 'Walk-in Customer',
        items: [{ id: 'it-3', name: 'Silk Neck Scarf', price: 320, qty: 1, total: 320 }],
        subtotal: 320,
        discount: 0,
        grandTotal: 320,
        paymentMethod: 'cash',
        paymentStatus: 'PAID',
        paidAmount: 320,
        changeAmount: 0,
      },
    ];

    const fahadCash: CashEntry[] = [
      {
        id: 'cash-1',
        type: 'Income',
        amount: 4500,
        note: 'Counter sale - 3x Cotton Kurtis & Dupatta',
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        dateFormatted: '02:30 PM',
      },
      {
        id: 'cash-2',
        type: 'Expense',
        amount: 850,
        note: 'Alteration tailoring thread & packaging covers',
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
        dateFormatted: '11:15 AM',
      },
      {
        id: 'cash-3',
        type: 'Expense',
        amount: 12000,
        note: 'Wholesale cloth roll purchase from Surat vendor',
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
        dateFormatted: 'Yesterday',
      },
    ];

    const fahadDues: CustomerDue[] = [
      {
        id: 'due-1',
        name: 'Ramesh Patel',
        phone: '98765 43210',
        type: 'receivable',
        dueAmount: 1500,
        lastUpdated: Date.now() - 1000 * 60 * 60 * 24 * 2,
        transactions: [
          {
            id: 'tx-1',
            type: 'added',
            dueType: 'receivable',
            amount: 1500,
            note: 'বাকি কেনাকাটা (Unpaid bill for 2 Cotton Kurtis)',
            timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
            dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toLocaleDateString(),
          },
        ],
      },
      {
        id: 'due-2',
        name: 'Ananya Roy',
        phone: '98301 22334',
        type: 'receivable',
        dueAmount: 850,
        lastUpdated: Date.now() - 1000 * 60 * 60 * 24 * 5,
        transactions: [
          {
            id: 'tx-2',
            type: 'added',
            dueType: 'receivable',
            amount: 850,
            note: 'বাকি কেনাকাটা (Designer Dupatta balance)',
            timestamp: Date.now() - 1000 * 60 * 60 * 24 * 5,
            dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toLocaleDateString(),
          },
        ],
      },
      {
        id: 'due-3',
        name: 'Suman Das (Master Tailor)',
        phone: '98453 77889',
        type: 'payable',
        dueAmount: 1200,
        lastUpdated: Date.now() - 1000 * 60 * 60 * 12,
        transactions: [
          {
            id: 'tx-3',
            type: 'added',
            dueType: 'payable',
            amount: 1200,
            note: 'অর্ডারের জন্য অগ্রিম জমা (Advance deposit for suit stitching)',
            timestamp: Date.now() - 1000 * 60 * 60 * 12,
            dateFormatted: new Date(Date.now() - 1000 * 60 * 60 * 12).toLocaleDateString(),
          },
        ],
      },
    ];

    return {
      identifier: '9707502246',
      email: 'uddinfahad89@gmail.com',
      phone: '9707502246',
      name: 'Fahad Uddin',
      role: 'Owner',
      pin: '1234',
      isAppLockEnabled: false,
      settings: fahadSettings,
      bills: fahadBills,
      cashEntries: fahadCash,
      customerDues: fahadDues,
      purchaseTrips: [],
      lastActive: Date.now(),
    };
  }

  getSavedAccounts(): SavedAccountItem[] {
    try {
      const indexRaw = localStorage.getItem(VAULT_KEYS.ACCOUNTS_INDEX);
      let list: SavedAccountItem[] = indexRaw ? JSON.parse(indexRaw) : [];

      // Always ensure Fahad Uddin's account is registered and available
      const hasFahad = list.some((a) => this.isFahadAccount(a.identifier) || this.isFahadAccount(a.phone) || this.isFahadAccount(a.email));
      if (!hasFahad) {
        const fahad = this.getFahadHistoricSeed();
        this.saveToAccountVault(fahad);
        list = [
          {
            identifier: fahad.phone,
            name: fahad.name,
            phone: fahad.phone,
            email: fahad.email,
            storeName: fahad.settings.storeName,
            role: fahad.role,
            lastActive: fahad.lastActive,
          },
          ...list,
        ];
      }
      return list;
    } catch {
      return [];
    }
  }

  saveToAccountVault(vaultData: AccountVaultData): void {
    try {
      const normId = this.normalizeIdentifier(vaultData.identifier || vaultData.phone || vaultData.email);
      if (!normId) return;

      localStorage.setItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${normId}`, JSON.stringify(vaultData));

      // Also link by phone and email if different
      if (vaultData.phone) {
        const pNorm = this.normalizeIdentifier(vaultData.phone);
        if (pNorm !== normId) {
          localStorage.setItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${pNorm}`, JSON.stringify(vaultData));
        }
      }
      if (vaultData.email) {
        const eNorm = this.normalizeIdentifier(vaultData.email);
        if (eNorm !== normId) {
          localStorage.setItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${eNorm}`, JSON.stringify(vaultData));
        }
      }

      // Update registry index
      const indexRaw = localStorage.getItem(VAULT_KEYS.ACCOUNTS_INDEX);
      let list: SavedAccountItem[] = indexRaw ? JSON.parse(indexRaw) : [];
      const item: SavedAccountItem = {
        identifier: vaultData.phone || vaultData.email || vaultData.identifier,
        name: vaultData.name || 'Store Owner',
        phone: vaultData.phone || '',
        email: vaultData.email || '',
        storeName: vaultData.settings?.storeName || 'My Store',
        role: vaultData.role || 'Owner',
        lastActive: Date.now(),
      };

      const existingIdx = list.findIndex(
        (a) =>
          this.normalizeIdentifier(a.identifier) === normId ||
          (a.phone && this.normalizeIdentifier(a.phone) === this.normalizeIdentifier(vaultData.phone)) ||
          (a.email && this.normalizeIdentifier(a.email) === this.normalizeIdentifier(vaultData.email))
      );

      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...item };
      } else {
        list.unshift(item);
      }

      localStorage.setItem(VAULT_KEYS.ACCOUNTS_INDEX, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save account vault:', e);
    }
  }

  syncActiveAccountVault(specificProfile?: UserProfile): void {
    try {
      const profile = specificProfile || this.getUserProfile();
      const identifier = profile.phone || profile.email;
      if (!identifier && !profile.isLoggedIn) return;

      const norm = this.normalizeIdentifier(identifier || 'default');
      const settings = this.getSettings();
      const bills = this.getBills();
      const cashEntries = this.getCashEntries();
      const customerDues = this.getCustomerDues();
      const purchaseTrips = this.getPurchaseTrips();

      const vaultData: AccountVaultData = {
        identifier: profile.phone || profile.email || norm,
        email: profile.email || '',
        phone: profile.phone || '',
        name: profile.name || 'Store Owner',
        role: profile.role || 'Owner',
        pin: profile.pin || '1234',
        isAppLockEnabled: profile.isAppLockEnabled,
        settings,
        bills,
        cashEntries,
        customerDues,
        purchaseTrips,
        lastActive: Date.now(),
      };

      this.saveToAccountVault(vaultData);
    } catch {
      // ignore
    }
  }

  restoreFromAccountVault(identifier: string): boolean {
    try {
      if (!identifier) return false;
      const norm = this.normalizeIdentifier(identifier);

      let vaultRaw = localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${norm}`);

      // Try matching phone digits or email
      if (!vaultRaw) {
        const list = this.getSavedAccounts();
        const match = list.find(
          (a) =>
            this.normalizeIdentifier(a.identifier) === norm ||
            this.normalizeIdentifier(a.phone) === norm ||
            this.normalizeIdentifier(a.email) === norm ||
            (norm.length >= 10 && this.normalizeIdentifier(a.phone).endsWith(norm.slice(-10)))
        );
        if (match) {
          vaultRaw =
            localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${this.normalizeIdentifier(match.phone)}`) ||
            localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${this.normalizeIdentifier(match.email)}`) ||
            localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${this.normalizeIdentifier(match.identifier)}`);
        }
      }

      // If still not found and identifier is Fahad's phone/email, load seed!
      if (!vaultRaw && this.isFahadAccount(identifier)) {
        const seed = this.getFahadHistoricSeed();
        this.saveToAccountVault(seed);
        vaultRaw = JSON.stringify(seed);
      }

      if (!vaultRaw) return false;

      const vault: AccountVaultData = JSON.parse(vaultRaw);

      // Restore active data into localStorage
      if (vault.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(vault.settings));
      }
      if (Array.isArray(vault.bills)) {
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(vault.bills));
      }
      if (Array.isArray(vault.cashEntries)) {
        localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify(vault.cashEntries));
      }
      if (Array.isArray(vault.customerDues)) {
        localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(vault.customerDues));
      }
      if (Array.isArray(vault.purchaseTrips)) {
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(vault.purchaseTrips));
      }

      const restoredProfile: UserProfile = {
        email: vault.email || '',
        name: vault.name || 'Store Owner',
        phone: vault.phone || '',
        role: vault.role || 'Owner',
        pin: vault.pin || '1234',
        isLoggedIn: true,
        isAppLockEnabled: vault.isAppLockEnabled,
        loginTime: Date.now(),
        loginMethod: 'otp',
        otpVerified: true,
      };

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restoredProfile));
      return true;
    } catch (e) {
      console.error('Failed to restore from account vault:', e);
      return false;
    }
  }

  // --- USER PROFILE & AUTH ---
  getUserProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      if (!data) {
        // Check if there is an account in the vault to prefill
        const accounts = this.getSavedAccounts();
        if (accounts.length > 0) {
          const first = accounts[0];
          const prefill: UserProfile = {
            email: first.email || '',
            name: first.name || '',
            phone: first.phone || '',
            role: first.role || 'Owner',
            isLoggedIn: false,
            pin: '1234',
          };
          this.saveUserProfile(prefill);
          return prefill;
        }
        this.saveUserProfile(DEFAULT_USER);
        return DEFAULT_USER;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_USER;
    }
  }

  saveUserProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
  }

  loginUser(
    emailOrIdentifier: string,
    name?: string,
    pin?: string,
    role?: 'Owner' | 'Manager' | 'Cashier',
    phone?: string,
    loginMethod?: 'email_pin' | 'otp',
    otpVerified?: boolean
  ): UserProfile {
    const raw = (emailOrIdentifier || phone || '').trim();
    const cleanPhone = phone?.trim() || (!raw.includes('@') ? raw : '');
    const cleanEmail = raw.includes('@') ? raw : '';

    // Attempt restoring account data from vault
    const lookupKey = cleanPhone || cleanEmail || raw;
    this.restoreFromAccountVault(lookupKey);

    const current = this.getUserProfile();

    const isEmail = raw.includes('@');
    const finalEmail = cleanEmail || (isEmail ? raw : (current.email || ''));
    const finalPhone = cleanPhone || (!isEmail ? raw : (current.phone || ''));

    const inferredName =
      name?.trim() ||
      current.name ||
      (this.isFahadAccount(finalPhone) || this.isFahadAccount(finalEmail) ? 'Fahad Uddin' : '') ||
      (finalEmail ? finalEmail.split('@')[0] : '') ||
      (finalPhone ? `User ${finalPhone.slice(-4)}` : 'Store Owner');

    const updated: UserProfile = {
      ...current,
      email: finalEmail,
      name: inferredName,
      phone: finalPhone,
      role: role || current.role || 'Owner',
      pin: pin?.trim() || current.pin || '1234',
      isLoggedIn: true,
      loginTime: Date.now(),
      loginMethod: loginMethod || current.loginMethod || (finalPhone ? 'otp' : 'email_pin'),
      otpVerified: otpVerified !== undefined ? otpVerified : true,
    };

    this.saveUserProfile(updated);
    this.syncActiveAccountVault(updated);

    return updated;
  }

  registerNewUser(data: {
    name: string;
    phone: string;
    email?: string;
    storeName?: string;
    pin?: string;
    role?: 'Owner' | 'Manager' | 'Cashier';
  }): UserProfile {
    const cleanPhone = data.phone.trim();
    const cleanEmail = (data.email || '').trim();
    const cleanName = data.name.trim() || 'Store Owner';
    const cleanStore = (data.storeName || '').trim() || `${cleanName}'s Store`;
    const cleanPin = (data.pin || '1234').trim();
    const role = data.role || 'Owner';

    // First save active session of any existing user before switching
    this.syncActiveAccountVault();

    const baseSettings = this.getSettings();
    const newSettings: ThermalPrinterSettings = {
      ...baseSettings,
      storeName: cleanStore,
      storePhone: cleanPhone,
      storeAddress: '',
      footerNote: 'ধন্যবাদ! আবার আসবেন।',
    };

    const newVault: AccountVaultData = {
      identifier: cleanPhone || cleanEmail || `user_${Date.now()}`,
      phone: cleanPhone,
      email: cleanEmail,
      name: cleanName,
      role: role,
      pin: cleanPin,
      isAppLockEnabled: false,
      settings: newSettings,
      bills: [],
      cashEntries: [],
      customerDues: [],
      purchaseTrips: [],
      lastActive: Date.now(),
    };

    // Save to account vault
    this.saveToAccountVault(newVault);

    // Set this as the active session in localStorage with fresh isolated data
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));

    const newProfile: UserProfile = {
      email: cleanEmail,
      name: cleanName,
      phone: cleanPhone,
      role: role,
      pin: cleanPin,
      isLoggedIn: true,
      loginTime: Date.now(),
      loginMethod: 'otp',
      otpVerified: true,
      isAppLockEnabled: false,
    };

    this.saveUserProfile(newProfile);
    return newProfile;
  }

  logoutUser(): void {
    // Before logging out, sync active data to user's vault
    this.syncActiveAccountVault();
    const current = this.getUserProfile();
    const loggedOut: UserProfile = {
      ...current,
      isLoggedIn: false,
      loginTime: undefined,
    };
    this.saveUserProfile(loggedOut);
  }

  updateUserSecurity(updates: Partial<UserProfile>): UserProfile {
    const current = this.getUserProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
    };
    this.saveUserProfile(updated);
    this.syncActiveAccountVault(updated);
    return updated;
  }

  verifyPin(enteredPin: string): boolean {
    const profile = this.getUserProfile();
    const currentPin = profile.pin || '1234';
    return enteredPin.trim() === currentPin.trim();
  }

  resetPin(emailOrPhone: string, newPin: string): boolean {
    const profile = this.getUserProfile();
    const target = emailOrPhone.trim().toLowerCase().replace(/[\s+-]/g, '');
    const currentEmail = (profile.email || '').toLowerCase().replace(/[\s+-]/g, '');
    const currentPhone = (profile.phone || '').toLowerCase().replace(/[\s+-]/g, '');

    if (target === currentEmail || target === currentPhone) {
      this.updateUserSecurity({ pin: newPin.trim() });
      return true;
    }
    return false;
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

  // --- LANGUAGE SETTINGS ---
  getLanguage(): Language {
    try {
      const lang = localStorage.getItem(STORAGE_KEYS.LANG);
      if (lang === 'en' || lang === 'bn' || lang === 'hi') {
        return lang;
      }
      return 'bn'; // Default to Bengali as requested
    } catch {
      return 'bn';
    }
  }

  setLanguage(lang: Language): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, lang);
    } catch (e) {
      console.error('Failed to save language:', e);
    }
  }

  // --- STOCK PURCHASE / SHOPPING TRIPS ---
  getPurchaseTrips(): PurchaseTrip[] {
    try {
      const now = Date.now();
      const defaultTrips: PurchaseTrip[] = [
        {
          id: 'trip-demo-1',
          title: 'চকবাজার পাইকারি বাজার - নতুন কালেকশন কেনা',
          marketLocation: 'চকবাজার পাইকারি মার্কেট',
          dateFormatted: new Date(now).toLocaleDateString(),
          timestamp: now - 1000 * 60 * 60 * 3, // 3 hours ago
          initialCash: 10000,
          totalSpent: 8650,
          remainingCash: 1350,
          status: 'active',
          note: 'দোকানের জন্য নতুন পোশাক ও কাপড় কেনাকাটা',
          expenses: [
            {
              id: 'exp-1',
              title: 'সুতি জামদানি শাড়ি ও কাতান লট (৫ পিস)',
              category: 'goods',
              amount: 6200,
              vendorOrPlace: 'মেসার্স মোল্লা টেক্সটাইল, দোকান নং ১৪',
              note: 'পাইকারি রেটে নেওয়া হয়েছে',
              timestamp: now - 1000 * 60 * 60 * 2.5,
              dateFormatted: new Date(now - 1000 * 60 * 60 * 2.5).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
            {
              id: 'exp-2',
              title: 'সুতি থান কাপড় (২০ গজ রোল)',
              category: 'goods',
              amount: 1900,
              vendorOrPlace: 'আল-মদিনা ক্লথ স্টোর, ২য় তলা',
              note: 'ব্লাউজ ও সালোয়ারের থান কাপড়',
              timestamp: now - 1000 * 60 * 60 * 2,
              dateFormatted: new Date(now - 1000 * 60 * 60 * 2).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
            {
              id: 'exp-3',
              title: 'মাল লোড ও ভ্যান পরিবহন ভাড়া',
              category: 'transport',
              amount: 350,
              vendorOrPlace: 'চকবাজার ভ্যান স্ট্যান্ড',
              note: 'দোকানে মাল পৌঁছানোর ভাড়া',
              timestamp: now - 1000 * 60 * 60 * 1.5,
              dateFormatted: new Date(now - 1000 * 60 * 60 * 1.5).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
            {
              id: 'exp-4',
              title: 'দুপুরের খাবার ও চা-নাস্তা',
              category: 'food',
              amount: 200,
              vendorOrPlace: 'হোটেল কস্তুরী, চকবাজার',
              note: 'বাজার চলাকালীন খাবার খরচ',
              timestamp: now - 1000 * 60 * 60 * 1,
              dateFormatted: new Date(now - 1000 * 60 * 60 * 1).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ],
        },
      ];

      const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!data) {
        this.savePurchaseTrips(defaultTrips);
        return defaultTrips;
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  savePurchaseTrips(trips: PurchaseTrip[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(trips));
      this.syncActiveAccountVault();
    } catch (e) {
      console.error('Failed to save purchase trips:', e);
    }
  }

  createPurchaseTrip(
    title: string,
    initialCash: number,
    marketLocation?: string,
    note?: string
  ): PurchaseTrip {
    const trips = this.getPurchaseTrips();
    const now = Date.now();
    const newTrip: PurchaseTrip = {
      id: 'trip-' + now,
      title: title.trim(),
      marketLocation: marketLocation?.trim() || '',
      dateFormatted: new Date(now).toLocaleDateString(),
      timestamp: now,
      initialCash: Math.max(0, initialCash),
      expenses: [],
      totalSpent: 0,
      remainingCash: Math.max(0, initialCash),
      status: 'active',
      note: note?.trim() || '',
    };

    trips.unshift(newTrip);
    this.savePurchaseTrips(trips);
    return newTrip;
  }

  addExpenseToTrip(
    tripId: string,
    item: Omit<PurchaseExpenseItem, 'id' | 'timestamp' | 'dateFormatted'>
  ): PurchaseTrip | null {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    const now = Date.now();
    const newExpense: PurchaseExpenseItem = {
      ...item,
      id: 'exp-' + now,
      timestamp: now,
      dateFormatted:
        new Date(now).toLocaleDateString() +
        ' ' +
        new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    trip.expenses = trip.expenses || [];
    trip.expenses.unshift(newExpense);

    // Recompute totals
    trip.totalSpent = trip.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    trip.remainingCash = trip.initialCash - trip.totalSpent;

    this.savePurchaseTrips(trips);
    return trip;
  }

  deleteExpenseFromTrip(tripId: string, expenseId: string): PurchaseTrip | null {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    trip.expenses = trip.expenses.filter((e) => e.id !== expenseId);
    trip.totalSpent = trip.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    trip.remainingCash = trip.initialCash - trip.totalSpent;

    this.savePurchaseTrips(trips);
    return trip;
  }

  updateTripStatus(tripId: string, status: 'active' | 'completed'): PurchaseTrip | null {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    trip.status = status;
    this.savePurchaseTrips(trips);
    return trip;
  }

  updatePurchaseTrip(
    tripId: string,
    updates: {
      title?: string;
      initialCash?: number;
      marketLocation?: string;
      note?: string;
    }
  ): PurchaseTrip | null {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    if (updates.title !== undefined) trip.title = updates.title.trim();
    if (updates.marketLocation !== undefined) trip.marketLocation = updates.marketLocation.trim();
    if (updates.note !== undefined) trip.note = updates.note.trim();
    if (updates.initialCash !== undefined) {
      trip.initialCash = Math.max(0, updates.initialCash);
    }

    // Recalculate totals
    trip.totalSpent = (trip.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    trip.remainingCash = trip.initialCash - trip.totalSpent;

    this.savePurchaseTrips(trips);
    return trip;
  }

  addCashToTrip(tripId: string, additionalCash: number): PurchaseTrip | null {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    trip.initialCash = Math.max(0, trip.initialCash + additionalCash);
    trip.totalSpent = (trip.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    trip.remainingCash = trip.initialCash - trip.totalSpent;

    this.savePurchaseTrips(trips);
    return trip;
  }

  setTripSyncedCashEntry(tripId: string, cashEntryId: string): void {
    const trips = this.getPurchaseTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;

    trip.syncedCashEntryId = cashEntryId;
    this.savePurchaseTrips(trips);
  }

  deletePurchaseTrip(tripId: string): void {
    const trips = this.getPurchaseTrips().filter((t) => t.id !== tripId);
    this.savePurchaseTrips(trips);
  }

  // --- OFFLINE BACKUP & EXPORT ---
  exportAllDataOffline(): string {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      bills: this.getBills(),
      customerDues: this.getCustomerDues(),
      cashEntries: this.getCashEntries(),
      purchaseTrips: this.getPurchaseTrips(),
      settings: this.getSettings(),
      user: this.getUserProfile(),
      language: this.getLanguage(),
    };
    return JSON.stringify(backupData, null, 2);
  }

  importAllDataOffline(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.bills && Array.isArray(data.bills)) {
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(data.bills));
      }
      if (data.customerDues && Array.isArray(data.customerDues)) {
        localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(data.customerDues));
      }
      if (data.cashEntries && Array.isArray(data.cashEntries)) {
        localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify(data.cashEntries));
      }
      if (data.purchaseTrips && Array.isArray(data.purchaseTrips)) {
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(data.purchaseTrips));
      }
      if (data.settings && typeof data.settings === 'object') {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
