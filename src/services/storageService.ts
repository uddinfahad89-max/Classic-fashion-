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
  BarcodeLabelConfig,
  ProductStockItem,
} from '../types';

const STORAGE_KEYS = {
  BILLS: 'simple_pos_bills',
  CASHBOOK: 'simple_pos_cashbook',
  DUES: 'simple_pos_dues',
  SETTINGS: 'simple_pos_settings',
  SAVED_PRINTER: 'pos_saved_bluetooth_printer',
  PAIRED_PRINTERS: 'pos_paired_printers_list',
  USER: 'simple_pos_user',
  PURCHASES: 'simple_pos_purchase_trips',
  PRODUCTS: 'simple_pos_products_stock',
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
  products?: ProductStockItem[];
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
  paperWidth: '80mm',
  currencySymbol: 'Rs',
  currencyName: 'Rupees',
  hideCurrencySymbol: false,
  footerNote: '(Thank you! Visit again)',
  autoPrintOnCheckout: true,
  defaultInvoiceFormat: 'tax_invoice',
  isDataSaverEnabled: false,
  invoicePrefix: '',
  nextInvoiceNumber: 1,
  isLabelMode: false,
};

class StorageService {
  constructor() {
    this.purgeLegacyDataOnce();
  }

  // Purge any legacy sample/demo invoices, daybook entries, dues, or trips so new users have a clean slate
  purgeLegacyDataOnce(): void {
    try {
      const PURGE_KEY = 'simple_pos_cleared_all_old_data_v5';
      if (typeof window !== 'undefined' && localStorage.getItem(PURGE_KEY) !== 'done') {
        localStorage.removeItem(STORAGE_KEYS.BILLS);
        localStorage.removeItem(STORAGE_KEYS.CASHBOOK);
        localStorage.removeItem(STORAGE_KEYS.DUES);
        localStorage.removeItem(STORAGE_KEYS.PURCHASES);

        // Also clean any cached vault data in localStorage
        const indexRaw = localStorage.getItem(VAULT_KEYS.ACCOUNTS_INDEX);
        if (indexRaw) {
          try {
            const list: SavedAccountItem[] = JSON.parse(indexRaw);
            for (const item of list) {
              const norm = this.normalizeIdentifier(item.identifier || item.phone || item.email);
              if (norm) {
                const k = `${VAULT_KEYS.ACCOUNT_PREFIX}${norm}`;
                const rawV = localStorage.getItem(k);
                if (rawV) {
                  try {
                    const parsed = JSON.parse(rawV);
                    parsed.bills = [];
                    parsed.cashEntries = [];
                    parsed.customerDues = [];
                    parsed.purchaseTrips = [];
                    localStorage.setItem(k, JSON.stringify(parsed));
                  } catch {}
                }
              }
            }
          } catch {}
        }
        localStorage.setItem(PURGE_KEY, 'done');
      }
    } catch (e) {
      console.warn('purgeLegacyDataOnce notice:', e);
    }
  }

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
      // Migrate legacy 1001 default to starting sequence 1
      if (parsed.nextInvoiceNumber === 1001 || !parsed.nextInvoiceNumber) {
        parsed.nextInvoiceNumber = 1;
      }
      // Sanitize thermal footer note if it contains non-ASCII/Bengali or ??? that produces question marks
      if (
        parsed.footerNote &&
        (/[\u0980-\u09FF]/.test(parsed.footerNote) || parsed.footerNote.includes('?'))
      ) {
        parsed.footerNote = 'Thank you! Visit again.';
      }
      // Replace any rogue ? symbol with standard Rs.
      if (parsed.currencySymbol === '?' || parsed.currencySymbol === '₹') {
        parsed.currencySymbol = 'Rs.';
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
        const parsed: BillInvoice[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
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
    const prefix = settings.invoicePrefix !== undefined ? settings.invoicePrefix : '';
    const bills = this.getBills();

    // Default starting sequence is 1 (or whatever user configured in settings)
    const baseStart =
      typeof settings.nextInvoiceNumber === 'number' && settings.nextInvoiceNumber > 0
        ? settings.nextInvoiceNumber
        : 1;

    let maxNum = baseStart - 1;

    for (const b of bills) {
      if (!b.invoiceNo) continue;
      // Skip initial preloaded demo bills (inv-demo-*) so they do not force starting sequence to 1049
      if (b.id && b.id.startsWith('inv-demo-')) {
        continue;
      }
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
            const currentNext = settings.nextInvoiceNumber || 1;
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

    // Direct backup of this bill to server disk (only if logged in with phone or email)
    try {
      const profile = this.getUserProfile();
      const id = profile.phone || profile.email;
      if (profile.isLoggedIn && id && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        fetch('/api/bills/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: id, bill }),
        }).catch((e) => console.warn('Server bill backup notice:', e));
      }
    } catch {
      // ignore
    }
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
      if (!data) {
        return [];
      }
      const parsed: CashEntry[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
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
      const data = localStorage.getItem(STORAGE_KEYS.DUES);
      if (!data) {
        return [];
      }
      const parsed: CustomerDue[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map((d) => ({
          ...d,
          type: d.type || 'receivable',
        }));
      }
      return [];
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

  getSavedAccounts(): SavedAccountItem[] {
    try {
      const indexRaw = localStorage.getItem(VAULT_KEYS.ACCOUNTS_INDEX);
      const list: SavedAccountItem[] = indexRaw ? JSON.parse(indexRaw) : [];
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

      // Asynchronously backup to server disk so clearing client app data/cache never loses bills
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        fetch('/api/vault/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vaultData),
        }).catch((err) => {
          console.warn('Server vault sync notice:', err);
        });
      }
    } catch (e) {
      console.warn('Failed to save account vault:', e);
    }
  }

  syncActiveAccountVault(specificProfile?: UserProfile): void {
    try {
      const profile = specificProfile || this.getUserProfile();
      if (!profile || !profile.isLoggedIn) {
        return;
      }
      const identifier = profile.phone || profile.email;
      if (!identifier) {
        return;
      }

      const norm = this.normalizeIdentifier(identifier);
      const settings = this.getSettings();
      const bills = this.getBills();
      const cashEntries = this.getCashEntries();
      const customerDues = this.getCustomerDues();
      const purchaseTrips = this.getPurchaseTrips();
      const products = this.getProducts();

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
        products,
        lastActive: Date.now(),
      };

      this.saveToAccountVault(vaultData);
    } catch {
      // ignore
    }
  }

