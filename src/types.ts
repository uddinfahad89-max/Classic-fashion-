export type PaperWidth = '58mm' | '80mm';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'due';

export type PaymentStatus = 'PAID' | 'DUE' | 'PARTIAL';

export type ActiveTab = 'billing' | 'invoices' | 'cashbook' | 'due' | 'purchases';

export type Language = 'bn' | 'en';

export interface BillItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
}

export interface BillInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  time?: string;
  timestamp: number;
  customerName?: string;
  customerPhone?: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paidAmount: number;
  changeAmount: number;
  balance?: number;
  previousBalance?: number;
  currentBalance?: number;
}

export type CashEntryType = 'Income' | 'Expense';

export interface CashEntry {
  id: string;
  type: CashEntryType;
  amount: number;
  note: string;
  timestamp: number;
  dateFormatted: string;
}

export type DueType = 'receivable' | 'payable'; // 'receivable' = আমি পাবো (Customer owes me), 'payable' = আমি দেবো (কাস্টমার পাওনাদার / Advance)

export interface DueTransaction {
  id: string;
  type: 'added' | 'paid';
  dueType?: DueType;
  amount: number;
  note: string;
  timestamp: number;
  dateFormatted: string;
}

export interface CustomerDue {
  id: string;
  name: string;
  phone: string;
  type?: DueType; // default 'receivable'
  dueAmount: number;
  lastUpdated: number;
  transactions: DueTransaction[];
}

export interface UserProfile {
  email: string;
  name: string;
  isLoggedIn: boolean;
  loginTime?: number;
}

export interface ThermalPrinterSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  signatoryName?: string;
  upiId?: string;
  paperWidth: PaperWidth;
  currencySymbol: string;
  currencyName?: string;
  footerNote: string;
  autoPrintOnCheckout: boolean;
  defaultInvoiceFormat?: 'tax_invoice' | 'thermal';
}

export interface SavedPrinterInfo {
  id: string;
  name: string;
  savedAt: number;
}

export interface BluetoothDeviceInfo {
  connected: boolean;
  deviceName?: string;
  deviceId?: string;
  isConnecting?: boolean;
  savedPrinter?: SavedPrinterInfo | null;
}

export type PurchaseExpenseCategory =
  | 'goods'
  | 'transport'
  | 'food'
  | 'labour'
  | 'packing'
  | 'other';

export interface PurchaseExpenseItem {
  id: string;
  title: string; // e.g., 'সুতি শাড়ি পাইকারি লট', 'থান কাপড়'
  category: PurchaseExpenseCategory;
  amount: number;
  vendorOrPlace?: string; // e.g. 'রহিম টেক্সটাইল, দোকান ১২' (where spent)
  note?: string;
  timestamp: number;
  dateFormatted: string;
}

export interface PurchaseTrip {
  id: string;
  title: string; // e.g., 'চকবাজার থেকে পাইকারি মাল কেনা'
  marketLocation?: string; // e.g. 'চকবাজার, ঢাকা'
  dateFormatted: string;
  timestamp: number;
  initialCash: number; // e.g. 10000 টাকা নিয়ে বের হয়েছি
  expenses: PurchaseExpenseItem[];
  totalSpent: number; // Total money spent so far
  remainingCash: number; // initialCash - totalSpent
  status: 'active' | 'completed'; // 'active' = বাজারে কেনাকাটা চলছে, 'completed' = সম্পন্ন
  note?: string;
  syncedCashEntryId?: string; // If synced to cashbook as expense
}
