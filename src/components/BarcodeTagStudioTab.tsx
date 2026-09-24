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
  Palette,
  SlidersHorizontal,
  LayoutTemplate,
  Type,
  Maximize2,
  RotateCcw,
  Save,
  QrCode as QrIcon,
  Phone,
  Percent,
  AlignLeft,
  AlignCenter,
  ShieldCheck,
  CheckSquare,
  Square,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  ThermalPrinterSettings,
  Language,
  BillInvoice,
  LabelSizePreset,
  BarcodeLabelConfig,
  TagLayoutStyle,
  TagBorderStyle,
  TagHeaderStyle,
  TagPriceStyle,
  TagBarcodeHeight,
  TagBarcodeThickness,
  TagCornerRadius,
  TagTitleFontSize,
  TagAlignment,
} from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { storageService } from '../services/storageService';

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
    titleBn: '৫০মিমি × ২৫মিমি (স্ট্যান্ডার্ড স্টিকার রোল)',
    titleEn: '50mm × 25mm (Standard Sticker Roll)',
    widthMm: 50,
    heightMm: 25,
    inchLabel: '50×25mm',
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

  const [activeControlTab, setActiveControlTab] = useState<'easy' | 'content' | 'design'>('easy');

  const [labelConfig, setLabelConfig] = useState<BarcodeLabelConfig>(() => {
    const saved = storageService.getBarcodeCustomDesign();
    const defaults: BarcodeLabelConfig = {
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
      // Design customizations:
      layoutStyle: 'classic',
      borderStyle: 'single',
      headerStyle: 'underline',
      priceStyle: 'standard',
      barcodeHeight: 'standard',
      barcodeThickness: 'medium',
      showBarcodeText: true,
      cornerRadius: 'medium',
      titleFontSize: 'medium',
      textAlign: 'center',
      showStorePhone: false,
      showDiscountBadge: false,
      customOfferText: '',
      showPunchHole: false,
      showFooterNote: true,
      cleanWhiteMode: true,
    };
    if (saved) {
      const cleanCustomOffer = (saved.customOfferText || '').replace(/save.*29.*%?/gi, '').trim();
      return {
        ...defaults,
        ...saved,
        showDiscountBadge: false,
        customOfferText: cleanCustomOffer,
        cleanWhiteMode: saved.cleanWhiteMode !== false,
      };
    }
    return defaults;
  });

  const [showPunchHole, setShowPunchHole] = useState(Boolean(labelConfig.showPunchHole));
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Helper to detect label printer model names
  const isLabelPrinterModel = (name?: string) =>
    Boolean(name && /4B|2034|XP|label|tsc|postek|gprinter/i.test(name));

  // Bluetooth Thermal Printer states
  const [btConnected, setBtConnected] = useState(thermalPrinterService.getIsConnected());
  const [btConnecting, setBtConnecting] = useState(thermalPrinterService.getIsConnecting());
  const [btDeviceName, setBtDeviceName] = useState<string | undefined>(thermalPrinterService.getDeviceName());
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [paperRollWidth, setPaperRollWidth] = useState<'50mm_label' | '58mm' | '80mm'>('50mm_label');
  const [printerProtocol, setPrinterProtocol] = useState<'escpos' | 'tspl'>(() => {
    const dev = thermalPrinterService.getDeviceName();
    return isLabelPrinterModel(dev) ? 'tspl' : 'escpos';
  });
  const [darknessMode, setDarknessMode] = useState<'normal' | 'dark' | 'extra_dark'>('dark');

  // Reactively subscribe to Bluetooth printer connection status changes
  useEffect(() => {
    const unsub = thermalPrinterService.addStatusListener((status) => {
      setBtConnected(status.connected);
      setBtConnecting(status.isConnecting);
      setBtDeviceName(status.deviceName);
      if (status.deviceName && isLabelPrinterModel(status.deviceName)) {
        setPrinterProtocol('tspl');
      }
    });
    return unsub;
  }, []);

  const labelPreviewRef = useRef<HTMLDivElement | null>(null);

  // Robust capture helper using html2canvas-pro with oklch support
  const captureLabelCanvas = async (scale = 3): Promise<HTMLCanvasElement | null> => {
    if (!labelPreviewRef.current) return null;
    return await html2canvas(labelPreviewRef.current, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
  };

  // Auto-generate SKU / Barcode
  const handleGenerateBarcode = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const prefix = (labelConfig.storeName || 'POS').substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'IT');
    const newCode = `${prefix}-${randomNum}`;
    setLabelConfig((prev) => ({ ...prev, barcodeValue: newCode }));
    onShowToast(isBn ? 'নতুন বারকোড তৈরি হয়েছে!' : 'New barcode generated!', 'info');
  };

  // Render Barcode PNG image via Canvas or QR Code whenever barcodeValue changes or design changes
  // Using Canvas raster PNG completely eliminates the infamous SVG-black-box rendering artifact
  useEffect(() => {
    if (!labelConfig.barcodeValue) return;

    if (labelConfig.barcodeType === 'QR') {
      const qrText = `${labelConfig.storeName} | ${labelConfig.itemName} | ${sym}${labelConfig.salePrice} | SKU: ${labelConfig.barcodeValue}`;
      QRCode.toDataURL(qrText, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    } else {
      try {
        const offscreenCanvas = document.createElement('canvas');
        const cleanCode = labelConfig.barcodeValue.trim() || '1001';
        const barWidth =
          labelConfig.sizePreset === '1x1'
            ? 1.2
            : labelConfig.barcodeThickness === 'thin'
            ? 1.1
            : labelConfig.barcodeThickness === 'thick'
            ? 2.0
            : 1.5;
        const barHeight =
          labelConfig.sizePreset === '1x1'
            ? 22
            : labelConfig.barcodeHeight === 'compact'
            ? 24
            : labelConfig.barcodeHeight === 'tall'
            ? 46
            : 34;
        const showText = labelConfig.showBarcodeText !== false;

        const effectiveFormat =
          labelConfig.barcodeType === 'EAN13' && /^\d{12,13}$/.test(cleanCode)
            ? 'EAN13'
            : 'CODE128';

        JsBarcode(offscreenCanvas, cleanCode, {
          format: effectiveFormat,
          width: barWidth,
          height: barHeight,
          displayValue: showText,
          fontSize: 11,
          font: 'monospace',
          textMargin: 2,
          margin: 4,
          background: '#ffffff', // PURE WHITE BACKGROUND - PREVENTS BLACK BOXES
          lineColor: '#000000',  // PURE BLACK CRISP BARS
        });
        setBarcodeDataUrl(offscreenCanvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Barcode generation error, using fallback:', err);
        try {
          const offscreenCanvas = document.createElement('canvas');
          JsBarcode(offscreenCanvas, labelConfig.barcodeValue || '1001', {
            format: 'CODE128',
            width: 1.4,
            height: 32,
            displayValue: true,
            fontSize: 11,
            margin: 4,
            background: '#ffffff',
            lineColor: '#000000',
          });
          setBarcodeDataUrl(offscreenCanvas.toDataURL('image/png'));
        } catch {}
      }
    }
  }, [
    labelConfig.barcodeValue,
    labelConfig.barcodeType,
    labelConfig.sizePreset,
    labelConfig.storeName,
    labelConfig.itemName,
    labelConfig.salePrice,
    labelConfig.barcodeHeight,
    labelConfig.barcodeThickness,
    labelConfig.showBarcodeText,
    sym,
  ]);

  // Apply Pre-made Design Themes
  const handleApplyTheme = (theme: TagLayoutStyle) => {
    setLabelConfig((prev) => {
      let updated: Partial<BarcodeLabelConfig> = { layoutStyle: theme };
      if (theme === 'ultra_simple') {
        updated = {
          ...updated,
          layoutStyle: 'ultra_simple',
          sizePreset: '2x1',
          headerStyle: 'minimal',
          borderStyle: 'none',
          priceStyle: 'standard',
          barcodeHeight: 'standard',
          barcodeThickness: 'medium',
          cornerRadius: 'none',
          titleFontSize: 'medium',
          textAlign: 'center',
          showBorder: false,
          showBarcodeText: true,
          showDiscountBadge: false,
          showStoreName: true,
          showItemName: false,
          showSize: false,
          showBatch: false,
          showPunchHole: false,
          showFooterNote: false,
          showMrp: true,
          showSalePrice: false,
          cleanWhiteMode: true,
        };
      } else if (theme === 'classic') {
        updated = {
          ...updated,
          headerStyle: 'underline',
          borderStyle: 'single',
          priceStyle: 'standard',
          barcodeHeight: 'standard',
          barcodeThickness: 'medium',
          cornerRadius: 'medium',
          titleFontSize: 'medium',
          textAlign: 'center',
          showBorder: true,
          showBarcodeText: true,
          showDiscountBadge: false,
        };
      } else if (theme === 'modern_badge') {
        updated = {
          ...updated,
          headerStyle: 'solid_banner',
          borderStyle: 'bold',
          priceStyle: 'highlight_pill',
          barcodeHeight: 'standard',
          barcodeThickness: 'medium',
          cornerRadius: 'small',
          titleFontSize: 'large',
          textAlign: 'left',
          showBorder: true,
          showBarcodeText: true,
          showDiscountBadge: false,
        };
      } else if (theme === 'bold_price') {
        updated = {
          ...updated,
          headerStyle: 'pill',
          borderStyle: 'bold',
          priceStyle: 'big_hero',
          barcodeHeight: 'compact',
          barcodeThickness: 'thick',
          cornerRadius: 'small',
          titleFontSize: 'large',
          textAlign: 'center',
          showBorder: true,
          showBarcodeText: true,
          showDiscountBadge: false,
          customOfferText: prev.customOfferText || (isBn ? 'ধামাকা অফার' : 'SPECIAL DEAL'),
        };
      } else if (theme === 'compact_split') {
        updated = {
          ...updated,
          headerStyle: 'minimal',
          borderStyle: 'single',
          priceStyle: 'standard',
          barcodeHeight: 'compact',
          barcodeThickness: 'thin',
          cornerRadius: 'small',
          titleFontSize: 'small',
          textAlign: 'left',
          showBorder: true,
          showBarcodeText: true,
          showDiscountBadge: false,
        };
      } else if (theme === 'minimal') {
        updated = {
          ...updated,
          headerStyle: 'minimal',
          borderStyle: 'none',
          priceStyle: 'standard',
          barcodeHeight: 'standard',
          barcodeThickness: 'thin',
          cornerRadius: 'none',
          titleFontSize: 'medium',
          textAlign: 'left',
          showBorder: false,
          showBarcodeText: true,
          showDiscountBadge: false,
        };
      } else if (theme === 'qr_centric') {
        updated = {
          ...updated,
          barcodeType: 'QR',
          headerStyle: 'solid_banner',
          borderStyle: 'single',
          priceStyle: 'highlight_pill',
          barcodeHeight: 'standard',
          cornerRadius: 'medium',
          titleFontSize: 'medium',
          textAlign: 'center',
          showBorder: true,
          showBarcodeText: true,
          showDiscountBadge: false,
        };
      }
      return { ...prev, ...updated };
    });
    onShowToast(
      isBn ? 'ডিজাইন থিম পরিবর্তন করা হয়েছে' : 'Design theme applied',
      'info'
    );
  };

  // Save Custom Barcode Design to Local Storage
  const handleSaveCustomDesign = () => {
    const toSave: Partial<BarcodeLabelConfig> = {
      layoutStyle: labelConfig.layoutStyle,
      borderStyle: labelConfig.borderStyle,
      headerStyle: labelConfig.headerStyle,
      priceStyle: labelConfig.priceStyle,
      barcodeHeight: labelConfig.barcodeHeight,
      barcodeThickness: labelConfig.barcodeThickness,
      showBarcodeText: labelConfig.showBarcodeText,
      cornerRadius: labelConfig.cornerRadius,
      titleFontSize: labelConfig.titleFontSize,
      textAlign: labelConfig.textAlign,
      showStorePhone: labelConfig.showStorePhone,
      showDiscountBadge: labelConfig.showDiscountBadge,
      customOfferText: labelConfig.customOfferText,
      showPunchHole: showPunchHole,
      showBorder: labelConfig.showBorder,
      showStoreName: labelConfig.showStoreName,
      showMrp: labelConfig.showMrp,
      showSalePrice: labelConfig.showSalePrice,
      showBarcode: labelConfig.showBarcode,
      showSize: labelConfig.showSize,
      showBatch: labelConfig.showBatch,
      showFooterNote: labelConfig.showFooterNote,
    };
    storageService.saveBarcodeCustomDesign(toSave);
    onShowToast(
      isBn
        ? '✅ আপনার পছন্দের বারকোড ডিজাইন সফলভাবে সেভ হয়েছে!'
        : '✅ Custom barcode design saved successfully!',
      'success'
    );
  };

  // Reset Design to default
  const handleResetDesign = () => {
    setLabelConfig((prev) => ({
      ...prev,
      layoutStyle: 'classic',
      borderStyle: 'single',
      headerStyle: 'underline',
      priceStyle: 'standard',
      barcodeHeight: 'standard',
      barcodeThickness: 'medium',
      showBarcodeText: true,
      cornerRadius: 'medium',
      titleFontSize: 'medium',
      textAlign: 'center',
      showStorePhone: false,
      showDiscountBadge: false,
      customOfferText: '',
      showBorder: true,
      showStoreName: true,
      showMrp: true,
      showSalePrice: true,
      showBarcode: true,
      showSize: true,
      showBatch: true,
      showFooterNote: true,
    }));
    setShowPunchHole(false);
    onShowToast(
      isBn ? 'ডিজাইন স্ট্যান্ডার্ড ডিফল্টে রিসেট হয়েছে' : 'Design reset to default',
      'info'
    );
  };

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
  const handleApplyTemplate = (type: 'garment' | 'grocery' | 'footwear' | 'jewel' | 'photo1') => {
    if (type === 'photo1') {
      setLabelConfig((prev) => ({
        ...prev,
        layoutStyle: 'ultra_simple',
        sizePreset: '2x1',
        storeName: prev.storeName || 'CLASSIC FASHION KOTAMO',
        itemName: '',
        showItemName: false,
        sizeOrVariant: '',
        showSize: false,
        barcodeValue: prev.barcodeValue || '2857854050000',
        barcodeType: 'CODE128',
        mrp: 5999,
        showMrp: true,
        showSalePrice: false,
        batchOrDate: '',
        footerNote: '',
        showBatch: false,
        showFooterNote: false,
        cleanWhiteMode: true,
        showBorder: false,
        showDiscountBadge: false,
        showBarcodeText: true,
        textAlign: 'center',
        headerStyle: 'minimal',
        priceStyle: 'standard',
        cornerRadius: 'none',
      }));
      setShowPunchHole(false);
      onShowToast(
        isBn ? 'ছবি ১-এর মতো সুপার সিম্পল লেবেল তৈরি হয়েছে' : 'Photo 1 simple label loaded',
        'success'
      );
    } else if (type === 'garment') {
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
      const canvas = await captureLabelCanvas(4);
      if (!canvas) throw new Error('Preview not ready');

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
      const canvas = await captureLabelCanvas(3);
      if (!canvas) throw new Error('Preview not ready');

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

      const canvas = await captureLabelCanvas(3);
      if (!canvas) throw new Error('Preview not ready');
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

  // Quick test print on thermal printer (50x25mm label test or receipt test)
  const handleTestPrint = async () => {
    try {
      if (labelPreviewRef.current) {
        onShowToast(
          isBn
            ? `${paperRollWidth === '50mm_label' ? '৫০×২৫ মিমি ' : ''}টেস্ট স্টিকার প্রিন্টারে পাঠানো হচ্ছে...`
            : `Sending ${paperRollWidth === '50mm_label' ? '50x25mm ' : ''}test sticker to printer...`,
          'info'
        );
        const canvas = await captureLabelCanvas(2.5);
        if (!canvas) throw new Error('Preview not ready');
        const threshold = darknessMode === 'extra_dark' ? 145 : darknessMode === 'dark' ? 160 : 175;
        const res = await thermalPrinterService.printLabelBitmapViaBluetooth(
          canvas,
          1,
          paperRollWidth,
          threshold,
          printerProtocol,
          widthMm,
          heightMm
        );
        if (res.success) {
          onShowToast(
            isBn
              ? `✅ ${paperRollWidth === '50mm_label' ? '৫০×২৫ মিমি ' : ''}টেস্ট স্টিকার প্রিন্ট সম্পন্ন!`
              : `✅ ${paperRollWidth === '50mm_label' ? '50x25mm ' : ''}Test label printed successfully!`,
            'success'
          );
        } else {
          onShowToast(res.message, 'error');
        }
      } else {
        const res = await thermalPrinterService.printTestReceipt(settings);
        if (res.success) {
          onShowToast(isBn ? 'টেস্ট স্লিপ প্রিন্ট হয়েছে!' : 'Test slip printed!', 'success');
        } else {
          onShowToast(res.message, 'error');
        }
      }
    } catch (e: any) {
      onShowToast(e?.message || 'Test print failed', 'error');
    }
  };

  // Direct Bluetooth BLE Stream to Thermal Printer (50x25mm Label Sticker / ESC/POS / TSPL)
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

      const sizeLabel = paperRollWidth === '50mm_label' ? '৫০×২৫ মিমি ' : '';
      onShowToast(
        isBn
          ? `ব্লুটুথ থার্মাল প্রিন্টারে ${sizeLabel}${labelConfig.quantity}টি স্টিকার পাঠানো হচ্ছে (${printerProtocol.toUpperCase()})...`
          : `Streaming ${sizeLabel}${labelConfig.quantity} label(s) to Bluetooth printer (${printerProtocol.toUpperCase()})...`,
        'info'
      );

      // Render crisp canvas representation of the sticker
      const canvas = await captureLabelCanvas(2.5);
      if (!canvas) throw new Error('Preview not ready');

      // Darkness threshold:
      // normal = 175, dark = 160, extra_dark = 145
      const threshold = darknessMode === 'extra_dark' ? 145 : darknessMode === 'dark' ? 160 : 175;

      const result = await thermalPrinterService.printLabelBitmapViaBluetooth(
        canvas,
        labelConfig.quantity,
        paperRollWidth,
        threshold,
        printerProtocol,
        widthMm,
        heightMm
      );

      if (result.success) {
        onShowToast(
          isBn
            ? `✅ ${sizeLabel}${labelConfig.quantity}টি বারকোড স্টিকার ব্লুটুথ প্রিন্টারে প্রিন্ট হয়েছে!`
            : `✅ ${sizeLabel}${labelConfig.quantity} barcode label(s) printed via Bluetooth!`,
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
      const canvas = await captureLabelCanvas(2.5);
      if (!canvas) throw new Error('Preview not ready');
      thermalPrinterService.printLabelViaRawBT(canvas, labelConfig.quantity, paperRollWidth);
    } catch (e: any) {
      console.error('RawBT print error:', e);
      onShowToast(isBn ? 'RawBT ওপেন করতে সমস্যা হয়েছে' : 'RawBT open failed', 'error');
    }
  };

  return (
    <div id="barcode-tag-studio-tab" className="max-w-4xl mx-auto space-y-3 sm:space-y-4 pb-28 pt-1">
      {/* Top Header Toolbar: Easy Mode vs Custom Designer vs Product Details */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Main Mode Switcher: 3 Clear Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200/80 flex-1">
            <button
              type="button"
              id="btn-tab-easy"
              onClick={() => setActiveControlTab('easy')}
              className={`flex-1 py-2 px-3 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeControlTab === 'easy'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isBn ? '⚡ সহজ প্রিন্ট' : '⚡ Easy Print'}</span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                  activeControlTab === 'easy' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isBn ? 'সহজ' : 'EASY'}
              </span>
            </button>

            <button
              type="button"
              id="btn-tab-custom-design"
              onClick={() => setActiveControlTab('design')}
              className={`flex-1 py-2 px-3 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeControlTab === 'design'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Palette className="w-4 h-4 text-amber-300" />
              <span>{isBn ? '🎨 ডিজাইন সাজান' : '🎨 Customize Design'}</span>
            </button>

            <button
              type="button"
              id="btn-tab-content"
              onClick={() => setActiveControlTab('content')}
              className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeControlTab === 'content'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              <span>{isBn ? 'বিলের তথ্য' : 'Bill Data'}</span>
            </button>
          </div>

          {/* Compact Size Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
              <span className="text-[10px] font-bold text-stone-500 pl-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-stone-600" />
                <span>{isBn ? 'সাইজ:' : 'Size:'}</span>
              </span>
              <select
                value={labelConfig.sizePreset}
                onChange={(e) => {
                  const val = e.target.value as LabelSizePreset;
                  const match = PRESET_SIZES.find((p) => p.id === val);
                  setLabelConfig((prev) => ({
                    ...prev,
                    sizePreset: val,
                    customWidthMm: match ? match.widthMm : prev.customWidthMm,
                    customHeightMm: match ? match.heightMm : prev.customHeightMm,
                  }));
                }}
                className="bg-white text-stone-900 text-xs font-extrabold font-mono border border-stone-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="2x1">50×25mm (জনপ্রিয় রোল)</option>
                <option value="2x1.2">2"×1.2" (MRP+Sale)</option>
                <option value="1x1">1"×1" (মিনি ট্যাগ)</option>
                <option value="1.5x1">1.5"×1" (কমপ্যাক্ট ট্যাগ)</option>
                <option value="2x2">2"×2" (বড় স্টিকার)</option>
                <option value="custom">{isBn ? 'কাস্টম সাইজ...' : 'Custom mm...'}</option>
              </select>
              <span className="text-[10px] font-bold font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                {widthMm}×{heightMm}mm
              </span>
            </div>
          </div>
        </div>

        {/* Quick Template Chips Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 text-[11px] font-bold text-stone-500 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isBn ? 'রেডিমেড টেমপ্লেট:' : 'Quick Presets:'}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleApplyTemplate('photo1')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer border ${
                labelConfig.layoutStyle === 'ultra_simple'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              <span>📸</span>
              <span>{isBn ? 'ছবি ১: সুপার সিম্পল' : 'Photo 1 Simple'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('garment')}
              className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 text-stone-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-stone-200/70"
            >
              <span>👗</span>
              <span>{isBn ? 'পোশাক' : 'Garments'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('grocery')}
              className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 text-stone-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-stone-200/70"
            >
              <span>🛒</span>
              <span>{isBn ? 'মুদি' : 'Grocery'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('footwear')}
              className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 text-stone-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-stone-200/70"
            >
              <span>👟</span>
              <span>{isBn ? 'জুতো' : 'Shoes'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('jewel')}
              className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 text-stone-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-stone-200/70"
            >
              <span>🏷️</span>
              <span>{isBn ? '১" মিনি' : '1" Mini'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Controls Form | Right Live Tag Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT COLUMN: Controls & Form (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">

          {/* Tab 1: ULTRA-SIMPLE EASY MODE (সহজ মোড - ১-ক্লিক প্রিন্ট) */}
          {activeControlTab === 'easy' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              {/* 1. Quick Mode Switcher: Photo 1 Simple vs Full Details */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => handleApplyTheme('ultra_simple')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    labelConfig.layoutStyle === 'ultra_simple'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/50'
                      : 'bg-white text-stone-800 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  <span className="text-base">📸</span>
                  <div className="text-left">
                    <span className="block leading-tight">{isBn ? 'ছবি ১: সুপার সিম্পল' : 'Photo 1: Ultra Simple'}</span>
                    <span className={`text-[9px] font-normal block ${labelConfig.layoutStyle === 'ultra_simple' ? 'text-emerald-100' : 'text-stone-500'}`}>
                      {isBn ? 'দোকান + বারকোড + MRP' : 'Store + Barcode + MRP'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyTheme('classic')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    labelConfig.layoutStyle !== 'ultra_simple'
                      ? 'bg-stone-900 text-white shadow-sm ring-2 ring-blue-500/50'
                      : 'bg-white text-stone-800 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  <span className="text-base">👗</span>
                  <div className="text-left">
                    <span className="block leading-tight">{isBn ? 'স্ট্যান্ডার্ড মোড' : 'Full Details Mode'}</span>
                    <span className={`text-[9px] font-normal block ${labelConfig.layoutStyle !== 'ultra_simple' ? 'text-stone-300' : 'text-stone-500'}`}>
                      {isBn ? 'নাম + সাইজ সহ বিস্তারিত' : 'Product name + Size'}
                    </span>
                  </div>
                </button>
              </div>

              {/* 2. Primary Barcode Format Switcher: 1D Barcode vs QR Code */}
              <div className="bg-linear-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                    <BarcodeIcon className="w-4 h-4 text-blue-600" />
                    <span>{isBn ? 'কোডের ধরন বাছুন' : 'Code Format'}</span>
                  </label>
                  <span className="text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                    {labelConfig.barcodeType === 'QR'
                      ? (isBn ? 'কিউআর কোড' : 'QR Code')
                      : (isBn ? 'স্ট্যান্ডার্ড বারকোড (ছবি ১)' : '1D Barcode (Photo 1)')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelConfig((prev) => ({
                        ...prev,
                        barcodeType: 'CODE128',
                        layoutStyle: prev.layoutStyle === 'qr_centric' ? 'classic' : prev.layoutStyle,
                      }));
                      onShowToast(isBn ? 'স্ট্যান্ডার্ড বারকোড নির্বাচন করা হয়েছে' : '1D Barcode selected', 'info');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      labelConfig.barcodeType !== 'QR'
                        ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-blue-500/50'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
                      <span className="tracking-widest">▌▌▌</span>
                      <span>{isBn ? 'স্ট্যান্ডার্ড বারকোড' : '1D Barcode'}</span>
                    </div>
                    <span className={`text-[10px] ${labelConfig.barcodeType !== 'QR' ? 'text-emerald-300' : 'text-stone-500'}`}>
                      {isBn ? '✓ ছবি ১-এর মতো স্ক্যানার কোড' : '✓ Like Photo 1'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLabelConfig((prev) => ({
                        ...prev,
                        barcodeType: 'QR',
                      }));
                      onShowToast(isBn ? 'কিউআর কোড নির্বাচন করা হয়েছে' : 'QR Code selected', 'info');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      labelConfig.barcodeType === 'QR'
                        ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-blue-500/50'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
                      <QrIcon className="w-4 h-4 text-blue-400" />
                      <span>{isBn ? 'কিউআর কোড (QR)' : 'QR Code'}</span>
                    </div>
                    <span className={`text-[10px] ${labelConfig.barcodeType === 'QR' ? 'text-blue-300' : 'text-stone-500'}`}>
                      {isBn ? 'মোবাইল ক্যামেরা দিয়ে স্ক্যান' : 'Smartphone Camera'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Sticker Roll Width Selector */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-stone-600" />
                    <span>{isBn ? 'স্টিকারের সাইজ / প্রস্থ (Width):' : 'Sticker Width:'}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {widthMm} × {heightMm} mm
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: '2x1' as LabelSizePreset, label: isBn ? '৫০ × ২৫ মিমি (ছবি ১)' : '50×25mm (Photo 1)' },
                    { id: '2x1.2' as LabelSizePreset, label: '৫০ × ৩০ মিমি' },
                    { id: '1.5x1' as LabelSizePreset, label: '৩৮ × ২৫ মিমি' },
                    { id: '1x1' as LabelSizePreset, label: '২৫ × ২৫ মিমি' },
                  ].map((sz) => {
                    const isSelected = labelConfig.sizePreset === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => {
                          const match = PRESET_SIZES.find((p) => p.id === sz.id);
                          setLabelConfig((prev) => ({
                            ...prev,
                            sizePreset: sz.id,
                            customWidthMm: match ? match.widthMm : prev.customWidthMm,
                            customHeightMm: match ? match.heightMm : prev.customHeightMm,
                          }));
                        }}
                        className={`text-[11px] font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-stone-900 text-white shadow-2xs font-black'
                            : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {sz.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Clean White Mode Guarantee */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={labelConfig.cleanWhiteMode !== false}
                    onChange={(e) => {
                      setLabelConfig((prev) => ({ ...prev, cleanWhiteMode: e.target.checked }));
                      onShowToast(
                        e.target.checked
                          ? (isBn ? '✅ সাদা ব্যাকগ্রাউন্ড মোড সক্রিয় (কোনো কালো দাগ পড়বে না)' : 'Clean White Print Enabled')
                          : (isBn ? 'ক্লিন হোয়াইট মোড বন্ধ' : 'Clean White Disabled'),
                        'info'
                      );
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-extrabold text-emerald-950 block text-xs leading-tight">
                      {isBn ? '✅ সাদা ব্যাকগ্রাউন্ড মোড (কোনো কালো দাগ পড়বে না)' : 'Clean White Print (No black blotches)'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium block">
                      {isBn ? 'স্টিকারে কোনো কালো ব্যান্ড হবে না, বারকোড শতভাগ পরিষ্কার ও স্পষ্ট প্রিন্ট হবে' : 'Removes black thermal fills to keep barcodes crisp'}
                    </span>
                  </div>
                </label>
                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  {isBn ? 'প্রস্তাবিত' : 'Recommended'}
                </span>
              </div>

              {/* 5. Essential Product Inputs (All Optional as Requested) */}
              <div className="space-y-3 pt-1">
                {/* Store Header */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">
                      {isBn ? 'দোকানের নাম (Store Header)' : 'Store Header'}
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500">
                      <input
                        type="checkbox"
                        checked={labelConfig.showStoreName}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, showStoreName: e.target.checked }))
                        }
                        className="rounded text-blue-600 cursor-pointer"
                      />
                      <span>{isBn ? 'স্টিকারে দেখান' : 'Show on Tag'}</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={labelConfig.storeName}
                    onChange={(e) => setLabelConfig((prev) => ({ ...prev, storeName: e.target.value }))}
                    placeholder="CLASSIC FASHION KOTAMO"
                    className="w-full bg-stone-50 hover:bg-stone-100/60 focus:bg-white text-stone-900 font-bold border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Product Name (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                      <span>{isBn ? 'পণ্যের নাম' : 'Product Name'}</span>
                      <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {recentBillItems.length > 0 && (
                        <select
                          onChange={(e) => {
                            const sel = recentBillItems.find((item) => item.name === e.target.value);
                            if (sel) {
                              setLabelConfig((prev) => ({
                                ...prev,
                                itemName: sel.name,
                                showItemName: true,
                                salePrice: sel.price,
                                mrp: Math.round(sel.price * 1.3),
                              }));
                            }
                          }}
                          value=""
                          className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer"
                        >
                          <option value="" disabled>
                            {isBn ? '⚡ বিল থেকে আইটেম বাছুন' : '⚡ Pick from Bills'}
                          </option>
                          {recentBillItems.map((item, idx) => (
                            <option key={idx} value={item.name}>
                              {item.name} ({sym}{item.price})
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500">
                        <input
                          type="checkbox"
                          checked={labelConfig.showItemName !== false}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({ ...prev, showItemName: e.target.checked }))
                          }
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>{isBn ? 'স্টিকারে দেখান' : 'Show'}</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={labelConfig.itemName}
                    onChange={(e) => setLabelConfig((prev) => ({ ...prev, itemName: e.target.value }))}
                    placeholder={isBn ? 'ফাঁকা রাখলে দেখাবে না (যেমন: কটন শাড়ি / কুর্তি)' : 'Leave blank to hide on tag (Optional)'}
                    className="w-full bg-stone-50 hover:bg-stone-100/60 focus:bg-white text-stone-900 font-bold border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Row: Size/Variant & Barcode Code with Auto Gen (Both Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <span>{isBn ? 'সাইজ / ভ্যারিয়েন্ট' : 'Size / Variant'}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500">
                        <input
                          type="checkbox"
                          checked={labelConfig.showSize}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({ ...prev, showSize: e.target.checked }))
                          }
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>{isBn ? 'দেখান' : 'Show'}</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={labelConfig.sizeOrVariant || ''}
                      onChange={(e) => setLabelConfig((prev) => ({ ...prev, sizeOrVariant: e.target.value }))}
                      placeholder={isBn ? 'ফাঁকা রাখলে দেখাবে না (Free Size / L / XL)' : 'Leave blank to hide (Optional)'}
                      className="w-full bg-stone-50 hover:bg-stone-100/60 focus:bg-white text-stone-900 font-bold border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <span>{isBn ? 'বারকোড নম্বর / SKU' : 'Barcode SKU'}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        className="text-[10px] font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{isBn ? 'অটো কোড' : 'Auto'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={labelConfig.barcodeValue}
                      onChange={(e) => setLabelConfig((prev) => ({ ...prev, barcodeValue: e.target.value }))}
                      placeholder="2857854050000"
                      className="w-full bg-stone-50 hover:bg-stone-100/60 focus:bg-white text-stone-900 font-black font-mono border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Row: MRP and Sale Price (Sale Price Optional!) */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50/80 rounded-xl border border-stone-200">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black text-stone-800 flex items-center gap-1">
                        <span className="line-through text-stone-400">MRP</span>
                        <span>{isBn ? 'আসল দাম (MRP)' : 'Original MRP'}</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500">
                        <input
                          type="checkbox"
                          checked={labelConfig.showMrp}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({ ...prev, showMrp: e.target.checked }))
                          }
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>{isBn ? 'দেখান' : 'Show'}</span>
                      </label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-stone-400">{sym}</span>
                      <input
                        type="number"
                        min="0"
                        value={labelConfig.mrp || ''}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, mrp: Number(e.target.value) || 0 }))
                        }
                        placeholder="5999"
                        className="w-full bg-white text-stone-900 font-bold border border-stone-200 rounded-lg pl-8 pr-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-blue-600" />
                        <span>{isBn ? 'বিক্রয় মূল্য' : 'Sale Price'}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Opt'})</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-stone-500">
                        <input
                          type="checkbox"
                          checked={labelConfig.showSalePrice}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({ ...prev, showSalePrice: e.target.checked }))
                          }
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>{isBn ? 'দেখান' : 'Show'}</span>
                      </label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-blue-600">{sym}</span>
                      <input
                        type="number"
                        min="0"
                        value={labelConfig.salePrice || ''}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, salePrice: Number(e.target.value) || 0 }))
                        }
                        placeholder={isBn ? 'ফাঁকা রাখতে পারেন' : 'Optional'}
                        className="w-full bg-white text-stone-950 font-bold border border-stone-300 rounded-lg pl-8 pr-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Print Button & Test Print right inside Easy Mode */}
              <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleBtThermalPrint}
                  disabled={isBtPrinting}
                  className="flex-1 w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Printer className={`w-4 h-4 ${isBtPrinting ? 'animate-bounce' : ''}`} />
                  <span>
                    {isBtPrinting
                      ? (isBn ? 'প্রিন্ট হচ্ছে...' : 'Printing...')
                      : (isBn
                          ? `🖨️ ${labelConfig.barcodeType === 'QR' ? 'কিউআর কোড' : 'বারকোড'} প্রিন্ট দিন (${labelConfig.quantity}টি)`
                          : `🖨️ Print ${labelConfig.barcodeType === 'QR' ? 'QR Code' : 'Barcode'} (${labelConfig.quantity})`)}
                  </span>
                </button>

                {btConnected && (
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="w-full sm:w-auto px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600" />
                    <span>{isBn ? '⚡ টেস্ট প্রিন্ট' : 'Test Print'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card B: Tag Details & Product Info */}
          {activeControlTab === 'content' && (
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                      <span>{isBn ? 'পণ্যের নাম (Item Name)' : 'Item Name'}</span>
                      <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labelConfig.showItemName !== false}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, showItemName: e.target.checked }))
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] text-stone-400 font-medium">
                        {isBn ? 'দেখাও' : 'Show'}
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={labelConfig.itemName}
                    onChange={(e) => setLabelConfig((prev) => ({ ...prev, itemName: e.target.value }))}
                    placeholder={isBn ? 'ফাঁকা রাখলে দেখাবে না (ঐচ্ছিক)' : 'Leave blank to hide (Optional)'}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-rose-700 flex items-center gap-1">
                      <span>{isBn ? 'বিক্রয় মূল্য (Our Price)' : 'Our Sale Price'}</span>
                      <span className="text-[10px] text-stone-400 font-normal">({isBn ? 'ঐচ্ছিক' : 'Optional'})</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labelConfig.showSalePrice}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({ ...prev, showSalePrice: e.target.checked }))
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-[10px] text-stone-400 font-medium">
                        {isBn ? 'দেখাও' : 'Show'}
                      </span>
                    </label>
                  </div>
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
                      placeholder={isBn ? 'ঐচ্ছিক (ফাঁকা রাখতে পারেন)' : 'Optional'}
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
          )}

          {/* TAB 2: Custom Barcode Design Studio (নিজের মতো ডিজাইন বানান) */}
          {activeControlTab === 'design' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-600" />
                    <span>{isBn ? 'বারকোড ও ট্যাগ ডিজাইন কাস্টমাইজেশন' : 'Barcode & Tag Customizer'}</span>
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    {isBn
                      ? 'লেআউট, হেডার স্টাইল, ফন্ট, বারকোড সাইজ ও ফ্রেম নিজের মতো সাজান'
                      : 'Customize layout, header style, barcode height, borders, and typography'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDesign}
                  className="px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                  title="রিসেট"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isBn ? 'ডিফল্ট' : 'Reset'}</span>
                </button>
              </div>

              {/* 1. Layout Archetypes / Themes */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? '১. লেআউট থিম ও ডিজাইন আর্কিটাইপ' : '1. Layout Style & Theme'}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'classic' as TagLayoutStyle,
                      nameBn: '👗 ক্লাসিক রিটেল',
                      nameEn: 'Classic Retail',
                      descBn: 'আন্ডারলাইন হেডার ও ক্লাসিক বারকোড',
                    },
                    {
                      id: 'modern_badge' as TagLayoutStyle,
                      nameBn: '✨ মডার্ন বুটিক',
                      nameEn: 'Modern Boutique',
                      descBn: 'ডার্ক হেডার ব্যানার ও বোল্ড প্রাইস',
                    },
                    {
                      id: 'bold_price' as TagLayoutStyle,
                      nameBn: '🏷️ অফার ও সেল',
                      nameEn: 'Bold Clearance',
                      descBn: 'বিশাল অফার মূল্য ও ডিসকাউন্ট ব্যাজ',
                    },
                    {
                      id: 'qr_centric' as TagLayoutStyle,
                      nameBn: '🔲 ডুয়াল কিউআর',
                      nameEn: 'Dual QR / Code',
                      descBn: 'মোবাইল স্ক্যানিং ফ্রেন্ডলি ডিজাইন',
                    },
                    {
                      id: 'compact_split' as TagLayoutStyle,
                      nameBn: '📦 স্প্লিট ২-কলাম',
                      nameEn: 'Split Side-by-Side',
                      descBn: 'বামে বিবরণ, ডানে খাড়া বারকোড',
                    },
                    {
                      id: 'minimal' as TagLayoutStyle,
                      nameBn: '🌿 মিনিমালিস্ট',
                      nameEn: 'Clean Minimal',
                      descBn: 'বর্ডারহীন পরিচ্ছন্ন আধুনিক ট্যাগ',
                    },
                  ].map((theme) => {
                    const isSelected = (labelConfig.layoutStyle || 'classic') === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleApplyTheme(theme.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100/90'
                        }`}
                      >
                        <span className="text-xs font-black text-stone-900 leading-tight">
                          {isBn ? theme.nameBn : theme.nameEn}
                        </span>
                        <span className="text-[10px] text-stone-500 mt-1 leading-tight line-clamp-2">
                          {theme.descBn}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Dimensions Editor when custom size preset chosen */}
                {labelConfig.sizePreset === 'custom' && (
                  <div className="mt-2.5 p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isBn ? 'কাস্টম স্টিকার সাইজ (Custom mm)' : 'Custom Label Dimensions (mm)'}</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                        {labelConfig.customWidthMm || 50}mm × {labelConfig.customHeightMm || 25}mm
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                          {isBn ? 'প্রস্থ (Width mm)' : 'Width (mm)'}
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="120"
                          value={labelConfig.customWidthMm || 50}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({
                              ...prev,
                              customWidthMm: Number(e.target.value) || 50,
                            }))
                          }
                          className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-600 uppercase block mb-1">
                          {isBn ? 'উচ্চতা (Height mm)' : 'Height (mm)'}
                        </label>
                        <input
                          type="number"
                          min="15"
                          max="150"
                          value={labelConfig.customHeightMm || 25}
                          onChange={(e) =>
                            setLabelConfig((prev) => ({
                              ...prev,
                              customHeightMm: Number(e.target.value) || 25,
                            }))
                          }
                          className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-stone-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Store Header & Branding */}
              <div className="space-y-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isBn ? '২. স্টোর হেডার ও ব্র্যান্ডিং স্টাইল' : '2. Store Header Style'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showStoreName}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showStoreName: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'দোকানের নাম দেখাও' : 'Show Store Name'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  {[
                    { id: 'underline' as TagHeaderStyle, labelBn: 'আন্ডারলাইন', labelEn: 'Underline' },
                    { id: 'solid_banner' as TagHeaderStyle, labelBn: '⬛ সলিড ব্যানার', labelEn: 'Solid Banner' },
                    { id: 'pill' as TagHeaderStyle, labelBn: '💊 রাউন্ডেড পিল', labelEn: 'Pill Badge' },
                    { id: 'minimal' as TagHeaderStyle, labelBn: '🔤 সিম্পল টেক্সট', labelEn: 'Simple Text' },
                  ].map((hStyle) => {
                    const isSelected = (labelConfig.headerStyle || 'underline') === hStyle.id;
                    return (
                      <button
                        key={hStyle.id}
                        type="button"
                        onClick={() => setLabelConfig((prev) => ({ ...prev, headerStyle: hStyle.id }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {isBn ? hStyle.labelBn : hStyle.labelEn}
                      </button>
                    );
                  })}
                </div>

                {/* Show Phone Number */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(labelConfig.showStorePhone)}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showStorePhone: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <Phone className="w-3 h-3 text-stone-500" />
                    <span>{isBn ? 'হেডারে মোবাইল নম্বর প্রদর্শন' : 'Show Phone in Header'}</span>
                  </label>
                  {labelConfig.showStorePhone && (
                    <input
                      type="text"
                      value={labelConfig.storePhone || ''}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, storePhone: e.target.value }))
                      }
                      placeholder="01711-xxxxxx"
                      className="w-36 bg-white border border-stone-200 rounded-md px-2 py-0.5 text-[11px] font-mono font-bold"
                    />
                  )}
                </div>
              </div>

              {/* 3. Barcode Sizing & Customization */}
              <div className="space-y-2.5 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                    <BarcodeIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isBn ? '৩. বারকোডের স্টাইল, টাইপ ও কোড নম্বর' : '3. Barcode Style, Type & SKU'}</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={labelConfig.barcodeType}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({
                          ...prev,
                          barcodeType: e.target.value as 'CODE128' | 'EAN13' | 'QR',
                        }))
                      }
                      className="text-[11px] font-bold border border-stone-200 bg-white rounded-lg px-2 py-0.5 cursor-pointer"
                    >
                      <option value="CODE128">Code 128 (Standard)</option>
                      <option value="EAN13">EAN-13</option>
                      <option value="QR">QR Code</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      title="নতুন কোড জেনারেট"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{isBn ? 'অটো কোড' : 'Auto'}</span>
                    </button>
                  </div>
                </div>

                {/* Barcode code input */}
                <div>
                  <input
                    type="text"
                    value={labelConfig.barcodeValue}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, barcodeValue: e.target.value }))
                    }
                    placeholder="যেমন: CF-1002 বা 890123456789"
                    className="w-full border border-stone-200 bg-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Barcode Height */}
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'বারকোড উচ্চতা (Height)' : 'Barcode Height'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'compact' as TagBarcodeHeight, label: isBn ? 'ছোট (20px)' : 'Compact' },
                        { id: 'standard' as TagBarcodeHeight, label: isBn ? 'স্ট্যান্ডার্ড' : 'Standard' },
                        { id: 'tall' as TagBarcodeHeight, label: isBn ? 'লম্বা (42px)' : 'Tall' },
                      ].map((bh) => {
                        const isSelected = (labelConfig.barcodeHeight || 'standard') === bh.id;
                        return (
                          <button
                            key={bh.id}
                            type="button"
                            onClick={() =>
                              setLabelConfig((prev) => ({ ...prev, barcodeHeight: bh.id }))
                            }
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {bh.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bar Thickness */}
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'বারের ঘনত্ব / থিকনেস' : 'Bar Thickness'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'thin' as TagBarcodeThickness, label: isBn ? 'সরু (1.0)' : 'Thin' },
                        { id: 'medium' as TagBarcodeThickness, label: isBn ? 'মাঝারি' : 'Medium' },
                        { id: 'thick' as TagBarcodeThickness, label: isBn ? 'চওড়া (1.8)' : 'Thick' },
                      ].map((bt) => {
                        const isSelected = (labelConfig.barcodeThickness || 'medium') === bt.id;
                        return (
                          <button
                            key={bt.id}
                            type="button"
                            onClick={() =>
                              setLabelConfig((prev) => ({ ...prev, barcodeThickness: bt.id }))
                            }
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {bt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Show text underneath barcode */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showBarcodeText !== false}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showBarcodeText: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'বারকোডের নিচে কোড নম্বর লেখা দেখাও' : 'Show Barcode Number Text Underneath'}</span>
                  </label>
                </div>
              </div>

              {/* 4. Price & Offer Display */}
              <div className="space-y-2.5 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <label className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? '৪. মূল্য ও অফারের প্রদর্শন স্টাইল' : '4. Price & Offer Style'}</span>
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'standard' as TagPriceStyle, label: isBn ? '🏷️ সাধারণ' : 'Standard' },
                    { id: 'highlight_pill' as TagPriceStyle, label: isBn ? '⬛ ডার্ক পিল' : 'Dark Pill' },
                    { id: 'big_hero' as TagPriceStyle, label: isBn ? '💥 বিগ হিরো' : 'Big Hero' },
                  ].map((ps) => {
                    const isSelected = (labelConfig.priceStyle || 'standard') === ps.id;
                    return (
                      <button
                        key={ps.id}
                        type="button"
                        onClick={() => setLabelConfig((prev) => ({ ...prev, priceStyle: ps.id }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {ps.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Offer Badge */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-stone-500">
                      {isBn ? 'কাস্টম অফার ব্যাজ টেক্সট (যেমন: ধামাকা অফার / ঈদ সেল)' : 'Custom Offer Badge Text'}
                    </span>
                    {labelConfig.customOfferText && (
                      <button
                        type="button"
                        onClick={() => setLabelConfig((prev) => ({ ...prev, customOfferText: '' }))}
                        className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                      >
                        {isBn ? 'মুছে ফেলুন' : 'Clear'}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={labelConfig.customOfferText || ''}
                    onChange={(e) =>
                      setLabelConfig((prev) => ({ ...prev, customOfferText: e.target.value }))
                    }
                    placeholder={isBn ? 'যেমন: ধামাকা অফার, স্পেশাল ছাড়, New Arrival' : 'e.g. SPECIAL OFFER, 30% OFF'}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900"
                  />
                  {/* Quick Offer Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['ধামাকা অফার', 'স্পেশাল ছাড়', 'New Arrival', 'Best Price'].map(
                      (chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            setLabelConfig((prev) => ({
                              ...prev,
                              customOfferText: chip,
                            }))
                          }
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer"
                        >
                          {chip}
                        </button>
                      )
                    )}
                  </div>

                  {/* Optional Discount % Badge toggle (default off) */}
                  <div className="pt-2 border-t border-stone-200/60 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-stone-700 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(labelConfig.showDiscountBadge)}
                        onChange={(e) =>
                          setLabelConfig((prev) => ({
                            ...prev,
                            showDiscountBadge: e.target.checked,
                          }))
                        }
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>
                        {isBn
                          ? 'ডিসকাউন্ট শতাংশ লেখা দেখান (যেমন: SAVE % OFF)'
                          : 'Show Discount % Text (e.g. SAVE % OFF)'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 5. Borders, Corners & Typography */}
              <div className="space-y-2.5 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <label className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? '৫. বর্ডার, কোণা ও ফন্ট সাইজ' : '5. Borders, Corners & Typography'}</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Border Style */}
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'বর্ডার ফ্রেম' : 'Border Style'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'single' as TagBorderStyle, label: isBn ? '১px নরমাল' : 'Single' },
                        { id: 'bold' as TagBorderStyle, label: isBn ? '২px বোল্ড' : 'Bold' },
                        { id: 'dashed' as TagBorderStyle, label: isBn ? 'ড্যাশড' : 'Dashed' },
                        { id: 'double' as TagBorderStyle, label: isBn ? 'ডাবল' : 'Double' },
                        { id: 'none' as TagBorderStyle, label: isBn ? 'বর্ডার ছাড়া' : 'None' },
                      ].map((bs) => {
                        const isSelected =
                          labelConfig.showBorder === false && bs.id === 'none'
                            ? true
                            : labelConfig.showBorder && (labelConfig.borderStyle || 'single') === bs.id;
                        return (
                          <button
                            key={bs.id}
                            type="button"
                            onClick={() => {
                              if (bs.id === 'none') {
                                setLabelConfig((prev) => ({ ...prev, showBorder: false, borderStyle: 'none' }));
                              } else {
                                setLabelConfig((prev) => ({ ...prev, showBorder: true, borderStyle: bs.id }));
                              }
                            }}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {bs.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Corner Rounding */}
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'কোণার আকৃতি' : 'Corners'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'none' as TagCornerRadius, label: isBn ? 'চোখা (0px)' : 'Square' },
                        { id: 'medium' as TagCornerRadius, label: isBn ? 'গোল (10px)' : 'Rounded' },
                        { id: 'pill' as TagCornerRadius, label: isBn ? 'পিল (16px)' : 'Pill' },
                      ].map((cr) => {
                        const isSelected = (labelConfig.cornerRadius || 'medium') === cr.id;
                        return (
                          <button
                            key={cr.id}
                            type="button"
                            onClick={() =>
                              setLabelConfig((prev) => ({ ...prev, cornerRadius: cr.id }))
                            }
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {cr.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Text Alignment & Title Size */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'অ্যালাইনমেন্ট' : 'Alignment'}
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setLabelConfig((prev) => ({ ...prev, textAlign: 'center' }))}
                        className={`py-1 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                          (labelConfig.textAlign || 'center') === 'center'
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                        <span>{isBn ? 'মাঝে' : 'Center'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLabelConfig((prev) => ({ ...prev, textAlign: 'left' }))}
                        className={`py-1 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                          labelConfig.textAlign === 'left'
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                        <span>{isBn ? 'বামে' : 'Left'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      {isBn ? 'পণ্যের নাম ফন্ট' : 'Title Size'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'small' as TagTitleFontSize, label: isBn ? 'ছোট' : 'S' },
                        { id: 'medium' as TagTitleFontSize, label: isBn ? 'মাঝারি' : 'M' },
                        { id: 'large' as TagTitleFontSize, label: isBn ? 'বড়' : 'L' },
                      ].map((ts) => {
                        const isSelected = (labelConfig.titleFontSize || 'medium') === ts.id;
                        return (
                          <button
                            key={ts.id}
                            type="button"
                            onClick={() =>
                              setLabelConfig((prev) => ({ ...prev, titleFontSize: ts.id }))
                            }
                            className={`py-1 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {ts.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Quick Elements Visibility Toggles */}
              <div className="space-y-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wide block">
                  {isBn ? '৬. স্টিকারে কি কি উপাদান দেখাবেন?' : '6. Elements Visibility'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-medium text-stone-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showStoreName}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showStoreName: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'দোকানের নাম' : 'Store Name'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showSize}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showSize: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'সাইজ ব্যাজ' : 'Size Badge'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showMrp}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showMrp: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'MRP কাটা দাম' : 'MRP Strikethrough'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showSalePrice}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showSalePrice: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'বিক্রয় মূল্য' : 'Sale Price'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showBarcode}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showBarcode: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'বারকোড / কিউআর' : 'Barcode / QR'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showBatch}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showBatch: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'ব্যাচ / তারিখ' : 'Batch / Date'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelConfig.showFooterNote !== false}
                      onChange={(e) =>
                        setLabelConfig((prev) => ({ ...prev, showFooterNote: e.target.checked }))
                      }
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'ফুটার টেক্সট' : 'Footer Note'}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPunchHole}
                      onChange={(e) => {
                        setShowPunchHole(e.target.checked);
                        setLabelConfig((prev) => ({ ...prev, showPunchHole: e.target.checked }));
                      }}
                      className="rounded text-blue-600"
                    />
                    <span>{isBn ? 'পাঞ্চ হোল (Hanger)' : 'Punch Hole'}</span>
                  </label>
                </div>
              </div>

              {/* 7. Save Custom Design Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  id="btn-save-custom-design"
                  onClick={handleSaveCustomDesign}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isBn ? '💾 আমার পছন্দের ডিজাইন সেভ করুন' : '💾 Save My Custom Design'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveControlTab('content')}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs cursor-pointer transition-all"
                >
                  {isBn ? 'পণ্যের তথ্যে ফিরে যান ➜' : 'Back to Product Info ➜'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Sticker Preview & Printing Actions (5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs sm:text-sm font-bold text-stone-900">
                  {isBn ? 'লাইভ ট্যাগ প্রিভিউ' : 'Live Tag Preview'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-preview-quick-print"
                  onClick={handleBtThermalPrint}
                  disabled={isBtPrinting}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-black rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                  title="সরাসরি প্রিন্ট করুন"
                >
                  <Printer className={`w-3.5 h-3.5 ${isBtPrinting ? 'animate-bounce' : ''}`} />
                  <span>{isBn ? '🖨️ প্রিন্ট করুন' : '🖨️ Print Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveControlTab('design')}
                  className="text-[10px] font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all"
                  title="ডিজাইন পরিবর্তন"
                >
                  <Palette className="w-3 h-3" />
                  <span>{isBn ? 'ডিজাইন সাজান' : 'Design'}</span>
                </button>
                <span className="text-[10px] font-bold font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                  {widthMm}×{heightMm}mm
                </span>
              </div>
            </div>

            {/* Quick theme pill switcher & Code switcher on top of preview */}
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center justify-between p-1 bg-stone-100 rounded-xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-600 pl-1 flex items-center gap-1">
                  <span>{isBn ? 'কোড মোড:' : 'Format:'}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelConfig((prev) => ({
                        ...prev,
                        barcodeType: 'CODE128',
                        layoutStyle: prev.layoutStyle === 'qr_centric' ? 'classic' : prev.layoutStyle,
                      }));
                      onShowToast(isBn ? 'স্ট্যান্ডার্ড বারকোড নির্বাচন করা হয়েছে' : '1D Barcode selected', 'info');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                      labelConfig.barcodeType !== 'QR'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <span>▌▌▌</span>
                    <span>{isBn ? 'বারকোড' : 'Barcode'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLabelConfig((prev) => ({ ...prev, barcodeType: 'QR' }));
                      onShowToast(isBn ? 'কিউআর কোড নির্বাচন করা হয়েছে' : 'QR Code selected', 'info');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                      labelConfig.barcodeType === 'QR'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <QrIcon className="w-3 h-3" />
                    <span>{isBn ? 'কিউআর (QR)' : 'QR Code'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  { id: 'ultra_simple' as TagLayoutStyle, label: isBn ? '📸 ছবি ১ (সুপার সিম্পল)' : '📸 Photo 1 Simple' },
                  { id: 'classic' as TagLayoutStyle, label: isBn ? '👗 ক্লাসিক' : 'Classic' },
                  { id: 'modern_badge' as TagLayoutStyle, label: isBn ? '✨ বুটিক' : 'Boutique' },
                  { id: 'bold_price' as TagLayoutStyle, label: isBn ? '🏷️ অফার' : 'Deal' },
                  { id: 'qr_centric' as TagLayoutStyle, label: isBn ? '🔲 কিউআর' : 'QR' },
                  { id: 'compact_split' as TagLayoutStyle, label: isBn ? '📦 স্প্লিট' : 'Split' },
                  { id: 'minimal' as TagLayoutStyle, label: isBn ? '🌿 মিনিমাল' : 'Minimal' },
                ].map((tp) => {
                  const isSelected = (labelConfig.layoutStyle || 'classic') === tp.id;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => handleApplyTheme(tp.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white shadow-xs font-black'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      {tp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Thermal Sticker Container */}
            <div className="bg-stone-100/90 p-3 sm:p-5 rounded-2xl border border-dashed border-stone-300 flex items-center justify-center min-h-[220px] overflow-hidden">
              <div
                ref={labelPreviewRef}
                id="thermal-sticker-live-card"
                className={`bg-white text-stone-900 relative transition-all select-none overflow-hidden flex flex-col justify-between ${
                  !labelConfig.showBorder || labelConfig.borderStyle === 'none'
                    ? 'border-0'
                    : labelConfig.borderStyle === 'bold'
                    ? 'border-2 border-stone-950'
                    : labelConfig.borderStyle === 'double'
                    ? 'border-4 border-double border-stone-900'
                    : labelConfig.borderStyle === 'dashed'
                    ? 'border border-dashed border-stone-700'
                    : 'border border-stone-900'
                } ${
                  labelConfig.cornerRadius === 'none'
                    ? 'rounded-none'
                    : labelConfig.cornerRadius === 'small'
                    ? 'rounded-sm'
                    : labelConfig.cornerRadius === 'pill'
                    ? 'rounded-2xl'
                    : 'rounded-xl'
                }`}
                style={{
                  width: `${Math.min(320, widthMm * 5.4)}px`,
                  minHeight: `${Math.max(120, heightMm * 5.4)}px`,
                  backgroundColor: '#ffffff',
                  boxShadow: 'none',
                  padding:
                    labelConfig.layoutStyle === 'ultra_simple'
                      ? '4px 6px'
                      : labelConfig.layoutStyle === 'compact_split'
                      ? '6px'
                      : !labelConfig.cleanWhiteMode && labelConfig.headerStyle === 'solid_banner' && labelConfig.showStoreName
                      ? '0 0 6px 0'
                      : '6px 8px',
                }}
              >
                {/* Garment tag punch hole (optional) */}
                {showPunchHole && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-stone-400 bg-stone-100 shadow-inner flex items-center justify-center z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  </div>
                )}

                {/* --- RENDER OPTION: ULTRA SIMPLE (Photo 1 exact layout) --- */}
                {labelConfig.layoutStyle === 'ultra_simple' ? (
                  <div className="flex flex-col justify-between h-full w-full bg-white select-none text-center py-0.5">
                    {/* Top: Centered Store Name */}
                    {labelConfig.showStoreName && labelConfig.storeName ? (
                      <div className="text-[11px] sm:text-[12px] font-black uppercase tracking-wider text-stone-950 leading-tight">
                        {labelConfig.storeName}
                      </div>
                    ) : null}

                    {/* Optional Product Name & Size if provided */}
                    {((labelConfig.showItemName !== false && Boolean(labelConfig.itemName?.trim())) ||
                      (labelConfig.showSize && Boolean(labelConfig.sizeOrVariant?.trim()))) && (
                      <div className="text-[9px] font-bold text-stone-800 truncate leading-tight pt-0.5">
                        {labelConfig.showItemName !== false && labelConfig.itemName?.trim() ? labelConfig.itemName : ''}
                        {labelConfig.showSize && labelConfig.sizeOrVariant?.trim() ? ` (${labelConfig.sizeOrVariant})` : ''}
                      </div>
                    )}

                    {/* Center: Barcode with code numbers underneath */}
                    {labelConfig.showBarcode && (
                      <div className="flex flex-col items-center justify-center my-auto py-1 bg-white">
                        {labelConfig.barcodeType === 'QR' ? (
                          qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt="QR"
                              className="w-14 h-14 object-contain select-none mx-auto"
                            />
                          ) : null
                        ) : barcodeDataUrl ? (
                          <img
                            src={barcodeDataUrl}
                            alt="Barcode"
                            className="w-full max-h-12 object-contain select-none mx-auto"
                          />
                        ) : null}
                      </div>
                    )}

                    {/* Bottom: Underlined MRP (Photo 1 exact style: MRP:5999) */}
                    <div className="text-center pt-0.5 pb-0.5">
                      {labelConfig.showMrp ? (
                        <span className="text-xs sm:text-sm font-black font-mono text-stone-950 underline decoration-stone-950 decoration-1.5 underline-offset-2 italic tracking-wide">
                          MRP:{labelConfig.mrp || labelConfig.salePrice || '5999'}
                        </span>
                      ) : labelConfig.showSalePrice ? (
                        <span className="text-xs sm:text-sm font-black font-mono text-stone-950 underline decoration-stone-950 decoration-1.5 underline-offset-2 italic tracking-wide">
                          PRICE:{sym}{labelConfig.salePrice}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : labelConfig.layoutStyle === 'compact_split' ? (
                  /* --- RENDER OPTION A: COMPACT SPLIT (Side-by-side) --- */
                  <div className={`flex items-center gap-2 w-full h-full ${showPunchHole ? 'pt-2.5' : ''}`}>
                    {/* Left Column: Product Info & Pricing */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full space-y-1">
                      {/* Store Header */}
                      {labelConfig.showStoreName && labelConfig.storeName && (
                        <div className="text-[9px] font-black uppercase tracking-wider text-stone-700 truncate leading-tight border-b border-stone-200 pb-0.5">
                          {labelConfig.storeName}
                        </div>
                      )}

                      {((labelConfig.showItemName !== false && Boolean(labelConfig.itemName?.trim())) ||
                        (labelConfig.showSize && Boolean(labelConfig.sizeOrVariant?.trim()))) && (
                        <div>
                          {labelConfig.showItemName !== false && Boolean(labelConfig.itemName?.trim()) && (
                            <div
                              className={`font-black text-stone-900 uppercase leading-tight truncate ${
                                labelConfig.titleFontSize === 'small'
                                  ? 'text-[10px]'
                                  : labelConfig.titleFontSize === 'large'
                                  ? 'text-xs'
                                  : 'text-[11px]'
                              }`}
                            >
                              {labelConfig.itemName}
                            </div>
                          )}
                          {labelConfig.showSize && labelConfig.sizeOrVariant && (
                            <span
                              className={`text-[8px] font-black px-1 py-0.2 rounded-xs inline-block mt-0.5 ${
                                labelConfig.cleanWhiteMode !== false
                                  ? 'border border-stone-800 bg-white text-stone-900'
                                  : 'bg-stone-900 text-white'
                              }`}
                            >
                              {labelConfig.sizeOrVariant}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pricing */}
                      <div className="pt-0.5">
                        {labelConfig.showMrp && Boolean(labelConfig.mrp) && (
                          <div className="text-[9px] text-stone-500 font-bold line-through leading-none">
                            MRP: {sym}{labelConfig.mrp}
                          </div>
                        )}
                        {labelConfig.showSalePrice && (
                          <div className="text-sm font-black font-mono text-stone-950 leading-tight">
                            {sym}{labelConfig.salePrice}
                          </div>
                        )}
                        {labelConfig.customOfferText ? (
                          <span
                            className={`text-[8px] font-black px-1 py-0.2 rounded-xs inline-block leading-none mt-0.5 ${
                              labelConfig.cleanWhiteMode !== false
                                ? 'border border-stone-800 bg-white text-stone-900'
                                : 'bg-stone-900 text-white'
                            }`}
                          >
                            {labelConfig.customOfferText}
                          </span>
                        ) : Boolean(labelConfig.showDiscountBadge) && discountPercent > 0 ? (
                          <span className="text-[8px] font-black text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded-xs inline-block leading-none mt-0.5">
                            SAVE {discountPercent}%
                          </span>
                        ) : null}
                      </div>

                      {/* Footer Note / Batch */}
                      {(labelConfig.showBatch !== false && labelConfig.batchOrDate) ||
                      (labelConfig.showFooterNote !== false && labelConfig.footerNote) ? (
                        <div className="text-[7px] text-stone-500 truncate leading-tight pt-0.5">
                          {labelConfig.batchOrDate || labelConfig.footerNote}
                        </div>
                      ) : null}
                    </div>

                    {/* Right Column: Barcode or QR Code Image */}
                    <div className="w-5/12 flex flex-col items-center justify-center border-l border-stone-200 pl-1.5 h-full bg-white">
                      {labelConfig.barcodeType === 'QR' ? (
                        qrCodeDataUrl ? (
                          <img src={qrCodeDataUrl} alt="QR" className="w-16 h-16 object-contain select-none mx-auto" />
                        ) : null
                      ) : barcodeDataUrl ? (
                        <img
                          src={barcodeDataUrl}
                          alt="Barcode"
                          className="w-full max-h-16 object-contain select-none mx-auto"
                        />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  /* --- RENDER OPTION B: STANDARD / MODERN / BOLD / MINIMAL --- */
                  <>
                    {/* Top: Store Name Banner or Underline */}
                    {labelConfig.showStoreName && labelConfig.storeName && (
                      labelConfig.headerStyle === 'solid_banner' ? (
                        labelConfig.cleanWhiteMode !== false ? (
                          <div className="border-b-2 border-stone-900 pb-0.5 px-2 text-center w-full bg-white text-stone-950">
                            <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight">
                              {labelConfig.storeName}
                            </div>
                            {labelConfig.showStorePhone && labelConfig.storePhone && (
                              <div className="text-[8px] text-stone-600 font-mono leading-none mt-0.5">
                                📞 {labelConfig.storePhone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-stone-950 text-white py-1 px-2 text-center w-full">
                            <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight">
                              {labelConfig.storeName}
                            </div>
                            {labelConfig.showStorePhone && labelConfig.storePhone && (
                              <div className="text-[8px] text-stone-300 font-mono leading-none mt-0.5">
                                📞 {labelConfig.storePhone}
                              </div>
                            )}
                          </div>
                        )
                      ) : labelConfig.headerStyle === 'pill' ? (
                        <div className={`text-center pt-1 px-2 ${showPunchHole ? 'pt-2.5' : ''}`}>
                          <span className="inline-block bg-stone-100 text-stone-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-stone-300 leading-tight">
                            {labelConfig.storeName}{' '}
                            {labelConfig.showStorePhone && labelConfig.storePhone
                              ? `• ${labelConfig.storePhone}`
                              : ''}
                          </span>
                        </div>
                      ) : labelConfig.headerStyle === 'minimal' ? (
                        <div
                          className={`text-[10px] font-black uppercase tracking-wider text-stone-900 pt-1 px-2 leading-tight ${
                            labelConfig.textAlign === 'left' ? 'text-left' : 'text-center'
                          } ${showPunchHole ? 'pt-2.5' : ''}`}
                        >
                          {labelConfig.storeName}
                          {labelConfig.showStorePhone && labelConfig.storePhone && (
                            <span className="text-[8px] font-normal text-stone-500 ml-1">
                              ({labelConfig.storePhone})
                            </span>
                          )}
                        </div>
                      ) : (
                        // Default Underline
                        <div
                          className={`text-center border-b border-stone-300 pb-0.5 px-2 ${
                            showPunchHole ? 'pt-2.5' : ''
                          }`}
                        >
                          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-stone-950 leading-tight">
                            {labelConfig.storeName}
                          </div>
                          {labelConfig.showStorePhone && labelConfig.storePhone && (
                            <div className="text-[8px] text-stone-600 font-mono leading-none mt-0.5">
                              Ph: {labelConfig.storePhone}
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {/* Product Name & Size Badge (Optional) */}
                    {((labelConfig.showItemName !== false && Boolean(labelConfig.itemName?.trim())) ||
                      (labelConfig.showSize && Boolean(labelConfig.sizeOrVariant?.trim()))) && (
                      <div
                        className={`px-2 pt-1 flex items-center gap-1 ${
                          labelConfig.textAlign === 'center'
                            ? 'justify-center text-center'
                            : 'justify-between text-left'
                        } ${showPunchHole && !labelConfig.showStoreName ? 'pt-3' : ''}`}
                      >
                        {labelConfig.showItemName !== false && Boolean(labelConfig.itemName?.trim()) && (
                          <span
                            className={`font-black text-stone-900 leading-tight truncate ${
                              labelConfig.titleFontSize === 'small'
                                ? 'text-[10px]'
                                : labelConfig.titleFontSize === 'large'
                                ? 'text-sm font-black'
                                : 'text-xs font-extrabold'
                            }`}
                          >
                            {labelConfig.itemName}
                          </span>
                        )}
                        {labelConfig.showSize && labelConfig.sizeOrVariant && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded-xs shrink-0 tracking-tight ${
                              labelConfig.cleanWhiteMode !== false
                                ? 'border border-stone-800 bg-white text-stone-900'
                                : 'bg-stone-900 text-white'
                            }`}
                          >
                            {labelConfig.sizeOrVariant}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Middle: Barcode Image or QR Code */}
                    {labelConfig.showBarcode && (
                      <div className="flex flex-col items-center justify-center py-1 px-1 bg-white">
                        {labelConfig.barcodeType === 'QR' ? (
                          qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt="QR"
                              className="w-14 h-14 object-contain select-none mx-auto"
                            />
                          ) : null
                        ) : barcodeDataUrl ? (
                          <img
                            src={barcodeDataUrl}
                            alt="Barcode"
                            className={`w-full object-contain select-none mx-auto ${
                              labelConfig.barcodeHeight === 'compact'
                                ? 'max-h-8'
                                : labelConfig.barcodeHeight === 'tall'
                                ? 'max-h-14'
                                : 'max-h-11'
                            }`}
                          />
                        ) : null}
                      </div>
                    )}

                    {/* Pricing Block */}
                    <div className="border-t border-stone-200 pt-1 px-2 space-y-0.5">
                      <div className="flex items-baseline justify-between gap-1">
                        {/* Left: Crossed out MRP */}
                        {labelConfig.showMrp && Boolean(labelConfig.mrp) ? (
                          <div className="text-[10px] text-stone-500 font-bold leading-tight">
                            <span>MRP: </span>
                            <span className="line-through">
                              {sym}{labelConfig.mrp}
                            </span>
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* Right: Sale Price styled by priceStyle */}
                        {labelConfig.showSalePrice && (
                          <div className="text-right ml-auto flex items-baseline gap-1">
                            <span className="text-[9px] font-black text-stone-600 uppercase">
                              {isBn ? 'মূল্য:' : 'PRICE:'}
                            </span>
                            {labelConfig.priceStyle === 'highlight_pill' ? (
                              labelConfig.cleanWhiteMode !== false ? (
                                <span className="border border-stone-900 bg-white text-stone-950 px-2 py-0.5 rounded-md text-xs sm:text-sm font-black font-mono tracking-tight leading-none">
                                  {sym}{labelConfig.salePrice}
                                </span>
                              ) : (
                                <span className="bg-stone-950 text-white px-2 py-0.5 rounded-md text-xs sm:text-sm font-black font-mono tracking-tight leading-none">
                                  {sym}{labelConfig.salePrice}
                                </span>
                              )
                            ) : labelConfig.priceStyle === 'big_hero' ? (
                              <span className="text-base sm:text-lg font-black font-mono text-stone-950 tracking-tight leading-none">
                                {sym}{labelConfig.salePrice}
                              </span>
                            ) : (
                              <span className="text-sm sm:text-base font-black font-mono text-stone-950 tracking-tight leading-none">
                                {sym}{labelConfig.salePrice}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Offers, Savings & Footer Notes */}
                      <div className="flex items-center justify-between text-[8px] text-stone-500 font-medium pt-0.5">
                        {labelConfig.customOfferText ? (
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded-xs ${
                              labelConfig.cleanWhiteMode !== false
                                ? 'border border-stone-800 bg-white text-stone-900'
                                : 'text-white bg-stone-950'
                            }`}
                          >
                            {labelConfig.customOfferText}
                          </span>
                        ) : Boolean(labelConfig.showDiscountBadge) && discountPercent > 0 ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded-xs">
                            SAVE {discountPercent}% OFF
                          </span>
                        ) : labelConfig.showBatch !== false && labelConfig.batchOrDate ? (
                          <span>{labelConfig.batchOrDate}</span>
                        ) : (
                          <span />
                        )}

                        {labelConfig.showFooterNote !== false && (
                          <span className="truncate max-w-[140px] text-right">
                            {labelConfig.footerNote || '(Incl. of all taxes)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
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
                      id="btn-bt-test-print"
                      onClick={handleTestPrint}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-emerald-500 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                      title={isBn ? 'টেস্ট স্টিকার প্রিন্ট দিন' : 'Test sticker print'}
                    >
                      <Printer className="w-3 h-3" />
                      <span>{isBn ? 'টেস্ট প্রিন্ট' : 'Test Print'}</span>
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

              {/* Roll / Sticker Size & Protocol & Darkness Controls */}
              <div className="space-y-2.5 pt-1.5 border-t border-indigo-100/80 text-[11px]">
                {/* 1. Paper / Sticker Size: 50x25mm (Default), 58mm, 80mm */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-700 flex items-center gap-1">
                      <span>{isBn ? 'পেপার / স্টিকার রোল সাইজ:' : 'Paper / Sticker Size:'}</span>
                    </span>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {paperRollWidth === '50mm_label'
                        ? (isBn ? '🏷️ ৫০×২৫ মিমি স্টিকার রোল' : '🏷️ 50×25mm Sticker Roll')
                        : paperRollWidth === '58mm'
                        ? (isBn ? '📄 ৫৮ মিমি রোল (২ ইঞ্চি)' : '📄 58mm Roll (2")')
                        : (isBn ? '📄 ৮০ মিমি রোল (৩ ইঞ্চি)' : '📄 80mm Roll (3")')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-white/95 p-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPaperRollWidth('50mm_label');
                        setLabelConfig((prev) => ({
                          ...prev,
                          sizePreset: '2x1',
                          customWidthMm: 50,
                          customHeightMm: 25,
                        }));
                      }}
                      className={`py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center leading-tight ${
                        paperRollWidth === '50mm_label'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                      title={isBn ? '৫০মিমি × ২৫মিমি পোশাক প্রাইস ট্যাগ স্টিকার' : '50mm × 25mm Garment Price Tag Sticker'}
                    >
                      <span className="font-extrabold">50×25 mm</span>
                      <span className="text-[8px] opacity-90">{isBn ? 'স্টিকার রোল' : 'Sticker Roll'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperRollWidth('58mm')}
                      className={`py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center leading-tight ${
                        paperRollWidth === '58mm'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <span className="font-extrabold">58 mm</span>
                      <span className="text-[8px] opacity-90">{isBn ? '২" পেপার' : '2" Paper'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperRollWidth('80mm')}
                      className={`py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex flex-col items-center leading-tight ${
                        paperRollWidth === '80mm'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <span className="font-extrabold">80 mm</span>
                      <span className="text-[8px] opacity-90">{isBn ? '৩" পেপার' : '3" Paper'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Protocol & Burn Darkness */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Command Protocol: ESC/POS vs TSPL */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-600">
                        {isBn ? 'প্রিন্টার কমান্ড মোড:' : 'Printer Protocol:'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-white/90 p-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPrinterProtocol('escpos')}
                        className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center ${
                          printerProtocol === 'escpos'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-stone-600 hover:bg-stone-50'
                        }`}
                        title={isBn ? 'সাধারণ থার্মাল POS প্রিন্টার' : 'Standard POS Thermal Printer'}
                      >
                        ESC/POS
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrinterProtocol('tspl')}
                        className={`py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center ${
                          printerProtocol === 'tspl'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-stone-600 hover:bg-stone-50'
                        }`}
                        title={isBn ? 'লেবেল প্রিন্টার যেমন Xprinter, Gprinter, Rongta (গ্যাপ অটো ডিটেক্ট)' : 'Label Printer with Gap Alignment (Xprinter, Rongta, etc.)'}
                      >
                        TSPL (লেবেল)
                      </button>
                    </div>
                  </div>

                  {/* Print Density / Darkness for sharp barcodes */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-600">
                      {isBn ? 'বারকোড স্পষ্টতা (Burn):' : 'Darkness (Burn):'}
                    </span>
                    <div className="grid grid-cols-3 gap-0.5 bg-white/90 p-0.5 rounded-lg border border-indigo-100 shadow-2xs">
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
                className="w-full bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.99] text-white py-3 px-4 rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all flex items-center justify-between gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Printer className={`w-5 h-5 text-white ${isBtPrinting ? 'animate-bounce' : ''}`} />
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="font-black text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
                      <span>{isBn ? '🖨️ সরাসরি বারকোড প্রিন্ট করুন' : '🖨️ Print Barcode Label'}</span>
                      {btConnected ? (
                        <span className="text-[10px] bg-emerald-400 text-stone-950 font-black px-1.5 py-0.2 rounded-xs">
                          {isBn ? 'প্রিন্টার রেডি' : 'Ready'}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-1.5 py-0.2 rounded-xs">
                          {isBn ? 'কানেক্ট করুন' : 'Tap to Pair'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-blue-100 font-medium mt-0.5 truncate">
                      {isBtPrinting
                        ? (isBn ? 'প্রিন্টারে ডেটা পাঠানো হচ্ছে...' : 'Streaming data to printer...')
                        : (isBn
                            ? `${paperRollWidth === '50mm_label' ? '৫০×২৫ মিমি স্টিকার • ' : ''}${labelConfig.quantity}টি কপি প্রিন্ট হবে`
                            : `${paperRollWidth === '50mm_label' ? '50×25mm Sticker • ' : ''}Print ${labelConfig.quantity} cop${labelConfig.quantity > 1 ? 'ies' : 'y'}`)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[11px] bg-white/20 px-2.5 py-1 rounded-lg font-mono font-black uppercase tracking-wider text-white">
                    {printerProtocol.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-blue-200 mt-0.5 font-bold">
                    {paperRollWidth === '50mm_label' ? '50×25mm' : paperRollWidth}
                  </span>
                </div>
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
