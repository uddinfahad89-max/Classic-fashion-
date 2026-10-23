import React, { useState, useEffect } from 'react';
import { BillInvoice, ThermalPrinterSettings, Language } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { buildUpiUri, generateQrDataUrl } from '../utils/qrCode';

interface TaxInvoiceSheetProps {
  bill: BillInvoice;
  settings: ThermalPrinterSettings;
  isTotalOnlySlip?: boolean;
  language?: Language;
}

export const TaxInvoiceSheet: React.FC<TaxInvoiceSheetProps> = ({
  bill,
  settings,
  isTotalOnlySlip = false,
  language = 'en',
}) => {
  const isBn = language === 'bn';
  const isTotalOnly = Boolean(isTotalOnlySlip);
  const isBillEstimate =
    bill.paymentMethod === 'estimate' ||
    (!bill.paymentMethod && (bill.paymentStatus === 'ESTIMATE' || Boolean(bill.isEstimate)));
  const isEstimate = isBillEstimate;
  const rawSym = (settings.currencySymbol || '').replace(/\?/g, '').trim();
  const isCurrencyHidden = settings.hideCurrencySymbol || !rawSym;
  const currencyPrefix = isCurrencyHidden ? '' : `${rawSym} `;
  const currencyName =
    settings.currencyName ||
    (rawSym.toLowerCase().includes('rs') || rawSym === '₹' ? 'Rupees' : 'Taka');
  const storeName = settings.storeName?.trim() || 'STORE / SHOP';
  const storeAddress = settings.storeAddress?.trim() || '';
  const storePhone = settings.storePhone?.trim() || '';
  const signatoryName = settings.signatoryName || '';

  // Calculate totals & balances
  const totalQty = bill.items.reduce((sum, it) => sum + (it.qty || 1), 0);
  const discountAmount = bill.discount || 0;
  const discountPercent =
    bill.discountType === 'percent' && bill.discountValue
      ? bill.discountValue
      : bill.subtotal > 0
      ? Math.round((discountAmount / bill.subtotal) * 100 * 10) / 10
      : 0;

  const isFullDue =
    bill.paymentMethod === 'due' &&
    (bill.paymentStatus === 'DUE' ||
      (bill.paidAmount === bill.grandTotal && (!bill.balance || bill.balance === 0)));

  const paidAmount = isFullDue
    ? 0
    : isBillEstimate && (!bill.paidAmount || (bill.paidAmount === bill.grandTotal && bill.paymentStatus === 'ESTIMATE'))
    ? 0
    : bill.paidAmount !== undefined
    ? bill.paidAmount
    : bill.paymentStatus === 'PAID'
    ? bill.grandTotal
    : 0;
  const balance = isFullDue
    ? bill.grandTotal
    : bill.balance !== undefined && bill.balance > 0
    ? bill.balance
    : Math.max(0, bill.grandTotal - paidAmount);

  // Amount in words
  const amountInWords = numberToWords(bill.grandTotal, currencyName);

  // Date and Time parsing
  let formattedDate = bill.date;
  let formattedTime = bill.time || '';

  if (!formattedTime && bill.timestamp) {
    const d = new Date(bill.timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    formattedDate = `${day}-${month}-${year}`;
    formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // Dynamic UPI Payment QR Code (Vyapar app feature: auto-generate when customer has Due or pays via UPI)
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const hasDue = balance > 0;
  const showUpiQr = Boolean(
    settings.upiId &&
    settings.upiId.trim() &&
    (hasDue || bill.paymentMethod === 'due' || bill.paymentMethod === 'upi')
  );
  const upiPayAmount = hasDue ? balance : bill.grandTotal;

  useEffect(() => {
    if (!showUpiQr || !settings.upiId || !settings.upiId.trim()) {
      setUpiQrUrl('');
      return;
    }
    const cleanStore = (storeName || 'Store').replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Store';
    const uri = buildUpiUri({
      vpa: settings.upiId.trim(),
      payeeName: cleanStore,
      amount: upiPayAmount,
      invoiceNo: bill.invoiceNo,
      note: hasDue ? `Due Bill #${bill.invoiceNo}` : `Bill #${bill.invoiceNo}`,
    });
    generateQrDataUrl(uri, 150).then((url) => {
      setUpiQrUrl(url);
    });
  }, [showUpiQr, settings.upiId, storeName, upiPayAmount, bill.invoiceNo, hasDue]);

  // ONLY SLIP (TOTAL ONLY SLIP): Minimalistic summary requested by user containing only:
  // Shop name, Total quantity, Paid/Unpaid, Discount, Total amount, and Due (বাকি নিলে)
  if (isTotalOnly) {
    return (
      <div
        id={`tax-invoice-${bill.id}`}
        className="tax-invoice-sheet bg-white text-stone-900 w-full max-w-[480px] mx-auto p-5 sm:p-6 rounded-2xl shadow-sm border border-stone-200 print:border-none print:shadow-none print:p-2 font-sans"
      >
        {/* 1. Shop name */}
        <div className="text-center space-y-1 pb-3 border-b border-stone-200">
          <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-stone-900 uppercase">
            {storeName}
          </h1>
          {storeAddress && (
            <p className="text-xs sm:text-base text-stone-600 font-medium">
              {storeAddress}
            </p>
          )}
          {storePhone && (
            <p className="text-xs sm:text-base text-stone-600 font-medium">
              Phone: {storePhone}
            </p>
          )}
          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-stone-600 pt-2 px-1">
            <span>Bill: #{bill.invoiceNo}</span>
            <span>Date: {formattedDate}</span>
          </div>
          {bill.customerName && (
            <div className="text-left text-xs sm:text-sm pt-1 text-stone-700 px-1">
              <span className="text-stone-500 font-normal">Customer: </span>
              <strong className="text-stone-900 uppercase">{bill.customerName}</strong>
              {bill.customerPhone && <span className="text-stone-500"> ({bill.customerPhone})</span>}
            </div>
          )}
        </div>

        {/* 2. Total items & Paid / Unpaid Option */}
        <div className="my-4 p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-stone-500 block font-medium">Total Quantity</span>
            <span className="text-lg sm:text-xl font-black text-stone-900 font-mono">
              {totalQty} <span className="text-xs font-semibold text-stone-500">items</span>
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-stone-500 block font-medium">Status</span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                isBillEstimate
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : bill.paymentMethod === 'cash' && balance <= 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : bill.paymentMethod === 'upi' && balance <= 0
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : balance <= 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {isBillEstimate
                ? (isBn ? '📋 ESTIMATE (এস্টিমেট)' : '📋 ESTIMATE')
                : bill.paymentMethod === 'cash' && balance <= 0
                ? (isBn ? '💵 CASH (পরিশোধিত)' : '💵 CASH (PAID)')
                : bill.paymentMethod === 'upi' && balance <= 0
                ? (isBn ? '📱 UPI (পরিশোধিত)' : '📱 UPI (PAID)')
                : balance <= 0
                ? (isBn ? '✓ PAID (পরিশোধিত)' : '✓ PAID')
                : (isBn ? '⚠️ UNPAID / DUE (বাকি)' : '⚠️ UNPAID / DUE')}
            </span>
          </div>
        </div>

        {/* 3. Discount, Total amount, and বাকি নিলে Due */}
        <div className="space-y-2.5 pt-2 pb-3 border-t border-stone-200 text-base sm:text-lg">
          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-stone-700 font-medium px-1">
              <span>Discount</span>
              <span className="font-bold text-rose-600">
                -{currencyPrefix}{discountAmount.toFixed(1)}
              </span>
            </div>
          )}

          {/* Purple Total Amount Bar */}
          <div className="bg-[#8C8EE8] text-white print:bg-[#8C8EE8] print:text-white font-extrabold py-2.5 px-3.5 flex justify-between items-center rounded-xl text-lg sm:text-xl shadow-xs">
            <span>Total Amount</span>
            <span>
              {currencyPrefix}{bill.grandTotal.toFixed(1)}
            </span>
          </div>

          <div
            className={`flex justify-between items-center border px-3.5 py-2 rounded-xl font-bold text-sm sm:text-base ${
              isBillEstimate
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : bill.paymentMethod === 'cash'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : bill.paymentMethod === 'upi'
                ? 'bg-purple-50 border-purple-200 text-purple-900'
                : bill.paymentMethod === 'due'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-stone-50 border-stone-200 text-stone-900'
            }`}
          >
            <span>{isBn ? 'পেমেন্ট ধরন (Payment Mode)' : 'Payment Mode'}</span>
            <span className="font-black uppercase tracking-wide">
              {isBillEstimate
                ? (isBn ? 'এস্টিমেট (ESTIMATE)' : 'ESTIMATE')
                : bill.paymentMethod === 'cash'
                ? (isBn ? 'ক্যাশ (CASH)' : 'CASH')
                : bill.paymentMethod === 'upi'
                ? (isBn ? 'ইউপিআই (UPI)' : 'UPI')
                : bill.paymentMethod === 'due'
                ? (isBn ? 'ক্রেডিট / বাকি (CREDIT)' : 'CREDIT / DUE')
                : bill.paymentMethod === 'card'
                ? (isBn ? 'কার্ড (CARD)' : 'CARD')
                : (bill.paymentMethod || 'CASH').toUpperCase()}
            </span>
          </div>
            <>
              {paidAmount > 0 && balance > 0 && (
                <div className="flex justify-between items-center text-stone-700 font-medium text-sm sm:text-base px-1">
                  <span>{isBn ? 'Paid (পরিশোধ)' : 'Paid'}</span>
                  <span className="font-bold text-emerald-700">
                    {currencyPrefix}{paidAmount.toFixed(1)}
                  </span>
                </div>
              )}

              {balance > 0 && (
                <div className="flex justify-between items-center bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl text-rose-900 font-bold">
                  <span>{isBn ? 'Due (বাকি)' : 'Due'}</span>
                  <span className="text-lg sm:text-xl font-black text-rose-700">
                    {currencyPrefix}{balance.toFixed(1)}
                  </span>
                </div>
              )}
            </>

          {/* Dynamic UPI Payment QR Code for Due in Total Only Slip */}
          {showUpiQr && upiQrUrl && (
            <div className="my-2 p-3 bg-stone-50 border border-stone-200 rounded-xl text-center flex flex-col items-center shadow-2xs">
              <span className="text-xs font-black text-stone-900 uppercase tracking-wider mb-2">
                Scan & Pay
              </span>
              <img
                src={upiQrUrl}
                alt="UPI QR"
                className="w-28 h-28 object-contain bg-white p-1 rounded-lg border border-stone-200"
              />
            </div>
          )}
        </div>

        {/* Clean minimal footer */}
        <div className="text-center pt-3 border-t border-stone-100 text-xs text-stone-400 font-medium">
          Thank you! Visit again.
        </div>
      </div>
    );
  }

  return (
    <div
      id={`tax-invoice-${bill.id}`}
      className="tax-invoice-sheet bg-white text-stone-900 w-full max-w-[700px] mx-auto p-4 sm:p-8 rounded-xl shadow-xs border border-stone-200 print:border-none print:shadow-none print:p-2 print:max-w-full font-sans text-base"
      style={{ minHeight: '840px' }}
    >
      {/* 1. Header: Store Info */}
      <div className="text-left space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-stone-900 uppercase">
          {storeName}
        </h1>
        {storeAddress && (
          <p className="text-sm sm:text-base text-stone-700 font-semibold leading-snug">
            {storeAddress}
          </p>
        )}
        {storePhone && (
          <p className="text-sm sm:text-base text-stone-700 font-semibold">
            Phone no.: {storePhone}
          </p>
        )}
      </div>

      <div className="border-t border-stone-300 my-3"></div>

      {/* 2. Tax Invoice / Estimate / Tailoring Invoice / Total Slip Banner */}
      <div className="text-center my-2.5">
        <h2 className="text-xl sm:text-2xl font-black text-[#5046E5] print:text-black tracking-wide uppercase">
          {isTotalOnly
            ? (isBn ? 'টাকার হিসাব স্লিপ / TOTAL AMOUNT SLIP' : 'TOTAL AMOUNT SLIP')
            : bill.isTailoring
            ? '✂️ Tailoring Invoice'
            : isBillEstimate
            ? (isBn ? 'এস্টিমেট বিল / ESTIMATE BILL' : 'ESTIMATE BILL')
            : bill.paymentMethod === 'cash'
            ? (isBn ? 'ক্যাশ মেমো / CASH MEMO' : 'CASH MEMO')
            : bill.paymentMethod === 'upi'
            ? (isBn ? 'ইউপিআই বিল / UPI BILL' : 'UPI BILL')
            : bill.paymentMethod === 'due'
            ? (isBn ? 'বাকি বিল / CREDIT BILL' : 'CREDIT / DUE BILL')
            : bill.paymentMethod === 'card'
            ? (isBn ? 'কার্ড বিল / CARD BILL' : 'CARD BILL')
            : (isBn ? 'ক্যাশ মেমো / CASH MEMO' : 'CASH MEMO')}
        </h2>
      </div>

      {/* 3. Bill To & Invoice Details (2 Columns) */}
      <div className="flex justify-between items-start pt-1 pb-4 text-sm sm:text-base gap-3">
        {/* Left: Customer Info */}
        <div className="space-y-1">
          <div className="font-bold text-stone-900 text-sm sm:text-base">
            {bill.isTailoring ? 'Customer' : 'Bill To'}
          </div>
          <div className="font-black text-stone-900 text-base sm:text-lg tracking-wide uppercase">
            {bill.customerName || 'Cash Customer'}
          </div>
          {bill.customerPhone && (
            <div className="text-stone-800 font-semibold text-sm sm:text-base">
              Ph: {bill.customerPhone}
            </div>
          )}
          {bill.isTailoring && bill.measurements?.garmentType && (
            <div className="text-stone-800 font-semibold text-sm sm:text-base">
              Item: <span className="font-bold text-stone-900">{bill.measurements.garmentType}</span>
            </div>
          )}
        </div>

        {/* Right: Invoice Metadata (Concise) */}
        <div className="text-right space-y-1 font-semibold text-stone-800 text-sm sm:text-base">
          <div className="font-bold text-stone-900">
            {bill.isTailoring ? 'Order Info' : isBillEstimate ? 'Estimate Details' : 'Invoice Details'}
          </div>
          <div>
            {isBillEstimate ? 'Estimate No:' : 'Invoice No:'}{' '}
            <span className="font-extrabold text-stone-900">#{bill.invoiceNo}</span>
          </div>
          <div>Date: {formattedDate}</div>
          <div className="pt-0.5">
            {isBillEstimate ? (
              <span className="inline-block px-2.5 py-0.5 rounded text-xs sm:text-sm font-black bg-blue-100 text-blue-800 border border-blue-300">
                {isBn ? '📋 ESTIMATE BILL (এস্টিমেট)' : '📋 ESTIMATE BILL'}
              </span>
            ) : bill.paymentMethod === 'cash' ? (
              <span className="inline-block px-2.5 py-0.5 rounded text-xs sm:text-sm font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {isBn ? `💵 CASH (ক্যাশ মেমো${balance <= 0 ? ' - পরিশোধিত' : ''})` : `💵 CASH${balance <= 0 ? ' (PAID)' : ''}`}
              </span>
            ) : bill.paymentMethod === 'upi' ? (
              <span className="inline-block px-2.5 py-0.5 rounded text-xs sm:text-sm font-black bg-purple-100 text-purple-800 border border-purple-300">
                {isBn ? `📱 UPI (ইউপিআই${balance <= 0 ? ' - পরিশোধিত' : ''})` : `📱 UPI${balance <= 0 ? ' (PAID)' : ''}`}
              </span>
            ) : bill.paymentMethod === 'due' ? (
              <span className="inline-block px-2 py-0.5 rounded text-xs sm:text-sm font-black bg-rose-100 text-rose-700 border border-rose-300">
                {isBn ? '⏳ CREDIT / DUE (বাকী / ক্রেডিট)' : '⏳ CREDIT / DUE'}
              </span>
            ) : bill.paymentMethod === 'card' ? (
              <span className="inline-block px-2.5 py-0.5 rounded text-xs sm:text-sm font-black bg-blue-100 text-blue-800 border border-blue-300">
                {isBn ? '💳 CARD (কার্ড)' : '💳 CARD'}
              </span>
            ) : balance > 0 ? (
              <span className="inline-block px-2 py-0.5 rounded text-xs sm:text-sm font-black bg-rose-100 text-rose-700 border border-rose-300">
                {paidAmount > 0
                  ? `PARTIAL DUE: ${currencyPrefix}${balance.toFixed(1)}`
                  : isBn
                  ? `DUE (বাকি): ${currencyPrefix}${balance.toFixed(1)}`
                  : `DUE: ${currencyPrefix}${balance.toFixed(1)}`}
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 rounded text-xs sm:text-sm font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {isBn ? '✓ PAID (পরিশোধিত)' : '✓ PAID'}
              </span>
            )}
          </div>
          {bill.isTailoring && bill.deliveryDate && (
            <div className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded inline-block mt-0.5 text-sm sm:text-base">
              Delivery:{' '}
              {/^\d{4}-\d{2}-\d{2}$/.test(bill.deliveryDate)
                ? bill.deliveryDate.split('-').reverse().join('-')
                : bill.deliveryDate}
            </div>
          )}
          {bill.isTailoring && bill.trialDate && (
            <div>Trial: {bill.trialDate}</div>
          )}
          {bill.isTailoring && bill.tailoringStatus && (
            <div className="text-sm sm:text-base font-extrabold text-[#8C8EE8]">
              Status:{' '}
              {bill.tailoringStatus === 'ready'
                ? 'Ready'
                : bill.tailoringStatus === 'delivered'
                ? 'Delivered'
                : 'Stitching'}
            </div>
          )}
        </div>
      </div>

      {/* 3B. Tailoring Body Measurements & Stitching Notes Box (When Tailoring Mode is Active) */}
      {bill.isTailoring &&
        bill.measurements &&
        Object.values(bill.measurements).some((v) => Boolean(v && String(v).trim())) && (
          <div className="mb-3.5 p-3.5 rounded-lg border border-stone-300 bg-stone-50/70 text-sm space-y-2.5">
            <div className="font-extrabold text-stone-900 uppercase tracking-wide flex items-center justify-between border-b border-stone-200 pb-1.5 text-sm sm:text-base">
              <span>✂️ Measurements (Inch)</span>
              {bill.measurements.garmentType && (
                <span className="font-black text-[#8C8EE8]">{bill.measurements.garmentType}</span>
              )}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
              {[
                { label: 'Length', val: bill.measurements.length },
                { label: 'Chest', val: bill.measurements.chest },
                { label: 'Waist', val: bill.measurements.waist },
                { label: 'Shoulder', val: bill.measurements.shoulder },
                { label: 'Sleeve', val: bill.measurements.sleeve },
                { label: 'Neck', val: bill.measurements.neck },
                { label: 'Hip', val: bill.measurements.hip },
                { label: 'Bottom', val: bill.measurements.bottom },
              ]
                .filter((m) => Boolean(m.val && String(m.val).trim()))
                .map((m) => (
                  <div
                    key={m.label}
                    className="bg-white border border-stone-200 rounded-md px-1.5 py-1.5"
                  >
                    <div className="text-xs text-stone-600 font-bold">{m.label}</div>
                    <div className="font-mono font-black text-stone-900 text-sm sm:text-base">{m.val}</div>
                  </div>
                ))}
            </div>

            {bill.measurements.designNotes && (
              <div className="pt-1 text-stone-800 text-sm sm:text-base">
                <span className="font-bold text-stone-900">Note: </span>
                <span className="font-medium">{bill.measurements.designNotes}</span>
              </div>
            )}
          </div>
        )}

      {/* 4. Table of Items: Exactly matching photo (or Total Slip Overview) */}
      {isTotalOnly ? (
        <div className="my-4 p-5 rounded-2xl bg-stone-50 border-2 border-stone-300 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                {isBn ? 'পণ্য বিবরণী / Purchase Overview' : 'Purchase Overview'}
              </span>
              <span className="text-base sm:text-lg font-black text-stone-900">
                {isBn ? 'মোট ক্রয়কৃত পণ্য / আইটেম: ' : 'Total Items Purchased: '}
                <strong className="text-[#8C8EE8] font-mono text-xl">{totalQty}</strong> {isBn ? 'টি' : 'pcs'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-stone-500 uppercase block">
                {isBn ? 'পেমেন্ট অবস্থা' : 'Payment Status'}
              </span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                  balance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {balance <= 0 ? (isBn ? '✓ পরিশোধিত (PAID)' : '✓ PAID') : (isBn ? '⚠️ বকেয়া (DUE)' : '⚠️ DUE')}
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-500 italic font-medium">
            {isBn
              ? '* এই হিসাব স্লিপে ব্যক্তিগত পণ্যের আইটেম তালিকা ও দর গোপন রাখা হয়েছে, শুধু চূড়ান্ত টাকার হিসাব দেওয়া হয়েছে।'
              : '* Individual item names and rates are hidden on this total slip; only final calculated amount is shown.'}
          </p>
        </div>
      ) : (
        <div className="mt-1 mb-2 overflow-x-auto">
          <table className="w-full text-sm sm:text-base text-left border-collapse">
            <thead>
              <tr className="bg-[#8C8EE8] text-white print:bg-[#8C8EE8] print:text-white">
                <th className="py-2.5 px-3 text-left font-bold text-white w-10">#</th>
                <th className="py-2.5 px-3 text-left font-bold text-white">
                  {bill.isTailoring ? 'Item' : 'Item name'}
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-white w-20">
                  {bill.isTailoring ? 'Qty' : 'Quantity'}
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-white w-24">
                  {bill.isTailoring ? 'Rate' : 'Price/ unit'}
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-white w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, idx) => {
                const itemDiscountRatio =
                  discountAmount > 0 && bill.subtotal > 0
                    ? discountAmount / bill.subtotal
                    : 0;
                const finalUnitPrice = Math.round(item.price * (1 - itemDiscountRatio) * 100) / 100;
                const finalItemTotal = Math.round(item.total * (1 - itemDiscountRatio) * 100) / 100;
                const hasDiscount = discountAmount > 0 && finalUnitPrice !== item.price;

                return (
                  <tr key={item.id || idx} className="bg-white">
                    <td className="py-2.5 px-3 text-left text-stone-900 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-left font-bold text-stone-900">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-stone-900 font-semibold whitespace-nowrap">
                      {item.qty}
                      {item.unit ? ` ${item.unit}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right text-stone-900 font-semibold whitespace-nowrap">
                      {hasDiscount ? (
                        <div>
                          <div className="font-bold text-stone-900">
                            {finalUnitPrice.toFixed(1)}
                          </div>
                          <div className="line-through text-stone-400 text-xs leading-none mt-0.5">
                            {item.price.toFixed(1)}
                          </div>
                        </div>
                      ) : (
                        <div>{item.price.toFixed(1)}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-stone-900 font-bold whitespace-nowrap">
                      {hasDiscount ? (
                        <div>
                          <div className="font-bold text-stone-900">
                            {finalItemTotal.toFixed(1)}
                          </div>
                          <div className="line-through text-stone-400 text-xs font-normal leading-none mt-0.5">
                            {item.total.toFixed(1)}
                          </div>
                        </div>
                      ) : (
                        item.total.toFixed(1)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-b border-stone-800 font-extrabold text-stone-900">
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 font-extrabold text-stone-900 text-base sm:text-lg">Total</td>
                <td className="py-2.5 px-3 text-right font-extrabold text-stone-900 text-base sm:text-lg">
                  {totalQty}
                </td>
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 text-right font-extrabold text-stone-900 text-base sm:text-lg whitespace-nowrap">
                  {discountAmount > 0 ? (
                    <div>
                      <div>{currencyPrefix}{bill.grandTotal.toFixed(1)}</div>
                      <div className="line-through text-stone-400 text-xs font-normal">
                        {currencyPrefix}{bill.subtotal.toFixed(1)}
                      </div>
                    </div>
                  ) : (
                    `${currencyPrefix}{bill.subtotal.toFixed(1)}`
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 5. Summary & Financials Section: Exactly matching photo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 pb-6">
        {/* Left: Invoice Amount in Words */}
        <div className="space-y-1.5 pr-2">
          <div className="font-bold text-stone-900 text-base sm:text-lg">Invoice Amount In Words</div>
          <p className="text-base sm:text-lg font-medium text-stone-800 leading-normal">
            {amountInWords}
          </p>
        </div>

        {/* Right: Discount, Total, Received, Balance */}
        <div className="space-y-2 text-base sm:text-lg text-stone-800">
          {(isTotalOnly || discountAmount > 0) && (
            <div className="flex justify-between items-center py-0.5">
              <span className="font-medium text-stone-800">
                {isTotalOnly ? (isBn ? 'মোট পণ্যের দাম (Subtotal)' : 'Subtotal') : 'Subtotal'}
              </span>
              <span className="font-semibold text-stone-900">
                {currencyPrefix}{bill.subtotal.toFixed(1)}
              </span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex justify-between items-center py-0.5">
              <span className="font-medium text-stone-800">
                Discount {discountPercent > 0 ? `(${discountPercent.toFixed(1)}%)` : ''}
              </span>
              <span className="font-semibold text-rose-600">
                -{currencyPrefix}{discountAmount.toFixed(1)}
              </span>
            </div>
          )}

          {/* Purple Total Highlight Bar */}
          <div className="bg-[#8C8EE8] text-white print:bg-[#8C8EE8] print:text-white font-extrabold py-2 px-3 flex justify-between items-center my-1 text-base sm:text-lg rounded-xs">
            <span>Total</span>
            <span>
              {currencyPrefix}{bill.grandTotal.toFixed(1)}
            </span>
          </div>

          {/* Payment Mode Banner & Settlement Breakdown */}
          <div className="space-y-1 pt-1">
            <div
              className={`flex justify-between items-center py-1.5 px-2.5 rounded-lg border font-bold ${
                isBillEstimate
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : bill.paymentMethod === 'cash'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : bill.paymentMethod === 'upi'
                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                  : bill.paymentMethod === 'due'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-stone-50 border-stone-200 text-stone-900'
              }`}
            >
              <span className="text-sm sm:text-base">{isBn ? 'পেমেন্ট ধরন (Payment Mode)' : 'Payment Mode'}</span>
              <span className="font-black uppercase tracking-wider text-sm sm:text-base">
                {isBillEstimate
                  ? (isBn ? 'এস্টিমেট (ESTIMATE)' : 'ESTIMATE')
                  : bill.paymentMethod === 'cash'
                  ? (isBn ? 'ক্যাশ (CASH)' : 'CASH')
                  : bill.paymentMethod === 'upi'
                  ? (isBn ? 'ইউপিআই (UPI)' : 'UPI')
                  : bill.paymentMethod === 'due'
                  ? (isBn ? 'ক্রেডিট / বাকি (CREDIT)' : 'CREDIT / DUE')
                  : bill.paymentMethod === 'card'
                  ? (isBn ? 'কার্ড (CARD)' : 'CARD')
                  : (bill.paymentMethod || 'CASH').toUpperCase()}
              </span>
            </div>

            {paidAmount > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-stone-800">
                  {bill.isTailoring ? 'Advance' : (isBn ? 'Paid / Received (পরিশোধ)' : 'Paid / Received')}
                </span>
                <span className="font-semibold text-emerald-700">
                  {currencyPrefix}{paidAmount.toFixed(1)}
                </span>
              </div>
            )}

            {balance > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="font-semibold text-rose-700">
                  {bill.isTailoring ? 'Balance Due' : (isBn ? 'Balance Due (বাকি)' : 'Balance Due')}
                </span>
                <span className="font-extrabold text-rose-700">
                  {currencyPrefix}{balance.toFixed(1)}
                </span>
              </div>
            )}

            {isBillEstimate && paidAmount <= 0 && (
              <div className="text-right text-xs text-stone-500 font-medium italic pt-0.5">
                {isBn ? '* এস্টিমেট বিল / কোটেশন (Estimate / Quotation)' : '* Estimate Bill / Quotation'}
              </div>
            )}
          </div>
          {/* Bottom underline */}
          <div className="border-b border-stone-800 pt-0.5"></div>
        </div>
      </div>

      {/* 6. Footer: Terms, Dynamic UPI QR (Vyapar style) & Authorized Signatory */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-5 border-t border-stone-200 gap-4">
        {/* Left: Terms and Conditions */}
        <div className="space-y-1 max-w-[280px]">
          <div className="font-bold text-stone-900 text-sm sm:text-base">Terms and Conditions</div>
          {bill.isTailoring ? (
            <>
              <p className="text-xs sm:text-sm text-stone-700 font-medium leading-normal">
                1. Please bring this tailoring slip at the time of trial & delivery.
              </p>
              <p className="text-xs sm:text-sm text-stone-700 font-medium leading-normal">
                2. Thank you for choosing our tailoring service!
              </p>
            </>
          ) : (
            <>
              <p className="text-xs sm:text-sm text-stone-700 font-medium leading-normal">
                1. Goods once sold will not be taken back without bill.
              </p>
              <p className="text-xs sm:text-sm text-stone-700 font-medium leading-normal">
                2. Thank you for shopping with us! Please visit again.
              </p>
            </>
          )}
        </div>

        {/* Center: Dynamic UPI Payment QR Code for Due Balance */}
        {showUpiQr && upiQrUrl && (
          <div className="flex flex-col items-center justify-center p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-center self-center sm:self-auto shadow-2xs">
            <div className="text-xs font-black text-stone-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span>Scan & Pay</span>
            </div>
            <img
              src={upiQrUrl}
              alt="UPI Payment QR Code"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain bg-white p-1 rounded-lg border border-stone-200"
            />
          </div>
        )}

        {/* Right: Authorized Signatory */}
        <div className="text-center space-y-1 w-44 self-end">
          <div className="text-stone-800 text-sm sm:text-base font-semibold">
            For: <span className="font-bold text-stone-900">{storeName}</span>
          </div>

          {/* Signature Line / Space for stamp & sign */}
          <div className="h-12 border-b border-dashed border-stone-400 flex items-end justify-center pb-1">
            {/* Blank space for physical signature or stamp */}
          </div>

          <div className="font-bold text-stone-900 text-sm sm:text-base pt-1">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
};
