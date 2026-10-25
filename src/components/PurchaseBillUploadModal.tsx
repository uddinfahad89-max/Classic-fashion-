import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Printer,
  Package,
  Eye,
  Store,
  Tag,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import JsBarcode from 'jsbarcode';
import Tesseract from 'tesseract.js';
import { ProductStockItem, ThermalPrinterSettings, Language } from '../types';
import { bengaliToEnglishDigits, makeValidEan13 } from '../utils/barcodeUtils';
import { generateAutoSkuFromName } from './ProductStockModal';
import { parseBillOcrText } from '../utils/billOcrParser';

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
    <div
      className={`inline-flex flex-col items-center bg-white p-1 rounded-md border border-stone-200 shadow-2xs ${className}`}
    >
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
  existingProducts?: ProductStockItem[];
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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [ocrEngineUsed, setOcrEngineUsed] = useState<'cloud' | 'local' | null>(null);
  const [detectedRawLines, setDetectedRawLines] = useState<string[]>([]);
  const [showDetectedLines, setShowDetectedLines] = useState<boolean>(false);

  // Profit markup setting for calculating selling price from wholesale cost
  const [profitMargin, setProfitMargin] = useState<number>(25);

  // Extracted Bill Details
  const [supplierName, setSupplierName] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [billDate, setBillDate] = useState<string>('');
  const [extractedItems, setExtractedItems] = useState<ExtractedBillItem[]>([]);
  const [, setTotalBillAmount] = useState<number>(0);

  // Image viewer controls (Zoom, Pan, Expand)
  const [showImagePreview, setShowImagePreview] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Options
  const [recordCashExpense, setRecordCashExpense] = useState<boolean>(false);

  // Saved success state
  const [isSavedSuccess, setIsSavedSuccess] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [savedProductsList, setSavedProductsList] = useState<ProductStockItem[]>([]);

  // Live Camera Viewfinder State
  const [isLiveCameraActive, setIsLiveCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream cleanly
  const stopLiveCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsLiveCameraActive(false);
    setIsTorchOn(false);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setImagePreview(null);
      setIsProcessing(false);
      setSupplierName('');
      setBillNo('');
      setBillDate('');
      setExtractedItems([]);
      setTotalBillAmount(0);
      setIsSavedSuccess(false);
      setSavedCount(0);
      setSavedProductsList([]);
      setDetectedRawLines([]);
      setZoomLevel(1);
    }
  }, [isOpen, stopLiveCamera]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, [stopLiveCamera]);

  if (!isOpen) return null;

  // Start in-app live camera viewfinder
  const startLiveCamera = async (facing: 'environment' | 'user' = 'environment') => {
    try {
      stopLiveCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setIsLiveCameraActive(true);
      setCameraFacing(facing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.warn('Video play warning:', err));
      }

      // Check torch / flash support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }
    } catch (err) {
      console.warn('Live camera access error, falling back to file camera input:', err);
      // Fallback directly to native mobile camera via file input
      setIsLiveCameraActive(false);
      cameraInputRef.current?.click();
    }
  };

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const newTorch = !isTorchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: newTorch }],
        });
        setIsTorchOn(newTorch);
      } catch (e) {
        console.warn('Could not toggle torch:', e);
      }
    }
  };

  // Capture photo from live camera video frame
  const handleCaptureLiveFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    stopLiveCamera();
    setImagePreview(capturedDataUrl);
    processBillImage(capturedDataUrl, 'image/jpeg');
  };

  // Switch between back and front camera
  const handleSwitchCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startLiveCamera(nextFacing);
  };

  // Process chosen image file from gallery or native camera input
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setIsSavedSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
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
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
            setImagePreview(optimizedBase64);
            processBillImage(optimizedBase64, 'image/jpeg');
          } else {
            setImagePreview(result);
            processBillImage(result, file.type || 'image/jpeg');
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Master Extraction Pipeline: Dual Engine (Tries Cloud, Seamlessly falls back to Free On-Device OCR)
  const processBillImage = async (base64Str: string, mime: string) => {
    setIsProcessing(true);
    setProcessingProgress(10);
    setProcessingStep(
      isBn ? '📄 বিলের ছবি প্রস্তুত করা হচ্ছে...' : 'Preparing bill image...'
    );

    let parsedSuccess = false;

    // 1. Try Server Endpoint (if available with Gemini API)
    try {
      setProcessingStep(
        isBn
          ? '🔍 বিল স্ক্যান করা হচ্ছে...'
          : 'Scanning purchase invoice...'
      );
      setProcessingProgress(30);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s quick timeout

      const res = await fetch('/api/ai/parse-purchase-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Str,
          mimeType: mime,
          defaultMarginPercent: profitMargin,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const rawText = await res.text();
        const json = JSON.parse(rawText);
        if (json && json.success && json.data) {
          const data = json.data;
          setSupplierName(data.supplierName || '');
          setBillNo(data.billNo || '');
          setBillDate(data.billDate || new Date().toISOString().slice(0, 10));

          const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
          if (rawItems.length > 0) {
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
            setOcrEngineUsed('cloud');
            parsedSuccess = true;
          }
        }
      }
    } catch {
      // Cloud OCR not available or timed out — silently transition to free local OCR
    }

    // 2. Free On-Device OCR with Tesseract.js (Zero Cost, No Paid API Required)
    if (!parsedSuccess) {
      try {
        setProcessingStep(
          isBn
            ? '🔍 বিনামূল্যে অন-ডিভাইস OCR দিয়ে বিল রিড হচ্ছে...'
            : 'Reading bill text with free on-device OCR...'
        );
        setProcessingProgress(45);

        const ocrResult = await Tesseract.recognize(base64Str, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              const pct = Math.min(95, Math.round(m.progress * 100));
              setProcessingProgress(pct);
            }
          },
        });

        const recognizedText = ocrResult?.data?.text || '';
        const parsed = parseBillOcrText(recognizedText, profitMargin);

        if (parsed.supplierName) setSupplierName(parsed.supplierName);
        if (parsed.billNo) setBillNo(parsed.billNo);
        if (parsed.billDate) setBillDate(parsed.billDate);
        if (parsed.totalBillAmount) setTotalBillAmount(parsed.totalBillAmount);
        setDetectedRawLines(parsed.rawLines || []);

        if (parsed.items.length > 0) {
          setExtractedItems(parsed.items);
          setOcrEngineUsed('local');
          parsedSuccess = true;
        }
      } catch (localOcrErr) {
        console.warn('Local OCR notice:', localOcrErr);
      }
    }

    // 3. Fallback: If OCR found 0 items (e.g. handwriting or poor lighting),
    // NEVER fail with an error! Open the visual review screen with starter row and the photo pinned!
    if (!parsedSuccess || extractedItems.length === 0) {
      const seed = String(Math.floor(100000 + Math.random() * 900000));
      const starterItem: ExtractedBillItem = {
        id: `starter-${Date.now()}`,
        name: '',
        qty: 1,
        unit: 'Pcs',
        purchasePrice: 0,
        totalAmount: 0,
        suggestedSalePrice: 0,
        category: 'General',
        barcode: generateAutoSkuFromName('ITEM', seed, 0),
      };
      setExtractedItems([starterItem]);
      setOcrEngineUsed('local');
    }

    setIsProcessing(false);
    setProcessingStep('');
    setProcessingProgress(100);
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
          if (field === 'purchasePrice') {
            const seed = String(Math.floor(100000 + Math.random() * 900000));
            updated.barcode = generateAutoSkuFromName(updated.name, seed, updated.purchasePrice);
            updated.suggestedSalePrice = Math.round(
              updated.purchasePrice * (1 + profitMargin / 100)
            );
          }
        }
        if (field === 'name') {
          const seed = String(Math.floor(100000 + Math.random() * 900000));
          updated.barcode = generateAutoSkuFromName(updated.name, seed, updated.purchasePrice);
        }
        return updated;
      })
    );
  };

  // Add extra empty row
  const handleAddRow = (prefilledName?: string) => {
    const seed = String(Math.floor(100000 + Math.random() * 900000));
    const name = prefilledName || '';
    const newBarcode = generateAutoSkuFromName(name || 'ITEM', seed, 0);
    const newItem: ExtractedBillItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      name,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* 1. Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  {isBn
                    ? 'বিল স্ক্যান ও অটো স্টক বারকোড'
                    : 'Bill Scanner to Stock & Barcodes'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-900 font-black text-[9px] uppercase tracking-wider">
                  FREE OCR & SKU
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-medium line-clamp-1">
                {isBn
                  ? 'বিলের ছবি তুলুন বা সিলেক্ট করুন — আইটেম ও বারকোড সরাসরি স্টকে যোগ হবে'
                  : 'Snap or upload bill — items & auto-SKU barcodes are saved straight to stock'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Body Area */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
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
              {/* LIVE CAMERA VIEWFINDER MODAL OVERLAY */}
              {isLiveCameraActive && (
                <div className="p-3 bg-stone-950 rounded-3xl border border-stone-800 text-white space-y-3 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Camera className="w-4 h-4" />
                      <span>{isBn ? 'লাইভ ক্যামেরা ভিউফাইন্ডার' : 'Live Camera Viewfinder'}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                            isTorchOn
                              ? 'bg-amber-400 text-stone-950 border-amber-300'
                              : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{isTorchOn ? (isBn ? 'ফ্ল্যাশ অন' : 'Torch On') : (isBn ? 'ফ্ল্যাশ' : 'Torch')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSwitchCameraFacing}
                        className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title={isBn ? 'ক্যামেরা পরিবর্তন' : 'Switch Camera'}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{cameraFacing === 'environment' ? 'Back' : 'Front'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopLiveCamera}
                        className="p-1.5 rounded-xl bg-stone-800 hover:bg-rose-900 border border-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Video Viewport with Target Framing Overlay */}
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 sm:aspect-16/9 flex items-center justify-center border border-stone-800">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Framing guide */}
                    <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between text-[10px] text-white/80 font-mono">
                        <span>┌ TOP LEFT</span>
                        <span>TOP RIGHT ┐</span>
                      </div>
                      <div className="text-center">
                        <span className="px-3 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold backdrop-blur-xs">
                          {isBn ? 'বিলের পুরো অংশটি ফ্রেমের মাঝে রাখুন' : 'Align bill within frame'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-white/80 font-mono">
                        <span>└ BTM LEFT</span>
                        <span>BTM RIGHT ┘</span>
                      </div>
                    </div>
                  </div>

                  {/* Shutter Button */}
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        stopLiveCamera();
                        fileInputRef.current?.click();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                    >
                      {isBn ? '📁 গ্যালারি থেকে' : 'From Gallery'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCaptureLiveFrame}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white hover:bg-stone-100 p-1 flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-transform"
                    >
                      <div className="w-full h-full rounded-full border-4 border-blue-600 bg-white flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-blue-600" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                    >
                      {isBn ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* UPLOAD / CAPTURE HERO AREA (When no image or before scan) */}
              {!imagePreview && !isLiveCameraActive && (
                <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-3xl p-5 sm:p-8 text-center space-y-4 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                    <Camera className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-black text-stone-900">
                      {isBn
                        ? 'পারচেজ বিল বা মেমোর ছবি তুলুন অথবা আপলোড করুন'
                        : 'Take Photo or Upload Purchase Bill / Invoice'}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md mx-auto">
                      {isBn
                        ? 'পাইকারি বা খুচরা মেমো, চালান বা রসিদের ছবি তুলুন। বিনামূল্যে OCR দিয়ে পণ্যের তালিকা ও স্বয়ংক্রিয় SKU বারকোড তৈরি হয়ে যাবে।'
                        : 'Capture any wholesale invoice, memo, or challan. Free OCR automatically extracts items and creates SKU barcodes.'}
                    </p>
                  </div>

                  {/* Action Buttons: Live Camera vs Native Camera vs Gallery */}
                  <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
                    {/* Live In-App Camera */}
                    <button
                      type="button"
                      onClick={() => startLiveCamera('environment')}
                      className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isBn ? '📸 সরাসরি ক্যামেরা চালু করুন' : 'Open Live Camera'}</span>
                    </button>

                    {/* Native Camera App File Input Trigger */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isBn ? '📱 ফোনের ক্যামেরা অ্যাপ' : 'Phone Camera App'}</span>
                    </button>

                    {/* Gallery / File Picker */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isBn ? '📁 গ্যালারি / ফাইল' : 'Gallery / File'}</span>
                    </button>
                  </div>

                  {/* Manual entry fallback */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleAddRow();
                      }}
                      className="text-xs font-bold text-stone-500 hover:text-blue-600 underline cursor-pointer"
                    >
                      {isBn
                        ? '+ ছবি ছাড়া সরাসরি প্রোডাক্টের নাম ও রেট লিখে বারকোড তৈরি করতে চান?'
                        : '+ Or enter products directly without photo?'}
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

              {/* PROCESSING ANIMATION (With Live Percentage Bar) */}
              {isProcessing && (
                <div className="py-10 px-4 text-center space-y-4 bg-stone-50 rounded-3xl border border-stone-200 animate-in fade-in">
                  <div className="relative w-14 h-14 mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
                      <Sparkles className="w-7 h-7 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="text-sm font-black text-stone-900">{processingStep}</h4>
                    {processingProgress > 0 && (
                      <div className="space-y-1">
                        <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${processingProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-stone-500">
                          {processingProgress}%
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-stone-500">
                      {isBn
                        ? 'বিলের লেখা ও সংখ্যা রিড করে স্বয়ংক্রিয়ভাবে প্রোডাক্ট তালিকা তৈরি হচ্ছে...'
                        : 'Reading bill text and auto-generating product items and barcodes...'}
                    </p>
                  </div>
                </div>
              )}

              {/* 3. EXTRACTED PRODUCTS REVIEW TABLE */}
              {!isProcessing && extractedItems.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Bill Photo & OCR Status Header Banner */}
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-stone-800">
                        <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-stone-500">{isBn ? 'সাপ্লায়ার:' : 'Supplier:'}</span>
                        <input
                          type="text"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder={isBn ? 'দোকান বা মহাজনের নাম' : 'Supplier Name'}
                          className="bg-white border border-stone-200 rounded-lg px-2 py-1 font-bold text-stone-900 focus:outline-none focus:border-blue-500 text-xs"
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

                      {ocrEngineUsed && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {ocrEngineUsed === 'cloud'
                              ? isBn
                                ? 'ক্লাউড স্ক্যান'
                                : 'Cloud Scan'
                              : isBn
                              ? 'ফ্রি অন-ডিভাইস OCR'
                              : 'Free On-Device OCR'}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => setShowImagePreview((prev) => !prev)}
                          className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg font-bold text-stone-700 flex items-center gap-1 cursor-pointer text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          <span>
                            {showImagePreview
                              ? isBn
                                ? 'ছবি লুকান'
                                : 'Hide Bill'
                              : isBn
                              ? 'ছবি দেখুন'
                              : 'View Bill'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setExtractedItems([]);
                          setDetectedRawLines([]);
                        }}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-bold cursor-pointer text-xs"
                      >
                        {isBn ? 'নতুন ছবি' : 'New Photo'}
                      </button>
                    </div>
                  </div>

                  {/* Bill Photo Viewer with Zoom Controls (Pinned for Easy Cross-Verification) */}
                  {showImagePreview && imagePreview && (
                    <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs text-stone-300 px-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {isBn
                              ? 'বিলের ছবি দেখে নিচে প্রোডাক্টের নাম ও দর মিলিয়ে নিন:'
                              : 'Cross-verify products and wholesale prices with your bill photo:'}
                          </span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.2))}
                            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                            title="Zoom Out"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-[10px] text-stone-400 px-1">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                            title="Zoom In"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(1)}
                            className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer ml-1"
                            title="Reset"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-64 sm:max-h-80 overflow-auto rounded-xl bg-stone-950 flex items-center justify-center p-2 border border-stone-800">
                        <img
                          src={imagePreview}
                          alt="Bill reference"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.15s ease-out',
                          }}
                          className="max-h-72 sm:max-h-96 object-contain rounded-lg select-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Detected Raw Lines Chips (Allows 1-tap quick add if any item was missed) */}
                  {detectedRawLines.length > 0 && (
                    <div className="border border-stone-200 bg-stone-50 rounded-2xl p-2.5 text-xs space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowDetectedLines((prev) => !prev)}
                        className="w-full flex items-center justify-between text-left font-bold text-stone-700 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            {isBn
                              ? `📝 বিলে পাওয়া লেখাগুলো (${detectedRawLines.length}টি লাইন) — ট্যাপ করে আইটেম বানান`
                              : `Detected text lines (${detectedRawLines.length}) — tap to create item`}
                          </span>
                        </span>
                        {showDetectedLines ? (
                          <ChevronUp className="w-4 h-4 text-stone-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-500" />
                        )}
                      </button>

                      {showDetectedLines && (
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                          {detectedRawLines.map((line, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAddRow(line)}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 border border-stone-200 hover:border-blue-300 text-stone-800 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title={isBn ? 'এই লেখা দিয়ে নতুন আইটেম যোগ করুন' : 'Add as new item'}
                            >
                              <Plus className="w-3 h-3 text-blue-600" />
                              <span className="truncate max-w-[200px]">{line}</span>
                            </button>
                          ))}
                        </div>
                      )}
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
                                  placeholder={isBn ? 'পণ্যের নাম লিখুন...' : 'Product Name...'}
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
                        onClick={() => handleAddRow()}
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
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer transition-colors"
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
