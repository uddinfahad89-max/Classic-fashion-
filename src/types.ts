export type PaperWidth = '58mm' | '80mm' | '50mm_label';

export type ThermalProtocol = 'escpos' | 'tspl';

export type PaymentMethod = 'estimate' | 'cash' | 'upi' | 'card' | 'due';

export type PaymentStatus = 'PAID' | 'DUE' | 'PARTIAL' | 'ESTIMATE';

export type ActiveTab = 'billing' | 'invoices' | 'cashbook' | 'due' | 'purchases' | 'barcode' | 'staff';

export type LabelSizePreset = '2x1' | '50x25' | '2x1.2' | '1.5x1' | '1x1' | '2x2' | 'custom';

export type TagLayoutStyle = 'classic' | 'modern_badge' | 'bold_price' | 'compact_split' | 'minimal' | 'qr_centric' | 'ultra_simple';
export type TagBorderStyle = 'single' | 'bold' | 'dashed' | 'double' | 'none';
export type TagHeaderStyle = 'solid_banner' | 'underline' | 'pill' | 'minimal';
export type TagPriceStyle = 'standard' | 'highlight_pill' | 'big_hero';
export type TagBarcodeHeight = 'compact' | 'standard' | 'tall';
export type TagBarcodeThickness = 'thin' | 'medium' | 'thick';
export type TagCornerRadius = 'none' | 'small' | 'medium' | 'pill';
export type TagTitleFontSize = 'small' | 'medium' | 'large';
export type TagAlignment = 'center' | 'left' | 'right';

export interface BarcodeLabelConfig {
  storeName: string;
  storePhone?: string;
  itemName: string;
  barcodeValue: string;
  barcodeType: 'CODE128' | 'EAN13' | 'QR';
  mrp?: number;
  salePrice: number;
  purchasePrice?: number;
  showPurchasePrice?: boolean;
  sizeOrVariant?: string;
  productQuantity?: number;
  batchOrDate?: string;
  footerNote?: string;
  sizePreset: LabelSizePreset;
  customWidthMm?: number;
  customHeightMm?: number;
  showStoreName: boolean;
  showItemName?: boolean;
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
  barcodeNumberFont?: 'sans' | 'ocr' | 'mono';
  barcodeNumberSize?: 'normal' | 'large';
  cornerRadius?: TagCornerRadius;
  titleFontSize?: TagTitleFontSize;
  textAlign?: TagAlignment;
  showStorePhone?: boolean;
  showDiscountBadge?: boolean;
  customOfferText?: string;
  showPunchHole?: boolean;
  showFooterNote?: boolean;
  cleanWhiteMode?: boolean;
  mrpPrefix?: string;
  mrpOffset?: number; // Vertical offset in px for moving MRP up/down
  // Custom TSPL Barcode Label Editor parameters (50mm x 25mm = 400 x 200 dots)
  tsplDirection?: '0,0' | '1,0';
  tsplAlign?: 'left' | 'center' | 'right';
  tsplShopX?: number;
  tsplShopY?: number;
  tsplShopFont?: '1' | '2' | '3' | '4';
  tsplBarcodeX?: number;
  tsplBarcodeY?: number;
  tsplBarcodeHeight?: number;
  tsplBarcodeWidthDots?: number;
  tsplBarcodeRatio?: '2:3' | '1:2' | '2:2';
  tsplPriceX?: number;
  tsplPriceY?: number;
  tsplPriceFont?: '1' | '2' | '3' | '4';
  tsplCustomX?: boolean;
}

export type Language = 'bn' | 'en' | 'hi';

export type TailoringOrderStatus = 'pending' | 'ready' | 'delivered';

export interface TailoringMeasurements {
  garmentType?: string; // e.g., Shirt, Pant, Panjabi, Suit, Salwar Kameez, Blouse
  length?: string;
  chest?: string;
  waist?: string;
  shoulder?: string;
  sleeve?: string;
  neck?: string;
  hip?: string;
  bottom?: string;
  cuff?: string;
  inseam?: string;
  customMeasurements?: string;
  designNotes?: string;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit?: string;
  total: number;
  barcode?: string;
  productId?: string;
  tailoringNote?: string;
}

export interface ProductStockItem {
  id: string;
  name: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  unit?: string;
  category?: string;
  barcode?: string;
  updatedAt: number;
  // Multi-Vendor & Soft Delete
  storeId?: string;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
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
  // Estimate vs Tax Invoice
  isEstimate?: boolean;
  // Tailoring Purpose Fields
  isTailoring?: boolean;
  deliveryDate?: string;
  trialDate?: string;
  tailoringStatus?: TailoringOrderStatus;
  masterName?: string;
  measurements?: TailoringMeasurements;
  cashierName?: string;
  cashierId?: string;
  // Multi-Vendor & Soft Delete
  storeId?: string;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
}

export type CashEntryType = 'Income' | 'Expense';

export interface CashEntry {
  id: string;
  type: CashEntryType;
  amount: number;
  note: string;
  timestamp: number;
  dateFormatted: string;
  // Multi-Vendor & Soft Delete
  storeId?: string;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
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
  // Multi-Vendor & Soft Delete
  storeId?: string;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
}

