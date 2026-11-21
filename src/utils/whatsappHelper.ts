import { BillInvoice, ThermalPrinterSettings } from '../types';

export interface SendWhatsAppBillParams {
  customerPhone?: string;
  customerName?: string;
  subtotal: number;
  discount?: number;
  finalPayable?: number;
  paidAmount?: number;
  balance?: number;
  previousBalance?: number;
  changeAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  isEstimate?: boolean;
  isTailoring?: boolean;
  deliveryDate?: string;
  trialDate?: string;
  storeName?: string;
  storeAddress?: string;
  invoiceNo?: number | string;
  date?: string;
  currencySymbol?: string;
  customNote?: string;
  items?: Array<{ name: string; qty: number; price: number; total: number; unit?: string }>;
}

/**
 * Generates and triggers WhatsApp bill sharing with clear subtotal, discount, total, advance paid, and due balance.
 */
export function sendWhatsAppBill({
  customerPhone = '',
  customerName = '',
  subtotal = 0,
  discount = 0,
  finalPayable,
  paidAmount,
  balance,
  previousBalance = 0,
  changeAmount = 0,
  paymentMethod,
  paymentStatus,
  isEstimate = false,
  isTailoring = false,
  deliveryDate,
  trialDate,
  storeName,
  storeAddress,
  invoiceNo,
  date,
  currencySymbol = 'Rs.',
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
  const sym = currencySymbol || 'Rs.';

  const paid = paidAmount !== undefined ? Math.max(0, parseFloat(String(paidAmount)) || 0) : undefined;
  const bal = balance !== undefined ? Math.max(0, parseFloat(String(balance)) || 0) : (paid !== undefined ? Math.max(0, payable - paid) : undefined);
  const change = changeAmount !== undefined ? Math.max(0, parseFloat(String(changeAmount)) || 0) : 0;

  // Custom manual note
  const note =
    customNote?.trim() ||
    `আপনার সাথে আবার দেখা হবে! ${effectiveStore} থেকে কেনাকাটা করার জন্য ধন্যবাদ। ভালো থাকবেন। 🙏`;

  // WhatsApp message text design
  let message = `Dear *${customerName?.trim() || 'Customer'}*,\n\n` +
                `Thank you for shopping at *${effectiveStore}* (${effectiveLocation})!\n` +
                `----------------------------------\n`;

  // Invoice No & Date
  if (invoiceNo || date) {
    const invPart = invoiceNo ? `🧾 *Invoice:* #${invoiceNo}` : '';
    const datePart = date ? `📅 *Date:* ${date}` : '';
    const metaLine = [invPart, datePart].filter(Boolean).join('  |  ');
    if (metaLine) {
      message += `${metaLine}\n----------------------------------\n`;
    }
  }

  // If discount is present, show with percentage
  if (disc > 0) {
    message += `🏷️ *Discount:* -${sym}${disc.toFixed(0)} (*${discountPercent}% OFF*)\n`;
  }

  // Total Bill
  message += `💵 *Total Bill:* ${sym}${payable.toFixed(0)}\n` +
             `----------------------------------\n`;

  // Payment Breakdown (Advance Paid, Due Balance, Fully Paid, Change)
  if (isEstimate) {
    message += `📋 *Bill Type:* Estimate Quotation (এস্টিমেট)\n` +
               `----------------------------------\n`;
  } else if (paid !== undefined || bal !== undefined) {
    const effectivePaid = paid !== undefined ? paid : 0;
    const effectiveBal = bal !== undefined ? bal : Math.max(0, payable - effectivePaid);

    // 1. Advance / Partial Payment (E.g. Total 3500, Advance Paid 2500, Due 1000)
    if (effectivePaid > 0 && effectiveBal > 0) {
      message += `💳 *Paid / Advance (জমা/অগ্রিম):* ${sym}${effectivePaid.toFixed(0)}\n` +
                 `⚠️ *Remaining Due (বাকি):* ${sym}${effectiveBal.toFixed(0)}\n`;
    }
    // 2. Paid in Full (Balance <= 0 or Paid >= Total)
    else if (effectiveBal <= 0 || effectivePaid >= payable) {
      message += `💳 *Paid Amount (পরিশোধ):* ${sym}${effectivePaid.toFixed(0)}\n`;
      if (change > 0) {
        message += `🔄 *Change Returned (ফেরত):* ${sym}${change.toFixed(0)}\n`;
      }
    }
    // 3. Complete Due / Credit Sale (Paid = 0, Balance > 0)
    else {
      message += `💳 *Paid Amount (জমা):* ${sym}0\n` +
                 `⚠️ *Due Amount (বাকি):* ${sym}${effectiveBal.toFixed(0)}\n`;
    }

    // Tailoring specific details
    if (isTailoring) {
      if (deliveryDate) {
        message += `🧵 *Delivery Date (ডেলিভারি):* ${deliveryDate}\n`;
      }
      if (trialDate) {
        message += `🪡 *Trial Date (ট্রায়াল):* ${trialDate}\n`;
      }
    }

    message += `----------------------------------\n`;
  }

  const prevBal = Math.max(0, parseFloat(String(previousBalance)) || 0);
  if (prevBal > 0) {
    const currDue = isEstimate ? payable : (bal !== undefined ? bal : 0);
    const netTotalBal = prevBal + currDue;
    message += `📌 *Previous Balance (পুরানা বাকি):* ${sym}${prevBal.toFixed(0)}\n` +
               `💰 *${isEstimate ? 'Net Payable (নতুন + পুরানা)' : 'Net Total Balance (সর্বমোট বাকি)'}:* ${sym}${netTotalBal.toFixed(0)}\n` +
               `----------------------------------\n`;
  }

  // Footer Note
  message += `${note}`;

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
  const currencySymbol = settings?.currencySymbol || 'Rs.';
  const customNote = settings?.footerNote;

  const subtotal = bill.subtotal !== undefined && bill.subtotal > 0
    ? bill.subtotal
    : (bill.items || []).reduce((sum, item) => sum + item.total, 0);

  const discount = bill.discount || 0;
  const finalPayable = bill.grandTotal !== undefined ? bill.grandTotal : Math.max(0, subtotal - discount);

  const paidAmount = bill.paidAmount !== undefined
    ? bill.paidAmount
    : (bill.paymentStatus === 'PAID' ? finalPayable : 0);

  const balance = bill.balance !== undefined
    ? bill.balance
    : (bill.paymentStatus === 'PAID' ? 0 : Math.max(0, finalPayable - paidAmount));

  const previousBalance =
    settings?.showPreviousBalanceOnBill !== false
      ? Math.max(0, Number(bill.previousBalance) || 0)
      : 0;

  return sendWhatsAppBill({
    customerPhone: bill.customerPhone || '',
    customerName: bill.customerName || '',
    subtotal,
    discount,
    finalPayable,
    paidAmount,
    balance,
    previousBalance,
    changeAmount: bill.changeAmount || 0,
    paymentMethod: bill.paymentMethod,
    paymentStatus: bill.paymentStatus,
    isEstimate: bill.isEstimate,
    isTailoring: bill.isTailoring,
    deliveryDate: bill.deliveryDate,
    trialDate: bill.trialDate,
    storeName,
    storeAddress,
    invoiceNo: bill.invoiceNo,
    date: bill.date,
    currencySymbol,
    customNote,
    items: bill.items,
  });
}
