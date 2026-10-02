import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Barcode,
  ZoomIn,
  Sparkles,
  Plus,
  Pin,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Language, ProductStockItem } from '../types';
import { useBackHandler } from '../utils/useBackHandler';
import { storageService } from '../services/storageService';

// Web Audio API POS Laser Barcode Beep Sound (Zero external assets, works 100% offline)
export const playBarcodeBeep = (enabled = true): void => {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Classic supermarket POS barcode scanner 1950Hz crisp double-tone beep
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, ctx.currentTime);
    osc.frequency.setValueAtTime(2250, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.38, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 180);
  } catch (e) {
    console.warn('Beep audio notice:', e);
  }
};

const SCANNER_MODE_PREF_KEY = 'simple_pos_quick_scan_mode_v2';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinToScreen?: () => void;
  onScanSuccess: (barcodeCode: string) => {
    matched: boolean;
    itemName?: string;
    price?: number;
  } | void;
  language?: Language;
  products?: ProductStockItem[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onPinToScreen,
  onScanSuccess,
  language = 'bn',
  products = [],
}) => {
  const isBn = language === 'bn';
  const scannerRegionId = 'pos-html5-barcode-reader-modal';

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const nativeDetectorTimerRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Default to 'permanent' (Continuous / non-closing mode so scanner stays permanently on!)
  const [scanMode, setScanMode] = useState<'permanent' | 'quick'>(() => {
    try {
      const saved = localStorage.getItem(SCANNER_MODE_PREF_KEY);
      return saved === 'quick' ? 'quick' : 'permanent';
    } catch {
      return 'permanent';
    }
  });
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    code: string;
    itemName?: string;
    price?: number;
    matched: boolean;
    count: number;
  } | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Saved products with barcodes for 1-tap quick scan fallback
  const savedBarcodeProducts = React.useMemo(() => {
    const all = products.length > 0 ? products : storageService.getProducts();
    return all.filter((p) => p.barcode && p.barcode.trim()).slice(0, 8);
  }, [products, isOpen]);

  useBackHandler(
    'barcodeScannerModal',
    isOpen,
    () => {
      onClose();
      return true;
    },
    55
  );

  const updateScanMode = (mode: 'permanent' | 'quick') => {
    setScanMode(mode);
    try {
      localStorage.setItem(SCANNER_MODE_PREF_KEY, mode);
    } catch {}
  };

  const stopScanner = useCallback(async () => {
    if (nativeDetectorTimerRef.current) {
      window.clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch (e) {
      console.warn('Stop scanner note:', e);
    } finally {
      html5QrCodeRef.current = null;
    }
  }, []);

  const handleDecodedCode = useCallback(
    (decodedText: string) => {
      const cleanCode = (decodedText || '').trim();
      if (!cleanCode) return;

      const now = Date.now();
      // 1.1s debounce for same code to prevent duplicate multi-adds while pointing at same label
      if (
        lastScannedRef.current.code === cleanCode &&
        now - lastScannedRef.current.time < 1100
      ) {
        return;
      }
      lastScannedRef.current = { code: cleanCode, time: now };

      // 1. Play crisp POS laser beep sound
      playBarcodeBeep(soundEnabled);

      // Vibrate on mobile devices if supported
      try {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {}

      // 2. Invoke parent handler (auto-lookup in inventory, add 1 item to cart, refresh input)
      const result = onScanSuccess(cleanCode);

      setLastScanFeedback((prev) => ({
        code: cleanCode,
        itemName: result && typeof result === 'object' ? result.itemName : undefined,
        price: result && typeof result === 'object' ? result.price : undefined,
        matched: result && typeof result === 'object' ? result.matched : true,
        count: (prev?.count || 0) + 1,
      }));

      // Only close modal automatically if explicitly in 1-Scan quick mode
      if (scanMode === 'quick') {
        setTimeout(() => {
          stopScanner().then(() => onClose());
        }, 320);
      }
    },
    [scanMode, onClose, onScanSuccess, soundEnabled, stopScanner]
  );

  // Start parallel native BarcodeDetector loop on the active <video> element for <50ms 1D barcode recognition
  const attachTurboNativeBarcodeDetector = useCallback(() => {
    if (nativeDetectorTimerRef.current) {
      window.clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    const BarcodeDetectorApi = (window as any).BarcodeDetector;
    if (!BarcodeDetectorApi) return;

    try {
      const detector = new BarcodeDetectorApi({
        formats: [
          'code_128',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_39',
          'code_93',
          'itf',
          'qr_code',
        ],
      });

      nativeDetectorTimerRef.current = window.setInterval(async () => {
        try {
          const regionEl = document.getElementById(scannerRegionId);
          const videoEl = regionEl?.querySelector('video') as HTMLVideoElement | null;
          if (!videoEl || videoEl.readyState < 2) return;
          const barcodes = await detector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDecodedCode(String(barcodes[0].rawValue));
          }
        } catch {
          // ignore frame error
        }
      }, 90);
    } catch {
      // Native BarcodeDetector not supported
    }
  }, [handleDecodedCode]);

  const startScanner = useCallback(
    async (mode: 'environment' | 'user') => {
      setIsStarting(true);
      setCameraError(null);
      await stopScanner();

      try {
        const el = document.getElementById(scannerRegionId);
        if (!el) {
          setIsStarting(false);
          return;
        }

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const qr = new Html5Qrcode(scannerRegionId, {
          formatsToSupport,
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });
        html5QrCodeRef.current = qr;

        // High-speed 30 FPS + Wide 1D Barcode Viewfinder Box for long SKUs like LN589756800
        const config = {
          fps: 30,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.max(220, Math.floor(viewfinderWidth * 0.92)),
            height: Math.max(105, Math.floor(viewfinderHeight * 0.58)),
          }),
          aspectRatio: 1.6,
          disableFlip: false,
        };

        try {
          await qr.start(
            { facingMode: mode },
            config,
            (decodedText) => {
              handleDecodedCode(decodedText);
            },
            () => {}
          );
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCam =
              cameras.find((c) => /back|rear|environment/i.test(c.label)) ||
              cameras[cameras.length - 1];
            await qr.start(
              backCam.id,
              config,
              (decodedText) => {
                handleDecodedCode(decodedText);
              },
              () => {}
            );
          } else {
            throw new Error(
              isBn
                ? 'ক্যামেরা খুঁজে পাওয়া যায়নি বা পারমিশন দেওয়া হয়নি।'
                : 'Camera not found or permission denied.'
            );
          }
        }

        // Apply continuous autofocus & sharp resolution if supported by mobile camera
        try {
          await qr.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' } as any],
          });
        } catch {}

        // Attach parallel native BarcodeDetector turbo loop
        attachTurboNativeBarcodeDetector();
      } catch (err: any) {
        console.warn('Camera scanner start error:', err);
        setCameraError(
          err?.message ||
            (isBn
              ? 'ক্যামেরা চালু করা যায়নি। ব্রাউজারে ক্যামেরা পারমিশন Allow করুন অথবা নিচের ছবি/কুইক বাটন ব্যবহার করুন।'
              : 'Could not start camera. Please allow camera permission or use quick scan below.')
        );
      } finally {
        setIsStarting(false);
      }
    },
    [attachTurboNativeBarcodeDetector, handleDecodedCode, isBn, stopScanner]
  );

  useEffect(() => {
    if (isOpen) {
      setLastScanFeedback(null);
      lastScannedRef.current = { code: '', time: 0 };
      const timer = setTimeout(() => {
        startScanner(facingMode);
      }, 60);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode, startScanner, stopScanner]);

  const handleToggleTorch = async () => {
    const instance = html5QrCodeRef.current;
    if (!instance || !instance.isScanning) return;
    try {
      const nextTorch = !torchOn;
      await instance.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch {
      // Torch not supported on this device/browser
    }
  };

  const handleSetZoom = async (targetZoom: number) => {
    setZoomLevel(targetZoom);
    const instance = html5QrCodeRef.current;
    if (!instance || !instance.isScanning) return;
    try {
      await instance.applyVideoConstraints({
        advanced: [{ zoom: targetZoom } as any],
      });
    } catch {
      // Fallback CSS scale if hardware zoom constraint not supported
      const regionEl = document.getElementById(scannerRegionId);
      const videoEl = regionEl?.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.style.transform = targetZoom > 1 ? `scale(${targetZoom})` : 'none';
      }
    }
  };

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await stopScanner();
      const qr = new Html5Qrcode(scannerRegionId, { verbose: false });
      const decodedText = await qr.scanFile(file, true);
      qr.clear();
      if (decodedText) {
        handleDecodedCode(decodedText);
      }
      if (scanMode === 'permanent') {
        startScanner(facingMode);
      }
    } catch {
      setCameraError(
        isBn
          ? 'ছবিতে কোনো স্পষ্ট বারকোড পাওয়া যায়নি। আবার চেষ্টা করুন।'
          : 'No clear barcode detected in the selected image.'
      );
      startScanner(facingMode);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                <span>{isBn ? '⚡ স্থায়ী কুইক স্ক্যানার' : '⚡ Permanent Quick Scanner'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-stone-400">
                {isBn
                  ? 'বারকোড ধরলেই একটানা বিলে যুক্ত হবে (কখনো বন্ধ হবে না)'
                  : 'Stays permanently active — wave barcodes to add continuously'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pin to Screen (Dock to Billing Tab) Button */}
            {onPinToScreen && (
              <button
                type="button"
                onClick={() => {
                  stopScanner().then(() => onPinToScreen());
                }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                title={isBn ? 'স্ক্রিনে স্থায়ীভাবে পিন করুন (ডক ভিউ)' : 'Pin/Dock permanently to billing screen'}
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] sm:text-[11px]">
                  {isBn ? 'স্ক্রিনে পিন' : 'Pin to Screen'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/10 border-white/10 text-stone-400'
              }`}
              title={isBn ? 'বিপ সাউন্ড অন/অফ' : 'Toggle Beep Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => onClose());
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher: Permanent Continuous Scanning (Default) vs Quick 1-Scan */}
        <div className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5 pb-1 bg-stone-950">
          <button
            type="button"
            onClick={() => updateScanMode('permanent')}
            className={`py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              scanMode === 'permanent'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-1 ring-emerald-300'
                : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <Pin className="w-3.5 h-3.5 fill-current" />
            <span>{isBn ? '📌 স্থায়ী স্ক্যানার (চালু থাকবে)' : '📌 Permanent (Stays Open)'}</span>
          </button>

          <button
            type="button"
            onClick={() => updateScanMode('quick')}
            className={`py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              scanMode === 'quick'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm ring-1 ring-blue-300'
                : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isBn ? '⚡ ১-বার স্ক্যান (অটো-ক্লোজ)' : '⚡ 1-Scan Auto-Close'}</span>
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-3 space-y-2.5 bg-stone-950">
          <div className="relative rounded-2xl overflow-hidden bg-black border border-stone-800 min-h-[205px] flex items-center justify-center">
            <div id={scannerRegionId} className="w-full overflow-hidden" />

            {/* Wide 1D Barcode Laser Guide Overlay */}
            {!cameraError && !isStarting && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3">
                <div className="w-full max-w-[310px] h-[105px] border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">
                  <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-300 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded-full">
                    {isBn
                      ? 'স্থায়ীভাবে চালু আছে — বারকোড ধরুন'
                      : 'Permanently Active — Wave barcode in front'}
                  </span>
                </div>
              </div>
            )}

            {isStarting && (
              <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-2 text-white text-xs font-bold">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                <span>{isBn ? 'স্থায়ী কুইক স্ক্যানার চালু হচ্ছে...' : 'Starting permanent scanner...'}</span>
              </div>
            )}

            {cameraError && (
              <div className="p-4 text-center space-y-2.5">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs text-stone-200 font-medium leading-relaxed">{cameraError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => startScanner(facingMode)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry Camera'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isBn ? 'ছবি থেকে স্ক্যান' : 'Scan Photo'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls Toolbar + 1x / 1.5x / 2x Quick Sticker Zoom */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                }
                className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-stone-700"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>{facingMode === 'environment' ? 'Back' : 'Front'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleTorch}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                  torchOn
                    ? 'bg-amber-500 text-stone-950 border-amber-400'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isBn ? 'ফ্ল্যাশ' : 'Flash'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-stone-700"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>{isBn ? 'ছবি' : 'Photo'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanImageFile}
                className="hidden"
              />
            </div>

            {/* 1x / 1.5x / 2x Zoom Buttons for Small 50x25mm Stickers */}
            <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded-xl border border-stone-800">
              <ZoomIn className="w-3.5 h-3.5 text-stone-400 ml-1.5" />
              {[1, 1.5, 2].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => handleSetZoom(z)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black cursor-pointer transition-all ${
                    zoomLevel === z
                      ? 'bg-emerald-500 text-stone-950 shadow-2xs'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Scan Status, 1-Tap Saved Barcode Chips & Manual Input */}
        <div className="p-3.5 bg-white space-y-2.5">
          {lastScanFeedback && (
            <div
              className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 animate-in fade-in duration-100 ${
                lastScanFeedback.matched
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    lastScanFeedback.matched ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">
                    {lastScanFeedback.itemName || `Barcode: ${lastScanFeedback.code}`}
                  </div>
                  <div className="text-[10px] font-mono text-stone-600">
                    SKU: {lastScanFeedback.code}{' '}
                    {lastScanFeedback.price !== undefined && lastScanFeedback.price > 0
                      ? `• Rs. ${lastScanFeedback.price}`
                      : ''}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0 animate-bounce">
                +{lastScanFeedback.count} {isBn ? 'যোগ হয়েছে' : 'Added'}
              </span>
            </div>
          )}

          {/* 1-Tap Quick Saved Barcode Products (Instant Tap to Scan/Add) */}
          {savedBarcodeProducts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold text-stone-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>
                  {isBn
                    ? 'কুইক ট্যাপ বারকোড প্রোডাক্ট (ট্যাপ করলেই বিলে যোগ হবে):'
                    : 'Quick-Tap Saved Barcode Products:'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {savedBarcodeProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleDecodedCode(prod.barcode || prod.name)}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-left shrink-0 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold text-stone-900 truncate max-w-[120px]">
                        {prod.name}
                      </div>
                      <div className="text-[9.5px] font-mono font-bold text-emerald-700">
                        {prod.barcode} • Rs.{prod.price}
                      </div>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual / Hardware Barcode Entry Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCode.trim()) return;
              handleDecodedCode(manualCode.trim());
              setManualCode('');
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={
                  isBn
                    ? 'বারকোড / SKU নম্বর লিখে + যোগ চাপুন...'
                    : 'Type barcode / SKU & tap + Add...'
                }
                className="w-full border border-stone-200 bg-stone-50 pl-9 pr-3 py-2 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold cursor-pointer shrink-0"
            >
              {isBn ? '+ যোগ' : '+ Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EMBEDDED DOCKED BARCODE SCANNER (Permanently Docked Live Camera on Billing Screen)
// ============================================================================
export interface EmbeddedDockedBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandToModal?: () => void;
  onScanSuccess: (barcodeCode: string) => {
    matched: boolean;
    itemName?: string;
    price?: number;
  } | void;
  language?: Language;
  products?: ProductStockItem[];
}

export const EmbeddedDockedBarcodeScanner: React.FC<EmbeddedDockedBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onExpandToModal,
  onScanSuccess,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const scannerRegionId = 'pos-html5-barcode-reader-docked';

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const nativeDetectorTimerRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scannedFeedback, setScannedFeedback] = useState<{
    code: string;
    itemName?: string;
    price?: number;
    count: number;
  } | null>(null);

  const stopScanner = useCallback(async () => {
    if (nativeDetectorTimerRef.current) {
      window.clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch (e) {
      console.warn('Docked scanner stop note:', e);
    } finally {
      html5QrCodeRef.current = null;
    }
  }, []);

  const handleDecodedCode = useCallback(
    (decodedText: string) => {
      const cleanCode = (decodedText || '').trim();
      if (!cleanCode) return;

      const now = Date.now();
      // 1.1s debounce to prevent duplicate multi-adds
      if (
        lastScannedRef.current.code === cleanCode &&
        now - lastScannedRef.current.time < 1100
      ) {
        return;
      }
      lastScannedRef.current = { code: cleanCode, time: now };

      // Play crisp beep sound
      playBarcodeBeep(soundEnabled);

      // Mobile vibration
      try {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {}

      // Add item to cart in parent BillingTab
      const result = onScanSuccess(cleanCode);

      setScannedFeedback((prev) => ({
        code: cleanCode,
        itemName: result && typeof result === 'object' ? result.itemName : undefined,
        price: result && typeof result === 'object' ? result.price : undefined,
        count: (prev?.count || 0) + 1,
      }));
    },
    [onScanSuccess, soundEnabled]
  );

  const attachTurboNativeBarcodeDetector = useCallback(() => {
    if (nativeDetectorTimerRef.current) {
      window.clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    const BarcodeDetectorApi = (window as any).BarcodeDetector;
    if (!BarcodeDetectorApi) return;

    try {
      const detector = new BarcodeDetectorApi({
        formats: [
          'code_128',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_39',
          'code_93',
          'itf',
          'qr_code',
        ],
      });

      nativeDetectorTimerRef.current = window.setInterval(async () => {
        try {
          const regionEl = document.getElementById(scannerRegionId);
          const videoEl = regionEl?.querySelector('video') as HTMLVideoElement | null;
          if (!videoEl || videoEl.readyState < 2) return;
          const barcodes = await detector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDecodedCode(String(barcodes[0].rawValue));
          }
        } catch {}
      }, 90);
    } catch {}
  }, [handleDecodedCode]);

  const startScanner = useCallback(
    async (mode: 'environment' | 'user') => {
      setIsStarting(true);
      setCameraError(null);
      await stopScanner();

      try {
        const el = document.getElementById(scannerRegionId);
        if (!el) {
          setIsStarting(false);
          return;
        }

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const qr = new Html5Qrcode(scannerRegionId, {
          formatsToSupport,
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });
        html5QrCodeRef.current = qr;

        const config = {
          fps: 30,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.max(200, Math.floor(viewfinderWidth * 0.90)),
            height: Math.max(90, Math.floor(viewfinderHeight * 0.55)),
          }),
          aspectRatio: 1.77,
          disableFlip: false,
        };

        try {
          await qr.start(
            { facingMode: mode },
            config,
            (decodedText) => {
              handleDecodedCode(decodedText);
            },
            () => {}
          );
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCam =
              cameras.find((c) => /back|rear|environment/i.test(c.label)) ||
              cameras[cameras.length - 1];
            await qr.start(
              backCam.id,
              config,
              (decodedText) => {
                handleDecodedCode(decodedText);
              },
              () => {}
            );
          } else {
            throw new Error(
              isBn
                ? 'ক্যামেরা পাওয়া যায়নি। অনুগ্রহ করে ক্যামেরা পারমিশন চেক করুন।'
                : 'Camera not found. Please verify permissions.'
            );
          }
        }

        try {
          await qr.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' } as any],
          });
        } catch {}

        attachTurboNativeBarcodeDetector();
      } catch (err: any) {
        console.warn('Docked camera scanner start error:', err);
        setCameraError(
          err?.message ||
            (isBn
              ? 'ক্যামেরা চালু করা যায়নি। ক্যামেরা পারমিশন চেক করুন।'
              : 'Could not access camera.')
        );
      } finally {
        setIsStarting(false);
      }
    },
    [attachTurboNativeBarcodeDetector, handleDecodedCode, isBn, stopScanner]
  );

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner(facingMode);
      }, 70);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode, startScanner, stopScanner]);

  const handleToggleTorch = async () => {
    const instance = html5QrCodeRef.current;
    if (!instance || !instance.isScanning) return;
    try {
      const nextTorch = !torchOn;
      await instance.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch {}
  };

  const handleSetZoom = async (targetZoom: number) => {
    setZoomLevel(targetZoom);
    const instance = html5QrCodeRef.current;
    if (!instance || !instance.isScanning) return;
    try {
      await instance.applyVideoConstraints({
        advanced: [{ zoom: targetZoom } as any],
      });
    } catch {
      const regionEl = document.getElementById(scannerRegionId);
      const videoEl = regionEl?.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.style.transform = targetZoom > 1 ? `scale(${targetZoom})` : 'none';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mb-3 rounded-2xl overflow-hidden border-2 border-emerald-500/90 bg-stone-950 text-white shadow-md animate-in fade-in zoom-in-95 duration-150">
      {/* Docked Header */}
      <div className="px-3 py-2 bg-stone-900 border-b border-stone-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
            <span>{isBn ? '⚡ স্থায়ী কুইক স্ক্যানার (লাইভ)' : '⚡ Permanent Quick Scanner (Live)'}</span>
          </span>
          {scannedFeedback && scannedFeedback.count > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full shadow-2xs">
              +{scannedFeedback.count} {isBn ? 'আইটেম' : 'Items'}
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            }`}
            title={isBn ? 'বিপ সাউন্ড অন/অফ' : 'Toggle Beep Sound'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleToggleTorch}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer border ${
              torchOn
                ? 'bg-amber-500 text-stone-950 border-amber-400'
                : 'bg-stone-800 text-stone-300 border-stone-700'
            }`}
            title={isBn ? 'টর্চ / ফ্ল্যাশ' : 'Flashlight'}
          >
            <Zap className="w-3 h-3" />
            <span className="hidden xs:inline">{isBn ? 'ফ্ল্যাশ' : 'Flash'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
            }
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-stone-700"
            title={isBn ? 'ক্যামেরা পরিবর্তন' : 'Switch Camera'}
          >
            <Camera className="w-3 h-3 text-emerald-400" />
            <span>{facingMode === 'environment' ? 'Back' : 'Front'}</span>
          </button>

          {/* Zoom Chips */}
          <div className="flex items-center gap-0.5 bg-stone-800 p-0.5 rounded-lg border border-stone-700">
            {[1, 1.5, 2].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => handleSetZoom(z)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black cursor-pointer transition-all ${
                  zoomLevel === z ? 'bg-emerald-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* Expand to Modal */}
          {onExpandToModal && (
            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => onExpandToModal());
              }}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 cursor-pointer"
              title={isBn ? 'ফুলস্ক্রিন মোড' : 'Fullscreen Modal'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Docked Scanner */}
          <button
            type="button"
            onClick={() => {
              stopScanner().then(() => onClose());
            }}
            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 cursor-pointer"
            title={isBn ? 'স্থায়ী স্ক্যানার বন্ধ করুন' : 'Close Permanent Scanner'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Camera Live Region */}
      <div className="relative bg-black min-h-[160px] sm:min-h-[185px] max-h-[220px] overflow-hidden flex items-center justify-center">
        <div id={scannerRegionId} className="w-full overflow-hidden" />

        {/* Laser Sight Overlay */}
        {!cameraError && !isStarting && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <div className="w-full max-w-[280px] h-[85px] border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
              <span className="absolute -bottom-4.5 left-1/2 -translate-x-1/2 text-[9.5px] font-bold text-emerald-300 whitespace-nowrap bg-black/70 px-2 py-0.5 rounded-full">
                {isBn ? 'বারকোড ক্যামেরার সামনে ধরুন' : 'Point barcode at camera'}
              </span>
            </div>
          </div>
        )}

        {isStarting && (
          <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-1.5 text-white text-xs font-bold">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span>{isBn ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting live camera...'}</span>
          </div>
        )}

        {cameraError && (
          <div className="p-3 text-center space-y-1.5">
            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-xs text-stone-300 font-medium">{cameraError}</p>
            <button
              type="button"
              onClick={() => startScanner(facingMode)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {isBn ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      {/* Real-time Scanned Feedback Banner */}
      {scannedFeedback && (
        <div className="px-3 py-1.5 bg-emerald-950/90 border-t border-emerald-800 flex items-center justify-between text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-extrabold text-emerald-200 truncate">
              {scannedFeedback.itemName || scannedFeedback.code}
            </span>
            {scannedFeedback.price !== undefined && scannedFeedback.price > 0 && (
              <span className="font-mono font-bold text-emerald-300 shrink-0">
                • Rs {scannedFeedback.price}
              </span>
            )}
          </div>
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-900/80 px-2 py-0.5 rounded-full shrink-0">
            {isBn ? 'বিলে যোগ হয়েছে ✓' : 'Added to Bill ✓'}
          </span>
        </div>
      )}
    </div>
  );
};
