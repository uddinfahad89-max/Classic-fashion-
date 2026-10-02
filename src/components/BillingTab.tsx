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
  MoreVertical,
  Pencil,
  X,
  Scissors,
  Calendar,
  Ruler,
  ChevronDown,
  FileText,
  Camera,
  Barcode,
} from 'lucide-react';
import {
  BillItem,
  BillInvoice,
  PaymentMethod,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  Language,
  ProductStockItem,
  TailoringMeasurements,
  TailoringOrderStatus,
} from '../types';
import { storageService } from '../services/storageService';
import { translations } from '../utils/i18n';
import { useBackHandler } from '../utils/useBackHandler';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';
import { BarcodeScannerModal, playBarcodeBeep } from './BarcodeScannerModal';

interface BillingTabProps {
  billItems: BillItem[];
  setBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  isPrinting?: boolean;
  onPrintBill: (bill: BillInvoice, mode?: 'save' | 'print') => void;
  onClearBill: () => void;
  language?: Language;
  onOpenCalculator?: () => void;
  products?: ProductStockItem[];
  onOpenProductStock?: () => void;
  totalInvoicesCount?: number;
  onQuickSaveProduct?: (data: {
    name: string;
    price: number;
    stock?: number;
    barcode?: string;
  }) => void;
}

const BILLING_CART_DRAFT_KEY = 'simple_pos_billing_cart_draft_v1';

interface BillingCartDraft {
  billItems?: BillItem[];
  customerName?: string;
  customerPhone?: string;
  discountType?: 'fixed' | 'percent';
  discountValue?: string;
  paymentMethod?: PaymentMethod;
  paidAmount?: string;
  itemName?: string;
  itemPrice?: string;
  itemQty?: string;
  itemUnit?: string;
  isTailoring?: boolean;
  deliveryDate?: string;
  trialDate?: string;
  tailoringStatus?: TailoringOrderStatus;
  measurements?: TailoringMeasurements;
  updatedAt?: number;
}

