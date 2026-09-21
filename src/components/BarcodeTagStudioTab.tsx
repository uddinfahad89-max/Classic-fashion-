import React, { useState, useEffect, useRef } from 'react';
import {
  Barcode as BarcodeIcon,
  Printer,
  Download,
  Share2,
  RefreshCw,
  Tag,
  Scissors,
  Layers,
  Sparkles,
  ShoppingBag,
  Check,
  FileText,
  Sliders,
  Eye,
  Plus,
  Copy,
  CheckCircle2,
  Package,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Zap,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ThermalPrinterSettings,
  Language,
  BillInvoice,
  LabelSizePreset,
  BarcodeLabelConfig,
} from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';

interface BarcodeTagStudioTabProps {
  settings: ThermalPrinterSettings;
  language: Language;
  bills: BillInvoice[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const PRESET_SIZES: {
  id: LabelSizePreset;
  titleBn: string;
  titleEn: string;
  widthMm: number;
  heightMm: number;
  inchLabel: string;
  badgeBn: string;
  badgeEn: string;
}[] = [
  {
    id: '2x1',
    titleBn: '২" × ১" (পোশাক / গার্মেন্ট প্রাইস ট্যাগ)',
    titleEn: '2" × 1" (Standard Garment Tag)',
    widthMm: 50,
    heightMm: 25,
    inchLabel: '2" × 1"',
    badgeBn: 'সবচেয়ে জনপ্রিয়',
    badgeEn: 'Most Popular',
  },
  {
    id: '2x1.2',
    titleBn: '২" × ১.২" (MRP + সেল প্রাইস + বারকোড)',
    titleEn: '2" × 1.2" (MRP + Sale Price + Barcode)',
    widthMm: 50,
    heightMm: 30,
    inchLabel: '2" × 1.2"',
    badgeBn: 'রিটেল স্টিকার',
    badgeEn: 'Retail Sticker',
  },
  {
    id: '1x1',
    titleBn: '১" × ১" (১ ইঞ্চি স্কয়ার মিনি ট্যাগ)',
    titleEn: '1" × 1" (1 Inch Square Mini Tag)',
    widthMm: 25,
    heightMm: 25,
    inchLabel: '1" × 1"',
    badgeBn: 'মিনি স্টিকার',
    badgeEn: 'Mini Tag',
  },
  {
    id: '1.5x1',
    titleBn: '১.৫" × ১" (মিডিয়াম প্রাইস ট্যাগ)',
    titleEn: '1.5" × 1" (Medium Price Tag)',
    widthMm: 38,
    heightMm: 25,
    inchLabel: '1.5" × 1"',
    badgeBn: 'কমপ্যাক্ট',
    badgeEn: 'Compact',
  },
  {
    id: '2x2',
    titleBn: '২" × ২" (২ ইঞ্চি স্কয়ার বড় লেবেল)',
    titleEn: '2" × 2" (2 Inch Square Big Label)',
    widthMm: 50,
    heightMm: 50,
    inchLabel: '2" × 2"',
    badgeBn: 'বড় লেবেল',
    badgeEn: 'Large Label',
  },
  {
    id: 'custom',
    titleBn: 'কাস্টম সাইজ (Custom mm)',
    titleEn: 'Custom Dimensions (mm)',
    widthMm: 50,
    heightMm: 25,
    inchLabel: 'Custom',
    badgeBn: 'নিজস্ব সাইজ',
    badgeEn: 'Custom',
  },
];

export const BarcodeTagStudioTab: React.FC<BarcodeTagStudioTabProps> = ({
  settings,
  language,
  bills,
  onShowToast,
}) => {
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || 'Rs. ';

  const [labelConfig, setLabelConfig] = useState<BarcodeLabelConfig>({
    storeName: settings.storeName || 'MY FASHION STORE',
    storePhone: settings.storePhone || '',
    itemName: 'Cotton Saree',
    barcodeValue: 'CF-1002',
    barcodeType: 'CODE128',
    mrp: 1200,
    salePrice: 850,
    sizeOrVariant: 'Free Size',
    batchOrDate: 'B#09/26',
    footerNote: '100% Pure Cotton',
    sizePreset: '2x1',
    customWidthMm: 50,
    customHeightMm: 25,
    showStoreName: true,
    showMrp: true,
    showSalePrice: true,
    showBarcode: true,
    showSize: true,
    showBatch: true,
    showBorder: true,
    quantity: 1,
  });

  const [showPunchHole, setShowPunchHole] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Bluetooth Thermal Printer states
  const [btConnected, setBtConnected] = useState(thermalPrinterService.getIsConnected());
  const [btConnecting, setBtConnecting] = useState(thermalPrinterService.getIsConnecting());
  const [btDeviceName, setBtDeviceName] = useState<string | undefined>(thermalPrinterService.getDeviceName());
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [paperRollWidth, setPaperRollWidth] = useState<'58mm' | '80mm'>(settings.paperWidth || '58mm');
  const [darknessMode, setDarknessMode] = useState<'normal' | 'dark' | 'extra_dark'>('dark');

  // Reactively subscribe to Bluetooth printer connection status changes
  useEffect(() => {
    const unsub = thermalPrinterService.addStatusListener((status) => {
      setBtConnected(status.connected);
      setBtConnecting(status.isConnecting);
      setBtDeviceName(status.deviceName);
    });
    return unsub;
  }, []);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const labelPreviewRef = useRef<HTMLDivElement | null>(null);

  // Auto-generate SKU / Barcode
  const handleGenerateBarcode = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const prefix = (labelConfig.storeName || 'POS').substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'IT');
    const newCode = `${prefix}-${randomNum}`;
    setLabelConfig((prev) => ({ ...prev, barcodeValue: newCode }));
    onShowToast(isBn ? 'নতুন বারকোড তৈরি হয়েছে!' : 'New barcode generated!', 'info');
  };

