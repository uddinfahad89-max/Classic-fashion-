export type PaperWidth = '58mm' | '80mm' | '50mm_label';

export type ThermalProtocol = 'escpos' | 'tspl';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'due';

export type PaymentStatus = 'PAID' | 'DUE' | 'PARTIAL';

export type ActiveTab = 'billing' | 'invoices' | 'cashbook' | 'due' | 'purchases' | 'barcode';

export type LabelSizePreset = '2x1' | '50x25' | '2x1.2' | '1.5x1' | '1x1' | '2x2' | 'custom';

export type TagLayoutStyle = 'classic' | 'modern_badge' | 'bold_price' | 'compact_split' | 'minimal' | 'qr_centric';
export type TagBorderStyle = 'single' | 'bold' | 'dashed' | 'double' | 'none';
export type TagHeaderStyle = 'solid_banner' | 'underline' | 'pill' | 'minimal';
export type TagPriceStyle = 'standard' | 'highlight_pill' | 'big_hero';
export type TagBarcodeHeight = 'compact' | 'standard' | 'tall';
export type TagBarcodeThickness = 'thin' | 'medium' | 'thick';
export type TagCornerRadius = 'none' | 'small' | 'medium' | 'pill';
export type TagTitleFontSize = 'small' | 'medium' | 'large';
export type TagAlignment = 'center' | 'left';

export interface BarcodeLabelConfig {
  storeName: string;
  storePhone?: string;
  itemName: string;
  barcodeValue: string;
  barcodeType: 'CODE128' | 'EAN13' | 'QR';
  mrp?: number;
  salePrice: number;
  sizeOrVariant?: string;
  batchOrDate?: string;
  footerNote?: string;
  sizePreset: LabelSizePreset;
  customWidthMm?: number;
  customHeightMm?: number;
  showStoreName: boolean;
  showMrp: boolean;
  showSalePrice: boolean;
  showBarcode: boolean;
  showSize: boolean;
  showBatch: boolean;
  showBorder: boolean;
  quantity: number;
  // Custom Design attributes:
  layoutStyle?: TagLayoutStyle;
  borderStyle?: TagBorderStyle;
  headerStyle?: TagHeaderStyle;
  priceStyle?: TagPriceStyle;
  barcodeHeight?: TagBarcodeHeight;
  barcodeThickness?: TagBarcodeThickness;
  showBarcodeText?: boolean;
  cornerRadius?: TagCornerRadius;
  titleFontSize?: TagTitleFontSize;
  textAlign?: TagAlignment;
  showStorePhone?: boolean;
  showDiscountBadge?: boolean;
  customOfferText?: string;
  showPunchHole?: boolean;
  showFooterNote?: boolean;
  cleanWhiteMode?: boolean;
}

export type Language = 'bn' | 'en' | 'hi';

export interface BillItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  total: number;
  barcode?: string;
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
  phone?: string;
  role?: 'Owner' | 'Manager' | 'Cashier';
  pin?: string;
  isAppLockEnabled?: boolean;
  securityQuestion?: string;
  securityAnswer?: string;
  otpVerified?: boolean;
  loginMethod?: 'email_pin' | 'otp';
}

export interface SavedAccountItem {
  identifier: string;
  name: string;
  phone: string;
  email: string;
  storeName: string;
  role: 'Owner' | 'Manager' | 'Cashier';
  lastActive: number;
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
  hideCurrencySymbol?: boolean;
  footerNote: string;
  autoPrintOnCheckout: boolean;
  defaultInvoiceFormat?: 'tax_invoice' | 'thermal';
  isDataSaverEnabled?: boolean;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  isLabelMode?: boolean;
}

export interface NetworkStatusInfo {
  isOnline: boolean;
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'offline';
  saveData: boolean;
  isLowBandwidth: boolean;
  downlink?: number;
  rtt?: number;
}

export interface SavedPrinterInfo {
  id: string;
  name: string;
  macAddress?: string;
  type?: 'bluetooth' | 'usb' | 'wifi';
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
