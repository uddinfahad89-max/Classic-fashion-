export type PaperWidth = '58mm' | '80mm';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'due';

export type PaymentStatus = 'PAID' | 'DUE' | 'PARTIAL';

export type ActiveTab = 'billing' | 'invoices' | 'cashbook' | 'due';

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

export interface DueTransaction {
  id: string;
  type: 'added' | 'paid';
  amount: number;
  note: string;
  timestamp: number;
  dateFormatted: string;
}

export interface CustomerDue {
  id: string;
  name: string;
  phone: string;
  dueAmount: number;
  lastUpdated: number;
  transactions: DueTransaction[];
}

export interface ThermalPrinterSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  paperWidth: PaperWidth;
  currencySymbol: string;
  footerNote: string;
  autoPrintOnCheckout: boolean;
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