  // Render Barcode SVG or QR Code whenever barcodeValue changes
  useEffect(() => {
    if (!labelConfig.barcodeValue) return;

    if (labelConfig.barcodeType === 'QR') {
      const qrText = `${labelConfig.storeName} | ${labelConfig.itemName} | ${sym}${labelConfig.salePrice} | SKU: ${labelConfig.barcodeValue}`;
      QRCode.toDataURL(qrText, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    } else {
      if (barcodeSvgRef.current) {
        try {
          const cleanCode = labelConfig.barcodeValue.trim() || '1001';
          JsBarcode(barcodeSvgRef.current, cleanCode, {
            format: labelConfig.barcodeType,
            width: labelConfig.sizePreset === '1x1' ? 1.0 : 1.4,
            height: labelConfig.sizePreset === '1x1' ? 22 : 32,
            displayValue: true,
            fontSize: 10,
            font: 'monospace',
            margin: 2,
            background: 'transparent',
            lineColor: '#000000',
          });
        } catch (err) {
          // If formatting error (e.g. EAN-13 length), fallback to CODE128
          try {
            JsBarcode(barcodeSvgRef.current, labelConfig.barcodeValue, {
              format: 'CODE128',
              width: 1.3,
              height: 30,
              displayValue: true,
              fontSize: 10,
              margin: 2,
              background: 'transparent',
            });
          } catch {}
        }
      }
    }
  }, [
    labelConfig.barcodeValue,
    labelConfig.barcodeType,
    labelConfig.sizePreset,
    labelConfig.storeName,
    labelConfig.itemName,
    labelConfig.salePrice,
    sym,
  ]);

  // Dimensions based on preset
  const currentPreset = PRESET_SIZES.find((p) => p.id === labelConfig.sizePreset) || PRESET_SIZES[0];
  const widthMm = labelConfig.sizePreset === 'custom' ? (labelConfig.customWidthMm || 50) : currentPreset.widthMm;
  const heightMm = labelConfig.sizePreset === 'custom' ? (labelConfig.customHeightMm || 25) : currentPreset.heightMm;

  // Calculate discount percentage
  const discountPercent =
    labelConfig.mrp && labelConfig.mrp > labelConfig.salePrice
      ? Math.round(((labelConfig.mrp - labelConfig.salePrice) / labelConfig.mrp) * 100)
      : 0;

  // Apply Quick Templates
  const handleApplyTemplate = (type: 'garment' | 'grocery' | 'footwear' | 'jewel') => {
    if (type === 'garment') {
      setLabelConfig((prev) => ({
        ...prev,
        sizePreset: '2x1',
        itemName: 'Cotton Saree',
        sizeOrVariant: 'Free Size',
        mrp: 1499,
        salePrice: 999,
        barcodeValue: 'CF-1002',
        footerNote: '100% Pure Cotton',
      }));
      setShowPunchHole(true);
      onShowToast(isBn ? 'গার্মেন্টস টেমপ্লেট লোড হয়েছে' : 'Garments template loaded');
    } else if (type === 'grocery') {
      setLabelConfig((prev) => ({
        ...prev,
        sizePreset: '2x1.2',
        itemName: 'Basmati Rice Premium',
        sizeOrVariant: 'Net Wt: 1 Kg',
        mrp: 160,
        salePrice: 135,
        barcodeValue: '890123456789',
        footerNote: 'Pack: 09/2026',
      }));
      setShowPunchHole(false);
      onShowToast(isBn ? 'মুদি ও রিটেল টেমপ্লেট লোড হয়েছে' : 'Grocery template loaded');
    } else if (type === 'footwear') {
      setLabelConfig((prev) => ({
        ...prev,
        sizePreset: '2x1',
        itemName: "Men's Leather Shoes",
        sizeOrVariant: 'Size: 8 (IND/UK)',
        mrp: 2499,
        salePrice: 1799,
        barcodeValue: 'SH-904',
        footerNote: 'Color: Black',
      }));
      setShowPunchHole(false);
      onShowToast(isBn ? 'জুতো টেমপ্লেট লোড হয়েছে' : 'Footwear template loaded');
    } else if (type === 'jewel') {
      setLabelConfig((prev) => ({
        ...prev,
        sizePreset: '1x1',
        itemName: 'Gold Polish Earring',
        sizeOrVariant: 'Model: GP-44',
        mrp: 450,
        salePrice: 320,
        barcodeValue: 'JW-301',
        footerNote: 'Guaranteed Polish',
      }));
      setShowPunchHole(false);
      onShowToast(isBn ? '১ ইঞ্চি মিনি স্টিকার লোড হয়েছে' : '1" Mini sticker loaded');
    }
  };

  // Recent bill items quick selector
  const recentBillItems = React.useMemo(() => {
    const list: { name: string; price: number }[] = [];
    const seen = new Set<string>();
    bills.forEach((bill) => {
      bill.items?.forEach((item) => {
        if (!seen.has(item.name.toLowerCase())) {
          seen.add(item.name.toLowerCase());
          list.push({ name: item.name, price: item.price });
        }
      });
    });
    return list.slice(0, 8);
  }, [bills]);

  // Export as High-Res PNG (Compatible with 4Barcode Android App / RawBT / Gallery)
  const handleDownloadImage = async () => {
    if (!labelPreviewRef.current) return;
    setIsGeneratingImg(true);
    try {
      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 4, // 4x for super crisp thermal printing
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = (labelConfig.itemName || 'barcode_tag').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `${safeName}_${labelConfig.sizePreset}_tag.png`;
      link.href = dataUrl;
      link.click();
      onShowToast(isBn ? 'স্টিকার ছবি সফলভাবে ডাউনলোড হয়েছে! (4Barcode অ্যাপে ওপেন করতে পারবেন)' : 'Sticker image downloaded! Ready for 4Barcode app.', 'success');
    } catch (e) {
      console.error('Image export failed:', e);
      onShowToast(isBn ? 'ছবি তৈরি ব্যর্থ হয়েছে' : 'Failed to export image', 'error');
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // Download Multi-Sticker A4 PDF Sheet (24-up / 30-up stickers)
  const handleDownloadPdfSheet = async () => {
    if (!labelPreviewRef.current) return;
    setIsGeneratingImg(true);
    try {
      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const qty = Math.max(1, Math.min(60, labelConfig.quantity));
      const colWidth = widthMm;
      const rowHeight = heightMm;
      const marginX = 10;
      const marginY = 10;
      const gapX = 4;
      const gapY = 4;

      const cols = Math.floor((210 - marginX * 2 + gapX) / (colWidth + gapX));
      const rows = Math.floor((297 - marginY * 2 + gapY) / (rowHeight + gapY));

      let currentX = marginX;
      let currentY = marginY;
      let count = 0;

      for (let i = 0; i < qty; i++) {
        if (count > 0 && count % (cols * rows) === 0) {
          doc.addPage();
          currentX = marginX;
          currentY = marginY;
        }

        const colIndex = count % cols;
        const rowIndex = Math.floor((count % (cols * rows)) / cols);
        currentX = marginX + colIndex * (colWidth + gapX);
        currentY = marginY + rowIndex * (rowHeight + gapY);

        doc.addImage(imgData, 'PNG', currentX, currentY, colWidth, rowHeight);
        count++;
      }

      doc.save(`${labelConfig.itemName || 'tags'}_labels_sheet.pdf`);
      onShowToast(isBn ? `${qty} টি স্টিকারের A4 PDF শিট ডাউনলোড হয়েছে` : `${qty} labels PDF sheet downloaded!`, 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      onShowToast(isBn ? 'PDF তৈরি করতে সমস্যা হয়েছে' : 'PDF creation failed', 'error');
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // Direct Label Print (Browser Print Window formatted for continuous 1" or 2" label roll)
  const handlePrintLabels = async () => {
    if (!labelPreviewRef.current) return;
    setIsPrinting(true);

    try {
      // First, if Bluetooth thermal printer is connected, attempt direct BLE stream
      if (thermalPrinterService.getIsConnected()) {
        onShowToast(isBn ? 'ব্লুটুথ থার্মাল প্রিন্টারে স্টিকার পাঠানো হচ্ছে...' : 'Streaming sticker to Bluetooth thermal printer...', 'info');
      }

      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgUrl = canvas.toDataURL('image/png');

      // Create temporary print iframe or document
      let printContainer = document.getElementById('barcode-print-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'barcode-print-container';
        document.body.appendChild(printContainer);
      }

      // Populate multiple copies
      let html = `
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0;
          }
          @media print {
            body { margin: 0; padding: 0; background: white; }
            .label-page {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              page-break-after: always;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .label-page img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          }
        </style>
      `;

      for (let i = 0; i < labelConfig.quantity; i++) {
        html += `<div class="label-page"><img src="${imgUrl}" /></div>`;
      }

      printContainer.innerHTML = html;
      window.print();
      onShowToast(isBn ? `${labelConfig.quantity} টি স্টিকার প্রিন্ট পাঠানো হয়েছে` : `${labelConfig.quantity} stickers sent to print!`, 'success');
    } catch (e) {
      console.error('Label print error:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // Pair or Connect Bluetooth Thermal Printer
  const handleConnectBt = async () => {
    try {
      const res = await thermalPrinterService.connect();
      if (res.success) {
        onShowToast(
          isBn ? `প্রিন্টার সংযুক্ত: ${res.deviceName || 'Thermal Printer'}` : `Connected to: ${res.deviceName || 'Thermal Printer'}`,
          'success'
        );
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Bluetooth connection failed', 'error');
    }
  };

  // Quick test slip on thermal printer
  const handleTestPrint = async () => {
    try {
      const res = await thermalPrinterService.printTestReceipt(settings);
      if (res.success) {
        onShowToast(isBn ? 'টেস্ট স্লিপ প্রিন্ট হয়েছে!' : 'Test slip printed!', 'success');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (e: any) {
      onShowToast(e?.message || 'Test print failed', 'error');
    }
  };

  // Direct Bluetooth BLE Stream to Thermal Printer (ESC/POS Raster Bitmap)
  const handleBtThermalPrint = async () => {
    if (!labelPreviewRef.current) return;
    setIsBtPrinting(true);

    try {
      // 1. Auto-connect if not already connected
      if (!thermalPrinterService.getIsConnected()) {
        onShowToast(isBn ? 'ব্লুটুথ প্রিন্টার কানেক্ট করা হচ্ছে...' : 'Connecting to Bluetooth printer...', 'info');
        const conn = await thermalPrinterService.connect();
        if (!conn.success) {
          onShowToast(
            isBn ? 'প্রিন্টার কানেক্ট করা যায়নি। ব্লুটুথ অন করে প্রিন্টারটি পেয়ার করুন।' : 'Could not connect. Please pair your Bluetooth printer.',
            'error'
          );
          setIsBtPrinting(false);
          return;
        }
      }

      onShowToast(
        isBn
          ? `ব্লুটুথ থার্মাল প্রিন্টারে ${labelConfig.quantity}টি স্টিকার পাঠানো হচ্ছে...`
          : `Streaming ${labelConfig.quantity} label(s) to Bluetooth thermal printer...`,
        'info'
      );

      // Render crisp canvas representation of the sticker
      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      // Darkness threshold:
      // normal = 175, dark = 160, extra_dark = 145
      const threshold = darknessMode === 'extra_dark' ? 145 : darknessMode === 'dark' ? 160 : 175;

      const result = await thermalPrinterService.printLabelBitmapViaBluetooth(
        canvas,
        labelConfig.quantity,
        paperRollWidth,
        threshold
      );

      if (result.success) {
        onShowToast(
          isBn
            ? `✅ ${labelConfig.quantity}টি বারকোড স্টিকার ব্লুটুথ প্রিন্টারে প্রিন্ট হয়েছে!`
            : `✅ ${labelConfig.quantity} barcode label(s) printed via Bluetooth!`,
          'success'
        );
      } else {
        onShowToast(result.message, 'error');
      }
    } catch (e: any) {
      console.error('Bluetooth thermal print error:', e);
      onShowToast(isBn ? `প্রিন্ট সমস্যা: ${e?.message || 'ত্রুটি'}` : `Print failed: ${e?.message}`, 'error');
    } finally {
      setIsBtPrinting(false);
    }
  };

  // Send raw ESC/POS image to RawBT Android app via Intent
  const handleRawBTPrint = async () => {
    if (!labelPreviewRef.current) return;
    try {
      onShowToast(isBn ? 'RawBT অ্যাপে পাঠানো হচ্ছে...' : 'Sending to RawBT app...', 'info');
      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      thermalPrinterService.printLabelViaRawBT(canvas, labelConfig.quantity, paperRollWidth);
    } catch (e: any) {
      console.error('RawBT print error:', e);
      onShowToast(isBn ? 'RawBT ওপেন করতে সমস্যা হয়েছে' : 'RawBT open failed', 'error');
    }
  };

  return (
    <div id="barcode-tag-studio-tab" className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-28 pt-1">
      {/* 1. Header Banner */}
      <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-sky-700 text-white p-4 sm:p-6 rounded-3xl shadow-lg border border-blue-600/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shrink-0 border border-white/20 shadow-inner">
              <BarcodeIcon className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  {isBn ? '4Barcode ও প্রাইস ট্যাগ স্টুডিও' : '4Barcode & Price Tag Studio'}
                </h1>
                <span className="bg-amber-400 text-stone-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {isBn ? '১" ও ২" সাইজ' : '1" & 2" Sizes'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-blue-100 font-medium mt-0.5">
                {isBn
                  ? 'দোকানের শাড়ি, জামাকাপড় ও পণ্যের বারকোড ও প্রাইস স্টিকার তৈরি ও প্রিন্ট করুন'
                  : 'Design and print garment price tags & barcodes for thermal sticker printers'}
              </p>
            </div>
          </div>

          {/* Quick template buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => handleApplyTemplate('garment')}
              className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="শাড়ি ও কাপড়ের ট্যাগ"
            >
              <span>👗</span>
              <span>{isBn ? 'পোশাক' : 'Garments'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('grocery')}
              className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="মুদি ও পণ্য"
            >
              <span>🛒</span>
              <span>{isBn ? 'মুদি' : 'Grocery'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('footwear')}
              className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="জুতো ও স্যান্ডেল"
            >
              <span>👟</span>
              <span>{isBn ? 'জুতো' : 'Shoes'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('jewel')}
              className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title='১" মিনি স্টিকার'
            >
              <span>🏷️</span>
              <span>{isBn ? '১" মিনি' : '1" Mini'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Grid: Left Controls Form | Right Live Tag Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT COLUMN: Controls & Form (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card A: Size Presets (1 inch, 2 inch, etc.) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-blue-600" />
                <span>{isBn ? '১. স্টিকার ও ট্যাগের সাইজ পছন্দ করুন' : '1. Select Label Sticker Size'}</span>
              </h2>
              <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {widthMm}mm × {heightMm}mm
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_SIZES.map((preset) => {
                const isSelected = labelConfig.sizePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setLabelConfig((prev) => ({
                        ...prev,
                        sizePreset: preset.id,
                        customWidthMm: preset.widthMm,
                        customHeightMm: preset.heightMm,
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-extrabold font-mono text-stone-900">
                        {preset.inchLabel}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {isBn ? preset.badgeBn : preset.badgeEn}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 font-medium mt-1 leading-tight line-clamp-1">
                      {isBn ? preset.titleBn : preset.titleEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom size inputs if custom chosen */}
            {labelConfig.sizePreset === 'custom' && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <div className="w-1/2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase">
                    {isBn ? 'প্রস্থ (Width mm)' : 'Width (mm)'}
                  </label>
                  <input
                    type="number"
                    value={labelConfig.customWidthMm}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, customWidthMm: Number(e.target.value) || 50 }))
                    }
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase">
                    {isBn ? 'উচ্চতা (Height mm)' : 'Height (mm)'}
                  </label>
                  <input
                    type="number"
                    value={labelConfig.customHeightMm}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, customHeightMm: Number(e.target.value) || 25 }))
                    }
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card B: Tag Details & Product Info */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span>{isBn ? '২. পণ্যের বিবরণ ও দাম' : '2. Product Info & Pricing'}</span>
              </h2>

              {/* Bill items quick-import */}
              {recentBillItems.length > 0 && (
                <div className="relative group">
                  <select
                    onChange={(e) => {
                      const sel = recentBillItems.find((item) => item.name === e.target.value);
                      if (sel) {
                        setLabelConfig((prev) => ({
                          ...prev,
                          itemName: sel.name,
                          salePrice: sel.price,
                          mrp: Math.round(sel.price * 1.3),
                        }));
                      }
                    }}
                    value=""
                    className="text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2 py-1 cursor-pointer"
                  >
                    <option value="" disabled>
                      {isBn ? '⚡ বিলের আইটেম থেকে বাছুন' : '⚡ Pick from Bills'}
                    </option>
                    {recentBillItems.map((item, idx) => (
                      <option key={idx} value={item.name}>
                        {item.name} ({sym}{item.price})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {/* Shop Name */}
              <div>
                <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center justify-between">
                  <span>{isBn ? 'দোকানের নাম (Store Header)' : 'Store Header'}</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showStoreName}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showStoreName: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span className="text-[10px] text-stone-400 font-medium">
                      {isBn ? 'দেখাও' : 'Show'}
                    </span>
                  </label>
                </label>
                <input
                  type="text"
                  value={labelConfig.storeName}
                  onChange={(e) => setLabelConfig((prev) => ({ ...prev, storeName: e.target.value }))}
                  placeholder="যেমন: CLASSIC FASHION"
                  className="w-full border border-stone-200 bg-stone-50/70 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Item Name & Size/Variant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 mb-1 block">
                    {isBn ? 'পণ্যের নাম (Item Name) *' : 'Item Name *'}
                  </label>
                  <input
                    type="text"
                    value={labelConfig.itemName}
                    onChange={(e) => setLabelConfig((prev) => ({ ...prev, itemName: e.target.value }))}
                    placeholder="যেমন: Cotton Saree / Kurti"
                    className="w-full border border-stone-200 bg-stone-50/70 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center justify-between">
                    <span>{isBn ? 'সাইজ / ভ্যারিয়েন্ট (Size)' : 'Size / Variant'}</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labelConfig.showSize}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, showSize: e.target.checked }))
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] text-stone-400 font-medium">
                        {isBn ? 'দেখাও' : 'Show'}
                      </span>
                    </label>
                  </label>
                  <input
                    type="text"
                    value={labelConfig.sizeOrVariant || ''}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, sizeOrVariant: e.target.value }))
                    }
                    placeholder="যেমন: Free Size / XL / 32"
                    className="w-full border border-stone-200 bg-stone-50/70 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Pricing: MRP and Sale Price */}
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 mb-1 flex items-center justify-between">
                    <span>{isBn ? 'M.R.P. (কাটা দাম)' : 'M.R.P. Price'}</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labelConfig.showMrp}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, showMrp: e.target.checked }))
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] text-stone-400 font-medium">
                        {isBn ? 'দেখাও' : 'Show'}
                      </span>
                    </label>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                      {sym}
                    </span>
                    <input
                      type="number"
                      value={labelConfig.mrp || ''}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, mrp: Number(e.target.value) || 0 }))
                      }
                      placeholder="1200"
                      className="w-full border border-stone-200 bg-white pl-8 pr-2 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold text-stone-600 line-through"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-rose-700 mb-1 block">
                    {isBn ? 'বিক্রয় মূল্য (Our Price) *' : 'Our Sale Price *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rose-500 text-xs font-mono font-bold">
                      {sym}
                    </span>
                    <input
                      type="number"
                      value={labelConfig.salePrice || ''}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({
                          ...prev,
                          salePrice: Number(e.target.value) || 0,
                        }))
                      }
                      placeholder="850"
                      className="w-full border-2 border-rose-300 bg-white pl-8 pr-2 py-2 rounded-xl text-xs sm:text-sm font-mono font-black text-rose-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Barcode & SKU Setup */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                    <BarcodeIcon className="w-3.5 h-3.5 text-stone-600" />
                    <span>{isBn ? 'বারকোড ও এসকেইউ (Barcode / SKU)' : 'Barcode & SKU'}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={labelConfig.barcodeType}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({
                          ...prev,
                          barcodeType: e.target.value as 'CODE128' | 'EAN13' | 'QR',
                        }))
                      }
                      className="text-[11px] font-bold border border-stone-200 bg-white rounded-lg px-2 py-0.5"
                    >
                      <option value="CODE128">Code 128 (Standard)</option>
                      <option value="EAN13">EAN-13</option>
                      <option value="QR">QR Code</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{isBn ? 'অটো কোড' : 'Auto'}</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={labelConfig.barcodeValue}
                  onChange={(e) =>
                    setLabelConfig((prev) => ({ ...prev, barcodeValue: e.target.value }))
                  }
                  placeholder="যেমন: CF-1002 বা 890123456789"
                  className="w-full border border-stone-200 bg-white px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold text-stone-800"
                />
              </div>

              {/* Additional Options (Batch & Note) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                    {isBn ? 'ব্যাচ / তারিখ' : 'Batch / Date'}
                  </label>
                  <input
                    type="text"
                    value={labelConfig.batchOrDate || ''}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, batchOrDate: e.target.value }))
                    }
                    placeholder="B#09/26"
                    className="w-full border border-stone-200 bg-stone-50/70 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                    {isBn ? 'ফুটার নোট / কাপড়' : 'Fabric / Note'}
                  </label>
                  <input
                    type="text"
                    value={labelConfig.footerNote || ''}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, footerNote: e.target.value }))
                    }
                    placeholder="100% Cotton"
                    className="w-full border border-stone-200 bg-stone-50/70 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-600 font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPunchHole}
                    onChange={(e) => setShowPunchHole(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>{isBn ? 'পোশাকের ট্যাগ হোল (Punch Hole)' : 'Tag Punch Hole'}</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={labelConfig.showBorder}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, showBorder: e.target.checked }))
                    }
                    className="rounded text-blue-600"
                  />
                  <span>{isBn ? 'বর্ডার লাইন' : 'Sticker Border'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Sticker Preview & Printing Actions (5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'লাইভ ট্যাগ প্রিভিউ (4Barcode Style)' : 'Live Tag Preview'}</span>
              </h2>
              <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                {widthMm}mm × {heightMm}mm
              </span>
            </div>

            {/* Visual Thermal Sticker Container */}
            <div className="bg-stone-100/90 p-4 sm:p-6 rounded-2xl border border-dashed border-stone-300 flex items-center justify-center min-h-[220px] overflow-hidden">
              <div
                ref={labelPreviewRef}
                id="thermal-sticker-live-card"
                className={`bg-white text-stone-900 relative shadow-md transition-all select-none overflow-hidden flex flex-col justify-between ${
                  labelConfig.showBorder ? 'border border-stone-400' : ''
                }`}
                style={{
                  // Scaling visual preview to fit mobile while retaining physical aspect ratio
                  width: `${Math.min(320, widthMm * 5.4)}px`,
                  minHeight: `${Math.max(120, heightMm * 5.4)}px`,
                  borderRadius: labelConfig.sizePreset === '1x1' ? '8px' : '10px',
                  padding: labelConfig.sizePreset === '1x1' ? '6px' : '8px 10px',
                }}
              >
                {/* Garment tag punch hole (optional) */}
                {showPunchHole && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-stone-400 bg-stone-100 shadow-inner flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  </div>
                )}

                {/* Top: Store Name & Item Name */}
                <div className={`text-center space-y-0.5 ${showPunchHole ? 'pt-2' : ''}`}>
                  {labelConfig.showStoreName && labelConfig.storeName && (
                    <div className="text-[11px] font-black uppercase tracking-wider text-stone-900 border-b border-stone-200 pb-0.5 leading-tight">
                      {labelConfig.storeName}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <span className="text-xs font-extrabold text-stone-900 leading-tight truncate">
                      {labelConfig.itemName || 'Product Title'}
                    </span>
                    {labelConfig.showSize && labelConfig.sizeOrVariant && (
                      <span className="text-[9px] font-black bg-stone-900 text-white px-1.5 py-0.2 rounded-sm shrink-0 tracking-tight">
                        {labelConfig.sizeOrVariant}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Barcode SVG or QR Code */}
                {labelConfig.showBarcode && (
                  <div className="flex flex-col items-center justify-center py-1">
                    {labelConfig.barcodeType === 'QR' && qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="QR" className="w-14 h-14 object-contain" />
                    ) : (
                      <svg
                        ref={barcodeSvgRef}
                        className="w-full max-h-12 overflow-visible"
                      ></svg>
                    )}
                  </div>
                )}

                {/* Pricing Block */}
                <div className="border-t border-stone-200 pt-1 space-y-0.5">
                  <div className="flex items-baseline justify-between">
                    {/* Left: Crossed out MRP */}
                    {labelConfig.showMrp && Boolean(labelConfig.mrp) && (
                      <div className="text-[10px] text-stone-500 font-bold leading-tight">
                        <span>MRP: </span>
                        <span className="line-through">
                          {sym}{labelConfig.mrp}
                        </span>
                      </div>
                    )}

                    {/* Right: Big Bold Our Sale Price */}
                    <div className="text-right ml-auto">
                      <span className="text-[9px] font-black text-stone-600 uppercase mr-1">
                        {isBn ? 'মূল্য:' : 'PRICE:'}
                      </span>
                      <span className="text-sm sm:text-base font-black font-mono text-stone-950 tracking-tight">
                        {sym}{labelConfig.salePrice}
                      </span>
                    </div>
                  </div>

                  {/* Savings & Footer note */}
                  <div className="flex items-center justify-between text-[8px] text-stone-500 font-medium">
                    {discountPercent > 0 ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded-xs">
                        SAVE {discountPercent}% OFF
                      </span>
                    ) : (
                      <span>{labelConfig.batchOrDate || ''}</span>
                    )}

                    <span className="truncate max-w-[140px] text-right">
                      {labelConfig.footerNote || '(Incl. of all taxes)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bluetooth Thermal Printer Integration Card */}
            <div className="p-3.5 bg-linear-to-br from-indigo-50/90 via-blue-50/60 to-sky-50/90 rounded-2xl border border-indigo-200/90 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      btConnected
                        ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-sm'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    <Bluetooth className={`w-4 h-4 ${btConnected ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-stone-900">
                        {isBn ? 'ব্লুটুথ থার্মাল প্রিন্টার' : 'Bluetooth Thermal Printer'}
                      </span>
                      {btConnected ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                          {isBn ? 'কানেক্টেড' : 'Connected'}
                        </span>
                      ) : (
                        <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {isBn ? 'কানেক্ট নেই' : 'Disconnected'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-600 truncate max-w-[210px] font-medium">
                      {btConnected
                        ? (btDeviceName || 'Thermal POS Printer')
                        : (isBn ? 'ওয়্যারলেস প্রিন্ট করতে প্রিন্টার পেয়ার করুন' : 'Pair printer to print wirelessly')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {btConnected && (
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      className="px-2 py-1 bg-white hover:bg-stone-50 active:scale-95 text-stone-700 border border-stone-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-2xs"
                      title={isBn ? 'টেস্ট স্লিপ প্রিন্ট দিন' : 'Test slip'}
                    >
                      {isBn ? 'টেস্ট' : 'Test'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConnectBt}
                    disabled={btConnecting}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                      btConnected
                        ? 'bg-white hover:bg-stone-50 text-indigo-700 border border-indigo-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Bluetooth className="w-3 h-3" />
                    <span>
                      {btConnecting
                        ? (isBn ? 'খোঁজা হচ্ছে...' : 'Pairing...')
                        : btConnected
                        ? (isBn ? 'পরিবর্তন' : 'Change')
                        : (isBn ? 'কানেক্ট করুন' : 'Connect')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Roll Size & Darkness density controls */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100/80 text-[11px]">
                {/* Roll Width (58mm vs 80mm) */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-stone-600">
                    {isBn ? 'রোল সাইজ (Roll Width):' : 'Roll Width:'}
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-white/90 p-0.5 rounded-lg border border-indigo-100">
                    <button
                      type="button"
                      onClick={() => setPaperRollWidth('58mm')}
                      className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        paperRollWidth === '58mm'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      58mm (2")
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperRollWidth('80mm')}
                      className={`py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        paperRollWidth === '80mm'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      80mm (3")
                    </button>
                  </div>
                </div>

                {/* Print Density / Darkness for sharp barcodes */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-stone-600">
                    {isBn ? 'বারকোড স্পষ্টতা (Burn):' : 'Darkness (Burn):'}
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 bg-white/90 p-0.5 rounded-lg border border-indigo-100">
                    <button
                      type="button"
                      onClick={() => setDarknessMode('normal')}
                      className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                        darknessMode === 'normal'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                      title="স্বাভাবিক হিট"
                    >
                      {isBn ? 'স্বাভাবিক' : 'Norm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDarknessMode('dark')}
                      className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                        darknessMode === 'dark'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                      title="গাঢ় ও স্পষ্ট"
                    >
                      {isBn ? 'গাঢ়' : 'Dark'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDarknessMode('extra_dark')}
                      className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                        darknessMode === 'extra_dark'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                      title="সর্বোচ্চ স্পষ্টতা (স্ক্যানার ফ্রেন্ডলি)"
                    >
                      {isBn ? 'খুব গাঢ়' : 'Max'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Quantity Selector */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">
                {isBn ? 'প্রিন্ট সংখ্যা (Copies):' : 'Sticker Quantity:'}
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 5, 10, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setLabelConfig((prev) => ({ ...prev, quantity: num }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      labelConfig.quantity === num
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={labelConfig.quantity}
                  onChange={(e) =>
                    setLabelConfig((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))
                  }
                  className="w-14 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center"
                />
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* HERO ACTION: Direct Bluetooth Thermal Print */}
              <button
                type="button"
                id="btn-bt-thermal-print"
                onClick={handleBtThermalPrint}
                disabled={isBtPrinting}
                className="w-full bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.99] text-white py-3.5 px-4 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <Bluetooth className={`w-5 h-5 ${isBtPrinting ? 'animate-spin' : ''}`} />
                <span className="tracking-wide">
                  {isBtPrinting
                    ? (isBn ? 'প্রিন্টারে পাঠানো হচ্ছে...' : 'Streaming to printer...')
                    : (isBn
                        ? `ব্লুটুথ থার্মাল প্রিন্ট (${labelConfig.quantity}টি স্টিকার)`
                        : `Bluetooth Thermal Print (${labelConfig.quantity} Label${labelConfig.quantity > 1 ? 's' : ''})`)}
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-extrabold uppercase tracking-wider">
                  ESC/POS
                </span>
              </button>

              {/* Secondary Row: RawBT 1-Tap & Standard System/USB Print */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-rawbt-print"
                  onClick={handleRawBTPrint}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="অ্যান্ড্রয়েড RawBT প্রিন্টার অ্যাপের মাধ্যমে ১-ক্লিকে প্রিন্ট"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isBn ? 'RawBT অ্যাপ প্রিন্ট' : 'RawBT App Print'}</span>
                </button>

                <button
                  type="button"
                  id="btn-print-labels"
                  onClick={handlePrintLabels}
                  disabled={isPrinting}
                  className="w-full bg-stone-700 hover:bg-stone-600 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="কম্পিউটার বা ইউএসবি প্রিন্টার ডায়ালগ"
                >
                  <Printer className="w-3.5 h-3.5 text-stone-200" />
                  <span>{isBn ? 'সিস্টেম / USB প্রিন্ট' : 'System / USB Print'}</span>
                </button>
              </div>

              {/* Download for 4Barcode App & PDF */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-download-tag-img"
                  onClick={handleDownloadImage}
                  disabled={isGeneratingImg}
                  className="w-full bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="4Barcode অ্যাপ বা গ্যালারিতে সেভ করুন"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBn ? '4Barcode ছবি সেভ' : 'Save as PNG'}</span>
                </button>

                <button
                  type="button"
                  id="btn-download-tag-pdf"
                  onClick={handleDownloadPdfSheet}
                  disabled={isGeneratingImg}
                  className="w-full bg-stone-100 hover:bg-stone-200 active:scale-[0.99] text-stone-800 border border-stone-300 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="A4 সাইজ স্টিকার শিট PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? 'PDF শিট ডাউনলোড' : 'PDF Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
