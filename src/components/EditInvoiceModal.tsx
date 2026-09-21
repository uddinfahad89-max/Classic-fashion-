import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  SmartphoneNfc,
  ExternalLink,
  Tag,
  Percent,
} from 'lucide-react';
import {
  BillInvoice,
  BillItem,
  PaymentMethod,
  ThermalPrinterSettings,
  Language,
} from '../types';
import { translations } from '../utils/i18n';

interface EditInvoiceModalProps {
  bill: BillInvoice | null;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (updatedBill: BillInvoice) => void;
  onDelete?: (id: string) => void;
  onLoadInBilling?: (bill: BillInvoice) => void;
  settings: ThermalPrinterSettings;
  language?: Language;
}

export const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  bill,
  isOpen = true,
  onClose,
  onSave,
  onDelete,
  onLoadInBilling,
  settings,
  language = 'bn',
}) => {
  const t = translations[language];
  const sym = settings.currencySymbol || '₹';

  // Form states
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New item quick entry
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');

  // Sync state whenever active bill changes
  useEffect(() => {
    if (bill) {
      setInvoiceNo(bill.invoiceNo);
      setCustomerName(bill.customerName || '');
      setCustomerPhone(bill.customerPhone || '');
      setItems(bill.items ? JSON.parse(JSON.stringify(bill.items)) : []);
      setDiscountType(bill.discountType || 'fixed');
      setDiscountValue(
        bill.discountValue !== undefined && bill.discountValue > 0
          ? bill.discountValue.toString()
          : bill.discount > 0
          ? bill.discount.toString()
          : ''
      );
      setPaymentMethod(bill.paymentMethod || 'cash');
      setPaidAmount(bill.paidAmount !== undefined ? bill.paidAmount.toString() : '');
      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
    }
  }, [bill, isOpen]);

  if (!isOpen || !bill) return null;

  // Math Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.total || item.price * item.qty), 0);
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
  const dueAmount = Math.max(0, grandTotal - paidNum);

  // Item Handlers
  const handleUpdateItemName = (id: string, name: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  };

  const handleUpdateItemPrice = (id: string, priceStr: string) => {
    const price = Math.max(0, parseFloat(priceStr) || 0);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, price, total: price * it.qty } : it))
    );
  };

  const handleUpdateItemQty = (id: string, qtyDelta: number) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = it.qty + qtyDelta;
            if (newQty <= 0) return null;
            return { ...it, qty: newQty, total: it.price * newQty };
          }
          return it;
        })
        .filter((it): it is BillItem => it !== null)
    );
  };

  const handleSetItemQtyDirect = (id: string, qtyStr: string) => {
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty, total: it.price * qty } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setValidationError(language === 'bn' ? 'ইনভয়েসে অন্তত একটি পণ্য থাকতে হবে।' : 'Invoice must have at least one item.');
      return;
    }
    setValidationError(null);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddNewItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);
    const qty = parseInt(newItemQty, 10) || 1;

    if (!name || isNaN(price) || price <= 0) {
      setValidationError(language === 'bn' ? 'সঠিক পণ্যের নাম ও দর লিখুন' : 'Please enter valid item name and price');
      return;
    }

    setValidationError(null);
    const newItem: BillItem = {
      id: 'item-edit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name,
      price,
      qty,
      total: price * qty,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty('1');
  };

  // Submit & Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setValidationError(language === 'bn' ? 'ইনভয়েসে অন্তত একটি পণ্য থাকতে হবে।' : 'Invoice must have at least one item.');
      return;
    }

    setValidationError(null);

    // Determine status
    let paymentStatus: 'PAID' | 'DUE' | 'PARTIAL' = 'PAID';
    if (paymentMethod === 'due' || dueAmount > 0) {
      paymentStatus = paidNum > 0 ? 'PARTIAL' : 'DUE';
    } else {
      paymentStatus = 'PAID';
    }

    const finalPaid = paymentMethod === 'due' && paidNum === 0 ? 0 : paidNum > 0 ? paidNum : grandTotal;
    const finalBalance = Math.max(0, grandTotal - finalPaid);

    const updatedBill: BillInvoice = {
      ...bill,
      invoiceNo: invoiceNo.trim() || bill.invoiceNo,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items,
      subtotal,
      discount: discountAmount,
      discountType,
      discountValue: rawDiscount,
      grandTotal,
      paymentMethod,
      paymentStatus,
      paidAmount: finalPaid,
      changeAmount: paymentMethod === 'due' ? 0 : changeAmount,
      balance: finalBalance,
      currentBalance: finalBalance,
    };

    onSave(updatedBill);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-gradient-to-r from-blue-50/90 via-white to-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">
                  {t.editInvoiceModalTitle}
                </h2>
                <span className="font-mono text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  #{bill.invoiceNo}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'পণ্যের নাম, দর, পরিমাণ, ডিসকাউন্ট বা কাস্টমারের তথ্য সংশোধন করুন'
                  : 'Modify items, unit prices, quantity, customer info, or payment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-rose-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-rose-500 hover:text-rose-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Delete Confirmation Overlay inside Edit Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-stone-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {language === 'bn' ? 'ইনভয়েস মুছে ফেলতে চান?' : 'Delete this Invoice?'}
                </h3>
                <p className="text-xs text-stone-500 font-mono mt-1">
                  #{bill.invoiceNo} • {sym}{grandTotal.toFixed(2)}
                </p>
                {customerName && (
                  <p className="text-xs text-stone-600 font-medium mt-0.5">{customerName}</p>
                )}
                <p className="text-[11px] text-rose-600 mt-2">
                  {language === 'bn'
                    ? 'সতর্কতা: এটি মুছে ফেললে আর পুনরুদ্ধার করা যাবে না।'
                    : 'Warning: This action is permanent and cannot be undone.'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onDelete) {
                      onDelete(bill.id);
                    }
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
                >
                  {language === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {/* 1. Customer & Invoice Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t.invoiceNumberLabel}
              </label>
              <div className="w-full border border-stone-200 bg-stone-100 px-3 py-2 rounded-xl text-xs font-mono font-bold text-stone-700 select-none flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>#{invoiceNo}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t.customerNameLabel}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: Fahad' : 'e.g. John Doe'}
                className="w-full border border-stone-200 bg-white px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t.customerPhoneLabel}
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="017... / +91..."
                className="w-full border border-stone-200 bg-white px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* 2. Purchased Items Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>{t.itemsListTitle}</span>
                <span className="bg-stone-200 text-stone-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {items.length}
                </span>
              </h3>
              <span className="text-[11px] text-stone-400">
                {language === 'bn' ? 'দর বা পরিমাণ বদলালে স্বয়ংক্রিয় হিসাব হবে' : 'Live recalculation'}
              </span>
            </div>

            <div className="divide-y divide-stone-200/80 border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 hover:bg-stone-50/60 transition-colors"
                >
                  {/* Item Name */}
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      value={item.name}
                      onChange={(e) => handleUpdateItemName(item.id, e.target.value)}
                      placeholder={t.itemNameLabel}
                      className="w-full border border-stone-200 bg-stone-50/50 hover:bg-white focus:bg-white px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    {/* Unit Price */}
                    <div className="flex items-center gap-1">
                      <span className="text-stone-400 text-xs font-mono">{sym}</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        value={item.price}
                        onChange={(e) => handleUpdateItemPrice(item.id, e.target.value)}
                        placeholder={t.itemPriceLabel}
                        className="w-20 sm:w-24 border border-stone-200 bg-stone-50/50 hover:bg-white focus:bg-white px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-stone-800 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-stone-200 rounded-lg bg-stone-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id, -1)}
                        className="p-1 hover:bg-stone-200 text-stone-600 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleSetItemQtyDirect(item.id, e.target.value)}
                        className="w-10 text-center text-xs font-mono font-bold bg-white py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id, 1)}
                        className="p-1 hover:bg-stone-200 text-stone-600 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="w-20 text-right font-mono font-bold text-xs sm:text-sm text-stone-900">
                      {sym}
                      {(item.total || item.price * item.qty).toFixed(2)}
                    </div>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={language === 'bn' ? 'আইটেম মুছুন' : 'Remove item'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add New Item to this invoice */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-dashed border-stone-300">
              <span className="text-[11px] font-bold text-stone-600 block mb-2">
                {language === 'bn' ? '+ এই ইনভয়েসে নতুন পণ্য যুক্ত করুন:' : '+ Add another item to this invoice:'}
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={language === 'bn' ? 'পণ্যের নাম (যেমন: Cloth, Pant, Sari)' : 'Item name'}
                  className="flex-2 border border-stone-200 bg-white px-3 py-1.5 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2 flex-1">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                      {sym}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder={t.itemPriceLabel}
                      className="w-full border border-stone-200 bg-white pl-6 pr-2 py-1.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="Qty"
                    className="w-16 border border-stone-200 bg-white px-2 py-1.5 rounded-xl text-xs font-mono font-bold text-center focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addItemBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Discount & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Discount Editor */}
            <div className="bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.discountLabel}</span>
                </label>
                <div className="flex gap-1 bg-white p-0.5 border border-stone-200 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-blue-600 text-white'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {sym} {t.discountFixed}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      discountType === 'percent'
                        ? 'bg-blue-600 text-white'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    % {t.discountPercent}
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono font-bold">
                  {discountType === 'percent' ? '%' : sym}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  className="w-full border border-stone-200 bg-white pl-8 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>
              {discountAmount > 0 && (
                <div className="text-[11px] text-rose-600 font-bold flex justify-between">
                  <span>{language === 'bn' ? 'ছাড়ের পরিমাণ:' : 'Discount Amount:'}</span>
                  <span className="font-mono">-{sym}{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Payment Method & Paid Amount */}
            <div className="bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200 space-y-2">
              <label className="text-xs font-bold text-stone-800 block">
                {t.paymentMethodLabel}
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI', icon: SmartphoneNfc },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'due', label: 'Due', icon: AlertCircle },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSelected = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                      className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        isSelected
                          ? pm.id === 'due'
                            ? 'bg-rose-50 border-rose-400 text-rose-700'
                            : 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  {t.paidAmountLabel}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono font-bold">
                    {sym}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={grandTotal.toString()}
                    className="w-full border border-stone-200 bg-white pl-8 pr-3 py-1.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Live Calculation Box */}
          <div className="bg-stone-100/80 p-4 rounded-2xl border border-stone-200 text-xs space-y-1.5">
            <div className="flex justify-between text-stone-600">
              <span>{language === 'bn' ? 'সাবটোটাল (Subtotal):' : 'Subtotal:'}</span>
              <span className="font-mono font-bold text-stone-800">
                {sym}{subtotal.toFixed(2)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{language === 'bn' ? 'ডিসকাউন্ট (Discount):' : 'Discount:'}</span>
                <span className="font-mono font-bold">
                  -{sym}{discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm sm:text-base font-black text-stone-900 border-t border-stone-300 pt-1.5">
              <span>{language === 'bn' ? 'সর্বমোট (Grand Total):' : 'Grand Total:'}</span>
              <span className="font-mono text-blue-700">
                {sym}{grandTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-200">
              <span>{t.paidAmountLabel}:</span>
              <span className="font-mono font-semibold">
                {sym}{(paidNum > 0 ? paidNum : paymentMethod === 'due' ? 0 : grandTotal).toFixed(2)}
              </span>
            </div>
            {changeAmount > 0 && paymentMethod !== 'due' && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>{t.changeAmountLabel}:</span>
                <span className="font-mono">{sym}{changeAmount.toFixed(2)}</span>
              </div>
            )}
            {(paymentMethod === 'due' || dueAmount > 0) && (
              <div className="flex justify-between text-rose-700 font-bold">
                <span>{t.dueAmountLabel}:</span>
                <span className="font-mono">
                  {sym}{(paymentMethod === 'due' && paidNum === 0 ? grandTotal : dueAmount).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {onLoadInBilling && (
              <button
                type="button"
                onClick={() => {
                  onLoadInBilling(bill);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title={language === 'bn' ? 'এই ইনভয়েসের আইটেমগুলো নিয়ে বিলিং স্ক্রিনে যান' : 'Load items into billing counter'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t.loadInBillingBtn}</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title={language === 'bn' ? 'এই ইনভয়েস মুছে ফেলুন' : 'Delete this invoice'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}</span>
              </button>
            )}

            <div className="flex gap-2 flex-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer transition-colors"
              >
                {t.cancel}
              </button>

              <button
                type="submit"
                className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.saveInvoiceBtn}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