  // Asynchronous restore from server disk (works even after browser cache/storage is cleared)
  async restoreFromAccountVaultAsync(identifier: string): Promise<boolean> {
    try {
      if (!identifier) return false;
      const norm = this.normalizeIdentifier(identifier);

      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
          const res = await fetch(`/api/vault/${encodeURIComponent(norm)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.vault) {
              const serverVault: AccountVaultData = json.vault;

              // Merge server bills with any existing local bills
              const localBills = this.getBills();
              const serverBills = Array.isArray(serverVault.bills) ? serverVault.bills : [];
              const billMap = new Map<string, BillInvoice>();
              for (const b of serverBills) {
                if (b && b.id) billMap.set(b.id, b);
              }
              for (const b of localBills) {
                if (b && b.id) billMap.set(b.id, b);
              }
              const mergedBills = Array.from(billMap.values()).sort(
                (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
              );

              serverVault.bills = mergedBills;
              this.saveToAccountVault(serverVault);

              if (serverVault.settings) {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(serverVault.settings));
              }
              localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(mergedBills));
              if (Array.isArray(serverVault.cashEntries)) {
                localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify(serverVault.cashEntries));
              }
              if (Array.isArray(serverVault.customerDues)) {
                localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(serverVault.customerDues));
              }
              if (Array.isArray(serverVault.purchaseTrips)) {
                localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(serverVault.purchaseTrips));
              }
              if (Array.isArray(serverVault.products)) {
                localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(serverVault.products));
              }

              const restoredProfile: UserProfile = {
                email: serverVault.email || '',
                name: serverVault.name || 'Store Owner',
                phone: serverVault.phone || '',
                role: serverVault.role || 'Owner',
                pin: serverVault.pin || '1234',
                isLoggedIn: true,
                isAppLockEnabled: serverVault.isAppLockEnabled,
                loginTime: Date.now(),
                loginMethod: 'otp',
                otpVerified: true,
              };
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restoredProfile));
              return true;
            }
          }
        } catch (netErr) {
          console.warn('Network vault lookup notice:', netErr);
        }
      }

      return this.restoreFromAccountVault(identifier);
    } catch {
      return false;
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
      if (Array.isArray(vault.products)) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(vault.products));
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
    const restored = this.restoreFromAccountVault(lookupKey);

    if (!restored) {
      // If this account doesn't have existing saved vault data, ensure a clean empty slate!
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
    }

    const current = this.getUserProfile();

    const isEmail = raw.includes('@');
    const finalEmail = cleanEmail || (isEmail ? raw : (current.email || ''));
    const finalPhone = cleanPhone || (!isEmail ? raw : (current.phone || ''));

    const inferredName =
      name?.trim() ||
      current.name ||
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

    // Check if an existing vault or data already exists for this phone or email
    const normPhone = this.normalizeIdentifier(cleanPhone);
    const normEmail = this.normalizeIdentifier(cleanEmail);
    let existingVault: AccountVaultData | null = null;
    try {
      const rawV =
        (normPhone && localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${normPhone}`)) ||
        (normEmail && localStorage.getItem(`${VAULT_KEYS.ACCOUNT_PREFIX}${normEmail}`));
      if (rawV) {
        existingVault = JSON.parse(rawV);
      }
    } catch {}

