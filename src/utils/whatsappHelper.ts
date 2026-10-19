import { BillInvoice, ThermalPrinterSettings } from '../types';

export interface SendWhatsAppBillParams {
  customerPhone?: string;
  customerName?: string;
  subtotal: number;
  discount?: number;
  finalPayable?: number;
  storeName?: string;
  storeAddress?: string;
  invoiceNo?: number | string;
  date?: string;
  currencySymbol?: string;
  customNote?: string;
  items?: Array<{ name: string; qty: number; price: number; total: number; unit?: string }>;
}

/**
 * Generates and triggers WhatsApp bill sharing using the user's custom layout
 */
export function sendWhatsAppBill({
  customerPhone = '',
  customerName = '',
  subtotal = 0,
  discount = 0,
  finalPayable,
  storeName,
  storeAddress,
  invoiceNo,
  date,
  currencySymbol = '₹',
  customNote,
  items,
}: SendWhatsAppBillParams): string {
  // Input numbers
  const sub = Math.max(0, parseFloat(String(subtotal)) || 0);
  const disc = Math.max(0, parseFloat(String(discount)) || 0);

  // Automatic calculation
  const payable = finalPayable !== undefined ? finalPayable : Math.max(0, sub - disc);

  // Discount percentage calculation
  let discountPercent = 0;
  if (sub > 0 && disc > 0) {
    discountPercent = Math.round((disc / sub) * 100);
  }

  const effectiveStore = storeName?.trim() || 'ক্লাসিক ফ্যাশন';
  const effectiveLocation = storeAddress?.trim() ? storeAddress.trim() : 'Kotamoni Bazar';
  const sym = currencySymbol || '₹';

  // Custom manual note
  const note =
    customNote?.trim() ||
    `আপনার সাথে আবার দেখা হবে! ${effectiveStore} থেকে কেনাকাটা করার জন্য ধন্যবাদ। ভালো থাকবেন। 🙏`;

  // WhatsApp message text design (Exact short summary format requested by user)
  let message = `Dear *${customerName?.trim() || 'Customer'}*,\n\n` +
                `Thank you for shopping at *${effectiveStore}* (${effectiveLocation})!\n` +
                `----------------------------------\n` +
                `🛍️ *Subtotal:* ${sym}${sub.toFixed(0)}\n`;

  // If discount is present, show with percentage
  if (disc > 0) {
    message += `🏷️ *Discount:* ${sym}${disc.toFixed(0)} (*${discountPercent}% OFF*)\n`;
  }

  message += `----------------------------------\n` +
             `💵 *Final Payable:* ${sym}${payable.toFixed(0)}\n` +
             `----------------------------------\n` +
             `${note}`;

  // URL encode
  const encodedMessage = encodeURIComponent(message);

  // Phone normalization: extract digits
  const rawPhone = String(customerPhone || '').replace(/[^0-9]/g, '');
  let formattedPhone = '';
  if (rawPhone.length === 10) {
    formattedPhone = `91${rawPhone}`;
  } else if (rawPhone.length > 10) {
    formattedPhone = rawPhone.startsWith('91') ? rawPhone : rawPhone;
  }

  // WhatsApp link creation
  const whatsappUrl = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  // Open in new tab safely
  try {
    const a = document.createElement('a');
    a.href = whatsappUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(whatsappUrl, '_blank');
  }

  return whatsappUrl;
}

/**
 * Convenience helper to send WhatsApp bill directly from a BillInvoice object
 */
export function sendWhatsAppBillForInvoice(
  bill: BillInvoice,
  settings?: ThermalPrinterSettings
): string {
  const storeName = settings?.storeName || 'ক্লাসিক ফ্যাশন';
  const storeAddress = settings?.storeAddress || 'Kotamoni Bazar';
  const currencySymbol = settings?.currencySymbol || '₹';
  const customNote = settings?.footerNote;

  const subtotal = bill.subtotal !== undefined && bill.subtotal > 0
    ? bill.subtotal
    : (bill.items || []).reduce((sum, item) => sum + item.total, 0);

  const discount = bill.discount || 0;
  const finalPayable = bill.grandTotal !== undefined ? bill.grandTotal : Math.max(0, subtotal - discount);

  return sendWhatsAppBill({
    customerPhone: bill.customerPhone || '',
    customerName: bill.customerName || '',
    subtotal,
    discount,
    finalPayable,
    storeName,
    storeAddress,
    invoiceNo: bill.invoiceNo,
    date: bill.date,
    currencySymbol,
    customNote,
    items: bill.items,
  });
}
