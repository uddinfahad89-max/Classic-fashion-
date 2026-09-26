import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Calculator,
  Package,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  BillItem,
  BillInvoice,
  PaymentMethod,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  Language,
  ProductStockItem,
} from '../types';
import { storageService } from '../services/storageService';
import { translations } from '../utils/i18n';
import { useBackHandler } from '../utils/useBackHandler';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';

interface BillingTabProps {
  billItems: BillItem[];
  setBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  isPrinting?: boolean;
  onPrintBill: (bill: BillInvoice) => void;
  onClearBill: () => void;
  language?: Language;
  onOpenCalculator?: () => void;
  products?: ProductStockItem[];
  onOpenProductStock?: () => void;
  onQuickSaveProduct?: (data: {
    name: string;
    price: number;
    stock?: number;
  }) => void;
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
  onOpenCalculator,
  products = [],
  onOpenProductStock,
  onQuickSaveProduct,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  // Direct item input form state
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemStockInput, setItemStockInput] = useState('');
  const [showInlineStockAdd, setShowInlineStockAdd] = useState(false);

  // First-letter Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Checkout meta
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // Automatically generated sequential invoice number
  const [invoiceNo, setInvoiceNo] = useState(() => storageService.getNextInvoiceNumber());
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Synchronize when settings prefix or sequence updates
  useEffect(() => {
    setInvoiceNo(storageService.getNextInvoiceNumber());
  }, [settings.invoicePrefix, settings.nextInvoiceNumber]);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khatabook Calculator Modal State
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [calculatorTarget, setCalculatorTarget] = useState<'item' | 'paid' | 'discount'>('item');

  useBackHandler(
    'billingCalculatorModal',
    isCalculatorModalOpen,
    () => {
      setIsCalculatorModalOpen(false);
      return true;
    },
    35
  );

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Build unified product list (saved stock products + any historical items from bills)
  const allSavedProducts = useMemo(() => {
    const map = new Map<string, ProductStockItem>();
    for (const p of products) {
      if (p.name && p.name.trim()) {
        map.set(p.name.trim().toLowerCase(), p);
      }
    }
    return Array.from(map.values());
  }, [products]);

  // Instant First-Letter Matching Products
  const matchingProducts = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return [];

    const exactStartsWith: ProductStockItem[] = [];
    const wordStartsWith: ProductStockItem[] = [];
    const containsMatch: ProductStockItem[] = [];

    for (const prod of allSavedProducts) {
      const pName = prod.name.trim().toLowerCase();
      if (pName.startsWith(q)) {
        exactStartsWith.push(prod);
      } else if (pName.split(/\s+/).some((w) => w.startsWith(q))) {
        wordStartsWith.push(prod);
      } else if (pName.includes(q)) {
        containsMatch.push(prod);
      }
    }

    return [...exactStartsWith, ...wordStartsWith, ...containsMatch].slice(0, 8);
  }, [allSavedProducts, itemName]);

  // Reset active suggestion index when query changes
  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [itemName]);

  // Select a product from the first-letter autocomplete dropdown
  const handleSelectSuggestedProduct = (prod: ProductStockItem, addDirectly = false) => {
    if (addDirectly) {
      const validQty = parseInt(itemQty, 10) > 0 ? parseInt(itemQty, 10) : 1;
      const price = prod.price || 0;
      const newItem: BillItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: prod.name,
        price,
        qty: validQty,
        total: price * validQty,
        productId: prod.id,
      };
      setBillItems((prev) => [...prev, newItem]);
      setItemName('');
      setItemPrice('');
      setItemQty('1');
      setShowSuggestions(false);
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
      return;
    }

    setItemName(prod.name);
    if (prod.price > 0) {
      setItemPrice(String(prod.price));
    }
    setShowSuggestions(false);
    // Focus price if 0, otherwise focus quantity for rapid billing
    setTimeout(() => {
      if (!prod.price || prod.price <= 0) {
        priceInputRef.current?.focus();
      } else {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    }, 20);
  };

  // Keyboard navigation for first-letter autocomplete
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || matchingProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < matchingProducts.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : matchingProducts.length - 1
      );
    } else if (e.key === 'Tab' && matchingProducts[activeSuggestionIndex]) {
      // Pressing Tab auto-completes the highlighted product name & price
      e.preventDefault();
      handleSelectSuggestedProduct(matchingProducts[activeSuggestionIndex], false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

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

  // Khatabook Calculator Save Handler
  const handleCalculatorSave = (payload: KhatabookEntryPayload) => {
    if (calculatorTarget === 'item') {
      const name =
        payload.details.trim() || itemName.trim() || (isBn ? 'বিক্রয় আইটেম' : 'Sale Item');
      const finalPrice = payload.amount;
      const validQty = parseInt(itemQty, 10) > 0 ? parseInt(itemQty, 10) : 1;

      const newItem: BillItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name,
        price: finalPrice,
        qty: validQty,
        total: finalPrice * validQty,
      };

      setBillItems((prev) => [...prev, newItem]);
      if (onQuickSaveProduct && name && finalPrice > 0) {
        onQuickSaveProduct({ name, price: finalPrice });
      }
      setItemName('');
      setItemPrice('');
      setItemQty('1');
      setIsCalculatorModalOpen(false);
      return;
    }

    if (calculatorTarget === 'paid') {
      setPaidAmount(payload.amount.toString());
      setIsCalculatorModalOpen(false);
      return;
    }

    if (calculatorTarget === 'discount') {
      setDiscountValue(payload.amount.toString());
      setIsCalculatorModalOpen(false);
      return;
    }
  };

  // Add Item to Bill on-the-fly
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // If user typed first letter(s) and didn't enter price yet, but a matching product exists with a price, auto-fill it!
    let finalName = itemName.trim();
    let price = parseFloat(itemPrice);

    if (
      finalName &&
      (isNaN(price) || price <= 0) &&
      matchingProducts.length > 0 &&
      matchingProducts[activeSuggestionIndex]?.price > 0
    ) {
      const matched = matchingProducts[activeSuggestionIndex];
      finalName = matched.name;
      price = matched.price;
    }

    const qty = parseInt(itemQty, 10);

    if (!finalName || isNaN(price) || price <= 0) {
      alert(t.enterValidNamePrice);
      return;
    }

    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;

    // Also save/update in Product Stock if user entered stock or auto-save so next time typing first letter brings it up
    const parsedStock = itemStockInput !== '' ? parseInt(itemStockInput, 10) : undefined;
    if (onQuickSaveProduct) {
      onQuickSaveProduct({
        name: finalName,
        price,
        stock: parsedStock !== undefined && !isNaN(parsedStock) ? parsedStock : undefined,
      });
    }

    const newItem: BillItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: finalName,
      price,
      qty: validQty,
      total: price * validQty,
    };

    setBillItems((prev) => [...prev, newItem]);

    // Reset fields & refocus
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setItemStockInput('');
    setShowSuggestions(false);
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

    let finalInvoiceNo = invoiceNo.trim();
    if (!finalInvoiceNo) {
      finalInvoiceNo = storageService.getNextInvoiceNumber();
    }

    const actualPaid = paidNum > 0 ? paidNum : paymentMethod === 'due' ? 0 : grandTotal;
    const balanceAmount = paymentMethod === 'due' ? Math.max(0, grandTotal - actualPaid) : 0;

    const bill: BillInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNo: finalInvoiceNo,
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

    setTimeout(() => {
      const nextInv = storageService.getNextInvoiceNumber();
      setInvoiceNo(nextInv);
    }, 50);
  };

  const hideCurrency =
    settings.hideCurrencySymbol ||
    settings.currencySymbol === '₹' ||
    !settings.currencySymbol;
  const sym = hideCurrency ? '' : settings.currencySymbol;

  // Helper to highlight matching first letter(s) in product suggestion
  const renderHighlightedName = (name: string, query: string) => {
    const q = query.trim();
    if (!q) return <span>{name}</span>;
    const lowerName = name.toLowerCase();
    const lowerQ = q.toLowerCase();
    const matchIdx = lowerName.indexOf(lowerQ);
    if (matchIdx === -1) return <span>{name}</span>;

    const before = name.slice(0, matchIdx);
    const match = name.slice(matchIdx, matchIdx + q.length);
    const after = name.slice(matchIdx + q.length);

    return (
      <span>
        {before}
        <span className="bg-blue-100 text-blue-800 font-black px-0.5 rounded">{match}</span>
        {after}
      </span>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* 1. CUSTOMER DETAILS CARD (SECTION 1 - TOP) */}
      <div
        id="billing-customer-section"
        className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600" />
            <span>{isBn ? 'ক্রেতার বিবরণ' : 'Customer Details'}</span>
          </h2>
          {/* Automatic Sequential Invoice Number Badge */}
          <div className="flex items-center gap-1.5">
            <span
              id="billing-auto-invoice-badge"
              title={
                isBn
                  ? 'স্বয়ংক্রিয় পরবর্তী ইনভয়েস নম্বর'
                  : 'Sequential Auto-Generated Invoice Number'
              }
              className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{invoiceNo || storageService.getNextInvoiceNumber()}</span>
              <span className="text-[10px] text-blue-600 font-sans font-medium">
                ({isBn ? 'অটো' : 'Auto'})
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Customer Name */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              {isBn ? 'ক্রেতার নাম (ঐচ্ছিক)' : 'Customer Name'}
            </label>
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
          </div>

          {/* Customer Phone / Mobile */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              {isBn ? 'মোবাইল নম্বর (ঐচ্ছিক)' : 'Mobile Phone'}
            </label>
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
      </div>

      {/* 2. INSTANT ITEM ENTRY & PRODUCT STOCK CARD (SECTION 2 - MIDDLE) */}
      <div
        id="billing-item-entry-section"
        className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200"
      >
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>{t.instantItemEntry}</span>
          </h2>

          {/* PRODUCT STOCK ADD & MANAGE BUTTON */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="btn-inline-stock-toggle"
              onClick={() => setShowInlineStockAdd((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                showInlineStockAdd
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
              title={
                isBn
                  ? 'সরাসরি এখানে নতুন প্রোডাক্ট ও স্টক যোগ করুন'
                  : 'Quick add product stock inline'
              }
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isBn ? 'স্টক যোগ' : 'Add Stock'}</span>
            </button>

            {onOpenProductStock && (
              <button
                type="button"
                id="btn-open-product-stock"
                onClick={onOpenProductStock}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'প্রোডাক্ট স্টক তালিকা' : 'Product Stock'}</span>
                <span className="bg-blue-600 text-white text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
                  {allSavedProducts.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Quick Inline "Add Product to Stock Only" Box */}
        {showInlineStockAdd && (
          <div className="mb-3.5 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>
                  {isBn
                    ? 'নতুন প্রোডাক্ট স্টকে সেভ করুন (Save Product to Stock)'
                    : 'Save Product to Stock'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowInlineStockAdd(false)}
                className="text-[11px] font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={isBn ? 'প্রোডাক্টের নাম (যেমন: শার্ট)' : 'Product Name'}
                className="border border-emerald-300 bg-white px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder={isBn ? 'বিক্রয় মূল্য (দর)' : 'Selling Price'}
                className="border border-emerald-300 bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
              />
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={itemStockInput}
                  onChange={(e) => setItemStockInput(e.target.value)}
                  placeholder={isBn ? 'স্টক সংখ্যা (পিস)' : 'Stock Qty'}
                  className="w-full border border-emerald-300 bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanName = itemName.trim();
                    const parsedPrice = parseFloat(itemPrice) || 0;
                    const parsedStock = parseInt(itemStockInput, 10) || 0;
                    if (!cleanName) {
                      alert(isBn ? 'প্রোডাক্টের নাম লিখুন' : 'Enter product name');
                      return;
                    }
                    if (onQuickSaveProduct) {
                      onQuickSaveProduct({
                        name: cleanName,
                        price: parsedPrice,
                        stock: parsedStock,
                      });
                    }
                    setItemName('');
                    setItemPrice('');
                    setItemStockInput('');
                    setShowInlineStockAdd(false);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isBn ? 'সেভ' : 'Save'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleAddItem} className="space-y-2.5">
          {/* ITEM NAME INPUT WITH INSTANT FIRST-LETTER AUTOCOMPLETE */}
          <div ref={suggestionContainerRef} className="relative">
            <input
              ref={nameInputRef}
              type="text"
              id="itemName"
              autoComplete="off"
              value={itemName}
              onFocus={() => {
                if (itemName.trim().length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setItemName(val);
                setShowSuggestions(val.trim().length > 0);
              }}
              onKeyDown={handleNameKeyDown}
              placeholder={
                isBn
                  ? 'প্রোডাক্টের প্রথম অক্ষর বা নাম লিখুন (যেমন: S, শ, প...)'
                  : t.itemNamePlaceholder
              }
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />

            {/* FIRST-LETTER INSTANT AUTOCOMPLETE DROPDOWN */}
            {showSuggestions && matchingProducts.length > 0 && (
              <div
                id="product-autocomplete-dropdown"
                className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-blue-200 overflow-hidden divide-y divide-stone-100 animate-in fade-in slide-in-from-top-1 duration-100"
              >
                <div className="px-3 py-1.5 bg-blue-50/80 flex items-center justify-between text-[10px] font-bold text-blue-700">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>
                      {isBn
                        ? 'সেভ করা প্রোডাক্ট (ট্যাপ করলে নাম ও দাম বসবে)'
                        : 'Saved Products (Tap to fill name & price)'}
                    </span>
                  </span>
                  <span>{matchingProducts.length}টি পাওয়া গেছে</span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-stone-100">
                  {matchingProducts.map((prod, idx) => {
                    const isHighlighted = idx === activeSuggestionIndex;
                    const hasStock = (prod.stock || 0) > 0;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectSuggestedProduct(prod, false)}
                        className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isHighlighted ? 'bg-blue-50/90' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                            {renderHighlightedName(prod.name, itemName)}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="font-mono font-extrabold text-blue-700">
                              {sym || 'Rs '}
                              {prod.price.toFixed(0)}
                            </span>
                            <span
                              className={`font-mono px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                hasStock
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-stone-100 text-stone-500'
                              }`}
                            >
                              {isBn ? 'স্টক:' : 'Stock:'} {prod.stock || 0} {prod.unit || 'Pcs'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestedProduct(prod, true);
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                            title={isBn ? 'সরাসরি বিলে যোগ করুন' : 'Directly add to bill'}
                          >
                            <Plus className="w-3 h-3 stroke-[3]" />
                            <span>{isBn ? 'বিলে যোগ' : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="w-1/2 relative">
              {sym ? (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                  {sym}
                </span>
              ) : null}
              <input
                ref={priceInputRef}
                type="number"
                id="itemPrice"
                min="0.01"
                step="any"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder={t.unitPrice}
                className={`w-full border border-stone-200 bg-stone-50/80 ${
                  sym ? (sym.length > 2 ? 'pl-11' : 'pl-8') : 'pl-3'
                } pr-8 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
              />
              <button
                type="button"
                onClick={() => {
                  setCalculatorTarget('item');
                  setIsCalculatorModalOpen(true);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-1 rounded-md transition-colors cursor-pointer"
                title={isBn ? 'ক্যালকুলেটর খুলুন' : 'Open Calculator'}
              >
                <Calculator className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-1/2">
              <input
                ref={qtyInputRef}
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
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t.addItemToBill}</span>
          </button>
        </form>
      </div>

      {/* 3. CURRENT BILL ITEMS LIST (SECTION 3) */}
      <div
        id="billing-items-list-section"
        className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden"
      >
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
          <div className="p-8 text-center text-stone-400 text-xs">{t.noItemsInBill}</div>
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
      <div
        id="billing-checkout-summary-section"
        className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200 space-y-4"
      >
        {/* 1. TOP: Discount Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.discountSection}</span>
            </label>

            {/* Mode Switcher: Fixed vs Percent % */}
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
                {sym ? `${t.discountFixedLabel} (${sym})` : t.discountFixedLabel}
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
              {discountType === 'percent' || sym ? (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-400">
                  {discountType === 'fixed' ? sym : '%'}
                </span>
              ) : null}
              <input
                type="number"
                min="0"
                max={discountType === 'percent' ? '100' : undefined}
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'fixed' ? '0.00' : '0'}
                className={`w-full border border-stone-200 bg-stone-50/80 ${
                  discountType === 'percent' || sym
                    ? discountType === 'fixed' && sym && sym.length > 2
                      ? 'pl-11'
                      : 'pl-8'
                    : 'pl-3'
                } pr-8 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
              />
              <button
                type="button"
                onClick={() => {
                  setCalculatorTarget('discount');
                  setIsCalculatorModalOpen(true);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-0.5 rounded cursor-pointer"
                title={isBn ? 'ক্যালকুলেটর দিয়ে ছাড় হিসাব করুন' : 'Calculate Discount'}
              >
                <Calculator className="w-3.5 h-3.5" />
              </button>
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
            <span className="text-[11px] text-stone-400 font-medium">
              {isBn ? 'দ্রুত:' : 'Quick:'}
            </span>
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
                    {sym}
                    {amt}
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
                {isBn ? 'সাশ্রয়' : 'Saves'} -{sym}
                {discountAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* 2. MIDDLE 1: Real-time Order Summary Breakdown */}
        <div className="bg-stone-50/90 border border-stone-200 p-3.5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>{t.subtotalText}</span>
            <span className="font-mono font-bold text-stone-900">
              {sym}
              {subtotal.toFixed(2)}
            </span>
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
            <span
              className={`font-mono font-bold ${
                discountAmount > 0 ? 'text-emerald-600' : 'text-stone-400'
              }`}
            >
              {discountAmount > 0 ? `-${sym}${discountAmount.toFixed(2)}` : `${sym}0.00`}
            </span>
          </div>

          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">{t.grandTotalText}</span>
              <span className="text-[11px] text-stone-500">{t.finalPayableSub}</span>
            </div>
            <div
              id="grandTotal"
              className="text-xl sm:text-2xl font-black text-green-700 font-mono"
            >
              {sym}
              {grandTotal.toFixed(2)}
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
                {t.exactBtn} ({sym}
                {grandTotal.toFixed(2)})
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="number"
              min="0"
              step="any"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
              className="w-full border border-stone-200 bg-stone-50/80 pl-3.5 pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <button
              type="button"
              onClick={() => {
                setCalculatorTarget('paid');
                setIsCalculatorModalOpen(true);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-1 rounded-md cursor-pointer transition-colors"
              title={isBn ? 'ক্যালকুলেটর দিয়ে ক্যাশ হিসাব করুন' : 'Calculate Cash'}
            >
              <Calculator className="w-4 h-4" />
            </button>
          </div>

          {paidNum > grandTotal && (
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between">
              <span>{t.changeToReturn}</span>
              <span className="font-mono text-sm">
                {sym}
                {changeAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* 4. BOTTOM: Payment Method Selection Buttons */}
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
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-white' : 'text-stone-500'
                    }`}
                  />
                  <span className="truncate">{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. VERY BOTTOM: Primary Action Button */}
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
              <span className="opacity-90 font-mono text-xs bg-white/20 px-2 py-0.5 rounded-md font-semibold">
                {invoiceNo || storageService.getNextInvoiceNumber()}
              </span>
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-stone-500 pt-0.5">
          {t.printTaxInvoiceSub}
        </p>
      </div>

      {/* KHATABOOK / VYAPAR ENTRY MODAL FOR BILLING WITH FULL 5-ROW CALCULATOR */}
      <KhatabookEntryModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        onSave={handleCalculatorSave}
        entryType={calculatorTarget === 'item' ? 'bill_item' : 'calculate_value'}
        initialAmount={
          calculatorTarget === 'item'
            ? parseFloat(itemPrice) || undefined
            : calculatorTarget === 'paid'
            ? parseFloat(paidAmount) || (grandTotal > 0 ? grandTotal : undefined)
            : parseFloat(discountValue) || undefined
        }
        initialDetails={calculatorTarget === 'item' ? itemName : ''}
        customSaveLabel={
          calculatorTarget === 'item'
            ? isBn
              ? 'বিলে আইটেম যোগ করুন'
              : 'ADD ITEM TO BILL'
            : calculatorTarget === 'paid'
            ? isBn
              ? 'প্রাপ্ত ক্যাশ বসান'
              : 'APPLY RECEIVED CASH'
            : isBn
            ? 'ডিসকাউন্ট বসান'
            : 'APPLY DISCOUNT'
        }
        settings={settings}
        language={language}
      />
    </div>
  );
};
