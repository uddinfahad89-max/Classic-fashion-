import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Printer,
  Package,
  Layers,
  ArrowRight,
  Eye,
  Store,
  DollarSign,
  Tag,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import JsBarcode from 'jsbarcode';
import { ProductStockItem, ThermalPrinterSettings, Language } from '../types';
import { bengaliToEnglishDigits, makeValidEan13 } from '../utils/barcodeUtils';
import { generateAutoSkuFromName } from './ProductStockModal';

// Crisp Barcode Canvas for live preview in the extracted table
const MiniBarcodePreview: React.FC<{ value: string; className?: string }> = ({
  value,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const rawClean = (value || '').trim();
    if (!rawClean) {
      setDataUrl('');
      return;
    }
    const clean = bengaliToEnglishDigits(rawClean);
    try {
      const canvas = document.createElement('canvas');
      const dpr = 2;
      const numericOnly = clean.replace(/\D/g, '');
      const isEan = numericOnly.length === 12 || numericOnly.length === 13;
      const format = isEan ? 'EAN13' : 'CODE128';
      const codeToRender = isEan ? makeValidEan13(numericOnly) : clean;

      JsBarcode(canvas, codeToRender, {
        format,
        width: Math.max(1.8, Math.round(1.4 * dpr)),
        height: Math.round(28 * dpr),
        displayValue: true,
        fontSize: Math.round(10 * dpr),
        font: 'monospace',
        fontOptions: 'bold',
        textMargin: Math.round(2 * dpr),
        margin: Math.round(4 * dpr),
        background: '#ffffff',
        lineColor: '#000000',
      });
      setDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setDataUrl('');
    }
  }, [value]);

  if (!dataUrl) {
    return <span className="font-mono text-xs font-bold text-stone-700">{value}</span>;
  }

  return (
    <div className={`inline-flex flex-col items-center bg-white p-1 rounded-md border border-stone-200 shadow-2xs ${className}`}>
      <img src={dataUrl} alt={value} className="h-8 max-w-[130px] object-contain select-none" />
    </div>
  );
};

export interface ExtractedBillItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  purchasePrice: number;
  totalAmount: number;
  suggestedSalePrice: number;
  category: string;
  barcode: string;
}

interface PurchaseBillUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProductsBatch: (
    products: Array<{
      name: string;
      price: number;
      purchasePrice?: number;
      stock?: number;
      addStockDelta?: number;
      unit?: string;
      category?: string;
      barcode?: string;
    }>
  ) => void;
  onOpenBarcodeStudioWithProducts?: (products: ProductStockItem[]) => void;
  onRecordCashExpense?: (amount: number, note: string) => void;
  settings: ThermalPrinterSettings;
  language?: Language;
}