export interface StaffPermissions {
  canCreateBills: boolean; // Create Bills / Invoices & Collect Payments (default true)
  canManageDues: boolean; // Manage Dues (Add Dues & Receive Payments) (default true)
  canManageInventory: boolean; // Add & Edit Products / Inventory (default true)
  canManageStock?: boolean; // Alias for canManageInventory
  canViewProfit: boolean; // View Net Profit / Financial Summary Reports (default false)
  canDeleteInvoices: boolean; // Delete Past Invoices (default false)
}

export interface UserProfile {
  email: string;
  name: string;
  isLoggedIn: boolean;
  shopId?: string;
  storeId?: string;
  userId?: string;
  storeName?: string;
  ownerId?: string;
  ownerEmail?: string;
  loginTime?: number;
  phone?: string;
  role?: 'Owner' | 'Manager' | 'Cashier' | 'Staff' | 'Super Admin' | 'super_admin';
  isSuperAdmin?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  pin?: string;
  password?: string;
  isAppLockEnabled?: boolean;
  securityQuestion?: string;
  securityAnswer?: string;
  otpVerified?: boolean;
  loginMethod?: 'email_pin' | 'otp' | 'email_password' | 'app_pin';
  staffId?: string;
  permissions?: StaffPermissions;
}

export interface StoreVendorAccount {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  storeName: string;
  role: string;
  isSuperAdmin?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  createdAt?: string | number;
  lastActive?: string | number;
  totalInvoices?: number;
  totalRevenue?: number;
  totalProducts?: number;
  totalDues?: number;
}

export interface SoftDeletedItem {
  id: string;
  entityType: 'invoice' | 'product' | 'customer_due' | 'cash_entry' | 'purchase_trip';
  title: string;
  storeId: string;
  storeName?: string;
  userEmail?: string;
  deletedAt: number;
  deletedBy?: string;
  data: any;
}

export interface SavedAccountItem {
  identifier: string;
  name: string;
  phone: string;
  email: string;
  storeName: string;
  role: 'Owner' | 'Manager' | 'Cashier' | 'Staff' | 'Super Admin' | 'super_admin';
  shopId?: string;
  ownerId?: string;
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
  defaultInvoiceFormat?: 'tax_invoice' | 'estimate' | 'thermal';
  isDataSaverEnabled?: boolean;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  isLabelMode?: boolean;
  autoCapitalizeItemNames?: boolean;
  isTotalOnlySlip?: boolean;
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
  // Multi-Vendor & Soft Delete
  storeId?: string;
  userId?: string;
  isDeleted?: boolean;
  deletedAt?: number | string;
  deletedBy?: string;
}

// ----------------------------------------------------
// Staff Management & Biometric Attendance Types
// ----------------------------------------------------
export type StaffRole =
  | 'manager'
  | 'cashier'
  | 'salesperson'
  | 'helper'
  | 'tailor'
  | 'accountant'
  | 'delivery'
  | 'other';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  designation: string; // e.g. 'ক্যাশিয়ার', 'সিনিয়র সেলসম্যান'
  role: StaffRole;
  joiningDate: string; // YYYY-MM-DD
  monthlySalary: number; // বেসিক মাসিক বেতন (e.g. 15,000 ৳)
  monthlyAllowedLeaves: number; // প্রতি মাসে ৪ দিন ছুটি (ডিফল্ট ৪ দিন)
  workingShift?: string; // e.g. '09:00 AM - 08:00 PM'
  fingerprintEnrolled: boolean;
  fingerprintId?: string; // বায়োমেট্রিক ক্রেডেনশিয়াল টোকেন বা আইডি
  fingerprintName?: string; // e.g. 'ডান হাতের বৃদ্ধাঙ্গুলি'
  avatarColor?: string;
  notes?: string;
  isActive: boolean;
  createdAt: number;
  // POS App Access & Permissions
  hasPosAccess?: boolean;
  email?: string;
  password?: string;
  permissions?: StaffPermissions;
  storeId?: string;
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkInTime?: string; // e.g. '09:12 AM'
  checkOutTime?: string; // e.g. '08:05 PM'
  verificationMethod: 'fingerprint' | 'biometric_device' | 'webauthn' | 'manual';
  note?: string;
  timestamp: number;
}

export interface StaffSalaryCalculation {
  staffId: string;
  staffName: string;
  month: string; // YYYY-MM
  totalDaysInMonth: number;
  baseMonthlySalary: number;
  dailyRate: number; // baseMonthlySalary / totalDaysInMonth
  allowedLeaves: number; // ডিফল্ট ৪ দিন ছুটি
  presentDays: number;
  absentDays: number; // অনুপস্থিত দিন
  paidLeaveDays: number; // অনুমোদিত ছুটি
  halfDays: number; // অর্ধ দিবস (০.৫ দিন হিসাব)
  unpaidDeductionDays: number; // মোট কর্তনযোগ্য দিন
  absentDeductionAmount: number; // স্বয়ংক্রিয় অনুপস্থিতি কর্তন
  absentDates?: string[]; // অনুপস্থিত তারিখসমূহ (YYYY-MM-DD)
  overtimeHours?: number;
  overtimeAmount?: number;
  bonusAmount?: number;
  advanceDeduction?: number;
  netPayableSalary: number; // চূড়ান্ত প্রদেয় বেতন
  isPaid?: boolean;
  paidDate?: string;
}