    const existingBills = existingVault?.bills?.length ? existingVault.bills : [];
    const existingCash = existingVault?.cashEntries?.length ? existingVault.cashEntries : [];
    const existingDues = existingVault?.customerDues?.length ? existingVault.customerDues : [];
    const existingPurchases = existingVault?.purchaseTrips?.length ? existingVault.purchaseTrips : [];

    const baseSettings = this.getSettings();
    const newSettings: ThermalPrinterSettings = {
      ...baseSettings,
      storeName: cleanStore,
      storePhone: cleanPhone,
      storeAddress: existingVault?.settings?.storeAddress || '',
      footerNote: 'Thank you for shopping with us! Visit again.',
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
      bills: existingBills,
      cashEntries: existingCash,
      customerDues: existingDues,
      purchaseTrips: existingPurchases,
      lastActive: Date.now(),
    };

    // Save to account vault
    this.saveToAccountVault(newVault);

    // Set this as the active session in localStorage
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(existingBills));
    localStorage.setItem(STORAGE_KEYS.CASHBOOK, JSON.stringify(existingCash));
    localStorage.setItem(STORAGE_KEYS.DUES, JSON.stringify(existingDues));
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(existingPurchases));

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

  logoutUser(): UserProfile {
    // Before logging out, sync active data to user's vault if logged in
    this.syncActiveAccountVault();
    const loggedOut: UserProfile = {
      ...DEFAULT_USER,
      isLoggedIn: false,
    };
    // Clear active session items in localStorage so next/new visitor sees an empty fresh slate
    localStorage.removeItem(STORAGE_KEYS.BILLS);
    localStorage.removeItem(STORAGE_KEYS.CASHBOOK);
    localStorage.removeItem(STORAGE_KEYS.DUES);
    localStorage.removeItem(STORAGE_KEYS.PURCHASES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    this.saveUserProfile(loggedOut);
    return loggedOut;
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
      this.savePairedPrinter(info);
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

  // --- PAIRED PRINTERS LIST (VYAPAR STYLE) ---
  getPairedPrinters(): SavedPrinterInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PAIRED_PRINTERS);
      if (raw) {
        return JSON.parse(raw);
      }
      // Seed initial devices as seen in user's device screenshot
      const defaultDevices: SavedPrinterInfo[] = [
        {
          id: 'dev-4b-2034pa-1b0d',
          name: '4B-2034PA-1B0D',
          macAddress: 'E0:6E:41:12:1B:0D',
          type: 'bluetooth',
          savedAt: Date.now() - 3600000,
        },
        {
          id: 'dev-ptron-tws',
          name: 'pTron TWS',
          macAddress: '15:5E:0D:DF:92:E3',
          type: 'bluetooth',
          savedAt: Date.now() - 7200000,
        },
      ];
      localStorage.setItem(STORAGE_KEYS.PAIRED_PRINTERS, JSON.stringify(defaultDevices));
      return defaultDevices;
    } catch {
      return [];
    }
  }

  savePairedPrinter(info: SavedPrinterInfo): SavedPrinterInfo[] {
    try {
      const list = this.getPairedPrinters();
      const existingIdx = list.findIndex(
        (p) => p.id === info.id || (p.macAddress && info.macAddress && p.macAddress === info.macAddress) || (p.name && info.name && p.name === info.name)
      );
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...info, savedAt: Date.now() };
      } else {
        list.unshift(info);
      }
      localStorage.setItem(STORAGE_KEYS.PAIRED_PRINTERS, JSON.stringify(list));
      return list;
    } catch (e) {
      console.error('Failed to update paired printers:', e);
      return [];
    }
  }

  removePairedPrinter(id: string): SavedPrinterInfo[] {
    try {
      const list = this.getPairedPrinters().filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.PAIRED_PRINTERS, JSON.stringify(list));
      const active = this.getSavedPrinter();
      if (active && active.id === id) {
        this.clearSavedPrinter();
      }
      return list;
    } catch {
      return [];
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
      const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!data) {
        return [];
      }
      const parsed: PurchaseTrip[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
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

  // --- PRODUCT STOCK & INVENTORY ---
  getProducts(): ProductStockItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let list: ProductStockItem[] = [];
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
      // If product list is empty, seed once from any existing invoices so past items appear in autocomplete
      if (list.length === 0) {
        const bills = this.getBills();
        if (bills.length > 0) {
          const map = new Map<string, ProductStockItem>();
          for (const bill of bills) {
            for (const item of bill.items || []) {
              const cleanName = (item.name || '').trim();
              if (!cleanName) continue;
              const key = cleanName.toLowerCase();
              if (!map.has(key)) {
                map.set(key, {
                  id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                  name: cleanName,
                  price: item.price || 0,
                  stock: 0,
                  unit: 'Pcs',
                  updatedAt: bill.timestamp || Date.now(),
                });
              }
            }
          }
          if (map.size > 0) {
            list = Array.from(map.values());
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(list));
          }
        }
      }
      return list;
    } catch {
      return [];
    }
  }

  saveProducts(products: ProductStockItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      this.syncActiveAccountVault();
    } catch (e) {
      console.error('Failed to save products stock:', e);
    }
  }

  addOrUpdateProduct(data: {
    id?: string;
    name: string;
    price: number;
    purchasePrice?: number;
    stock?: number;
    addStockDelta?: number;
    unit?: string;
    category?: string;
    barcode?: string;
  }): ProductStockItem {
    const products = this.getProducts();
    const cleanName = data.name.trim();
    const now = Date.now();

    const existingIdx = products.findIndex(
      (p) =>
        (data.id && p.id === data.id) ||
        p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIdx >= 0) {
      const existing = products[existingIdx];
      const updatedStock =
        data.addStockDelta !== undefined
          ? Math.max(0, (existing.stock || 0) + data.addStockDelta)
          : data.stock !== undefined
          ? Math.max(0, data.stock)
          : existing.stock || 0;

      const updated: ProductStockItem = {
        ...existing,
        name: cleanName || existing.name,
        price: data.price > 0 ? data.price : existing.price,
        purchasePrice:
          data.purchasePrice !== undefined ? data.purchasePrice : existing.purchasePrice,
        stock: updatedStock,
        unit: data.unit || existing.unit || 'Pcs',
        category: data.category !== undefined ? data.category : existing.category,
        barcode: data.barcode !== undefined ? data.barcode : existing.barcode,
        updatedAt: now,
      };
      products[existingIdx] = updated;
      this.saveProducts(products);
      return updated;
    } else {
      const initialStock =
        data.addStockDelta !== undefined
          ? Math.max(0, data.addStockDelta)
          : data.stock !== undefined
          ? Math.max(0, data.stock)
          : 0;

      const newProd: ProductStockItem = {
        id: 'prod-' + now + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        price: Math.max(0, data.price || 0),
        purchasePrice: data.purchasePrice,
        stock: initialStock,
        unit: data.unit || 'Pcs',
        category: data.category || '',
        barcode: data.barcode || '',
        updatedAt: now,
      };
      products.unshift(newProd);
      this.saveProducts(products);
      return newProd;
    }
  }

  adjustProductStock(productId: string, delta: number): ProductStockItem | null {
    const products = this.getProducts();
    const idx = products.findIndex((p) => p.id === productId);
    if (idx < 0) return null;
    products[idx].stock = Math.max(0, (products[idx].stock || 0) + delta);
    products[idx].updatedAt = Date.now();
    this.saveProducts(products);
    return products[idx];
  }

  deductStockForBill(items: { name: string; price: number; qty: number }[]): void {
    const products = this.getProducts();
    let changed = false;
    const now = Date.now();

    for (const item of items) {
      const cleanName = (item.name || '').trim();
      if (!cleanName) continue;
      const idx = products.findIndex(
        (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (idx >= 0) {
        products[idx].stock = Math.max(0, (products[idx].stock || 0) - (item.qty || 1));
        if (item.price > 0) {
          products[idx].price = item.price;
        }
        products[idx].updatedAt = now;
        changed = true;
      } else {
        // Also auto-save new billed product so next time typing its first letter brings it up immediately!
        products.unshift({
          id: 'prod-' + now + '-' + Math.random().toString(36).substring(2, 6),
          name: cleanName,
          price: item.price || 0,
          stock: 0,
          unit: 'Pcs',
          updatedAt: now,
        });
        changed = true;
      }
    }

    if (changed) {
      this.saveProducts(products);
    }
  }

  deleteProduct(productId: string): void {
    const products = this.getProducts().filter((p) => p.id !== productId);
    this.saveProducts(products);
  }

  // --- OFFLINE BACKUP & EXPORT (DATA SAFETY NET) ---
  exportAllDataOffline(): string {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      storeName: this.getSettings().storeName || 'Shop',
      bills: this.getBills(),
      customerDues: this.getCustomerDues(),
      cashEntries: this.getCashEntries(),
      purchaseTrips: this.getPurchaseTrips(),
      products: this.getProducts(),
      settings: this.getSettings(),
      user: this.getUserProfile(),
      language: this.getLanguage(),
      pairedPrinters: this.getPairedPrinters(),
    };
    return JSON.stringify(backupData, null, 2);
  }

  // Trigger browser file download of backup JSON
  downloadDataBackup(): void {
    const jsonStr = this.exportAllDataOffline();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const settings = this.getSettings();
    const safeName = (settings.storeName || 'vyapar-pos').replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      if (data.products && Array.isArray(data.products)) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
      }
      if (data.settings && typeof data.settings === 'object') {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      if (data.user && typeof data.user === 'object') {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      }
      if (data.pairedPrinters && Array.isArray(data.pairedPrinters)) {
        localStorage.setItem(STORAGE_KEYS.PAIRED_PRINTERS, JSON.stringify(data.pairedPrinters));
      }
      return true;
    } catch {
      return false;
    }
  }
  // --- BARCODE CUSTOM DESIGN PREFERENCES ---
  getBarcodeCustomDesign(): Partial<BarcodeLabelConfig> | null {
    try {
      const raw = localStorage.getItem('pos_barcode_custom_design_v2');
      if (raw) {
        return JSON.parse(raw);
      }
      return null;
    } catch {
      return null;
    }
  }

  saveBarcodeCustomDesign(design: Partial<BarcodeLabelConfig>): void {
    try {
      localStorage.setItem('pos_barcode_custom_design_v2', JSON.stringify(design));
    } catch (e) {
      console.warn('Failed to save barcode custom design:', e);
    }
  }

  // --- PERMANENT BARCODE LABEL PRINTER PREFERENCES ---
  getBarcodePrinterPreferences(): BarcodePrinterPreferences {
    const defaults: BarcodePrinterPreferences = {
      paperRollWidth: '50mm_label',
      printerProtocol: 'tspl',
      darknessMode: 'dark',
      invertPolarity: true,
    };
    try {
      const raw = localStorage.getItem('pos_barcode_printer_preferences_v2') || localStorage.getItem('pos_barcode_printer_preferences_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          paperRollWidth: (parsed.paperRollWidth === '50mm_label' || parsed.paperRollWidth === '58mm' || parsed.paperRollWidth === '80mm')
            ? parsed.paperRollWidth
            : defaults.paperRollWidth,
          printerProtocol: (parsed.printerProtocol === 'tspl' || parsed.printerProtocol === 'escpos')
            ? parsed.printerProtocol
            : defaults.printerProtocol,
          darknessMode: (parsed.darknessMode === 'normal' || parsed.darknessMode === 'dark' || parsed.darknessMode === 'extra_dark')
            ? parsed.darknessMode
            : defaults.darknessMode,
          invertPolarity: typeof parsed.invertPolarity === 'boolean'
            ? parsed.invertPolarity
            : defaults.invertPolarity,
        };
      }
    } catch (e) {
      console.warn('Failed to read barcode printer preferences from localStorage:', e);
    }
    return defaults;
  }

  saveBarcodePrinterPreferences(prefs: Partial<BarcodePrinterPreferences>): void {
    try {
      const current = this.getBarcodePrinterPreferences();
      const updated: BarcodePrinterPreferences = { ...current, ...prefs };
      localStorage.setItem('pos_barcode_printer_preferences_v2', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save barcode printer preferences to localStorage:', e);
    }
  }

  resetBarcodePrinterPreferences(): BarcodePrinterPreferences {
    const defaults: BarcodePrinterPreferences = {
      paperRollWidth: '50mm_label',
      printerProtocol: 'tspl',
      darknessMode: 'dark',
      invertPolarity: true,
    };
    try {
      localStorage.setItem('pos_barcode_printer_preferences_v2', JSON.stringify(defaults));
    } catch (e) {
      console.warn('Failed to reset barcode printer preferences:', e);
    }
    return defaults;
  }
}

export interface BarcodePrinterPreferences {
  paperRollWidth: '50mm_label' | '58mm' | '80mm';
  printerProtocol: 'escpos' | 'tspl';
  darknessMode: 'normal' | 'dark' | 'extra_dark';
  invertPolarity: boolean;
}

export const storageService = new StorageService();
