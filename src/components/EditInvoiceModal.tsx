import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Clock,
  ExternalLink,
  Tag,
  FileText,
  Building2,
  Scissors,
  Calendar,
  Ruler,
  User,
  Phone,
  BookUser,
  Sparkles,
  ChevronDown,
  Calculator,
  Pencil,
  Package,
  MessageCircle,
} from 'lucide-react';
import {
  BillInvoice,
  BillItem,
  PaymentMethod,
  ThermalPrinterSettings,
  Language,
  TailoringMeasurements,
  TailoringOrderStatus,
  ProductStockItem,
} from '../types';
import { translations } from '../utils/i18n';
import { storageService } from '../services/storageService';
import { sendWhatsAppBillForInvoice } from '../utils/whatsappHelper';
import { useBackHandler } from '../utils/useBackHandler';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';

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
  const isBn = language === 'bn';

  const hideCurrency =
    settings.hideCurrencySymbol ||
    settings.currencySymbol === '₹' ||
    !settings.currencySymbol;
  const sym = hideCurrency ? '' : settings.currencySymbol;
  const displaySym = sym || 'Rs.';

  const [isAllCaps] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('retail_billing_all_caps');
      if (saved !== null) return saved === 'true';
    } catch {}
    return settings.autoCapitalizeItemNames !== false;
  });

  // Core Invoice Form States
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    message: string;
    type: 'success' | 'warning';
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inline Editing State for Bill Items Table (Matches BillingTab)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('Pcs');
  const [editItemNoDiscount, setEditItemNoDiscount] = useState(false);
  const [editFocusField, setEditFocusField] = useState<'name' | 'qty' | 'price'>('name');

  // New Item Entry States (Matches BillingTab Section 3)
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('Pcs');
  const [newItemNoDiscount, setNewItemNoDiscount] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<string[]>(() =>
    storageService.getCustomUnits()
  );
  const [showUnitSelectorModal, setShowUnitSelectorModal] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');

  // Product Suggestions State (Synced with BillingTab setting)
  const [enableSavedSuggestions, setEnableSavedSuggestionsState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('thermal_pos_enable_product_suggestions');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const setEnableSavedSuggestions = (val: boolean | ((prev: boolean) => boolean)) => {
    setEnableSavedSuggestionsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('thermal_pos_enable_product_suggestions', String(next));
      } catch {}
      return next;
    });
  };
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  // Customer Contacts Modal
  const [showSavedCustomerModal, setShowSavedCustomerModal] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Calculator Modal
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [calculatorTarget, setCalculatorTarget] = useState<'item' | 'paid' | 'discount'>('item');

  // Tailoring Fields
  const [isTailoring, setIsTailoring] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [trialDate, setTrialDate] = useState('');
  const [tailoringStatus, setTailoringStatus] = useState<TailoringOrderStatus>('pending');
  const [measurements, setMeasurements] = useState<TailoringMeasurements>({
    garmentType: '',
    length: '',
    chest: '',
    waist: '',
    shoulder: '',
    sleeve: '',
    neck: '',
    hip: '',
    bottom: '',
    designNotes: '',
  });

  // GST Optional Fields
  const [isGstBill, setIsGstBill] = useState(false);
  const [customerGst, setCustomerGst] = useState('');
  const [gstRate, setGstRate] = useState(5);
  const [taxType, setTaxType] = useState<'intra' | 'inter'>('intra');
  const [isGstInclusive, setIsGstInclusive] = useState(true);
  const [showDiscountOnPrint, setShowDiscountOnPrint] = useState(true);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Back-button handling for sub-modals and main edit view
  useBackHandler(
    'editInvoiceDeleteConfirm',
    showDeleteConfirm,
    () => {
      setShowDeleteConfirm(false);
      return true;
    },
    60
  );
  useBackHandler(
    'editInvoiceCalculatorModal',
    isCalculatorModalOpen,
    () => {
      setIsCalculatorModalOpen(false);
      return true;
    },
    55
  );
  useBackHandler(
    'editInvoiceUnitModal',
    showUnitSelectorModal,
    () => {
      setShowUnitSelectorModal(false);
      return true;
    },
    52
  );
  useBackHandler(
    'editInvoiceContactModal',
    showSavedCustomerModal,
    () => {
      setShowSavedCustomerModal(false);
      return true;
    },
    51
  );
  useBackHandler(
    'editInvoiceScreen',
    Boolean(isOpen && bill),
    () => {
      onClose();
      return true;
    },
    45
  );

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

  // Sync state whenever active bill changes
  useEffect(() => {
    if (bill && isOpen) {
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
      setShowDiscountOnPrint(bill.showDiscountOnPrint !== false);
      const pm = bill.isEstimate ? 'estimate' : bill.paymentMethod || 'cash';
      setPaymentMethod(pm);

      if (pm === 'estimate') {
        setPaidAmount('');
      } else if (pm === 'due') {
        if (bill.paidAmount && bill.paidAmount > 0 && bill.paidAmount < bill.grandTotal) {
          setPaidAmount(bill.paidAmount.toString());
        } else {
          setPaidAmount('0');
        }
      } else {
        if (bill.paidAmount !== undefined && bill.paidAmount < bill.grandTotal) {
          setPaidAmount(bill.paidAmount.toString());
        } else if (bill.paidAmount !== undefined && bill.paidAmount > bill.grandTotal) {
          setPaidAmount(bill.paidAmount.toString());
        } else {
          setPaidAmount('');
        }
      }

      setIsTailoring(Boolean(bill.isTailoring));
      setDeliveryDate(bill.deliveryDate || '');
      setTrialDate(bill.trialDate || '');
      setTailoringStatus(bill.tailoringStatus || 'pending');
      setMeasurements({
        garmentType: bill.measurements?.garmentType || '',
        length: bill.measurements?.length || '',
        chest: bill.measurements?.chest || '',
        waist: bill.measurements?.waist || '',
        shoulder: bill.measurements?.shoulder || '',
        sleeve: bill.measurements?.sleeve || '',
        neck: bill.measurements?.neck || '',
        hip: bill.measurements?.hip || '',
        bottom: bill.measurements?.bottom || '',
        designNotes: bill.measurements?.designNotes || '',
      });
      setIsGstBill(Boolean(bill.isGstBill));
      setCustomerGst(bill.customerGst || '');
      setGstRate(bill.gstRate || settings.defaultGstRate || 5);
      setTaxType(bill.taxType || settings.defaultTaxType || 'intra');
      setIsGstInclusive(bill.isGstInclusive ?? (settings.defaultIsGstInclusive ?? true));

      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
      setNewItemUnit('Pcs');
      setNewItemNoDiscount(false);
      setEditingItemId(null);
      setValidationError(null);
      setStatusBanner(null);
      setShowDeleteConfirm(false);
      setAvailableUnits(storageService.getCustomUnits());
    }
  }, [bill, isOpen]);

  // Saved Products for Suggestions
  const allSavedProducts = useMemo(() => {
    if (!isOpen) return [];
    return storageService.getProducts();
  }, [isOpen]);

  const matchingProducts = useMemo(() => {
    const q = newItemName.trim().toLowerCase();
    if (!q) return allSavedProducts.slice(0, 8);

    const exactStartsWith: ProductStockItem[] = [];
    const wordStartsWith: ProductStockItem[] = [];
    const containsMatch: ProductStockItem[] = [];

    for (const prod of allSavedProducts) {
      const pName = prod.name.trim().toLowerCase();
      const pBarcode = (prod.barcode || '').trim().toLowerCase();
      if (pName.startsWith(q) || (pBarcode && pBarcode === q)) {
        exactStartsWith.push(prod);
      } else if (
        pName.split(/\s+/).some((w) => w.startsWith(q)) ||
        (pBarcode && pBarcode.startsWith(q))
      ) {
        wordStartsWith.push(prod);
      } else if (pName.includes(q) || (pBarcode && pBarcode.includes(q))) {
        containsMatch.push(prod);
      }
    }

    return [...exactStartsWith, ...wordStartsWith, ...containsMatch].slice(0, 8);
  }, [allSavedProducts, newItemName]);

  // Customer Contacts from Khata & Bills
  const savedCustomerContacts = useMemo(() => {
    const list: Array<{ name: string; phone: string; due?: number }> = [];
    const seen = new Set<string>();
    try {
      const dues = storageService.getCustomerDues();
      for (const d of dues) {
        const cleanName = d.name.trim();
        const cleanPhone = (d.phone || '').trim();
        const key = `${cleanName.toLowerCase()}_${cleanPhone}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ name: cleanName, phone: cleanPhone, due: d.dueAmount });
        }
      }
    } catch {}
    try {
      const allBills = storageService.getBills();
      for (const b of allBills) {
        if (b.customerName || b.customerPhone) {
          const cleanName = (b.customerName || '').trim();
          const cleanPhone = (b.customerPhone || '').trim();
          const key = `${cleanName.toLowerCase()}_${cleanPhone}`;
          if (cleanName && !seen.has(key)) {
            seen.add(key);
            list.push({ name: cleanName, phone: cleanPhone });
          }
        }
      }
    } catch {}
    return list;
  }, [showSavedCustomerModal]);

  const filteredCustomerContacts = useMemo(() => {
    const q = contactSearchQuery.trim().toLowerCase();
    if (!q) return savedCustomerContacts;
    return savedCustomerContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [savedCustomerContacts, contactSearchQuery]);

  // Previous Balance Lookup
  const showPreviousBalanceSetting = settings.showPreviousBalanceOnBill !== false;
  const customerOldBalance = useMemo(() => {
    if (!bill || !showPreviousBalanceSetting) return 0;
    const sameCustomer =
      (bill.customerName || '').trim().toLowerCase() === customerName.trim().toLowerCase() &&
      (bill.customerPhone || '').trim() === customerPhone.trim();
    if (sameCustomer) {
      return bill.previousBalance || 0;
    }
    const info = storageService.getCustomerPreviousBalance(customerName, customerPhone);
    return info.type === 'receivable' ? info.amount : 0;
  }, [bill, showPreviousBalanceSetting, customerName, customerPhone]);

  if (!isOpen || !bill) return null;

  const cleanExtractedPhone = (raw: string): string => {
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  };

  const handlePickContact = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts && contacts.length > 0) {
          const selected = contacts[0];
          const rawName = (selected.name?.[0] || selected.name || '').trim();
          const rawTel = (selected.tel?.[0] || selected.tel || '').trim();
          const finalPhone = cleanExtractedPhone(rawTel);
          if (rawName) setCustomerName(isAllCaps ? rawName.toUpperCase() : rawName);
          if (finalPhone) setCustomerPhone(finalPhone);
          setStatusBanner({
            type: 'success',
            message: isBn
              ? `✓ কন্টাক্ট থেকে কাস্টমার যুক্ত হয়েছে: ${rawName}`
              : `✓ Contact selected: ${rawName}`,
          });
          setTimeout(() => setStatusBanner(null), 3500);
          return;
        }
      } catch {}
    }
    setShowSavedCustomerModal(true);
  };

  const renderHighlightedName = (name: string, query: string) => {
    const q = query.trim();
    if (!q) return <span>{name}</span>;
    const lowerName = name.toLowerCase();
    const lowerQ = q.toLowerCase();
    const matchIdx = lowerName.indexOf(lowerQ);
    if (matchIdx === -1) return <span>{name}</span>;
    return (
      <span>
        {name.slice(0, matchIdx)}
        <span className="bg-blue-100 text-blue-800 font-black px-0.5 rounded">
          {name.slice(matchIdx, matchIdx + q.length)}
        </span>
        {name.slice(matchIdx + q.length)}
      </span>
    );
  };

  // Live Math Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.total || item.price * item.qty), 0);
  const eligibleSubtotal = items.reduce(
    (sum, item) => sum + (item.noDiscount ? 0 : item.total || item.price * item.qty),
    0
  );
  const rawDiscount = Math.max(0, parseFloat(discountValue) || 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    const clampedPercent = Math.min(100, rawDiscount);
    discountAmount = Math.round(((eligibleSubtotal * clampedPercent) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(eligibleSubtotal, rawDiscount);
  }
  const liveDiscountPercent =
    eligibleSubtotal > 0 ? Math.min(100, (discountAmount / eligibleSubtotal) * 100) : 0;

  const postDiscountTotal = Math.max(0, subtotal - discountAmount);
  let liveTaxable = 0;
  let liveTax = 0;
  let liveCgst = 0;
  let liveSgst = 0;
  let liveIgst = 0;
  let computedGrand = postDiscountTotal;

  if (isGstBill && postDiscountTotal > 0 && gstRate > 0) {
    if (isGstInclusive) {
      liveTaxable = Math.round((postDiscountTotal / (1 + gstRate / 100)) * 100) / 100;
      liveTax = Math.round((postDiscountTotal - liveTaxable) * 100) / 100;
      computedGrand = postDiscountTotal;
    } else {
      liveTaxable = postDiscountTotal;
      liveTax = Math.round(((liveTaxable * gstRate) / 100) * 100) / 100;
      computedGrand = Math.round((liveTaxable + liveTax) * 100) / 100;
    }

    if (taxType === 'intra') {
      liveCgst = Math.round((liveTax / 2) * 100) / 100;
      liveSgst = Math.round((liveTax - liveCgst) * 100) / 100;
    } else {
      liveIgst = liveTax;
    }
  } else if (isGstBill) {
    liveTaxable = postDiscountTotal;
  }

  const grandTotal = computedGrand;
  const rawPaidNum = parseFloat(paidAmount);
  const hasExplicitPaid = paidAmount.trim() !== '' && !isNaN(rawPaidNum);
  const effectivePaidNum =
    paymentMethod === 'estimate'
      ? 0
      : paymentMethod === 'due'
      ? hasExplicitPaid && rawPaidNum < grandTotal
        ? Math.max(0, rawPaidNum)
        : 0
      : hasExplicitPaid
      ? Math.max(0, rawPaidNum)
      : grandTotal;
  const paidNum = effectivePaidNum;
  const changeAmount =
    paymentMethod === 'estimate' || paymentMethod === 'due'
      ? 0
      : Math.max(0, paidNum - grandTotal);
  const dueAmount =
    paymentMethod === 'estimate'
      ? 0
      : paymentMethod === 'due'
      ? Math.max(0, grandTotal - paidNum)
      : hasExplicitPaid && paidNum < grandTotal
      ? Math.max(0, grandTotal - paidNum)
      : 0;

  // Inline Table Row Editing Handlers
  const handleStartEditItem = (item: BillItem, field: 'name' | 'qty' | 'price' = 'name') => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(String(item.price));
    setEditItemQty(String(item.qty));
    setEditItemUnit(item.unit || 'Pcs');
    setEditItemNoDiscount(Boolean(item.noDiscount));
    setEditFocusField(field);
  };

  const handleSaveEditItem = (id: string) => {
    const cleanName = editItemName.trim();
    const price = Math.max(0, parseFloat(editItemPrice) || 0);
    const qty = Math.max(0.01, parseFloat(editItemQty) || 1);
    const unit = editItemUnit.trim() || 'Pcs';

    if (!cleanName) {
      setValidationError(isBn ? 'পণ্যের নাম লিখুন' : 'Please enter item name');
      return;
    }

    setValidationError(null);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              name: isAllCaps ? cleanName.toUpperCase() : cleanName,
              price,
              qty,
              unit,
              noDiscount: editItemNoDiscount,
              total: Math.round(price * qty * 100) / 100,
            }
          : it
      )
    );
    setEditingItemId(null);
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
  };

  const handleUpdateQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      handleRemoveItem(id);
      return;
    }
    setValidationError(null);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, qty: nextQty, total: Math.round(it.price * nextQty * 100) / 100 }
          : it
      )
    );
  };

  const handleToggleItemNoDiscount = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, noDiscount: !it.noDiscount } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setValidationError(
        isBn
          ? 'ইনভয়েসে অন্তত একটি পণ্য থাকতে হবে।'
          : 'Invoice must have at least one item.'
      );
      return;
    }
    setValidationError(null);
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingItemId === id) setEditingItemId(null);
  };

  // New Item Entry Handlers
  const handleSelectSuggestedProduct = (prod: ProductStockItem, autoAdd = false) => {
    setShowSuggestions(false);
    const formattedName = isAllCaps ? prod.name.toUpperCase() : prod.name;
    const prodUnit = prod.unit || 'Pcs';

    if (autoAdd && prod.price > 0) {
      const qty = Math.max(0.01, parseFloat(newItemQty) || 1);
      const newItem: BillItem = {
        id: 'item-edit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: formattedName,
        price: prod.price,
        qty,
        unit: prodUnit,
        total: Math.round(prod.price * qty * 100) / 100,
        barcode: prod.barcode,
        productId: prod.id,
        noDiscount: prod.noDiscount || newItemNoDiscount,
      };
      setItems((prev) => [...prev, newItem]);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
      setNewItemNoDiscount(false);
      setValidationError(null);
      return;
    }

    setNewItemName(formattedName);
    setNewItemPrice(prod.price > 0 ? String(prod.price) : '');
    setNewItemUnit(prodUnit);
    if (prod.noDiscount) setNewItemNoDiscount(true);
    setTimeout(() => {
      priceInputRef.current?.focus();
    }, 30);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!enableSavedSuggestions || !showSuggestions || matchingProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % matchingProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(
        (prev) => (prev - 1 + matchingProducts.length) % matchingProducts.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = matchingProducts[activeSuggestionIndex] || matchingProducts[0];
      if (chosen) handleSelectSuggestedProduct(chosen, false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleAddNewItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawName = newItemName.trim();
    const name = isAllCaps ? rawName.toUpperCase() : rawName;
    const price = parseFloat(newItemPrice);
    const qty = Math.max(0.01, parseFloat(newItemQty) || 1);
    const unit = newItemUnit.trim() || 'Pcs';

    if (!name || isNaN(price) || price <= 0) {
      setValidationError(
        isBn ? 'সঠিক পণ্যের নাম ও দর লিখুন' : 'Please enter valid item name and price'
      );
      return;
    }

    setValidationError(null);
    const newItem: BillItem = {
      id: 'item-edit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name,
      price,
      qty,
      unit,
      noDiscount: newItemNoDiscount,
      total: Math.round(price * qty * 100) / 100,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty('1');
    setNewItemNoDiscount(false);
    setShowSuggestions(false);
    nameInputRef.current?.focus();
  };

  // Custom Units Handlers
  const handleAddNewUnit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newUnitInput.trim();
    if (!clean) return;
    const updated = storageService.addCustomUnit(clean);
    setAvailableUnits(updated);
    setNewItemUnit(clean);
    setNewUnitInput('');
    setShowUnitSelectorModal(false);
    priceInputRef.current?.focus();
  };

  const handleDeleteUnit = (u: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = storageService.deleteCustomUnit(u);
    setAvailableUnits(updated);
    if (newItemUnit.toLowerCase() === u.toLowerCase()) {
      setNewItemUnit(updated[0] || 'Pcs');
    }
  };

  // Calculator Callback
  const handleCalculatorSave = (payload: KhatabookEntryPayload) => {
    if (calculatorTarget === 'item') {
      if (payload.amount > 0) {
        if (payload.details && !newItemName.trim()) {
          setNewItemName(
            isAllCaps ? payload.details.toUpperCase() : payload.details
          );
        }
        setNewItemPrice(String(payload.amount));
      }
    } else if (calculatorTarget === 'paid') {
      if (payload.amount >= 0) {
        setPaidAmount(String(payload.amount));
      }
    } else if (calculatorTarget === 'discount') {
      if (payload.amount >= 0) {
        setDiscountValue(String(payload.amount));
      }
    }
    setIsCalculatorModalOpen(false);
  };

  // Payment Method Selector Handler
  const handleSelectPaymentMethod = (nextMethod: PaymentMethod) => {
    setPaymentMethod(nextMethod);
    if (nextMethod === 'estimate') {
      setPaidAmount('');
    } else if (nextMethod === 'due') {
      const currentPaid = parseFloat(paidAmount) || 0;
      if (currentPaid >= grandTotal || paymentMethod !== 'due') {
        setPaidAmount('0');
      }
    } else {
      if (paymentMethod === 'due' || paymentMethod === 'estimate') {
        setPaidAmount('');
      }
    }
  };

  // Build Final Bill Object (auto-commits any active inline edit row first)
  const buildFinalUpdatedBill = (): BillInvoice | null => {
    let finalItems = items;
    if (editingItemId) {
      const cleanName = editItemName.trim();
      const price = Math.max(0, parseFloat(editItemPrice) || 0);
      const qty = Math.max(0.01, parseFloat(editItemQty) || 1);
      const unit = editItemUnit.trim() || 'Pcs';
      if (cleanName) {
        finalItems = items.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                name: isAllCaps ? cleanName.toUpperCase() : cleanName,
                price,
                qty,
                unit,
                noDiscount: editItemNoDiscount,
                total: Math.round(price * qty * 100) / 100,
              }
            : it
        );
      }
    }

    if (finalItems.length === 0) {
      setValidationError(
        isBn
          ? 'ইনভয়েসে অন্তত একটি পণ্য থাকতে হবে।'
          : 'Invoice must have at least one item.'
      );
      return null;
    }

    const finalSubtotal = finalItems.reduce(
      (sum, it) => sum + (it.total || it.price * it.qty),
      0
    );
    const finalEligibleSubtotal = finalItems.reduce(
      (sum, it) => sum + (it.noDiscount ? 0 : it.total || it.price * it.qty),
      0
    );

    let finalDiscountAmount = 0;
    if (discountType === 'percent') {
      const clampedPercent = Math.min(100, rawDiscount);
      finalDiscountAmount =
        Math.round(((finalEligibleSubtotal * clampedPercent) / 100) * 100) / 100;
    } else {
      finalDiscountAmount = Math.min(finalEligibleSubtotal, rawDiscount);
    }

    const finalPostDiscount = Math.max(0, finalSubtotal - finalDiscountAmount);
    let finalTaxable = 0;
    let finalTax = 0;
    let finalCgst = 0;
    let finalSgst = 0;
    let finalIgst = 0;
    let finalGrand = finalPostDiscount;

    if (isGstBill && finalPostDiscount > 0 && gstRate > 0) {
      if (isGstInclusive) {
        finalTaxable = Math.round((finalPostDiscount / (1 + gstRate / 100)) * 100) / 100;
        finalTax = Math.round((finalPostDiscount - finalTaxable) * 100) / 100;
        finalGrand = finalPostDiscount;
      } else {
        finalTaxable = finalPostDiscount;
        finalTax = Math.round(((finalTaxable * gstRate) / 100) * 100) / 100;
        finalGrand = Math.round((finalTaxable + finalTax) * 100) / 100;
      }
      if (taxType === 'intra') {
        finalCgst = Math.round((finalTax / 2) * 100) / 100;
        finalSgst = Math.round((finalTax - finalCgst) * 100) / 100;
      } else {
        finalIgst = finalTax;
      }
    } else if (isGstBill) {
      finalTaxable = finalPostDiscount;
    }

    const isEst = paymentMethod === 'estimate';
    const computedPaidNum =
      isEst
        ? 0
        : paymentMethod === 'due'
        ? hasExplicitPaid && rawPaidNum < finalGrand
          ? Math.max(0, rawPaidNum)
          : 0
        : hasExplicitPaid
        ? Math.max(0, rawPaidNum)
        : finalGrand;

    const finalPaid = isEst
      ? 0
      : paymentMethod === 'due'
      ? Math.min(finalGrand, Math.max(0, computedPaidNum))
      : hasExplicitPaid && computedPaidNum < finalGrand
      ? Math.max(0, computedPaidNum)
      : finalGrand;
    const finalChange =
      isEst || paymentMethod === 'due'
        ? 0
        : Math.max(0, computedPaidNum - finalGrand);
    const finalBalance = isEst
      ? 0
      : Math.max(0, Math.round((finalGrand - finalPaid) * 100) / 100);
    const finalPaymentMethod: PaymentMethod = isEst
      ? 'estimate'
      : paymentMethod === 'due' || finalBalance > 0
      ? 'due'
      : paymentMethod;

    let paymentStatus: 'PAID' | 'DUE' | 'PARTIAL' | 'ESTIMATE' = 'PAID';
    if (finalPaymentMethod === 'estimate') {
      paymentStatus = 'ESTIMATE';
    } else if (finalPaymentMethod === 'due' || finalBalance > 0) {
      paymentStatus = finalPaid > 0 && finalBalance > 0 ? 'PARTIAL' : 'DUE';
    } else {
      paymentStatus = 'PAID';
    }

    const hasMeasurements = Object.values(measurements).some((v) =>
      Boolean(v && String(v).trim())
    );

    return {
      ...bill,
      invoiceNo: invoiceNo.trim() || bill.invoiceNo,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: finalItems,
      subtotal: finalSubtotal,
      discount: finalDiscountAmount,
      discountType,
      discountValue: rawDiscount,
      showDiscountOnPrint,
      discountPrintMode: showDiscountOnPrint ? 'item_discount' : 'standard_discount',
      grandTotal: finalGrand,
      paymentMethod: finalPaymentMethod,
      paymentStatus,
      paidAmount: isEst ? 0 : finalPaid,
      changeAmount: isEst || finalPaymentMethod === 'due' ? 0 : finalChange,
      balance: isEst ? 0 : finalBalance,
      previousBalance: customerOldBalance,
      currentBalance: isEst ? customerOldBalance : customerOldBalance + finalBalance,
      isEstimate: isEst,
      isGstBill: Boolean(isGstBill),
      ...(isGstBill
        ? {
            customerGst: customerGst.trim().toUpperCase() || undefined,
            gstRate,
            taxType,
            isGstInclusive,
            taxableAmount: finalTaxable,
            cgstAmount: finalCgst,
            sgstAmount: finalSgst,
            igstAmount: finalIgst,
            totalTaxAmount: finalTax,
          }
        : {
            customerGst: undefined,
            gstRate: undefined,
            taxType: undefined,
            isGstInclusive: undefined,
            taxableAmount: undefined,
            cgstAmount: undefined,
            sgstAmount: undefined,
            igstAmount: undefined,
            totalTaxAmount: undefined,
          }),
      isTailoring,
      deliveryDate:
        isTailoring && deliveryDate.trim() ? deliveryDate.trim() : undefined,
      trialDate:
        isTailoring && trialDate.trim() ? trialDate.trim() : undefined,
      tailoringStatus: isTailoring ? tailoringStatus : undefined,
      measurements:
        isTailoring && hasMeasurements ? { ...measurements } : undefined,
    };
  };

  const handleSave = (e?: React.FormEvent, sendWhatsApp = false) => {
    if (e) e.preventDefault();
    const updatedBill = buildFinalUpdatedBill();
    if (!updatedBill) return;
    setValidationError(null);
    onSave(updatedBill);
    if (sendWhatsApp) {
      sendWhatsAppBillForInvoice(updatedBill, settings);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f5f5f5] overflow-hidden animate-in fade-in duration-150">
      {/* COMPACT STICKY TOP BAR (Matches App's Clean Mobile Header) */}
      <header className="bg-white border-b border-stone-200 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={isBn ? 'ফিরে যান' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-stone-900 truncate">
                {t.editInvoiceModalTitle}
              </h2>
              <span className="font-mono text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg shrink-0">
                #{invoiceNo || bill.invoiceNo}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-mono truncate">
              {bill.date}
              {bill.time ? ` • ${bill.time}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onLoadInBilling && (
            <button
              type="button"
              onClick={() => {
                onLoadInBilling(bill);
                onClose();
              }}
              className="h-9 px-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title={
                isBn
                  ? 'এই ইনভয়েসের আইটেমগুলো নিয়ে বিলিং স্ক্রিনে যান'
                  : 'Load items into billing counter'
              }
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">{t.loadInBillingBtn}</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 sm:w-auto sm:px-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title={isBn ? 'এই ইনভয়েস মুছে ফেলুন' : 'Delete invoice'}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">{isBn ? 'মুছুন' : 'Delete'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave(undefined, false)}
            className="h-9 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isBn ? 'সেভ' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-rose-800 text-xs font-bold flex items-center justify-between animate-in fade-in shrink-0">
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

      {/* MAIN SCROLLABLE BILLING-STYLE CANVAS */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 pb-24">
          {/* 1. CUSTOMER DETAILS & MODE TOGGLES CARD (Matches BillingTab Section 1) */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-stone-200">
            {/* Top 4-Column Bar: Estimate/Bill | GST | Tailoring | #InvoiceNo */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-2.5 w-full">
              {/* 1. ESTIMATE / BILL TOGGLE */}
              <button
                type="button"
                onClick={() =>
                  handleSelectPaymentMethod(
                    paymentMethod === 'estimate' ? 'cash' : 'estimate'
                  )
                }
                className={`min-w-0 h-8 sm:h-9 px-1 sm:px-2 rounded-lg text-[10px] sm:text-xs font-bold border transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs ${
                  paymentMethod === 'estimate'
                    ? 'bg-blue-600 text-white border-blue-600 ring-1 ring-blue-300 shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                }`}
              >
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">
                  {paymentMethod === 'estimate'
                    ? isBn
                      ? 'এস্টিমেট'
                      : 'Estimate'
                    : isBn
                    ? 'বিল'
                    : 'Bill'}
                </span>
              </button>

              {/* 2. GST BILL TOGGLE */}
              <button
                type="button"
                onClick={() => setIsGstBill((prev) => !prev)}
                className={`min-w-0 h-8 sm:h-9 px-1 sm:px-2 rounded-lg text-[10px] sm:text-xs font-bold border transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs ${
                  isGstBill
                    ? 'bg-emerald-600 text-white border-emerald-600 ring-1 ring-emerald-300 shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                }`}
              >
                <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">
                  {isGstBill
                    ? isBn
                      ? 'GST চালু'
                      : 'GST (ON)'
                    : isBn
                    ? 'GST বিল'
                    : 'GST Bill'}
                </span>
              </button>

              {/* 3. TAILORING INVOICE TOGGLE */}
              <button
                type="button"
                onClick={() => setIsTailoring((prev) => !prev)}
                className={`min-w-0 h-8 sm:h-9 px-1 sm:px-2 rounded-lg text-[10px] sm:text-xs font-bold border transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs ${
                  isTailoring
                    ? 'bg-purple-600 text-white border-purple-600 ring-1 ring-purple-300 shadow-xs'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                }`}
              >
                <Scissors className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">
                  {isBn ? 'টেইলারিং' : 'Tlr Invoice'}
                </span>
              </button>

              {/* 4. INVOICE NUMBER BADGE */}
              <div className="min-w-0 h-8 sm:h-9 px-1 sm:px-2 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 shadow-2xs flex items-center justify-center gap-1 text-center">
                <span className="truncate font-semibold">
                  #{invoiceNo || bill.invoiceNo}
                </span>
              </div>
            </div>

            {/* Customer Name + Contacts & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={customerName}
                    autoCapitalize={isAllCaps ? 'characters' : 'words'}
                    style={{ textTransform: isAllCaps ? 'uppercase' : 'none' }}
                    onChange={(e) =>
                      setCustomerName(
                        isAllCaps ? e.target.value.toUpperCase() : e.target.value
                      )
                    }
                    placeholder={t.customerNameOptionalPlaceholder}
                    className="w-full border border-stone-200 bg-stone-50/80 pl-9 pr-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePickContact}
                  className="px-2.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 border border-blue-200 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                  title={
                    isBn
                      ? 'মোবাইলের কন্টাক্ট বা খাতা থেকে কাস্টমার বাছুন'
                      : 'Pick customer from contacts or saved accounts'
                  }
                >
                  <BookUser className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? 'কন্টাক্ট' : 'Contacts'}</span>
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.customerPhoneOptionalPlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 pl-9 pr-3 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {statusBanner && (
              <div
                className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
                  statusBanner.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                <span className="truncate">{statusBanner.message}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Live Previous Balance Banner */}
            {customerOldBalance > 0 && (
              <div className="mt-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs animate-in fade-in">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>
                    {isBn
                      ? 'কাস্টমারের পুরানা ব্যালেন্স (Previous Balance):'
                      : 'Customer Previous Balance:'}
                  </span>
                </span>
                <span className="font-mono font-black text-rose-600 text-sm shrink-0">
                  {sym}
                  {customerOldBalance.toFixed(2)}
                </span>
              </div>
            )}

            {/* OPTIONAL GST DETAILS (Shown only when GST Bill is ON) */}
            {isGstBill && (
              <div className="mt-2.5 p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      {isBn
                        ? '🏛️ জিএসটি ইনভয়েস সেটিংস (ঐচ্ছিক)'
                        : '🏛️ GST Invoice Details (Optional)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGstBill(false)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    {isBn ? '✕ GST বন্ধ করুন' : '✕ Turn Off GST'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                      {isBn
                        ? 'কাস্টমারের GSTIN নম্বর (ঐচ্ছিক)'
                        : 'Customer GSTIN (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={customerGst}
                      onChange={(e) =>
                        setCustomerGst(e.target.value.toUpperCase())
                      }
                      placeholder="e.g. 19ABCDE1234F1Z5"
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-stone-300 bg-white px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                      {isBn ? 'দোকানের GSTIN' : 'Shop GSTIN'}
                    </label>
                    <div className="bg-white border border-stone-300 px-2.5 py-1.5 rounded-lg font-mono font-bold text-stone-800 text-xs truncate">
                      {settings.storeGstin?.trim() ||
                        (isBn
                          ? '(দোকান সেটিংস থেকে GSTIN দিতে পারেন)'
                          : '(Set in Shop Settings)')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="block text-[11px] font-bold text-stone-700 mb-1">
                      {isBn ? 'GST ট্যাক্স রেট:' : 'GST Rate:'}{' '}
                      <strong className="text-emerald-700 font-mono">
                        {gstRate}%
                      </strong>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {[0, 5, 12, 18, 28].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setGstRate(rate)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                            gstRate === rate
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-stone-700 mb-1">
                      {isBn ? 'ট্যাক্স ধরন ও হিসাব:' : 'Tax Type & Calculation:'}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setTaxType('intra')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                          taxType === 'intra'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {isBn ? 'রাজ্যীয় (CGST+SGST)' : 'Intra (CGST+SGST)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxType('inter')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                          taxType === 'inter'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {isBn ? 'আন্তঃরাজ্য (IGST)' : 'Inter (IGST)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsGstInclusive((prev) => !prev)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                          isGstInclusive
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isGstInclusive
                          ? isBn
                            ? 'ইনক্লুসিভ (Inclusive)'
                            : 'Inclusive'
                          : isBn
                          ? '+এক্সক্লুসিভ (+Exclusive)'
                          : '+Exclusive'}
                      </button>
                    </div>
                  </div>
                </div>

                {liveTax > 0 && (
                  <div className="p-2 rounded-lg bg-white border border-emerald-200 flex items-center justify-between text-[11px] font-mono font-bold text-stone-800 flex-wrap gap-1">
                    <span>
                      Taxable: {sym}
                      {liveTaxable.toFixed(2)}
                    </span>
                    {taxType === 'intra' ? (
                      <>
                        <span className="text-emerald-700">
                          CGST ({(gstRate / 2).toFixed(1)}%): {sym}
                          {liveCgst.toFixed(2)}
                        </span>
                        <span className="text-emerald-700">
                          SGST ({(gstRate / 2).toFixed(1)}%): {sym}
                          {liveSgst.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-emerald-700">
                        IGST ({gstRate}%): {sym}
                        {liveIgst.toFixed(2)}
                      </span>
                    )}
                    <span className="text-stone-900 font-black">
                      Total GST: {sym}
                      {liveTax.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* CONDITIONAL TAILORING ORDER & MEASUREMENTS (Shown only when Tailoring is ON) */}
            {isTailoring && (
              <div className="mt-3 pt-3 border-t border-purple-200/80 bg-purple-50/50 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 p-3 sm:p-4 rounded-b-2xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-purple-950 font-black text-xs sm:text-sm">
                    <Scissors className="w-4 h-4 text-purple-600" />
                    <span>
                      {isBn
                        ? 'টেইলারিং অর্ডার ও শরীরের মাপ'
                        : 'Tailoring Order & Measurements'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-purple-200">
                    {(
                      [
                        { id: 'pending', bn: '🧵 সেলাই চলছে', en: '🧵 Stitching' },
                        { id: 'ready', bn: '✅ তৈরি', en: '✅ Ready' },
                        { id: 'delivered', bn: '📦 ডেলিভারি', en: '📦 Delivered' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setTailoringStatus(st.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          tailoringStatus === st.id
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-stone-600 hover:bg-purple-50'
                        }`}
                      >
                        {isBn ? st.bn : st.en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        {isBn ? 'ডেলিভারির তারিখ (Delivery Date)' : 'Delivery Date'}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>
                        {isBn ? 'ট্রায়াল তারিখ (ঐচ্ছিক)' : 'Trial Date (Optional)'}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={trialDate}
                      onChange={(e) => setTrialDate(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Quick Garment Presets */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-purple-900 block">
                    {isBn ? 'পোশাকের ধরন:' : 'Garment Type:'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { labelBn: '👔 শার্ট', labelEn: 'Shirt', type: 'Shirt' },
                      { labelBn: '👖 প্যান্ট', labelEn: 'Pant', type: 'Pant' },
                      { labelBn: '🧥 পাঞ্জাবি', labelEn: 'Panjabi', type: 'Panjabi' },
                      { labelBn: '🤵 স্যুট', labelEn: 'Suit/Blazer', type: 'Suit/Blazer' },
                      { labelBn: '👗 সালোয়ার কামিজ', labelEn: 'Salwar Kameez', type: 'Salwar Kameez' },
                      { labelBn: '👚 ব্লাউজ', labelEn: 'Blouse', type: 'Blouse' },
                      { labelBn: '🧕 বোরকা', labelEn: 'Burqa', type: 'Burqa' },
                      { labelBn: '🧵 অল্টার', labelEn: 'Alteration', type: 'Alteration' },
                    ].map((g) => {
                      const active = measurements.garmentType === g.type;
                      return (
                        <button
                          key={g.type}
                          type="button"
                          onClick={() =>
                            setMeasurements((prev) => ({
                              ...prev,
                              garmentType: g.type,
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-white hover:bg-purple-100/70 text-stone-800 border-purple-200'
                          }`}
                        >
                          {isBn ? g.labelBn : g.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Body Measurements Grid */}
                <div className="bg-white p-3 rounded-xl border border-purple-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-purple-950 flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        {isBn
                          ? 'শরীরের মাপ (ইঞ্চিতে - ঐচ্ছিক):'
                          : 'Body Measurements (Inches):'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMeasurements({
                          garmentType: measurements.garmentType,
                          length: '',
                          chest: '',
                          waist: '',
                          shoulder: '',
                          sleeve: '',
                          neck: '',
                          hip: '',
                          bottom: '',
                          designNotes: '',
                        })
                      }
                      className="text-[10px] font-bold text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      {isBn ? 'মাপ মুছুন' : 'Clear'}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'length', labelBn: 'লম্বা', labelEn: 'Length', ph: '40"' },
                      { key: 'chest', labelBn: 'বুক', labelEn: 'Chest', ph: '38"' },
                      { key: 'waist', labelBn: 'কোমর', labelEn: 'Waist', ph: '34"' },
                      { key: 'shoulder', labelBn: 'পুট/কাঁধ', labelEn: 'Shoulder', ph: '17.5"' },
                      { key: 'sleeve', labelBn: 'হাতা', labelEn: 'Sleeve', ph: '24"' },
                      { key: 'neck', labelBn: 'গলা/কলার', labelEn: 'Neck', ph: '15.5"' },
                      { key: 'hip', labelBn: 'হিপ', labelEn: 'Hip', ph: '40"' },
                      { key: 'bottom', labelBn: 'মুহুরি', labelEn: 'Bottom', ph: '14"' },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-[10px] font-bold text-stone-600 truncate mb-0.5">
                          {isBn ? field.labelBn : field.labelEn}
                        </label>
                        <input
                          type="text"
                          value={(measurements as any)[field.key] || ''}
                          onChange={(e) =>
                            setMeasurements((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={field.ph}
                          className="w-full bg-stone-50 focus:bg-white border border-stone-200 focus:border-purple-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={measurements.designNotes || ''}
                    onChange={(e) =>
                      setMeasurements((prev) => ({
                        ...prev,
                        designNotes: e.target.value,
                      }))
                    }
                    placeholder={
                      isBn
                        ? 'ডিজাইন বা সেলাইয়ের বিশেষ নির্দেশনা...'
                        : 'Design / Stitching instructions...'
                    }
                    className="w-full bg-stone-50 focus:bg-white border border-stone-200 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. CURRENT BILL ITEMS TABLE (Matches BillingTab Section 2) */}
          <div className="bg-white rounded-2xl shadow-xs border border-blue-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-stone-200 bg-blue-50/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-800">
                  {t.currentBillItems}
                </span>
                <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
                <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg tabular-nums">
                  {isBn ? 'মোট:' : 'Total:'} {sym}
                  {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSave(undefined, true)}
                  className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white"
                  title={
                    isBn
                      ? 'আপডেট সেভ করে হোয়াটসঅ্যাপে পাঠান'
                      : 'Save & Send WhatsApp'
                  }
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(undefined, false)}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span className="whitespace-nowrap">
                    {isBn ? 'বিল সেভ' : 'Save Bill'}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-stone-50/90 text-stone-500 text-[10.5px] sm:text-xs uppercase tracking-wider font-bold border-b border-stone-200 select-none">
                    <th className="text-left p-2 sm:p-2.5">ITEM</th>
                    <th className="text-center p-2 sm:p-2.5 w-24 sm:w-28">QTY</th>
                    <th className="text-right p-2 sm:p-2.5">UNIT PRICE</th>
                    <th className="text-right p-2 sm:p-2.5">TOTAL</th>
                    <th className="sticky right-0 bg-stone-50/95 text-right p-1.5 sm:p-2 w-20 sm:w-24 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const liveEditPrice = parseFloat(editItemPrice) || 0;
                    const liveEditQty = Math.max(
                      0.01,
                      parseFloat(editItemQty) || 1
                    );
                    const liveEditTotal =
                      Math.round(liveEditPrice * liveEditQty * 100) / 100;

                    if (isEditing) {
                      return (
                        <tr
                          key={item.id}
                          className="bg-emerald-50/50 border-b border-stone-200 transition-colors"
                        >
                          <td className="p-2 sm:p-2.5">
                            <input
                              type="text"
                              autoFocus={editFocusField === 'name'}
                              value={editItemName}
                              autoCapitalize={isAllCaps ? 'characters' : 'sentences'}
                              style={{
                                textTransform: isAllCaps ? 'uppercase' : 'none',
                              }}
                              onChange={(e) =>
                                setEditItemName(
                                  isAllCaps
                                    ? e.target.value.toUpperCase()
                                    : e.target.value
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditItem(item.id);
                                if (e.key === 'Escape') handleCancelEditItem();
                              }}
                              placeholder={isBn ? 'পণ্যের নাম' : 'Item Name'}
                              className="w-full min-w-[75px] bg-white border border-[#0A8057] rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0A8057]"
                            />
                            <label className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-stone-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={editItemNoDiscount}
                                onChange={(e) =>
                                  setEditItemNoDiscount(e.target.checked)
                                }
                                className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                              />
                              <span
                                className={
                                  editItemNoDiscount
                                    ? 'text-rose-700 font-extrabold'
                                    : 'text-stone-500'
                                }
                              >
                                {isBn
                                  ? '🚫 ছাড় হবে না (No Disc)'
                                  : '🚫 No Discount'}
                              </span>
                            </label>
                          </td>
                          <td className="p-2 sm:p-2.5 text-center">
                            <div className="inline-flex items-center gap-1 justify-center">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                autoFocus={editFocusField === 'qty'}
                                value={editItemQty}
                                onChange={(e) => setEditItemQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditItem(item.id);
                                  if (e.key === 'Escape') handleCancelEditItem();
                                }}
                                placeholder="1"
                                className="w-12 bg-white border border-[#0A8057] rounded-lg px-1 py-1.5 text-xs sm:text-sm font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0A8057]"
                              />
                              <select
                                value={editItemUnit || 'Pcs'}
                                onChange={(e) => setEditItemUnit(e.target.value)}
                                className="w-14 bg-white border border-[#0A8057] rounded-lg px-0.5 py-1.5 text-xs font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0A8057] cursor-pointer"
                              >
                                {availableUnits.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="p-2 sm:p-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              autoFocus={editFocusField === 'price'}
                              value={editItemPrice}
                              onChange={(e) => setEditItemPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditItem(item.id);
                                if (e.key === 'Escape') handleCancelEditItem();
                              }}
                              placeholder="0.00"
                              className="w-20 bg-white border border-[#0A8057] rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold text-right text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0A8057] ml-auto block"
                            />
                          </td>
                          <td className="p-2 sm:p-2.5 text-right font-bold text-stone-900 whitespace-nowrap text-xs sm:text-sm font-mono tabular-nums">
                            {displaySym}
                            {liveEditTotal.toFixed(2)}
                          </td>
                          <td className="sticky right-0 bg-emerald-50/95 z-10 p-1.5 sm:p-2 text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            <div className="inline-flex items-center justify-end gap-1 sm:gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEditItem(item.id)}
                                className="px-2 py-1 rounded-md bg-[#0A8057] hover:bg-[#086a48] active:scale-95 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer whitespace-nowrap leading-none"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditItem}
                                className="p-1 sm:p-1.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={item.id}
                        className="group hover:bg-stone-50/80 border-b border-stone-100 transition-colors"
                      >
                        {/* 1. ITEM */}
                        <td className="p-2 sm:p-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                onClick={() => handleStartEditItem(item, 'name')}
                                className="font-bold text-xs sm:text-sm text-stone-900 tracking-wide uppercase cursor-pointer hover:text-[#0A8057] transition-colors"
                                title={
                                  isBn
                                    ? 'নাম এডিট করতে ট্যাপ করুন'
                                    : 'Tap to edit item name'
                                }
                              >
                                {item.name}
                              </span>
                              {item.noDiscount ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleItemNoDiscount(item.id)}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-all leading-none"
                                >
                                  🚫 {isBn ? 'ছাড় নেই' : 'No Disc'}
                                </button>
                              ) : discountAmount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleItemNoDiscount(item.id)}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-medium text-stone-400 hover:text-stone-700 hover:bg-stone-100 px-1 py-0.5 rounded cursor-pointer transition-colors leading-none"
                                >
                                  🚫 {isBn ? 'ছাড় বন্ধ?' : 'No disc?'}
                                </button>
                              ) : null}
                            </div>
                            {item.unit && item.unit !== 'Pcs' && (
                              <span className="text-[10px] text-stone-500 font-medium">
                                ({item.unit})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. QTY STEPPER (Green Circular Steppers Matching BillingTab) */}
                        <td className="p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#E2F4EB] hover:bg-[#cdecdb] active:scale-90 text-[#0A8057] font-bold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer select-none"
                              title={isBn ? 'একটি কমান' : 'Decrease'}
                            >
                              −
                            </button>
                            <span
                              onClick={() => handleStartEditItem(item, 'qty')}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0A8057] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-2xs cursor-pointer select-none font-mono tabular-nums"
                              title={
                                isBn
                                  ? 'সংখ্যা এডিট করতে ট্যাপ করুন'
                                  : 'Tap to edit quantity'
                              }
                            >
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#E2F4EB] hover:bg-[#cdecdb] active:scale-90 text-[#0A8057] font-bold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer select-none"
                              title={isBn ? 'একটি বাড়ান' : 'Increase'}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* 3. UNIT PRICE */}
                        <td className="p-2 sm:p-2.5 text-right font-mono tabular-nums">
                          <div className="flex flex-col items-end">
                            {!item.noDiscount &&
                            discountAmount > 0 &&
                            liveDiscountPercent > 0 ? (
                              <>
                                <span
                                  onClick={() =>
                                    handleStartEditItem(item, 'price')
                                  }
                                  className="font-bold text-xs sm:text-sm text-stone-900 cursor-pointer hover:text-[#0A8057] transition-colors"
                                >
                                  {(
                                    item.price *
                                    (1 -
                                      (eligibleSubtotal > 0
                                        ? discountAmount / eligibleSubtotal
                                        : 0))
                                  ).toFixed(2)}
                                </span>
                                <span className="line-through text-stone-400 text-[11px] leading-tight">
                                  {item.price.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span
                                onClick={() => handleStartEditItem(item, 'price')}
                                className="font-medium text-xs sm:text-sm text-stone-800 cursor-pointer hover:text-[#0A8057] transition-colors"
                              >
                                {item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. TOTAL */}
                        <td className="p-2 sm:p-2.5 text-right font-medium text-xs sm:text-sm text-stone-900 whitespace-nowrap font-mono tabular-nums">
                          {!item.noDiscount &&
                          discountAmount > 0 &&
                          liveDiscountPercent > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-stone-900">
                                {displaySym}
                                {(
                                  (item.total || item.price * item.qty) *
                                  (1 -
                                    (eligibleSubtotal > 0
                                      ? discountAmount / eligibleSubtotal
                                      : 0))
                                ).toFixed(2)}
                              </span>
                              <span className="line-through text-stone-400 text-[11px] leading-tight">
                                {displaySym}
                                {(item.total || item.price * item.qty).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            `${displaySym}${(item.total || item.price * item.qty).toFixed(2)}`
                          )}
                        </td>

                        {/* 5. ACTIONS: Edit Pen & Remove */}
                        <td className="sticky right-0 bg-white group-hover:bg-stone-50/80 z-10 p-1.5 sm:p-2 text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          <div className="inline-flex items-center justify-end gap-1 sm:gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item, 'name')}
                              className="p-1.5 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200/80 active:scale-95 transition-all cursor-pointer shrink-0"
                              title={isBn ? 'আইটেম এডিট করুন' : 'Edit Item'}
                            >
                              <Pencil className="w-3.5 h-3.5 stroke-[2.2]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200/80 active:scale-95 transition-all cursor-pointer shrink-0"
                              title={isBn ? 'আইটেম মুছুন' : 'Remove item'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. INSTANT ITEM ENTRY CARD (Matches BillingTab Section 3) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-stone-200">
            <form onSubmit={handleAddNewItem} className="space-y-2.5">
              {/* Header row with Product Suggestion ON/OFF toggle */}
              <div className="flex items-center justify-between px-0.5 pt-0.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1">
                  <span>
                    {isBn ? '+ নতুন আইটেম যোগ করুন' : '+ ADD ITEM TO INVOICE'}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const next = !enableSavedSuggestions;
                    setEnableSavedSuggestions(next);
                    if (!next) setShowSuggestions(false);
                    else if (newItemName.trim().length > 0) setShowSuggestions(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer shadow-2xs select-none active:scale-95 ${
                    enableSavedSuggestions
                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                      : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
                  }`}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 ${
                      enableSavedSuggestions ? 'text-blue-600' : 'text-stone-400'
                    }`}
                  />
                  <span>{isBn ? 'প্রোডাক্ট সাজেশন:' : 'Product Suggestion:'}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      enableSavedSuggestions
                        ? 'bg-blue-600 text-white'
                        : 'bg-stone-300 text-stone-700'
                    }`}
                  >
                    {enableSavedSuggestions ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Row 1: Item Name with Product Suggestions Dropdown */}
              <div ref={suggestionContainerRef} className="relative">
                <input
                  ref={nameInputRef}
                  type="text"
                  autoComplete="off"
                  autoCapitalize={isAllCaps ? 'characters' : 'sentences'}
                  style={{ textTransform: isAllCaps ? 'uppercase' : 'none' }}
                  value={newItemName}
                  onFocus={() => {
                    if (enableSavedSuggestions) setShowSuggestions(true);
                  }}
                  onChange={(e) => {
                    const val = isAllCaps
                      ? e.target.value.toUpperCase()
                      : e.target.value;
                    setNewItemName(val);
                    if (enableSavedSuggestions) setShowSuggestions(true);
                    else setShowSuggestions(false);
                  }}
                  onKeyDown={handleNameKeyDown}
                  placeholder={
                    isBn
                      ? 'পণ্যের নাম লিখুন (যেমন: SHIRT, PANT, PUNJABI...)'
                      : t.itemNamePlaceholder
                  }
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                />

                {enableSavedSuggestions &&
                  showSuggestions &&
                  matchingProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-blue-200 overflow-hidden divide-y divide-stone-100 animate-in fade-in slide-in-from-top-1 duration-100">
                      <div className="px-3 py-1.5 bg-blue-50/90 flex items-center justify-between text-[11px] font-bold text-blue-800 border-b border-blue-100">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">
                            {isBn
                              ? 'সেভ করা প্রোডাক্ট সাজেশন'
                              : 'Saved Product Suggestions'}
                          </span>
                          <span className="text-[10px] text-blue-600 font-bold shrink-0">
                            ({matchingProducts.length})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnableSavedSuggestions(false);
                            setShowSuggestions(false);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-blue-200 cursor-pointer flex items-center gap-1 transition-colors shrink-0"
                        >
                          <span>✕</span>
                          <span>{isBn ? 'বন্ধ করুন (OFF)' : 'Turn OFF'}</span>
                        </button>
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
                                  {renderHighlightedName(prod.name, newItemName)}
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
                                    {isBn ? 'স্টক:' : 'Stock:'} {prod.stock || 0}{' '}
                                    {prod.unit || 'Pcs'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSuggestedProduct(prod, true);
                                }}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Plus className="w-3 h-3 stroke-[3]" />
                                <span>{isBn ? 'বিলে যোগ' : 'Add'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {/* Row 2: Quantity + Unit Selector (Full 2-col layout - no cramped inputs) */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  placeholder={isBn ? 'সংখ্যা (Quantity)' : 'Quantity'}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowUnitSelectorModal(true)}
                  className="w-full border border-stone-200 bg-stone-50/80 hover:bg-stone-100 hover:border-blue-400 active:scale-[0.99] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-stone-900 flex items-center justify-between cursor-pointer transition-all shadow-2xs text-left"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-stone-400 font-semibold shrink-0">
                      {isBn ? 'ইউনিট:' : 'Unit:'}
                    </span>
                    <span className="font-extrabold text-blue-700 truncate">
                      {newItemUnit || 'Pcs'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
                </button>
              </div>

              {/* Row 3: Rate (Price/Unit) + Calculator */}
              <div className="relative">
                {sym ? (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                    {sym}
                  </span>
                ) : null}
                <input
                  ref={priceInputRef}
                  type="number"
                  min="0.01"
                  step="any"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder={
                    isBn
                      ? 'দর / রেট (Rate / Price per Unit)'
                      : 'Rate (Price/Unit)'
                  }
                  className={`w-full border border-stone-200 bg-stone-50/80 ${
                    sym ? (sym.length > 2 ? 'pl-11' : 'pl-8') : 'pl-3'
                  } pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
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
                  <Calculator className="w-4 h-4" />
                </button>
              </div>

              {/* Quick No-Discount Toggle */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newItemNoDiscount}
                    onChange={(e) => setNewItemNoDiscount(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-stone-300 cursor-pointer"
                  />
                  <span
                    className={`text-xs font-bold transition-colors ${
                      newItemNoDiscount ? 'text-rose-700' : 'text-stone-600'
                    }`}
                  >
                    {isBn
                      ? '🚫 এই আইটেমে ছাড় / ডিসকাউন্ট হবে না'
                      : '🚫 Exclude from bill discount'}
                  </span>
                </label>
                {newItemNoDiscount && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    {isBn ? 'ফিক্সড রেট' : 'Fixed Price'}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{t.addItemToBill}</span>
              </button>
            </form>
          </div>

          {/* 4. PAYMENT & CHECKOUT SUMMARY CARD (Matches BillingTab Section 4) */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-stone-200 space-y-3">
            {/* TOP: Side-by-Side Paid / Received (Left) & Discount (Right) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* LEFT: Paid / Received */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1 min-h-[24px]">
                  <label className="text-[11px] sm:text-xs font-bold text-stone-700 truncate">
                    {isTailoring
                      ? isBn
                        ? `অগ্রিম জমা ${sym ? `(${sym})` : ''}`
                        : `Advance ${sym ? `(${sym})` : ''}`
                      : paymentMethod === 'estimate'
                      ? isBn
                        ? `অগ্রিম/পরিশোধ (এস্টিমেট) ${sym ? `(${sym})` : ''}`
                        : `Advance/Paid (Est.) ${sym ? `(${sym})` : ''}`
                      : `${t.paidReceivedLabel} ${sym ? `(${sym})` : ''}`}
                  </label>
                  {paymentMethod === 'due' && paidNum > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPaidAmount('0')}
                      className="text-[10px] font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                    >
                      {isBn ? '0 জমা' : '0 Due'}
                    </button>
                  ) : grandTotal > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(grandTotal.toFixed(2))}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer shrink-0"
                    >
                      {t.exactBtn}
                    </button>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaidAmount(val);
                      const num = parseFloat(val);
                      if (
                        !isNaN(num) &&
                        num < grandTotal &&
                        paymentMethod !== 'due' &&
                        paymentMethod !== 'estimate'
                      ) {
                        setPaymentMethod('due');
                      }
                    }}
                    placeholder={
                      paymentMethod === 'estimate'
                        ? '0.00'
                        : paymentMethod === 'due'
                        ? '0.00'
                        : grandTotal > 0
                        ? grandTotal.toFixed(2)
                        : '0.00'
                    }
                    className="w-full border border-stone-200 bg-stone-50/80 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCalculatorTarget('paid');
                      setIsCalculatorModalOpen(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-1 rounded-md cursor-pointer transition-colors"
                    title={isBn ? 'ক্যালকুলেটর দিয়ে হিসাব করুন' : 'Calculate Cash'}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* RIGHT: Discount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1 min-h-[24px]">
                  <label className="text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1 truncate">
                    <Tag className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</span>
                  </label>

                  <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        discountType === 'fixed'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      {sym || (isBn ? '৳' : 'Rs.')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>

                <div className="relative">
                  {discountType === 'percent' || sym ? (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-[11px] text-stone-400 pointer-events-none">
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
                    placeholder={discountType === 'fixed' ? '0.00' : '0%'}
                    className={`w-full border border-stone-200 bg-stone-50/80 ${
                      discountType === 'percent' || sym
                        ? discountType === 'fixed' && sym && sym.length > 2
                          ? 'pl-9'
                          : 'pl-7'
                        : 'pl-3'
                    } ${
                      discountValue ? 'pr-12' : 'pr-8'
                    } py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
                  />
                  {discountValue && (
                    <button
                      type="button"
                      onClick={() => setDiscountValue('')}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-600 p-0.5 rounded cursor-pointer text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCalculatorTarget('discount');
                      setIsCalculatorModalOpen(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-1 rounded-md cursor-pointer transition-colors"
                    title={isBn ? 'ক্যালকুলেটর দিয়ে ছাড় হিসাব করুন' : 'Calculate Discount'}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* MIDDLE: Real-Time Order Summary Breakdown */}
            <div className="bg-stone-50/90 border border-stone-200 p-3 sm:p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>{t.subtotalText}</span>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
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
                  className={`font-mono font-bold tabular-nums ${
                    discountAmount > 0 ? 'text-emerald-600' : 'text-stone-400'
                  }`}
                >
                  {discountAmount > 0
                    ? `-${sym}${discountAmount.toFixed(2)}`
                    : `${sym}0.00`}
                </span>
              </div>

              {isGstBill && liveTax > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-700">
                  <span>
                    {isBn ? `GST (${gstRate}%):` : `GST (${gstRate}%):`}
                  </span>
                  <span className="font-mono font-bold tabular-nums">
                    {isGstInclusive ? '(Incl.) ' : '+'}
                    {sym}
                    {liveTax.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">
                  {t.grandTotalText}
                </span>
                <div className="text-xl sm:text-2xl font-black text-green-700 font-mono tabular-nums">
                  {sym}
                  {grandTotal.toFixed(2)}
                </div>
              </div>

              {customerOldBalance > 0 && (
                <div className="pt-2 border-t border-dashed border-amber-300 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900">
                      {isBn
                        ? 'পুরানা ব্যালেন্স (Previous Balance):'
                        : 'Previous Balance:'}
                    </span>
                    <span className="font-mono font-extrabold text-rose-600 tabular-nums">
                      +{sym}
                      {customerOldBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-amber-100/80 border border-amber-300 px-2.5 py-1.5 rounded-xl text-xs">
                    <span className="font-black text-amber-950">
                      {isBn
                        ? 'সর্বমোট হিসাব (নতুন + পুরানা):'
                        : 'Net Payable (New + Prev Bal):'}
                    </span>
                    <span className="font-mono font-black text-rose-700 text-sm sm:text-base tabular-nums">
                      {sym}
                      {(grandTotal + customerOldBalance).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Print Discount Bill Option */}
              {rawDiscount > 0 && (
                <div className="mt-1 p-2 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950 select-none">
                    <input
                      type="checkbox"
                      checked={showDiscountOnPrint}
                      onChange={(e) => setShowDiscountOnPrint(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>
                      {isBn
                        ? '🏷️ এই কাস্টমারকে ডিসকাউন্ট বিল প্রিন্ট দিন'
                        : '🏷️ Print Discount Bill for this customer'}
                    </span>
                  </label>
                  <span className="text-[11px] font-semibold text-amber-800 shrink-0">
                    {showDiscountOnPrint
                      ? isBn
                        ? '✓ ছাড় সহ বিল'
                        : '✓ Discount Bill'
                      : isBn
                      ? 'ক্লিন বিল'
                      : 'Clean Bill'}
                  </span>
                </div>
              )}
            </div>

            {/* Change / Balance Due Alert */}
            {paymentMethod !== 'estimate' &&
              paymentMethod !== 'due' &&
              changeAmount > 0 && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between">
                  <span>{t.changeToReturn}</span>
                  <span className="font-mono text-sm tabular-nums">
                    {sym}
                    {changeAmount.toFixed(2)}
                  </span>
                </div>
              )}

            {paymentMethod !== 'estimate' && dueAmount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold space-y-1">
                <div className="flex items-center justify-between">
                  <span>
                    {isTailoring
                      ? isBn
                        ? 'ডেলিভারির সময় বাকি:'
                        : 'Balance Due on Delivery:'
                      : isBn
                      ? 'এই বিলের বাকি (Current Bill Due):'
                      : 'Balance Due:'}
                  </span>
                  <span className="font-mono text-sm font-black text-rose-600 tabular-nums">
                    {sym}
                    {dueAmount.toFixed(2)}
                  </span>
                </div>
                {customerOldBalance > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/80 text-rose-700">
                    <span className="font-extrabold">
                      {isBn
                        ? 'মোট বাকি (বর্তমান + পুরানা):'
                        : 'Total Net Due (Curr + Old):'}
                    </span>
                    <span className="font-mono text-sm font-black tabular-nums">
                      {sym}
                      {(dueAmount + customerOldBalance).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* BOTTOM: Payment Method Selection Buttons */}
            <div className="pt-1.5 border-t border-stone-100">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                {t.paymentModeLabel}
              </label>
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                {[
                  { id: 'estimate', label: 'Estimate', icon: FileText },
                  { id: 'cash', label: t.modeCash, icon: Banknote },
                  { id: 'upi', label: t.modeUpi, icon: QrCode },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'due', label: t.modeDue, icon: Clock },
                ].map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() =>
                        handleSelectPaymentMethod(method.id as PaymentMethod)
                      }
                      className={`py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-bold text-center border transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                        isSelected
                          ? method.id === 'due'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-600/20'
                            : 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/20'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-white' : 'text-stone-500'
                        }`}
                      />
                      <span className="truncate">{method.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VERY BOTTOM: 3-Button Action Row (Save Changes, WhatsApp, Cancel) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSave(undefined, false)}
                className="w-full py-3.5 px-2 rounded-2xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white"
              >
                <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span className="truncate">{t.saveInvoiceBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave(undefined, true)}
                className="w-full py-3.5 px-2 rounded-2xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white"
              >
                <MessageCircle className="w-4 h-4 shrink-0 fill-current" />
                <span className="truncate font-extrabold">
                  {isBn ? 'WhatsApp বিল' : 'WhatsApp'}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300"
              >
                <X className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.cancel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION OVERLAY */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-stone-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {isBn ? 'ইনভয়েস মুছে ফেলতে চান?' : 'Delete this Invoice?'}
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-1">
                #{bill.invoiceNo} • {displaySym}
                {grandTotal.toFixed(2)}
              </p>
              {customerName && (
                <p className="text-xs text-stone-600 font-medium mt-0.5">
                  {customerName}
                </p>
              )}
              <p className="text-[11px] text-rose-600 mt-2">
                {isBn
                  ? 'সতর্কতা: ডিলিট করলে এটি রিসাইকেল বিনে চলে যাবে।'
                  : 'Deleted invoices are moved to Recycle Bin.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete(bill.id);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
              >
                {isBn ? 'হ্যাঁ, মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIT SELECTOR MODAL (Matches BillingTab) */}
      {showUnitSelectorModal && (
        <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3.5 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {isBn
                      ? 'ইউনিট নির্বাচন করুন (Select Unit)'
                      : 'Select Product Unit'}
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    {isBn
                      ? 'ট্যাপ করলেই ইউনিট সিলেক্ট হয়ে যাবে'
                      : 'Tap to select unit for this item'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitSelectorModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-blue-50/60 border-b border-blue-100 shrink-0">
              <form onSubmit={handleAddNewUnit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newUnitInput}
                  onChange={(e) => setNewUnitInput(e.target.value)}
                  placeholder={
                    isBn
                      ? 'নতুন ইউনিট লিখুন (যেমন: বস্তা, বান্ডিল)...'
                      : 'Type new custom unit...'
                  }
                  className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newUnitInput.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isBn ? '+ যোগ' : '+ Add'}</span>
                </button>
              </form>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableUnits.map((u) => {
                  const isSelected =
                    (newItemUnit || 'Pcs').toLowerCase() === u.toLowerCase();
                  const isDefaultUnit = [
                    'pcs',
                    'set',
                    'meter',
                    'gaz',
                    'pair',
                    'suit',
                    'dozen',
                  ].includes(u.toLowerCase());

                  return (
                    <div
                      key={u}
                      onClick={() => {
                        setNewItemUnit(u);
                        setShowUnitSelectorModal(false);
                        priceInputRef.current?.focus();
                      }}
                      className={`group p-2.5 rounded-2xl border flex items-center justify-between gap-1.5 cursor-pointer transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                          : 'bg-stone-50 hover:bg-blue-50/80 border-stone-200 hover:border-blue-300 text-stone-800'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-1.5">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                        )}
                        <span className="font-extrabold text-xs truncate">
                          {u}
                        </span>
                      </div>
                      {!isDefaultUnit && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUnit(u, e)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 opacity-60 group-hover:opacity-100 ${
                            isSelected
                              ? 'hover:bg-white/20 text-white'
                              : 'hover:bg-stone-200 text-stone-400 hover:text-rose-600'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CONTACT PICKER MODAL (Matches BillingTab) */}
      {showSavedCustomerModal && (
        <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3.5 bg-blue-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-300">
                  <BookUser className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {isBn ? 'কাস্টমার কন্টাক্ট লিস্ট' : 'Customer Contact List'}
                  </h3>
                  <p className="text-[10px] text-blue-200">
                    {isBn
                      ? 'ফোনবুক অথবা খাতা থেকে কাস্টমার বাছুন'
                      : 'Select customer from contacts or saved accounts'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedCustomerModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {'contacts' in navigator && 'ContactsManager' in window && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const contacts = await (navigator as any).contacts.select(
                        ['name', 'tel'],
                        { multiple: false }
                      );
                      if (contacts && contacts.length > 0) {
                        const selected = contacts[0];
                        const rawName = (
                          selected.name?.[0] ||
                          selected.name ||
                          ''
                        ).trim();
                        const rawTel = (
                          selected.tel?.[0] ||
                          selected.tel ||
                          ''
                        ).trim();
                        const finalPhone = cleanExtractedPhone(rawTel);
                        if (rawName)
                          setCustomerName(
                            isAllCaps ? rawName.toUpperCase() : rawName
                          );
                        if (finalPhone) setCustomerPhone(finalPhone);
                        setShowSavedCustomerModal(false);
                      }
                    } catch {}
                  }}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>
                    {isBn
                      ? '📱 সরাসরি মোবাইলের ফোনবুক থেকে বাছুন'
                      : 'Open Mobile Phone Contacts'}
                  </span>
                </button>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder={
                    isBn
                      ? 'নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...'
                      : 'Search by name or phone...'
                  }
                  className="w-full bg-stone-100 pl-8 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white border border-stone-200"
                />
                <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="space-y-1 divide-y divide-stone-100 max-h-72 overflow-y-auto">
                {filteredCustomerContacts.length > 0 ? (
                  filteredCustomerContacts.map((c, idx) => (
                    <button
                      key={`${c.name}-${c.phone}-${idx}`}
                      type="button"
                      onClick={() => {
                        const cleanP = cleanExtractedPhone(c.phone);
                        setCustomerName(
                          isAllCaps ? c.name.toUpperCase() : c.name
                        );
                        setCustomerPhone(cleanP);
                        setShowSavedCustomerModal(false);
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-blue-50/70 text-left transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-stone-900 group-hover:text-blue-700 truncate">
                            {c.name}
                          </div>
                          <div className="text-[11px] font-mono text-stone-500">
                            {c.phone || (isBn ? 'মোবাইল নম্বর নেই' : 'No phone')}
                          </div>
                        </div>
                      </div>
                      {c.due !== undefined && c.due > 0 && (
                        <div className="text-right shrink-0">
                          <span className="text-[9px] text-stone-400 block uppercase">
                            {isBn ? 'বকেয়া' : 'Due'}
                          </span>
                          <span className="text-xs font-mono font-bold text-rose-600">
                            {sym}
                            {c.due.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-stone-400">
                    {isBn
                      ? 'কোনো কাস্টমার পাওয়া যায়নি।'
                      : 'No customers found.'}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 text-right">
              <button
                type="button"
                onClick={() => setShowSavedCustomerModal(false)}
                className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR MODAL */}
      <KhatabookEntryModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        onSave={handleCalculatorSave}
        entryType={calculatorTarget === 'item' ? 'bill_item' : 'calculate_value'}
        initialAmount={
          calculatorTarget === 'item'
            ? parseFloat(newItemPrice) || undefined
            : calculatorTarget === 'paid'
            ? parseFloat(paidAmount) || (grandTotal > 0 ? grandTotal : undefined)
            : parseFloat(discountValue) || undefined
        }
        initialDetails={calculatorTarget === 'item' ? newItemName : ''}
        customSaveLabel={
          calculatorTarget === 'item'
            ? isBn
              ? 'দর বসান'
              : 'APPLY RATE'
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