export const PurchaseBillUploadModal: React.FC<PurchaseBillUploadModalProps> = ({
  isOpen,
  onClose,
  onSaveProductsBatch,
  onOpenBarcodeStudioWithProducts,
  onRecordCashExpense,
  settings,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profit markup setting for calculating selling price from wholesale cost
  const [profitMargin, setProfitMargin] = useState<number>(25);

  // Extracted Bill Details
  const [supplierName, setSupplierName] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [billDate, setBillDate] = useState<string>('');
  const [extractedItems, setExtractedItems] = useState<ExtractedBillItem[]>([]);
  const [totalBillAmount, setTotalBillAmount] = useState<number>(0);
  const [showImagePreview, setShowImagePreview] = useState<boolean>(false);

  // Options
  const [recordCashExpense, setRecordCashExpense] = useState<boolean>(false);

  // Saved success state
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [savedProductsList, setSavedProductsList] = useState<ProductStockItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setIsProcessing(false);
      setErrorMsg(null);
      setSupplierName('');
      setBillNo('');
      setBillDate('');
      setExtractedItems([]);
      setTotalBillAmount(0);
      setIsSavedSuccess(false);
      setSavedCount(0);
      setSavedProductsList([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Process chosen image file
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setErrorMsg(null);
    setIsSavedSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        // Compress/resize if needed using a canvas to ensure quick upload
        const img = new Image();
        img.onload = () => {
          const maxDim = 1800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.88);
            setImagePreview(optimizedBase64);
            setImageMime('image/jpeg');
            triggerAiParse(optimizedBase64, 'image/jpeg');
          } else {
            setImagePreview(result);
            setImageMime(file.type || 'image/jpeg');
            triggerAiParse(result, file.type || 'image/jpeg');
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Trigger Gemini AI Multimodal Parsing
  const triggerAiParse = async (base64Str: string, mime: string) => {
    setIsProcessing(true);
    setProcessingStep(
      isBn ? '📄 বিলের ছবি স্ক্যান করা হচ্ছে...' : 'Scanning purchase bill image...'
    );

    try {
      setProcessingStep(
        isBn
          ? '🤖 AI দিয়ে পণ্য, পাইকারি দর ও পরিমাণ বের করা হচ্ছে...'
          : 'Extracting products, quantities & wholesale rates...'
      );

      const res = await fetch('/api/ai/parse-purchase-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Str,
          mimeType: mime,
          defaultMarginPercent: profitMargin,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to parse bill');
      }

      const data = json.data || {};
      setSupplierName(data.supplierName || '');
      setBillNo(data.billNo || '');
      setBillDate(data.billDate || new Date().toISOString().slice(0, 10));

      setProcessingStep(isBn ? '🏷️ স্বয়ংক্রিয় বারকোড তৈরি হচ্ছে...' : 'Generating automatic barcodes...');

      const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
      let calculatedTotal = 0;

      const formatted: ExtractedBillItem[] = rawItems.map((item, idx) => {
        const cleanName = (item.name || `Product ${idx + 1}`).trim();
        const qty = parseFloat(item.qty) > 0 ? parseFloat(item.qty) : 1;
        const purchasePrice =
          parseFloat(item.purchasePrice) >= 0 ? parseFloat(item.purchasePrice) : 0;
        const total =
          parseFloat(item.totalAmount) > 0 ? parseFloat(item.totalAmount) : purchasePrice * qty;
        calculatedTotal += total;

        let salePrice = parseFloat(item.suggestedSalePrice);
        if (isNaN(salePrice) || salePrice <= purchasePrice) {
          salePrice = Math.round(purchasePrice * (1 + profitMargin / 100));
        }

        // Generate smart automatic barcode encoding the purchase cost
        const seed = String(Math.floor(100000 + Math.random() * 900000));
        const autoBarcode = generateAutoSkuFromName(cleanName, seed, purchasePrice);

        return {
          id: `item-${Date.now()}-${idx}`,
          name: cleanName,
          qty,
          unit: item.unit || 'Pcs',
          purchasePrice,
          totalAmount: total,
          suggestedSalePrice: salePrice,
          category: item.category || 'General',
          barcode: autoBarcode,
        };
      });

      setExtractedItems(formatted);
      setTotalBillAmount(data.totalBillAmount || calculatedTotal);

      if (formatted.length === 0) {
        setErrorMsg(
          isBn
            ? 'বিলের ছবিতে কোনো পণ্যের স্পষ্ট তালিকা পাওয়া যায়নি। পরিষ্কার ছবি দিয়ে পুনরায় চেষ্টা করুন।'
            : 'No clear product items found in this bill image. Please try with a clearer photo.'
        );
      }
    } catch (e: any) {
      console.error('AI Parse error:', e);
      setErrorMsg(
        e.message || (isBn ? 'বিল স্ক্যান করতে ব্যর্থ হয়েছে।' : 'Failed to scan bill.')
      );
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Re-generate Barcode for an item
  const handleRegenerateBarcode = (itemId: string) => {
    setExtractedItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const newSeed = String(Math.floor(100000 + Math.random() * 900000));
        return {
          ...it,
          barcode: generateAutoSkuFromName(it.name, newSeed, it.purchasePrice),
        };
      })
    );
  };

  // Update Item in Table
  const handleUpdateItem = (itemId: string, field: keyof ExtractedBillItem, value: any) => {
    setExtractedItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: value };
        if (field === 'qty' || field === 'purchasePrice') {
          updated.totalAmount = updated.qty * updated.purchasePrice;
          // If cost changed, regenerate auto barcode encoding cost
          if (field === 'purchasePrice') {
            const seed = String(Math.floor(100000 + Math.random() * 900000));
            updated.barcode = generateAutoSkuFromName(updated.name, seed, updated.purchasePrice);
            updated.suggestedSalePrice = Math.round(
              updated.purchasePrice * (1 + profitMargin / 100)
            );
          }
        }
        return updated;
      })
    );
  };

  // Add extra empty row
  const handleAddRow = () => {
    const seed = String(Math.floor(100000 + Math.random() * 900000));
    const newBarcode = generateAutoSkuFromName('ITEM', seed, 0);
    const newItem: ExtractedBillItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      name: '',
      qty: 1,
      unit: 'Pcs',
      purchasePrice: 0,
      totalAmount: 0,
      suggestedSalePrice: 0,
      category: 'General',
      barcode: newBarcode,
    };
    setExtractedItems((prev) => [...prev, newItem]);
  };

  // Delete row
  const handleDeleteRow = (itemId: string) => {
    setExtractedItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Recalculate all sale prices with a new profit margin
  const handleApplyMargin = (newMargin: number) => {
    setProfitMargin(newMargin);
    setExtractedItems((prev) =>
      prev.map((it) => ({
        ...it,
        suggestedSalePrice: Math.round(it.purchasePrice * (1 + newMargin / 100)),
      }))
    );
  };

  // Confirm and Save All to Product Stock
  const handleSaveToStock = () => {
    const validItems = extractedItems.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      alert(
        isBn
          ? 'কমপক্ষে একটি পণ্যের নাম লিখুন।'
          : 'Please enter at least one valid product name.'
      );
      return;
    }

    const payload = validItems.map((it) => ({
      name: it.name.trim(),
      price: it.suggestedSalePrice > 0 ? it.suggestedSalePrice : it.purchasePrice,
      purchasePrice: it.purchasePrice,
      addStockDelta: it.qty,
      unit: it.unit || 'Pcs',
      category: it.category || 'General',
      barcode: it.barcode,
    }));

    onSaveProductsBatch(payload);

    // Optionally record expense
    if (recordCashExpense && onRecordCashExpense) {
      const grandTotal = validItems.reduce((sum, it) => sum + it.totalAmount, 0);
      if (grandTotal > 0) {
        const note = `${isBn ? 'পাইকারি মাল ক্রয়' : 'Stock Purchase'}${
          supplierName ? `: ${supplierName}` : ''
        }${billNo ? ` (বিল #${billNo})` : ''}`;
        onRecordCashExpense(grandTotal, note);
      }
    }

    // Trigger celebration
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}

    // Prepare list for barcode studio
    const simulatedProds: ProductStockItem[] = validItems.map((it, idx) => ({
      id: `saved-prod-${Date.now()}-${idx}`,
      name: it.name.trim(),
      price: it.suggestedSalePrice > 0 ? it.suggestedSalePrice : it.purchasePrice,
      purchasePrice: it.purchasePrice,
      stock: it.qty,
      unit: it.unit,
      barcode: it.barcode,
      category: it.category,
      updatedAt: Date.now(),
    }));

    setSavedProductsList(simulatedProds);
    setSavedCount(validItems.length);
    setIsSavedSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* 1. Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  {isBn
                    ? 'AI পারচেজ বিল স্ক্যান ও অটো স্টক বারকোড'
                    : 'AI Purchase Bill to Stock & Barcodes'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-900 font-black text-[10px] uppercase">
                  AUTO SKU
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-medium">
                {isBn
                  ? 'বিলের ছবি আপলোড করলেই স্বয়ংক্রিয়ভাবে প্রোডাক্ট বের হবে, স্টকে যোগ হবে এবং বারকোড তৈরি হয়ে যাবে'
                  : 'Upload bill image to automatically extract products, add stock & generate barcodes'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Body Area */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* SUCCESS SCREEN */}
          {isSavedSuccess ? (
            <div className="py-8 px-4 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-stone-900">
                  {isBn
                    ? `✓ ${savedCount}টি প্রোডাক্ট সফলভাবে স্টকে যোগ হয়েছে!`
                    : `✓ ${savedCount} products added to stock successfully!`}
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto">
                  {isBn
                    ? 'প্রতিটি পণ্যের কেনা দামের সাথে মিলিয়ে ইউনিক বারকোড (SKU) তৈরি করা হয়েছে। আপনি এখন সরাসরি বারকোড লেবেল স্টিকার প্রিন্ট করতে পারেন।'
                    : 'Unique barcodes (SKUs) have been generated for all items. You can now print barcode label stickers directly.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
                {onOpenBarcodeStudioWithProducts && savedProductsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBarcodeStudioWithProducts(savedProductsList);
                    }}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isBn ? '🖨️ এই মালের বারকোড লেবেল প্রিন্ট করুন' : 'Print Barcode Labels'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  {isBn ? 'সম্পন্ন (Done)' : 'Done'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* UPLOAD / CAPTURE BUTTONS (If no image or want to change) */}
              {!imagePreview && (
                <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-3xl p-6 sm:p-10 text-center space-y-4 transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-black text-stone-900">
                      {isBn
                        ? 'পারচেজ বিল বা মেমোর ছবি আপলোড করুন'
                        : 'Upload Purchase Bill or Invoice Photo'}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md mx-auto">
                      {isBn
                        ? 'দোকানদার বা পাইকারদের দেওয়া যেকোনো হাতে লেখা বা ছাপানো ক্যাশ মেমো, ইনভয়েস বা চালানের ছবি তুলুন।'
                        : 'Take a photo or upload any printed or handwritten wholesale invoice, memo, or challan.'}
                    </p>
                  </div>

                  {/* Dual Action Buttons: Camera vs File Upload */}
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isBn ? '📸 ক্যামেরা দিয়ে ছবি তুলুন' : 'Take Photo (Camera)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isBn ? '📁 গ্যালারি বা ফাইল থেকে নিন' : 'Choose File / Gallery'}</span>
                    </button>
                  </div>

                  {/* Hidden inputs */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
              )}

              {/* PROCESSING ANIMATION */}
              {isProcessing && (
                <div className="py-12 px-4 text-center space-y-4 bg-stone-50 rounded-3xl border border-stone-200">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white animate-pulse shadow-lg">
                      <Sparkles className="w-8 h-8 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-stone-900">{processingStep}</h4>
                    <p className="text-xs text-stone-500">
                      {isBn
                        ? 'মডেল বিলের প্রতিটি পণ্যের নাম, দাম, সংখ্যা ও বারকোড সাজাচ্ছে...'
                        : 'AI is reading each item name, rate, quantity & encoding barcodes...'}
                    </p>
                  </div>
                </div>
              )}

              {/* ERROR ALERT */}
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setImagePreview(null);
                    }}
                    className="px-2.5 py-1 bg-rose-200/70 hover:bg-rose-200 rounded-lg text-rose-900 font-bold shrink-0 cursor-pointer"
                  >
                    {isBn ? 'নতুন ছবি দিন' : 'Try Again'}
                  </button>
                </div>
              )}

              {/* 3. EXTRACTED PRODUCTS REVIEW TABLE */}
              {!isProcessing && extractedItems.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Bill Metadata Banner */}
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-stone-800">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-stone-500">{isBn ? 'সাপ্লায়ার:' : 'Supplier:'}</span>
                        <input
                          type="text"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder={isBn ? 'দোকান বা মহাজনের নাম' : 'Supplier Name'}
                          className="bg-white border border-stone-200 rounded-lg px-2 py-1 font-bold text-stone-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {billNo && (
                        <span className="text-stone-600 font-mono">
                          {isBn ? 'বিল নং:' : 'Bill #'}{' '}
                          <strong className="text-stone-900">{billNo}</strong>
                        </span>
                      )}

                      {billDate && (
                        <span className="text-stone-600">
                          {isBn ? 'তারিখ:' : 'Date:'}{' '}
                          <strong className="text-stone-900">{billDate}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => setShowImagePreview((prev) => !prev)}
                          className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg font-bold text-stone-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          <span>{showImagePreview ? (isBn ? 'ছবি লুকান' : 'Hide Bill') : (isBn ? 'আসল ছবি দেখুন' : 'View Bill')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setExtractedItems([]);
                        }}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-bold cursor-pointer"
                      >
                        {isBn ? 'পুনরায় স্ক্যান' : 'Rescan'}
                      </button>
                    </div>
                  </div>

                  {/* Original Image Toggle Preview */}
                  {showImagePreview && imagePreview && (
                    <div className="p-2 bg-stone-900 rounded-2xl flex justify-center max-h-64 overflow-hidden border border-stone-800 animate-in fade-in duration-150">
                      <img
                        src={imagePreview}
                        alt="Uploaded Bill"
                        className="max-h-60 object-contain rounded-lg"
                      />
                    </div>
                  )}

                  {/* Profit Margin Quick Adjuster */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isBn ? 'বিক্রয় মূল্যে লাভ (Profit Margin):' : 'Selling Price Margin:'}</span>
                    </span>
                    <div className="inline-flex items-center bg-white rounded-xl p-0.5 border border-indigo-200 text-xs font-bold shadow-2xs">
                      {[15, 20, 25, 30, 40].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleApplyMargin(m)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            profitMargin === m
                              ? 'bg-indigo-600 text-white font-black shadow-xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          +{m}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-100/90 text-stone-700 font-extrabold border-b border-stone-200">
                            <th className="py-2.5 px-3 w-10">#</th>
                            <th className="py-2.5 px-3 min-w-[150px]">
                              {isBn ? 'পণ্যের নাম (Item Name)' : 'Product Name'}
                            </th>
                            <th className="py-2.5 px-3 w-20 text-right">
                              {isBn ? 'পরিমাণ (Qty)' : 'Quantity'}
                            </th>
                            <th className="py-2.5 px-3 w-16 text-center">
                              {isBn ? 'ইউনিট' : 'Unit'}
                            </th>
                            <th className="py-2.5 px-3 w-24 text-right">
                              {isBn ? 'কেনা দর (Cost)' : 'Cost Price'}
                            </th>
                            <th className="py-2.5 px-3 w-24 text-right">
                              {isBn ? 'বিক্রয় দর (Sale)' : 'Sale Price'}
                            </th>
                            <th className="py-2.5 px-3 min-w-[140px] text-center">
                              {isBn ? 'অটো বারকোড (Auto Barcode)' : 'Barcode (Auto SKU)'}
                            </th>
                            <th className="py-2.5 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {extractedItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-stone-400">
                                {idx + 1}
                              </td>

                              {/* Name */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                  className="w-full bg-transparent font-bold text-stone-900 border-b border-transparent hover:border-stone-300 focus:border-blue-500 focus:bg-white px-1.5 py-0.5 rounded text-xs"
                                  placeholder="Product Name"
                                />
                              </td>

                              {/* Qty */}
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'qty',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-right font-mono font-bold text-stone-900 border border-stone-200 rounded-lg px-1.5 py-0.5 focus:border-blue-500 text-xs"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                                  className="w-14 text-center font-bold text-stone-600 border border-stone-200 rounded-lg px-1 py-0.5 focus:border-blue-500 text-xs"
                                />
                              </td>

                              {/* Purchase Price */}
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.purchasePrice}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'purchasePrice',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 text-right font-mono font-bold text-stone-700 bg-amber-50/60 border border-amber-200 rounded-lg px-1.5 py-0.5 focus:border-blue-500 text-xs"
                                />
                              </td>

                              {/* Sale Price */}
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.suggestedSalePrice}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'suggestedSalePrice',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 text-right font-mono font-black text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-lg px-1.5 py-0.5 focus:border-blue-500 text-xs"
                                />
                              </td>

                              {/* Barcode Preview & Regenerate */}
                              <td className="py-2 px-2 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <MiniBarcodePreview value={item.barcode} />
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateBarcode(item.id)}
                                    title={isBn ? 'নতুন বারকোড তৈরি' : 'Regenerate Barcode'}
                                    className="p-1 rounded-md text-stone-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Delete */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(item.id)}
                                  className="text-stone-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer: Add row & summary */}
                    <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />
                        <span>{isBn ? '+ আরো আইটেম যোগ করুন' : '+ Add Item'}</span>
                      </button>

                      <div className="flex items-center gap-4 font-mono font-bold text-stone-700">
                        <span>
                          {isBn ? 'মোট আইটেম:' : 'Total Items:'}{' '}
                          <strong className="text-stone-900">{extractedItems.length}</strong>
                        </span>
                        <span>
                          {isBn ? 'মোট পিস:' : 'Total Qty:'}{' '}
                          <strong className="text-stone-900">
                            {extractedItems.reduce((s, it) => s + (it.qty || 0), 0)}
                          </strong>
                        </span>
                        <span>
                          {isBn ? 'মোট কেনা দাম:' : 'Total Cost:'}{' '}
                          <strong className="text-emerald-700 font-black">
                            {sym}
                            {extractedItems
                              .reduce((s, it) => s + (it.totalAmount || 0), 0)
                              .toFixed(0)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cashbook Record Option */}
                  {onRecordCashExpense && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950 select-none">
                        <input
                          type="checkbox"
                          checked={recordCashExpense}
                          onChange={(e) => setRecordCashExpense(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>
                          {isBn
                            ? '💰 ক্যাশবুকে এই কেনাকাটার খরচ স্বয়ংক্রিয়ভাবে রেকর্ড করুন'
                            : 'Record this total bill as an expense entry in Cashbook'}
                        </span>
                      </label>
                      <span className="text-amber-800 font-mono font-black">
                        {sym}
                        {extractedItems
                          .reduce((s, it) => s + (it.totalAmount || 0), 0)
                          .toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 4. Bottom Actions */}
        {!isSavedSuccess && extractedItems.length > 0 && !isProcessing && (
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer transition-colors"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSaveToStock}
              className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all"
            >
              <Package className="w-4 h-4" />
              <span>
                {isBn
                  ? `✓ সব (${extractedItems.length}টি) প্রোডাক্ট স্টকে যোগ ও বারকোড সেভ করুন`
                  : `Save all (${extractedItems.length}) Products & Barcodes to Stock`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