const loadSavedBillingDraft = (): BillingCartDraft | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(BILLING_CART_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BillingCartDraft) : null;
  } catch {
    return null;
  }
};

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
  totalInvoicesCount = 0,
  onQuickSaveProduct,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  const initialDraft = useMemo(() => loadSavedBillingDraft(), []);

  // Direct item input form state (hydrated from auto-saved draft if present)
  const [itemName, setItemName] = useState(() => initialDraft?.itemName || '');
  const [itemPrice, setItemPrice] = useState(() => initialDraft?.itemPrice || '');
  const [itemQty, setItemQty] = useState(() => initialDraft?.itemQty || '1');
  const [itemUnit, setItemUnit] = useState(() => initialDraft?.itemUnit || '');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [itemStockInput, setItemStockInput] = useState('');
  const [showInlineStockAdd, setShowInlineStockAdd] = useState(false);
  const [showStockMoreMenu, setShowStockMoreMenu] = useState(false);

  // Inline Editing State for Current Bill Items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('');
  const [editFocusField, setEditFocusField] = useState<'name' | 'qty' | 'unit' | 'price'>('name');

  // First-letter Autocomplete state (Disabled by default so it never disturbs typing; optional toggle in 3-dot menu)
  const [enableSavedSuggestions, setEnableSavedSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Checkout meta (hydrated from auto-saved draft if present)
  const [customerName, setCustomerName] = useState(() => initialDraft?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => initialDraft?.customerPhone || '');
  // Tailoring Invoice State
  const [isTailoring, setIsTailoring] = useState(() => Boolean(initialDraft?.isTailoring));
  const [deliveryDate, setDeliveryDate] = useState(() => initialDraft?.deliveryDate || '');
  const [trialDate, setTrialDate] = useState(() => initialDraft?.trialDate || '');
  const [tailoringStatus, setTailoringStatus] = useState<TailoringOrderStatus>(
    () => initialDraft?.tailoringStatus || 'pending'
  );
  const [measurements, setMeasurements] = useState<TailoringMeasurements>(
    () =>
      initialDraft?.measurements || {
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
      }
  );
  // Automatically generated sequential invoice number
  const [invoiceNo, setInvoiceNo] = useState(() => storageService.getNextInvoiceNumber());
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>(
    () => initialDraft?.discountType || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState(() => initialDraft?.discountValue || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => initialDraft?.paymentMethod || 'estimate'
  );
  const [paidAmount, setPaidAmount] = useState(() => initialDraft?.paidAmount || '');

  // Restore saved cart items on mount if parent state was empty, then auto-save cart changes to localStorage
  const hasHydratedDraftRef = useRef(false);
  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      hasHydratedDraftRef.current = true;
      if (
        billItems.length === 0 &&
        initialDraft?.billItems &&
        Array.isArray(initialDraft.billItems) &&
        initialDraft.billItems.length > 0
      ) {
        setBillItems(initialDraft.billItems);
        return;
      }
    }

    try {
      const hasAnyDraftData =
        billItems.length > 0 ||
        customerName.trim() !== '' ||
        customerPhone.trim() !== '' ||
        discountValue.trim() !== '' ||
        paidAmount.trim() !== '' ||
        itemName.trim() !== '' ||
        itemPrice.trim() !== '' ||
        isTailoring;

      if (!hasAnyDraftData) {
        localStorage.removeItem(BILLING_CART_DRAFT_KEY);
      } else {
        const draftPayload: BillingCartDraft = {
          billItems,
          customerName,
          customerPhone,
          discountType,
          discountValue,
          paymentMethod,
          paidAmount,
          itemName,
          itemPrice,
          itemQty,
          itemUnit,
          isTailoring,
          deliveryDate,
          trialDate,
          tailoringStatus,
          measurements,
          updatedAt: Date.now(),
        };
        localStorage.setItem(BILLING_CART_DRAFT_KEY, JSON.stringify(draftPayload));
      }
    } catch (err) {
      console.warn('Failed to auto-save billing cart draft:', err);
    }
  }, [
    billItems,
    customerName,
    customerPhone,
    discountType,
    discountValue,
    paymentMethod,
    paidAmount,
    itemName,
    itemPrice,
    itemQty,
    itemUnit,
    isTailoring,
    deliveryDate,
    trialDate,
    tailoringStatus,
    measurements,
    initialDraft,
    setBillItems,
  ]);

  // Synchronize when settings prefix, sequence, or total invoices count updates
  useEffect(() => {
    setInvoiceNo(storageService.getNextInvoiceNumber());
  }, [totalInvoicesCount, settings.invoicePrefix, settings.nextInvoiceNumber]);

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

  // Mobile Camera Barcode Scanner Modal State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [scanStatusBanner, setScanStatusBanner] = useState<{
    message: string;
    type: 'success' | 'warning';
  } | null>(null);

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

  // Build unified product list (always combining live localStorage products + prop products)
  const allSavedProducts = useMemo(() => {
    const map = new Map<string, ProductStockItem>();
    const stored = storageService.getProducts();
    for (const p of [...stored, ...products]) {
      if (p.id) {
        map.set(p.id, p);
      } else if (p.name && p.name.trim()) {
        map.set(p.name.trim().toLowerCase(), p);
      }
    }
    return Array.from(map.values());
  }, [products]);

  // Instant First-Letter or Barcode Matching Products
  const matchingProducts = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return [];

    const exactStartsWith: ProductStockItem[] = [];
    const wordStartsWith: ProductStockItem[] = [];
    const containsMatch: ProductStockItem[] = [];

    for (const prod of allSavedProducts) {
      const pName = prod.name.trim().toLowerCase();
      const pBarcode = (prod.barcode || '').trim().toLowerCase();
      if (pName.startsWith(q) || (pBarcode && pBarcode === q)) {
        exactStartsWith.push(prod);
      } else if (pName.split(/\s+/).some((w) => w.startsWith(q)) || (pBarcode && pBarcode.startsWith(q))) {
        wordStartsWith.push(prod);
      } else if (pName.includes(q) || (pBarcode && pBarcode.includes(q))) {
        containsMatch.push(prod);
      }
    }

    return [...exactStartsWith, ...wordStartsWith, ...containsMatch].slice(0, 8);
  }, [allSavedProducts, itemName]);

  // Comprehensive Barcode -> Product & Rate Resolver (Exact, Normalized, Prefix/Substring SKU, Studio Config, Past Bills)
  const resolveProductByBarcodeCode = (rawScannedCode: string): {
    cleanCode: string;
    matchedProd?: ProductStockItem;
  } => {
    const rawTrimmed = (rawScannedCode || '').trim();
    if (!rawTrimmed) return { cleanCode: '' };

    // Extract SKU if QR format "STORE | ITEM | Rs. 850 | SKU: 10001234" was scanned
    let cleanCode = rawTrimmed;
    let qrParsedName = '';
    let qrParsedPrice = 0;
    if (rawTrimmed.includes('|') && /SKU:/i.test(rawTrimmed)) {
      const parts = rawTrimmed.split('|').map((s) => s.trim());
      const skuPart = parts.find((p) => /^SKU:/i.test(p));
      if (skuPart) {
        cleanCode = skuPart.replace(/^SKU:\s*/i, '').trim() || rawTrimmed;
      }
      if (parts[1]) qrParsedName = parts[1];
      if (parts[2]) {
        const numMatch = parts[2].match(/(\d+(\.\d+)?)/);
        if (numMatch) qrParsedPrice = parseFloat(numMatch[1]) || 0;
      }
    }

    const lowerCode = cleanCode.toLowerCase();
    const normCode = lowerCode.replace(/[^a-z0-9]/g, '');

    // Always read the freshest products from storageService + props
    const storedProds = storageService.getProducts();
    const prodMap = new Map<string, ProductStockItem>();
    for (const p of [...storedProds, ...allSavedProducts]) {
      const key = p.id || p.name.trim().toLowerCase();
      const existing = prodMap.get(key);
      if (!existing || (p.price > 0 && existing.price <= 0)) {
        prodMap.set(key, p);
      }
    }
    const freshProducts = Array.from(prodMap.values());

    // 1A. Exact match on barcode, id, or name (preferring items with price > 0)
    let matchedProd =
      freshProducts.find(
        (p) =>
          p.price > 0 &&
          ((p.barcode && p.barcode.trim().toLowerCase() === lowerCode) ||
            p.id.toLowerCase() === lowerCode ||
            p.name.trim().toLowerCase() === lowerCode)
      ) ||
      freshProducts.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === lowerCode) ||
          p.id.toLowerCase() === lowerCode ||
          p.name.trim().toLowerCase() === lowerCode
      );

    // 1B. Normalized alphanumeric match (e.g. "ZF-1678" === "ZF1678")
    if ((!matchedProd || matchedProd.price <= 0) && normCode.length >= 2) {
      const normMatch = freshProducts.find((p) => {
        const pNorm = (p.barcode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return pNorm.length >= 2 && pNorm === normCode && p.price > 0;
      });
      if (normMatch) matchedProd = normMatch;
    }

    // 1C. Prefix / Substring SKU match (e.g. scanned "ZF1678455" matches saved SKU "ZF1678" -> "Zufar royal king" Rs 300)
    if ((!matchedProd || matchedProd.price <= 0) && normCode.length >= 3) {
      const prefixMatches = freshProducts
        .filter((p) => {
          const pNorm = (p.barcode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (pNorm.length < 3) return false;
          return normCode.startsWith(pNorm) || pNorm.startsWith(normCode);
        })
        .sort((a, b) => {
          // Prefer products with price > 0, then longest matching barcode
          if ((b.price > 0 ? 1 : 0) !== (a.price > 0 ? 1 : 0)) {
            return (b.price > 0 ? 1 : 0) - (a.price > 0 ? 1 : 0);
          }
          return (b.barcode || '').length - (a.barcode || '').length;
        });

      if (prefixMatches.length > 0 && prefixMatches[0].price > 0) {
        matchedProd = prefixMatches[0];
      } else if (!matchedProd && prefixMatches.length > 0) {
        matchedProd = prefixMatches[0];
      }
    }

    // 1D. 2-Letter SKU Prefix match if there is a product with matching letters & price > 0 (e.g. "ZF..." -> "Zufar royal king")
    if ((!matchedProd || matchedProd.price <= 0) && /^[a-z]{2}\d+/i.test(normCode)) {
      const alphaPrefix = normCode.slice(0, 2);
      const letterMatch = freshProducts.find((p) => {
        if (p.price <= 0) return false;
        const pNorm = (p.barcode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const pNameLetters = p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 2);
        return pNorm.startsWith(alphaPrefix) || pNameLetters === alphaPrefix;
      });
      if (letterMatch) {
        matchedProd = letterMatch;
      }
    }

    // 2. Fallback lookup in saved Barcode Label Studio config (exact or prefix match)
    if (!matchedProd || matchedProd.price <= 0) {
      const savedDesign = storageService.getBarcodeCustomDesign();
      if (savedDesign && savedDesign.barcodeValue) {
        const dCode = savedDesign.barcodeValue.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const isDesignMatch =
          dCode === normCode ||
          (dCode.length >= 3 && (normCode.startsWith(dCode) || dCode.startsWith(normCode)));
        const dPrice = Number(savedDesign.salePrice || savedDesign.mrp || 0);
        if (isDesignMatch && dPrice > 0) {
          const dName =
            matchedProd?.name ||
            (savedDesign.itemName || '').trim() ||
            (savedDesign.storeName || '').trim() ||
            `Item #${cleanCode}`;
          matchedProd = {
            id: matchedProd?.id || `barcode-${cleanCode}`,
            name: dName,
            price: dPrice,
            stock: matchedProd?.stock ?? 1,
            unit: matchedProd?.unit || 'Pcs',
            barcode: cleanCode,
            updatedAt: Date.now(),
          };
        }
      }
    }

    // 3. Fallback lookup in previous bills if any billed item had this barcode or prefix with price > 0
    if (!matchedProd || matchedProd.price <= 0) {
      const pastBills = storageService.getBills();
      for (const b of pastBills) {
        const foundItem = b.items?.find((it) => {
          if (!it.price || it.price <= 0) return false;
          const itCode = (it.barcode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return (
            (itCode &&
              (itCode === normCode ||
                (itCode.length >= 3 &&
                  (normCode.startsWith(itCode) || itCode.startsWith(normCode))))) ||
            it.name.trim().toLowerCase() === lowerCode
          );
        });
        if (foundItem) {
          matchedProd = {
            id: foundItem.productId || matchedProd?.id || `barcode-${cleanCode}`,
            name:
              matchedProd && !matchedProd.name.startsWith('Item (')
                ? matchedProd.name
                : foundItem.name,
            price: foundItem.price,
            stock: matchedProd?.stock ?? 1,
            unit: foundItem.unit || matchedProd?.unit || 'Pcs',
            barcode: cleanCode,
            updatedAt: Date.now(),
          };
          break;
        }
      }
    }

    // 4. If QR code contained embedded name & price
    if ((!matchedProd || matchedProd.price <= 0) && (qrParsedName || qrParsedPrice > 0)) {
      matchedProd = {
        id: matchedProd?.id || `barcode-${cleanCode}`,
        name: qrParsedName || matchedProd?.name || `Item #${cleanCode}`,
        price: qrParsedPrice || matchedProd?.price || 0,
        stock: 1,
        unit: 'Pcs',
        barcode: cleanCode,
        updatedAt: Date.now(),
      };
    }

    return { cleanCode, matchedProd };
  };

  // Auto-repair any existing scanned items in the current bill that had Rs 0 rate (e.g. "Item (ZF1678455)")
  useEffect(() => {
    if (billItems.length === 0) return;
    let didRepair = false;
    const repaired = billItems.map((it) => {
      if (it.price > 0) return it;
      const itemMatch = it.name.match(/^Item\s*\(([^)]+)\)$/i);
      const candidateCode = (it.barcode || (itemMatch ? itemMatch[1] : '')).trim();
      if (!candidateCode) return it;

      const { matchedProd } = resolveProductByBarcodeCode(candidateCode);
      if (matchedProd && matchedProd.price > 0) {
        didRepair = true;
        return {
          ...it,
          name: matchedProd.name,
          price: matchedProd.price,
          unit: it.unit || matchedProd.unit || 'Pcs',
          productId: matchedProd.id,
          total: Math.round(matchedProd.price * it.qty * 100) / 100,
        };
      }
      return it;
    });

    if (didRepair) {
      setBillItems(repaired);
    }
  }, [billItems, allSavedProducts]);

  // Barcode Auto-Lookup in Inventory + Add 1 Item to Billing Cart + Refresh Input
  const handleBarcodeScanned = (rawScannedCode: string) => {
    const { cleanCode, matchedProd } = resolveProductByBarcodeCode(rawScannedCode);
    if (!cleanCode) return { matched: false };

    const lowerCode = cleanCode.toLowerCase();

    const resolvedName = matchedProd ? matchedProd.name : `Item (${cleanCode})`;
    const resolvedPrice =
      matchedProd && matchedProd.price > 0
        ? matchedProd.price
        : parseFloat(itemPrice) > 0
        ? parseFloat(itemPrice)
        : 0;
    const resolvedUnit = matchedProd?.unit || itemUnit.trim() || 'Pcs';
    const newItemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    // Add 1 item to the billing cart (or increment qty by +1 if already in cart)
    setBillItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) =>
          (it.barcode && it.barcode.trim().toLowerCase() === lowerCode) ||
          (matchedProd && it.productId && it.productId === matchedProd.id) ||
          (it.name.trim().toLowerCase() === resolvedName.toLowerCase() &&
            (it.price === resolvedPrice || it.price === 0))
      );

      if (existingIndex >= 0) {
        return prev.map((it, idx) => {
          if (idx !== existingIndex) return it;
          const nextQty = it.qty + 1;
          const effectivePrice = resolvedPrice > 0 ? resolvedPrice : it.price;
          const effectiveName =
            matchedProd && it.name.startsWith('Item (') ? matchedProd.name : it.name;
          return {
            ...it,
            name: effectiveName,
            price: effectivePrice,
            qty: nextQty,
            barcode: it.barcode || cleanCode,
            productId: it.productId || matchedProd?.id,
            total: Math.round(effectivePrice * nextQty * 100) / 100,
          };
        });
      }

      const newCartItem: BillItem = {
        id: newItemId,
        name: resolvedName,
        price: resolvedPrice,
        qty: 1,
        unit: resolvedUnit,
        total: Math.round(resolvedPrice * 100) / 100,
        barcode: cleanCode,
        productId: matchedProd?.id,
      };
      return [...prev, newCartItem];
    });

    // If an unlisted barcode still has 0 price, open inline rate editor automatically so user can type rate immediately
    if (resolvedPrice <= 0) {
      setEditingItemId(newItemId);
      setEditItemName(resolvedName);
      setEditItemPrice('');
      setEditItemQty('1');
      setEditItemUnit(resolvedUnit);
      setEditFocusField('price');
    }

    // Refresh the input fields
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setShowSuggestions(false);
    setShowUnitDropdown(false);
    if (resolvedPrice > 0) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 30);
    }

    // Show quick status banner on Billing page
    setScanStatusBanner({
      message:
        matchedProd && resolvedPrice > 0
          ? isBn
            ? `✅ স্ক্যান সফল: "${resolvedName}" (+1) বিলে যোগ হয়েছে (${sym}${resolvedPrice})`
            : `✅ Scanned: "${resolvedName}" (+1) added to cart (${sym}${resolvedPrice})`
          : isBn
          ? `⚡ বারকোড "${cleanCode}" যোগ হয়েছে — নিচে দর (Rate) লিখলে স্টকে অটো সেভ হবে`
          : `⚡ Barcode "${cleanCode}" added — enter Rate below to auto-save to stock`,
      type: matchedProd && resolvedPrice > 0 ? 'success' : 'warning',
    });
    setTimeout(() => {
      setScanStatusBanner(null);
    }, 3500);

    return {
      matched: Boolean(matchedProd && resolvedPrice > 0),
      itemName: resolvedName,
      price: resolvedPrice,
    };
  };

  // Reset active suggestion index when query changes
  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [itemName]);

  // Select a product from the first-letter autocomplete dropdown
  const handleSelectSuggestedProduct = (prod: ProductStockItem, addDirectly = false) => {
    if (addDirectly) {
      const parsedQty = parseFloat(itemQty);
      const validQty = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
      const price = prod.price || 0;
      const resolvedUnit = itemUnit.trim() || prod.unit || undefined;
      const newItem: BillItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: prod.name,
        price,
        qty: validQty,
        unit: resolvedUnit,
        total: Math.round(price * validQty * 100) / 100,
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
    if (prod.unit && !itemUnit.trim()) {
      setItemUnit(prod.unit);
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

  // Keyboard navigation for first-letter autocomplete & hardware barcode scanner Enter lookup
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && itemName.trim() && !itemPrice.trim()) {
      const qLower = itemName.trim().toLowerCase();
      const exactBarcodeMatch = allSavedProducts.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === qLower
      );
      const savedDesign = storageService.getBarcodeCustomDesign();
      const isSavedTagBarcode =
        savedDesign?.barcodeValue &&
        savedDesign.barcodeValue.trim().toLowerCase() === qLower;
      if (exactBarcodeMatch || isSavedTagBarcode) {
        e.preventDefault();
        playBarcodeBeep(true);
        handleBarcodeScanned(itemName.trim());
        return;
      }
    }

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
  const pendingPrice = parseFloat(itemPrice);
  const pendingQty = parseFloat(itemQty);
  const hasPendingItem = itemName.trim().length > 0 && !isNaN(pendingPrice) && pendingPrice > 0;
  const pendingItemTotal = hasPendingItem
    ? Math.round(pendingPrice * (!isNaN(pendingQty) && pendingQty > 0 ? pendingQty : 1) * 100) / 100
    : 0;
  const canCheckout = billItems.length > 0 || hasPendingItem;

  const subtotal =
    billItems.reduce((sum, item) => sum + item.total, 0) +
    (billItems.length === 0 ? pendingItemTotal : 0);
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
      const parsedQty = parseFloat(itemQty);
      const validQty = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
      const cleanUnit = itemUnit.trim() || undefined;

      const newItem: BillItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name,
        price: finalPrice,
        qty: validQty,
        unit: cleanUnit,
        total: Math.round(finalPrice * validQty * 100) / 100,
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

    const finalName = itemName.trim();
    const price = parseFloat(itemPrice);
    const qty = parseFloat(itemQty);

    if (!finalName || isNaN(price) || price <= 0) {
      alert(t.enterValidNamePrice);
      return;
    }

    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    const cleanUnit = itemUnit.trim() || undefined;

    const newItem: BillItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: finalName,
      price,
      qty: validQty,
      unit: cleanUnit,
      total: Math.round(price * validQty * 100) / 100,
    };

    setBillItems((prev) => [...prev, newItem]);

    // Reset fields & refocus
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setItemStockInput('');
    setShowSuggestions(false);
    setShowUnitDropdown(false);
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
        item.id === id
          ? { ...item, qty: newQty, total: Math.round(item.price * newQty * 100) / 100 }
          : item
      )
    );
  };

  // Start Inline Editing a Bill Item
  const handleStartEditItem = (
    item: BillItem,
    focusField: 'name' | 'qty' | 'unit' | 'price' = 'name'
  ) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(String(item.price));
    setEditItemQty(String(item.qty));
    setEditItemUnit(item.unit || '');
    setEditFocusField(focusField);
  };

  // Save Inline Edited Bill Item
  const handleSaveEditItem = (id: string) => {
    const cleanName = editItemName.trim();
    const parsedPrice = parseFloat(editItemPrice);
    const parsedQty = parseFloat(editItemQty);
    const cleanUnit = editItemUnit.trim() || undefined;

    if (!cleanName) {
      alert(isBn ? 'পণ্যের নাম লিখুন' : 'Please enter item name');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert(isBn ? 'সঠিক দাম লিখুন' : 'Please enter a valid price');
      return;
    }
    const finalQty = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;

    setBillItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // If this item came from a barcode scan, also save its rate to Product Stock so future scans auto-fill the rate
        const itemMatch = item.name.match(/^Item\s*\(([^)]+)\)$/i);
        const itemBarcode = item.barcode || (itemMatch ? itemMatch[1].trim() : undefined);
        if (itemBarcode && parsedPrice > 0) {
          storageService.addOrUpdateProduct({
            id: item.productId,
            name: cleanName,
            price: parsedPrice,
            unit: cleanUnit || item.unit || 'Pcs',
            barcode: itemBarcode,
          });
          if (onQuickSaveProduct) {
            onQuickSaveProduct({
              name: cleanName,
              price: parsedPrice,
              barcode: itemBarcode,
            });
          }
        }
        return {
          ...item,
          name: cleanName,
          price: parsedPrice,
          qty: finalQty,
          unit: cleanUnit,
          barcode: itemBarcode || item.barcode,
          total: Math.round(parsedPrice * finalQty * 100) / 100,
        };
      })
    );
    setEditingItemId(null);
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
  };

  // Handle Checkout: Save Only or Direct Print
  const handleCheckoutAndPrint = (mode: 'save' | 'print' = 'print') => {
    let finalItems = [...billItems];
    if (hasPendingItem) {
      const validQty = !isNaN(pendingQty) && pendingQty > 0 ? pendingQty : 1;
      const cleanUnit = itemUnit.trim() || undefined;
      finalItems.push({
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: itemName.trim(),
        price: pendingPrice,
        qty: validQty,
        unit: cleanUnit,
        total: Math.round(pendingPrice * validQty * 100) / 100,
      });
    }

    if (finalItems.length === 0) {
      alert(t.addAtLeastOneItem);
      return;
    }

    const finalSubtotal = finalItems.reduce((sum, item) => sum + item.total, 0);
    let finalDiscountAmount = 0;
    if (discountType === 'percent') {
      const clampedPercent = Math.min(100, rawDiscount);
      finalDiscountAmount = Math.round(((finalSubtotal * clampedPercent) / 100) * 100) / 100;
    } else {
      finalDiscountAmount = Math.min(finalSubtotal, rawDiscount);
    }
    const finalGrandTotal = Math.max(0, finalSubtotal - finalDiscountAmount);
    const finalChangeAmount = Math.max(0, paidNum - finalGrandTotal);

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

    const actualPaid =
      paymentMethod === 'due'
        ? paidAmount.trim() !== '' && paidNum < finalGrandTotal
          ? paidNum
          : 0
        : paidAmount.trim() !== ''
        ? paidNum
        : isTailoring
        ? 0
        : finalGrandTotal;
    const balanceAmount =
      paymentMethod === 'due' || isTailoring || (paidAmount.trim() !== '' && paidNum < finalGrandTotal)
        ? Math.max(0, finalGrandTotal - actualPaid)
        : 0;
    const hasMeasurements = Object.values(measurements).some((v) => Boolean(v && String(v).trim()));

    const bill: BillInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNo: finalInvoiceNo,
      date: dateFormatted,
      time: timeFormatted,
      timestamp: Date.now(),
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: finalItems,
      subtotal: finalSubtotal,
      discount: finalDiscountAmount,
      discountType,
      discountValue: rawDiscount,
      grandTotal: finalGrandTotal,
      paymentMethod:
        paymentMethod === 'estimate'
          ? 'estimate'
          : balanceAmount > 0 && actualPaid < finalGrandTotal
          ? 'due'
          : paymentMethod,
      paymentStatus:
        balanceAmount <= 0 ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'DUE',
      paidAmount: actualPaid,
      changeAmount: paidNum > finalGrandTotal ? finalChangeAmount : 0,
      balance: balanceAmount,
      previousBalance: 0,
      currentBalance: balanceAmount,
      ...(isTailoring
        ? {
            isTailoring: true,
            deliveryDate: deliveryDate.trim() || undefined,
            trialDate: trialDate.trim() || undefined,
            tailoringStatus,
            measurements: hasMeasurements ? { ...measurements } : undefined,
          }
        : {}),
    };

    try {
      localStorage.removeItem(BILLING_CART_DRAFT_KEY);
    } catch {}

    onPrintBill(bill, mode);
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue('');
    setPaidAmount('');
    setPaymentMethod('estimate');
    setDeliveryDate('');
    setTrialDate('');
    setMeasurements({
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
    <div className="max-w-2xl mx-auto px-3 py-2 sm:py-3 space-y-2">
      {/* 1. CUSTOMER DETAILS CARD (SECTION 1 - TOP) */}
      <div
        id="billing-customer-section"
        className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-stone-200"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          {/* Tailoring Mode Toggle + Automatic Sequential Invoice Number Badge */}
          <div className="flex items-center justify-between w-full gap-1.5 flex-wrap">
            <button
              type="button"
              id="btn-toggle-tailoring-invoice"
              onClick={() => setIsTailoring((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isTailoring
                  ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-200'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
              }`}
              title={
                isBn
                  ? 'টেইলারিং অর্ডার ও মাপ সহ ইনভয়েস তৈরি করুন'
                  : 'Switch to Tailoring Order & Measurement Invoice'
              }
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{isBn ? '✂️ টেইলারিং ইনভয়েস' : '✂️ Tailoring Invoice'}</span>
            </button>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Customer Name */}
          <div>
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

        {/* TAILORING ORDER & MEASUREMENTS SECTION (When Tailoring Mode is Active) */}
        {isTailoring && (
          <div className="mt-4 pt-3.5 border-t border-purple-200/80 bg-purple-50/50 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-4 sm:p-5 rounded-b-2xl space-y-3.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-purple-950 font-black text-xs sm:text-sm">
                <Scissors className="w-4 h-4 text-purple-600" />
                <span>
                  {isBn
                    ? 'টেইলারিং অর্ডার ও শরীরের মাপ (Tailoring Order Details)'
                    : 'Tailoring Order & Measurements'}
                </span>
              </div>

              {/* Order Status Pills */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-purple-200">
                {(
                  [
                    { id: 'pending', bn: '🧵 সেলাই চলছে', en: '🧵 Stitching' },
                    { id: 'ready', bn: '✅ তৈরি (Ready)', en: '✅ Ready' },
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

            {/* Row 1: Delivery Date & Trial Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span>{isBn ? 'ডেলিভারির তারিখ (Delivery Date)' : 'Delivery Date'}</span>
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
                  <span>{isBn ? 'ট্রায়াল তারিখ (ঐচ্ছিক / Trial Date)' : 'Trial Date (Optional)'}</span>
                </label>
                <input
                  type="date"
                  value={trialDate}
                  onChange={(e) => setTrialDate(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Row 2: Quick Garment Type Presets (Tap to fill garment type & item name) */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-purple-900 block">
                {isBn ? 'পোশাকের ধরন (ট্যাপ করলে আইটেম বক্সে বসবে):' : 'Garment Type (Tap to select & fill item):'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { labelBn: '👔 শার্ট সেলাই', labelEn: 'Shirt Stitching', type: 'Shirt' },
                  { labelBn: '👖 প্যান্ট সেলাই', labelEn: 'Pant Stitching', type: 'Pant' },
                  { labelBn: '🧥 পাঞ্জাবি / কুর্তা', labelEn: 'Panjabi / Kurta', type: 'Panjabi' },
                  { labelBn: '🤵 স্যুট / ব্লেজার', labelEn: 'Suit / Blazer', type: 'Suit/Blazer' },
                  { labelBn: '👗 সালোয়ার কামিজ', labelEn: 'Salwar Kameez', type: 'Salwar Kameez' },
                  { labelBn: '👚 ব্লাউজ সেলাই', labelEn: 'Blouse Stitching', type: 'Blouse' },
                  { labelBn: '🧕 বোরকা / আবায়া', labelEn: 'Abaya / Burqa', type: 'Burqa' },
                  { labelBn: '🧵 অল্টার / ফিটিং', labelEn: 'Alteration / Fitting', type: 'Alteration' },
                ].map((g) => {
                  const active = measurements.garmentType === g.type;
                  return (
                    <button
                      key={g.type}
                      type="button"
                      onClick={() => {
                        setMeasurements((prev) => ({ ...prev, garmentType: g.type }));
                        setItemName(isBn ? g.labelBn.replace(/^[^\s]+\s/, '') : g.labelEn);
                        nameInputRef.current?.focus();
                      }}
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

            {/* Row 3: Body Measurements Grid (in Inches) */}
            <div className="bg-white p-3 rounded-xl border border-purple-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-purple-950 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5 text-purple-600" />
                  <span>{isBn ? 'শরীরের মাপ (ইঞ্চিতে - ঐচ্ছিক):' : 'Body Measurements (in inches - Optional):'}</span>
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

              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                {[
                  { key: 'length', labelBn: 'লম্বা (Length)', labelEn: 'Length', ph: '40"' },
                  { key: 'chest', labelBn: 'বুক (Chest)', labelEn: 'Chest', ph: '38"' },
                  { key: 'waist', labelBn: 'কোমর (Waist)', labelEn: 'Waist', ph: '34"' },
                  { key: 'shoulder', labelBn: 'পুট/কাঁধ (Shoulder)', labelEn: 'Shoulder', ph: '17.5"' },
                  { key: 'sleeve', labelBn: 'হাতা (Sleeve)', labelEn: 'Sleeve', ph: '24"' },
                  { key: 'neck', labelBn: 'গলা/কলার (Neck)', labelEn: 'Neck/Collar', ph: '15.5"' },
                  { key: 'hip', labelBn: 'হিপ (Hip)', labelEn: 'Hip/Seat', ph: '40"' },
                  { key: 'bottom', labelBn: 'মুহুরি/ঘের (Bottom)', labelEn: 'Bottom/Cuff', ph: '14"' },
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

              {/* Design / Stitching Instructions */}
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-stone-600 mb-1">
                  {isBn
                    ? 'ডিজাইন বা সেলাইয়ের বিশেষ নির্দেশনা (Design / Stitching Note):'
                    : 'Design / Stitching Instructions:'}
                </label>
                <input
                  type="text"
                  value={measurements.designNotes || ''}
                  onChange={(e) =>
                    setMeasurements((prev) => ({ ...prev, designNotes: e.target.value }))
                  }
                  placeholder={
                    isBn
                      ? 'যেমন: চাইনিজ কলার, সাইড পকেট, লুজ ফিটিং, আস্তর সহ...'
                      : 'e.g. Chinese collar, Side pocket, Slim fit, Lining...'
                  }
                  className="w-full bg-stone-50 focus:bg-white border border-stone-200 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CURRENT BILL ITEMS LIST (SHOWN ABOVE ITEM ENTRY FOR INSTANT CHECKING WHILE BILLING) */}
      {billItems.length > 0 && (
        <div
          id="billing-items-list-section"
          className="bg-white rounded-2xl shadow-xs border border-blue-200 overflow-hidden animate-in fade-in duration-150"
        >
          <div className="px-3 py-2.5 border-b border-stone-200 bg-blue-50/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-800">{t.currentBillItems}</span>
              <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {billItems.length}
              </span>
              <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                {isBn ? 'মোট:' : 'Total:'} {sym}
                {subtotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirm(t.clearBillConfirm)) {
                  try {
                    localStorage.removeItem(BILLING_CART_DRAFT_KEY);
                  } catch {}
                  onClearBill();
                  setCustomerName('');
                  setCustomerPhone('');
                  setDiscountValue('');
                  setPaidAmount('');
                  setPaymentMethod('estimate');
                }
              }}
              className="text-[11px] text-stone-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.clearBill}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-stone-100/70 text-stone-600 text-[11px] uppercase tracking-wider font-semibold border-b border-stone-200">
                  <th className="text-left p-2.5 sm:p-3">{isBn ? 'পণ্য' : 'Item'}</th>
                  <th className="text-center p-2.5 sm:p-3 w-24">{t.qty}</th>
                  <th className="text-right p-2.5 sm:p-3">{t.unitPrice}</th>
                  <th className="text-right p-2.5 sm:p-3">{isBn ? 'মোট' : 'Total'}</th>
                  <th className="p-2.5 sm:p-3 w-16 text-right">{isBn ? 'অ্যাকশন' : ''}</th>
                </tr>
              </thead>
              <tbody id="billTable" className="divide-y divide-stone-100">
                {billItems.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const liveEditPrice = parseFloat(editItemPrice) || 0;
                  const liveEditQty = Math.max(0.01, parseFloat(editItemQty) || 1);
                  const liveEditTotal = Math.round(liveEditPrice * liveEditQty * 100) / 100;

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-blue-50/70 transition-colors">
                        <td className="p-2 sm:p-2.5">
                          <input
                            type="text"
                            autoFocus={editFocusField === 'name'}
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditItem(item.id);
                              if (e.key === 'Escape') handleCancelEditItem();
                            }}
                            placeholder={isBn ? 'পণ্যের নাম' : 'Item Name'}
                            className="w-full min-w-[95px] bg-white border border-blue-400 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5 text-center">
                          <div className="inline-flex items-center gap-1">
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
                              className="w-12 bg-white border border-blue-400 rounded-lg px-1 py-1.5 text-xs font-mono font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              autoFocus={editFocusField === 'unit'}
                              value={editItemUnit}
                              onChange={(e) => setEditItemUnit(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditItem(item.id);
                                if (e.key === 'Escape') handleCancelEditItem();
                              }}
                              placeholder={isBn ? 'ইউনিট' : 'Unit'}
                              className="w-14 bg-white border border-blue-400 rounded-lg px-1.5 py-1.5 text-xs font-semibold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
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
                            className="w-20 bg-white border border-blue-400 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-right text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto block"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-blue-900 whitespace-nowrap">
                          {sym}
                          {liveEditTotal.toFixed(2)}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEditItem(item.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-colors cursor-pointer"
                              title={isBn ? 'সেভ করুন' : 'Save changes'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditItem}
                              className="p-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer"
                              title={isBn ? 'বাতিল করুন' : 'Cancel'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                      <td
                        onClick={() => handleStartEditItem(item, 'name')}
                        className="p-2.5 sm:p-3 font-medium text-stone-900 cursor-pointer hover:text-blue-600 transition-colors"
                        title={isBn ? 'নাম পরিবর্তন করতে ট্যাপ করুন' : 'Tap to edit item name'}
                      >
                        <span className="border-b border-dashed border-transparent hover:border-blue-400">
                          {item.name}
                        </span>
                      </td>
                      <td className="p-2.5 sm:p-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-lg border border-stone-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                            className="w-4 h-4 text-stone-600 hover:text-stone-900 font-bold flex items-center justify-center leading-none cursor-pointer"
                          >
                            -
                          </button>
                          <span
                            onClick={() => handleStartEditItem(item, 'qty')}
                            className="font-mono font-bold text-xs px-1 cursor-pointer hover:text-blue-600"
                            title={isBn ? 'সংখ্যা ও ইউনিট পরিবর্তন করতে ট্যাপ করুন' : 'Tap to edit quantity & unit'}
                          >
                            {item.qty}
                            {item.unit ? <span className="font-sans font-semibold text-[11px] text-stone-600 ml-0.5">{item.unit}</span> : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                            className="w-4 h-4 text-stone-600 hover:text-stone-900 font-bold flex items-center justify-center leading-none cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td
                        onClick={() => handleStartEditItem(item, 'price')}
                        className="p-2.5 sm:p-3 text-right font-mono text-stone-600 cursor-pointer hover:text-blue-600 transition-colors whitespace-nowrap"
                        title={isBn ? 'দাম পরিবর্তন করতে ট্যাপ করুন' : 'Tap to edit unit price'}
                      >
                        <span className="border-b border-dashed border-stone-300 hover:border-blue-500">
                          {sym}
                          {item.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2.5 sm:p-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                        {sym}
                        {item.total.toFixed(2)}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditItem(item, 'price')}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title={isBn ? 'এডিট করুন (Edit)' : 'Edit Item'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={isBn ? 'মুছে ফেলুন' : 'Remove'}
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
      )}

      {/* 3. INSTANT ITEM ENTRY & PRODUCT STOCK CARD (SECTION 3 - MIDDLE) */}
      <div
        id="billing-item-entry-section"
        className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-stone-200"
      >
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
          {scanStatusBanner && (
            <div
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
                scanStatusBanner.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <span className="truncate">{scanStatusBanner.message}</span>
              <button
                type="button"
                onClick={() => setScanStatusBanner(null)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* ITEM NAME INPUT + CAMERA BARCODE SCANNER BUTTON + 3-DOT STOCK MENU */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div ref={suggestionContainerRef} className="relative flex-1">
              <input
                ref={nameInputRef}
                type="text"
                id="itemName"
                autoComplete="off"
                value={itemName}
                onFocus={() => {
                  if (enableSavedSuggestions && itemName.trim().length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemName(val);
                  if (enableSavedSuggestions) {
                    setShowSuggestions(val.trim().length > 0);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={handleNameKeyDown}
                placeholder={
                  isBn
                    ? 'পণ্যের নাম লিখুন (যেমন: Shirt, Pant, Panjabi...)'
                    : t.itemNamePlaceholder
                }
                className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />

              {/* OPTIONAL SAVED PRODUCTS DROPDOWN (Only shown if explicitly enabled from 3-dot menu) */}
              {enableSavedSuggestions && showSuggestions && matchingProducts.length > 0 && (
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

            {/* Mobile Camera Barcode Scanner Button */}
            <button
              type="button"
              id="btn-billing-barcode-scanner"
              onClick={() => setIsBarcodeScannerOpen(true)}
              className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title={
                isBn
                  ? 'মোবাইল ক্যামেরা দিয়ে বারকোড স্ক্যান করুন (Scan Barcode)'
                  : 'Scan Barcode with Mobile Camera'
              }
            >
              <Camera className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">
                {isBn ? 'স্ক্যান' : 'Scan'}
              </span>
            </button>

            {/* 3-dot (⋮) menu aligned inline with Item Name input */}
            <div className="relative shrink-0">
              <button
                type="button"
                id="btn-billing-stock-dots"
                onClick={() => setShowStockMoreMenu((prev) => !prev)}
                className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-all flex items-center justify-center cursor-pointer"
                title={isBn ? 'স্টক অপশন (৩ ডট)' : 'Stock Options'}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showStockMoreMenu && (
                <div className="absolute right-0 top-11 w-48 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    id="btn-inline-stock-toggle"
                    onClick={() => {
                      setShowInlineStockAdd((prev) => !prev);
                      setShowStockMoreMenu(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                    <span>{isBn ? 'স্টক যোগ (+ Add Stock)' : '+ Add Stock'}</span>
                  </button>

                  {onOpenProductStock && (
                    <button
                      type="button"
                      id="btn-open-product-stock"
                      onClick={() => {
                        setShowStockMoreMenu(false);
                        onOpenProductStock();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-blue-800 hover:bg-blue-50 flex items-center justify-between gap-2 cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isBn ? 'প্রোডাক্ট স্টক তালিকা' : 'Product Stock'}</span>
                      </span>
                      <span className="bg-blue-600 text-white text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
                        {allSavedProducts.length}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEnableSavedSuggestions((prev) => !prev);
                      setShowSuggestions(false);
                      setShowStockMoreMenu(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center justify-between gap-2 cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isBn ? 'সেভ আইটেম সাজেশন' : 'Saved Item Suggestions'}</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        enableSavedSuggestions
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {enableSavedSuggestions ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: QUANTITY + UNIT (Matches reference screenshot: Quantity on left, Unit on right) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Quantity Input */}
            <div className="relative">
              <input
                ref={qtyInputRef}
                type="number"
                id="itemQty"
                min="0.01"
                step="any"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                placeholder={isBn ? 'সংখ্যা (Quantity)' : 'Quantity'}
                className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Unit Input + Dropdown Selector */}
            <div className="relative">
              <input
                type="text"
                id="itemUnit"
                value={itemUnit}
                onFocus={() => setShowUnitDropdown(true)}
                onChange={(e) => {
                  setItemUnit(e.target.value);
                  setShowUnitDropdown(true);
                }}
                placeholder={isBn ? 'ইউনিট (Unit: Pcs, Set, গজ...)' : 'Unit (e.g. Pcs, Set, Meter)'}
                className="w-full border border-stone-200 bg-stone-50/80 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowUnitDropdown((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 rounded-md cursor-pointer"
                title={isBn ? 'ইউনিট তালিকা দেখুন' : 'Select Unit'}
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {showUnitDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowUnitDropdown(false)}
                  />
                  <div className="absolute right-0 left-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase flex items-center justify-between">
                      <span>{isBn ? 'ইউনিট সিলেক্ট করুন বা টাইপ করুন' : 'Select or Type Unit'}</span>
                      {itemUnit && (
                        <button
                          type="button"
                          onClick={() => {
                            setItemUnit('');
                            setShowUnitDropdown(false);
                          }}
                          className="text-rose-600 hover:underline cursor-pointer"
                        >
                          {isBn ? 'মুছুন' : 'Clear'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      {[
                        { val: 'Pcs', label: isBn ? 'Pcs (পিস)' : 'Pcs (Pieces)' },
                        { val: 'Set', label: isBn ? 'Set (সেট)' : 'Set' },
                        { val: 'Suit', label: isBn ? 'Suit (সুট)' : 'Suit' },
                        { val: 'Pair', label: isBn ? 'Pair (জোড়া)' : 'Pair' },
                        { val: 'Meter', label: isBn ? 'Meter (মিটার)' : 'Meter (m)' },
                        { val: 'Gaz', label: isBn ? 'Gaz (গজ)' : 'Gaz / Yard' },
                        { val: 'पिस', label: 'পিস' },
                        { val: 'সেট', label: 'সেট' },
                        { val: 'গজ', label: 'গজ' },
                        { val: 'মিটার', label: 'মিটার' },
                        { val: 'জোড়া', label: 'জোড়া' },
                        { val: 'Dozen', label: isBn ? 'Dozen (ডজন)' : 'Dozen (Dz)' },
                      ].map((u) => (
                        <button
                          key={u.val}
                          type="button"
                          onClick={() => {
                            setItemUnit(u.val);
                            setShowUnitDropdown(false);
                            priceInputRef.current?.focus();
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer ${
                            itemUnit === u.val
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-stone-100 text-stone-800'
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ROW 3: RATE (PRICE / UNIT) */}
          <div className="relative">
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
              placeholder={isBn ? 'দর / রেট (Rate / Price per Unit)' : 'Rate (Price/Unit)'}
              className={`w-full border border-stone-200 bg-stone-50/80 ${
                sym ? (sym.length > 2 ? 'pl-11' : 'pl-8') : 'pl-3'
              } pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
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

      {/* 4. PAYMENT & CHECKOUT SUMMARY (SECTION 4 - BOTTOM) */}
      <div
        id="billing-checkout-summary-section"
        className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-stone-200 space-y-3"
      >
        {/* 1. TOP: Real-time Order Summary Breakdown (Discount input hidden from top as requested) */}
        <div className="bg-stone-50/90 border border-stone-200 p-3 sm:p-3.5 rounded-2xl space-y-1.5">
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

        {/* 2. MIDDLE: Side-by-Side Paid/Received (Left) & Discount (Right) */}
        <div className="pt-0.5 space-y-2">
          <div className="grid grid-cols-2 gap-2.5">
            {/* LEFT COLUMN: Paid / Received */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 min-h-[24px]">
                <label className="text-[11px] sm:text-xs font-bold text-stone-700 truncate">
                  {isTailoring
                    ? isBn
                      ? `অগ্রিম জমা ${sym ? `(${sym})` : ''}`
                      : `Advance ${sym ? `(${sym})` : ''}`
                    : `${t.paidReceivedLabel} ${sym ? `(${sym})` : ''}`}
                </label>
                {grandTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaidAmount(grandTotal.toFixed(2))}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer shrink-0"
                  >
                    {t.exactBtn}
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
                  className="w-full border border-stone-200 bg-stone-50/80 pl-3 pr-8 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCalculatorTarget('paid');
                    setIsCalculatorModalOpen(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-600 p-1 rounded-md cursor-pointer transition-colors"
                  title={isBn ? 'ক্যালকুলেটর দিয়ে ক্যাশ হিসাব করুন' : 'Calculate Cash'}
                >
                  <Calculator className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Discount (Moved from top to right side as requested) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 min-h-[24px]">
                <label className="text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1 truncate">
                  <Tag className="w-3 h-3 text-blue-600 shrink-0" />
                  <span className="truncate">{isBn ? 'ডিসকাউন্ট' : 'Discount'}</span>
                </label>

                {/* Compact Fixed vs Percent % Toggle */}
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
                  } ${discountValue ? 'pr-12' : 'pr-8'} py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all`}
                />
                {discountValue && (
                  <button
                    type="button"
                    onClick={() => setDiscountValue('')}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-600 p-0.5 rounded cursor-pointer text-xs font-bold"
                    title={isBn ? 'ডিসকাউন্ট মুছুন' : 'Clear Discount'}
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

          {paidNum > grandTotal && (
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between">
              <span>{t.changeToReturn}</span>
              <span className="font-mono text-sm">
                {sym}
                {changeAmount.toFixed(2)}
              </span>
            </div>
          )}

          {(isTailoring || paymentMethod === 'due' || (paidAmount.trim() !== '' && paidNum < grandTotal)) &&
            grandTotal > 0 &&
            Math.max(0, grandTotal - (paidAmount.trim() !== '' ? paidNum : 0)) > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
                <span>
                  {isTailoring
                    ? isBn
                      ? 'ডেলিভারির সময় বাকি (Balance Due on Delivery):'
                      : 'Balance Due on Delivery:'
                    : isBn
                    ? 'বাকি টাকা (Balance Due):'
                    : 'Balance Due:'}
                </span>
                <span className="font-mono text-sm font-black text-rose-600">
                  {sym}
                  {Math.max(0, grandTotal - (paidAmount.trim() !== '' ? paidNum : 0)).toFixed(2)}
                </span>
              </div>
            )}
        </div>

        {/* 4. BOTTOM: Payment Method Selection Buttons (Estimate | Cash | UPI | Due) */}
        <div className="pt-1.5 border-t border-stone-100">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
            {t.paymentModeLabel}
          </label>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {[
              { id: 'estimate', label: 'Estimate', icon: FileText },
              { id: 'cash', label: t.modeCash, icon: Banknote },
              { id: 'upi', label: t.modeUpi, icon: QrCode },
              { id: 'due', label: t.modeDue, icon: Clock },
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    const nextMode = method.id as PaymentMethod;
                    setPaymentMethod(nextMode);
                    if (nextMode === 'due' && paidNum >= grandTotal) {
                      setPaidAmount('');
                    }
                  }}
                  className={`py-2.5 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold text-center border transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/20 scale-[1.02]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                      isSelected ? 'text-white' : 'text-stone-500'
                    }`}
                  />
                  <span className="truncate">{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. VERY BOTTOM: Two Side-by-Side Action Buttons (Save Bill & Direct Print) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Button 1: Save Bill Only */}
          <button
            type="button"
            id="billing-save-btn"
            onClick={() => handleCheckoutAndPrint('save')}
            disabled={!canCheckout || isPrinting}
            className={`w-full py-3.5 px-3 rounded-2xl font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              canCheckout && !isPrinting
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md active:scale-[0.99]'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.5]" />
            <span className="truncate">
              {isBn ? 'বিল সেভ করুন' : language === 'hi' ? 'बिल सेव करें' : 'Save Bill'}
            </span>
            <span className="opacity-90 font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
              #{invoiceNo || storageService.getNextInvoiceNumber()}
            </span>
          </button>

          {/* Button 2: Direct Print Bill */}
          <button
            type="button"
            id="billing-print-btn"
            onClick={() => handleCheckoutAndPrint('print')}
            disabled={!canCheckout || isPrinting}
            className={`w-full py-3.5 px-3 rounded-2xl font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              canCheckout && !isPrinting
                ? 'bg-[#6E68D8] hover:bg-[#5E58C8] active:bg-[#534DA8] text-white shadow-md active:scale-[0.99]'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isPrinting ? (
              <>
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                <span className="truncate">{t.generatingInvoice}</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">
                  {isBn ? 'প্রিন্ট করুন' : language === 'hi' ? 'प्रिंट करें' : 'Print Bill'}
                </span>
                <span className="opacity-90 font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                  #{invoiceNo || storageService.getNextInvoiceNumber()}
                </span>
              </>
            )}
          </button>
        </div>
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

      {/* MOBILE CAMERA BARCODE SCANNER MODAL (html5-qrcode + BarcodeDetector + Beep) */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        language={language}
      />
    </div>
  );
};
