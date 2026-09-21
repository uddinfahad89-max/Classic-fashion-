import React from 'react';
import { BillInvoice, ThermalPrinterSettings } from '../types';
import { numberToWords } from '../utils/numberToWords';

interface TaxInvoiceSheetProps {
  bill: BillInvoice;
  settings: ThermalPrinterSettings;
}

export const TaxInvoiceSheet: React.FC<TaxInvoiceSheetProps> = ({ bill, settings }) => {
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

  const paidAmount = bill.paidAmount !== undefined ? bill.paidAmount : (bill.paymentStatus === 'PAID' ? bill.grandTotal : 0);
  const balance = bill.balance !== undefined ? bill.balance : Math.max(0, bill.grandTotal - paidAmount);
  const youSaved = discountAmount;
  const previousBalance = bill.previousBalance !== undefined ? bill.previousBalance : 0;
  const currentBalance = bill.currentBalance !== undefined ? bill.currentBalance : previousBalance + balance;

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

  return (
    <div
      id={`tax-invoice-${bill.id}`}
      className="tax-invoice-sheet bg-white text-stone-900 w-full max-w-[700px] mx-auto p-4 sm:p-8 rounded-xl shadow-xs border border-stone-200 print:border-none print:shadow-none print:p-2 print:max-w-full font-sans text-sm"
      style={{ minHeight: '840px' }}
    >
      {/* 1. Header: Store Info */}
      <div className="text-left space-y-0.5">
        <h1 className="text-xl sm:text-2xl font-black tracking-wide text-stone-900 uppercase">
          {storeName}
        </h1>
        {storeAddress && (
          <p className="text-xs sm:text-sm text-stone-600 font-medium leading-tight">
            {storeAddress}
          </p>
        )}
        {storePhone && (
          <p className="text-xs sm:text-sm text-stone-600 font-medium">
            Phone no.: {storePhone}
          </p>
        )}
      </div>

      <div className="border-t border-stone-300 my-3"></div>

      {/* 2. Tax Invoice Banner */}
      <div className="text-center my-2">
        <h2 className="text-lg sm:text-xl font-bold text-[#8C8EE8] tracking-normal">
          Tax Invoice
        </h2>
      </div>

      {/* 3. Bill To & Invoice Details (2 Columns) */}
      <div className="flex justify-between items-start pt-1 pb-4 text-xs sm:text-sm">
        {/* Left: Customer Info */}
        <div className="space-y-0.5">
          <div className="font-bold text-stone-900">Bill To</div>
          <div className="font-black text-stone-900 text-sm sm:text-base tracking-wide uppercase">
            {bill.customerName || 'Cash Customer'}
          </div>
          {bill.customerPhone && (
            <div className="text-stone-700 font-medium">
              Contact No.: {bill.customerPhone}
            </div>
          )}
        </div>

        {/* Right: Invoice Metadata */}
        <div className="text-right space-y-0.5 font-medium text-stone-700">
          <div className="font-bold text-stone-900">Invoice Details</div>
          <div>
            Invoice No.: <span className="font-bold text-stone-900">{bill.invoiceNo}</span>
          </div>
          <div>Date: {formattedDate}</div>
          {formattedTime && <div>Time: {formattedTime}</div>}
        </div>
      </div>

      {/* 4. Table of Items: Exactly matching photo */}
      <div className="mt-1 mb-2 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left border-collapse">
          <thead>
            <tr className="bg-[#8C8EE8] text-white print:bg-[#8C8EE8] print:text-white">
              <th className="py-2.5 px-3 text-left font-bold text-white w-10">#</th>
              <th className="py-2.5 px-3 text-left font-bold text-white">Item name</th>
              <th className="py-2.5 px-3 text-right font-bold text-white w-24">Quantity</th>
              <th className="py-2.5 px-3 text-right font-bold text-white w-28">Price/ unit</th>
              <th className="py-2.5 px-3 text-right font-bold text-white w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, idx) => (
              <tr key={item.id || idx} className="bg-white">
                <td className="py-2.5 px-3 text-left text-stone-900 font-medium">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 text-left font-bold text-stone-900">
                  {item.name}
                </td>
                <td className="py-2.5 px-3 text-right text-stone-900 font-medium">
                  {item.qty}
                </td>
                <td className="py-2.5 px-3 text-right text-stone-900 font-medium whitespace-nowrap">
                  {item.price.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-stone-900 font-medium whitespace-nowrap">
                  {item.total.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-b border-stone-800 font-bold text-stone-900">
              <td className="py-2.5 px-3"></td>
              <td className="py-2.5 px-3 font-bold text-stone-900 text-sm sm:text-base">Total</td>
              <td className="py-2.5 px-3 text-right font-bold text-stone-900 text-sm sm:text-base">
                {totalQty}
              </td>
              <td className="py-2.5 px-3"></td>
              <td className="py-2.5 px-3 text-right font-bold text-stone-900 text-sm sm:text-base whitespace-nowrap">
                {currencyPrefix}{bill.subtotal.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Summary & Financials Section: Exactly matching photo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 pb-6">
        {/* Left: Invoice Amount in Words */}
        <div className="space-y-1.5 pr-2">
          <div className="font-bold text-stone-900 text-sm sm:text-base">Invoice Amount In Words</div>
          <p className="text-sm sm:text-base font-normal text-stone-800 leading-normal">
            {amountInWords}
          </p>
        </div>

        {/* Right: Subtotal, Discount, Total, Received, Balance */}
        <div className="space-y-1.5 text-sm sm:text-base text-stone-800">
          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">Sub Total</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{bill.subtotal.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">
              Discount {discountPercent > 0 ? `(${discountPercent.toFixed(1)}%)` : ''}
            </span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{discountAmount.toFixed(1)}
            </span>
          </div>

          {/* Purple Total Highlight Bar */}
          <div className="bg-[#8C8EE8] text-white print:bg-[#8C8EE8] print:text-white font-bold py-1.5 px-3 flex justify-between items-center my-1 text-sm sm:text-base rounded-xs">
            <span>Total</span>
            <span>
              {currencyPrefix}{bill.grandTotal.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">Received</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{paidAmount.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">Balance</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{balance.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">You Saved</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{youSaved.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">Previous Balance</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{previousBalance.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="font-normal text-stone-800">Current Balance</span>
            <span className="font-normal text-stone-900">
              {currencyPrefix}{currentBalance.toFixed(1)}
            </span>
          </div>
          {/* Bottom underline under Current Balance */}
          <div className="border-b border-stone-800 pt-0.5"></div>
        </div>
      </div>

      {/* 6. Footer: Terms & Authorized Signatory */}
      <div className="flex justify-between items-end pt-5 border-t border-stone-200">
        {/* Left: Terms and Conditions */}
        <div className="space-y-1 max-w-[280px]">
          <div className="font-bold text-stone-900 text-xs sm:text-sm">Terms and Conditions</div>
          <p className="text-xs text-stone-600 leading-normal">
            1. Goods once sold will not be taken back without bill.
          </p>
          <p className="text-xs text-stone-600 leading-normal">
            2. Thank you for shopping with us! Please visit again.
          </p>
        </div>

        {/* Right: Authorized Signatory */}
        <div className="text-center space-y-1 w-48">
          <div className="text-stone-700 text-xs sm:text-sm font-medium">
            For: <span className="font-bold text-stone-900">{storeName}</span>
          </div>

          {/* Signature Line / Space for stamp & sign */}
          <div className="h-12 border-b border-dashed border-stone-400 flex items-end justify-center pb-1">
            {/* Blank space for physical signature or stamp */}
          </div>

          <div className="font-bold text-stone-900 text-xs sm:text-sm pt-1">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
};
