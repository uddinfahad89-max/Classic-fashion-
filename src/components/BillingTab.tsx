import React, { useState, useRef } from 'react';
import {
  Printer,
  Plus,
  Trash2,
  Receipt,
  RotateCcw,
  Tag,
  Percent,
  RefreshCw,
  User,
  Phone,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
} from 'lucide-react';
import {
  BillItem,
  BillInvoice,
  PaymentMethod,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  Language,
} from '../types';
import { translations } from '../utils/i18n';

interface BillingTabProps {
  billItems: BillItem[];
  setBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  isPrinting?: boolean;
  onPrintBill: (bill: BillInvoice) => void;
  onClearBill: () => void;
  language?: Language;
}

export const BillingTab: React.FC<BillingTabProps> = ({
  billItems,
  setBillItems,
  settings,
  bluetoothStatus,
  isPrinting = false,
  onPrintBill,
  onClearBill,
  language = 'bn',
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  // Direct item input form state
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');

  // Checkout meta
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const rawDiscount = Math.max(0, parseFloat(discountValue) || 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    const clampedPercent = Math.min(100, rawDiscount);
    discountAmount = Math.round(((subtotal * clampedPercent) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(subtotal, rawDiscount);
  }

  const grandTotal = Math.max(0, subtotal - discountAmount);
  const paidNum = parseFloat(paidAmount) || 0;
  const changeAmount = Math.max(0, paidNum - grandTotal);

  // Add Item to Bill on-the-fly
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    const qty = parseInt(itemQty, 10);

    if (!name || isNaN(price) || price <= 0) {
      alert(t.enterValidNamePrice);
      return;
    }

    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;

    const newItem: BillItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name,
      price,
      qty: validQty,
      total: price * validQty,
    };

    setBillItems((prev) => [...prev, newItem]);

    // Reset fields & refocus
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setBillItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Adjust Quantity
  const handleUpdateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(id);
      return;
    }
    setBillItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: newQty, total: item.price * newQty } : item
      )
    );
  };

  // Handle Checkout & Print Bill
  const handleCheckoutAndPrint = () => {
    if (billItems.length === 0) {
      alert(t.addAtLeastOneItem);
      return;
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`;
    const timeFormatted = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const invoiceNo = String(Math.floor(100 + Math.random() * 900));

    const actualPaid = paidNum > 0 ? paidNum : (paymentMethod === 'due' ? 0 : grandTotal);
    const balanceAmount = paymentMethod === 'due' ? Math.max(0, grandTotal - actualPaid) : 0;

    const bill: BillInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNo,
      date: dateFormatted,
      time: timeFormatted,
      timestamp: Date.now(),
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: [...billItems],
      subtotal,
      discount: discountAmount,
      discountType,
      discountValue: rawDiscount,
      grandTotal,
      paymentMethod,
      paidAmount: actualPaid,
      changeAmount: paidNum > grandTotal ? changeAmount : 0,
      balance: balanceAmount,
      previousBalance: 0,
      currentBalance: balanceAmount,
    };

    onPrintBill(bill);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue('');
    setPaidAmount('');
  };

  const sym = settings.currencySymbol || '₹';

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* 1. CUSTOMER DETAILS CARD (SECTION 1 - TOP) */}
      <div id="billing-customer-section" className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600" />
            <span>{isBn ? 'ক্রেতার বিবরণ (ঐচ্ছিক)' : 'Customer Details (Optional)'}</span>
          </h2>
          <span className="text-[11px] text-stone-400 font-medium">
            {isBn ? 'ইনভয়েস ও বাকি খাতার জন্য' : 'For invoice & due ledger'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Customer Name */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="billing-customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t.customerNameOptionalPlaceholder}
              className="w-full border border-stone-200 bg-stone-50/80 pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Customer Phone / Mobile */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="tel"
              id="billing-customer-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t.customerPhoneOptionalPlaceholder}
              className="w-full border border-stone-200 bg-stone-50/80 pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. INSTANT ITEM ENTRY CARD (SECTION 2 - MIDDLE) */}
      <div id="billing-item-entry-section" className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>{t.instantItemEntry}</span>
          </h2>
          <span className="text-[11px] text-stone-400 font-medium">{t.typeAndAddDirectly}</span>
        </div>

        <form onSubmit={handleAddItem} className="space-y-2.5">
          <div>
            <input
              ref={nameInputRef}
              type="text"
              id="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={t.itemNamePlaceholder}
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex gap-2">
            <div className="w-1/2 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                {sym}
              </span>
              <input
                type="number"
                id="itemPrice"
                min="0.01"
                step="any"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder={t.unitPrice}
                className="w-full border border-stone-200 bg-stone-50/80 pl-7 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="w-1/2">
              <input
                type="number"
                id="itemQty"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                placeholder={t.qty}
                className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            id="btn-add-item"
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t.addItemToBill}</span>
          </button>
        </form>
      </div>

      {/* 3. CURRENT BILL ITEMS LIST (SECTION 3) */}
      <div id="billing-items-list-section" className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
        <div className="p-3.5 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-800">{t.currentBillItems}</span>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {billItems.length}
            </span>
          </div>

          {billItems.length > 0 && (
            <button
              onClick={() => {
                if (confirm(t.clearBillConfirm)) {
                  onClearBill();
                  setCustomerName('');
                  setCustomerPhone('');
                  setDiscountValue('');
                  setPaidAmount('');
                }
              }}
              className="text-[11px] text-stone-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.clearBill}</span>
            </button>
          )}
        </div>

        {billItems.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            {t.noItemsInBill}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-stone-100/70 text-stone-600 text-[11px] uppercase tracking-wider font-semibold border-b border-stone-200">
                  <th className="text-left p-2.5 sm:p-3">{isBn ? 'পণ্য' : 'Item'}</th>
                  <th className="text-center p-2.5 sm:p-3 w-24">{t.qty}</th>
                  <th className="text-right p-2.5 sm:p-3">{t.unitPrice}</th>
                  <th className="text-right p-2.5 sm:p-3">{isBn ? 'মোট' : 'Total'}</th>
                  <th className="p-2.5 sm:p-3 w-8"></th>
                </tr>
              </thead>
              <tbody id="billTable" className="divide-y divide-stone-100">
                {billItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="p-2.5 sm:p-3 font-medium text-stone-900">{item.name}</td>
                    <td className="p-2.5 sm:p-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-lg border border-stone-200">
                        <button
                          onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                          className="w-4 h-4 text-stone-600 hover:text-stone-900 font-bold flex items-center justify-center leading-none cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs px-1">{item.qty}</span>
                        <button
                          onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                          className="w-4 h-4 text-stone-600 hover:text-stone-900 font-bold flex items-center justify-center leading-none cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 sm:p-3 text-right font-mono text-stone-600">
                      {sym}
                      {item.price.toFixed(2)}
                    </td>
                    <td className="p-2.5 sm:p-3 text-right font-mono font-bold text-stone-900">
                      {sym}
                      {item.total.toFixed(2)}
                    </td>
                    <td className="p-2.5 sm:p-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. PAYMENT & CHECKOUT SUMMARY (SECTION 4 - BOTTOM) */}
      <div id="billing-checkout-summary-section" className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200 space-y-4">
        {/* 1. TOP: Discount Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.discountSection}</span>
            </label>

            {/* Mode Switcher: Fixed ₹ vs Percent % */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  discountType === 'fixed'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {t.discountFixedLabel} ({sym})
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  discountType === 'percent'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Percent className="w-3 h-3" />
                <span>{t.discountPercentLabel}</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-400">
                {discountType === 'fixed' ? sym : '%'}
              </span>
              <input
                type="number"
                min="0"
                max={discountType === 'percent' ? '100' : undefined}
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'fixed' ? '0.00' : '0'}
                className="w-full border border-stone-200 bg-stone-50/80 pl-8 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {discountValue && (
              <button
                type="button"
                onClick={() => setDiscountValue('')}
                className="px-3 py-2 border border-stone-200 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {t.clearBill}
              </button>
            )}
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-stone-400 font-medium">{isBn ? 'দ্রুত:' : 'Quick:'}</span>
            {discountType === 'percent'
              ? [5, 10, 15, 20, 25].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountValue(String(pct))}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      discountValue === String(pct)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))
              : [50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDiscountValue(String(amt))}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      discountValue === String(amt)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {sym}{amt}
                  </button>
                ))}
          </div>

          {/* Live discount savings highlight */}
          {discountAmount > 0 && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
              <span>
                {discountType === 'percent'
                  ? isBn
                    ? `${rawDiscount}% ছাড় প্রযোজ্য হয়েছে`
                    : `Applied ${rawDiscount}% discount`
                  : isBn
                  ? 'নির্দিষ্ট ছাড় প্রযোজ্য হয়েছে'
                  : 'Flat discount applied'}
              </span>
              <span className="font-bold">
                {isBn ? 'সাশ্রয়' : 'Saves'} -{sym}{discountAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* 2. MIDDLE 1: Real-time Order Summary Breakdown */}
        <div className="bg-stone-50/90 border border-stone-200 p-3.5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>{t.subtotalText}</span>
            <span className="font-mono font-bold text-stone-900">{sym}{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-600">
            <span className="flex items-center gap-1.5">
              <span>{t.discountText}</span>
              {discountAmount > 0 && discountType === 'percent' && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  {rawDiscount}% off
                </span>
              )}
            </span>
            <span className={`font-mono font-bold ${discountAmount > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
              {discountAmount > 0 ? `-${sym}${discountAmount.toFixed(2)}` : `${sym}0.00`}
            </span>
          </div>

          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">{t.grandTotalText}</span>
              <span className="text-[11px] text-stone-500">{t.finalPayableSub}</span>
            </div>
            <div id="grandTotal" className="text-xl sm:text-2xl font-black text-green-700 font-mono">
              {sym}{grandTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 3. MIDDLE 2: Tendered Amount & Change Due */}
        <div className="pt-1 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-700">
              {t.paidReceivedLabel} ({sym})
            </label>
            {grandTotal > 0 && (
              <button
                type="button"
                onClick={() => setPaidAmount(grandTotal.toFixed(2))}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer"
              >
                {t.exactBtn} ({sym}{grandTotal.toFixed(2)})
              </button>
            )}
          </div>

          <input
            type="number"
            min="0"
            step="any"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
            className="w-full border border-stone-200 bg-stone-50/80 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />

          {paidNum > grandTotal && (
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between">
              <span>{t.changeToReturn}</span>
              <span className="font-mono text-sm">{sym}{changeAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* 4. BOTTOM: Payment Method Selection Buttons (Right before Print button) */}
        <div className="pt-2 border-t border-stone-100">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
            {t.paymentModeLabel}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'cash', label: t.modeCash, icon: Banknote },
              { id: 'upi', label: t.modeUpi, icon: QrCode },
              { id: 'card', label: t.modeCard, icon: CreditCard },
              { id: 'due', label: t.modeDue, icon: Clock },
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/20 scale-[1.02]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-stone-500'}`} />
                  <span className="truncate">{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. VERY BOTTOM: Primary Action Button (Create Invoice, Print & Save) */}
        <button
          id="billing-print-btn"
          onClick={handleCheckoutAndPrint}
          disabled={billItems.length === 0 || isPrinting}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            billItems.length > 0 && !isPrinting
              ? 'bg-[#6E68D8] hover:bg-[#5E58C8] active:bg-[#534DA8] text-white shadow-md active:scale-[0.99]'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          {isPrinting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>{t.generatingInvoice}</span>
            </>
          ) : (
            <>
              <Printer className="w-5 h-5" />
              <span>{t.printTaxInvoiceBtn}</span>
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-stone-500 pt-0.5">
          {t.printTaxInvoiceSub}
        </p>
      </div>
    </div>
  );
};
