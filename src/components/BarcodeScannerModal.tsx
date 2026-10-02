import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
} from 'lucide-react';
import { Language, ProductStockItem } from '../types';
import { useBackHandler } from '../utils/useBackHandler';

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

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  onScanSuccess,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const scannerRegionId = 'pos-html5-fast-barcode-reader';

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const nativeDetectorTimerRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    code: string;
    itemName?: string;
    price?: number;
    matched: boolean;
    count: number;
  } | null>(null);

  useBackHandler(
    'barcodeScannerModal',
    isOpen,
    () => {
      onClose();
      return true;
    },
    55
  );

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

  // FAST ACTION Scan Handler: Beep + Haptic + Instant Add to Bill
  const handleDecodedCode = useCallback(
    (decodedText: string) => {
      const cleanCode = (decodedText || '').trim();
      if (!cleanCode) return;

      const now = Date.now();
      // 1.1s debounce for the same barcode to prevent duplicate multi-adds while pointing at label
      if (
        lastScannedRef.current.code === cleanCode &&
        now - lastScannedRef.current.time < 1100
      ) {
        return;
      }
      lastScannedRef.current = { code: cleanCode, time: now };

      // 1. Play crisp POS laser beep sound
      playBarcodeBeep(soundEnabled);

      // 2. Vibrate on mobile device
      try {
        if (navigator.vibrate) {
          navigator.vibrate(60);
        }
      } catch {}

      // 3. Immediately add item to bill in BillingTab
      const result = onScanSuccess(cleanCode);

      setLastScanFeedback((prev) => ({
        code: cleanCode,
        itemName: result && typeof result === 'object' ? result.itemName : undefined,
        price: result && typeof result === 'object' ? result.price : undefined,
        matched: result && typeof result === 'object' ? result.matched : true,
        count: (prev?.count || 0) + 1,
      }));
    },
    [onScanSuccess, soundEnabled]
  );

  // Parallel Turbo Native BarcodeDetector loop for <50ms hardware detection
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
      }, 80);
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

        // Ultra fast 30 FPS scanning with wide 1D barcode viewfinder
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

        try {
          await qr.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' } as any],
          });
        } catch {}

        attachTurboNativeBarcodeDetector();
      } catch (err: any) {
        console.warn('Fast camera scanner start error:', err);
        setCameraError(
          err?.message ||
            (isBn
              ? 'ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে ব্রাউজারে ক্যামেরা পারমিশন Allow করুন।'
              : 'Could not start camera. Please allow camera permissions.')
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
      }, 50);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-stone-950 rounded-3xl shadow-2xl border border-stone-800 w-full max-w-md overflow-hidden my-auto flex flex-col">
        {/* Fast Action Header */}
        <div className="px-4 py-3 bg-stone-900 border-b border-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{isBn ? '⚡ কুইক বারকোড স্ক্যানার' : '⚡ Quick Barcode Scanner'}</span>
            </h3>
          </div>

          {/* Essential Quick Controls: Sound, Torch, Camera Flip & Close */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              }`}
              title={isBn ? 'বিপ সাউন্ড অন/অফ' : 'Toggle Beep Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                torchOn
                  ? 'bg-amber-500 text-stone-950 border-amber-400'
                  : 'bg-stone-800 border-stone-700 text-stone-300'
              }`}
              title={isBn ? 'টর্চ / ফ্ল্যাশ' : 'Flashlight'}
            >
              <Zap className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 cursor-pointer text-xs font-bold flex items-center gap-1"
              title={isBn ? 'ক্যামেরা পরিবর্তন' : 'Switch Camera'}
            >
              <Camera className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => onClose());
              }}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-rose-900/80 hover:text-rose-200 text-stone-300 flex items-center justify-center cursor-pointer transition-colors"
              title={isBn ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Camera Viewport (PURE FAST ACTION) */}
        <div className="relative bg-black min-h-[260px] sm:min-h-[300px] overflow-hidden flex items-center justify-center">
          <div id={scannerRegionId} className="w-full overflow-hidden" />

          {/* Laser Guide Overlay */}
          {!cameraError && !isStarting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
              <div className="w-full max-w-[320px] h-[120px] border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-300 whitespace-nowrap bg-black/70 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {isBn ? 'বারকোড ক্যামেরার সামনে ধরুন' : 'Point barcode at camera'}
                </span>
              </div>
            </div>
          )}

          {isStarting && (
            <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-2 text-white text-xs font-bold">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span>{isBn ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting camera...'}</span>
            </div>
          )}

          {cameraError && (
            <div className="p-4 text-center space-y-2.5">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-stone-200 font-medium leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => startScanner(facingMode)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
              </button>
            </div>
          )}

          {/* Quick Zoom Bar pinned at the bottom-right of the video */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-stone-950/80 backdrop-blur-xs p-1 rounded-xl border border-stone-700/80">
            <ZoomIn className="w-3.5 h-3.5 text-stone-400 ml-1" />
            {[1, 1.5, 2].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => handleSetZoom(z)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black cursor-pointer transition-all ${
                  zoomLevel === z
                    ? 'bg-emerald-500 text-stone-950 shadow-2xs font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>
        </div>

        {/* Instant Scanned Item Feedback Bar (Auto-adds to bill immediately) */}
        {lastScanFeedback && (
          <div className="p-3 bg-emerald-950 border-t border-emerald-800 flex items-center justify-between gap-2 animate-in fade-in duration-100">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white truncate">
                  {lastScanFeedback.itemName || `Barcode: ${lastScanFeedback.code}`}
                </div>
                <div className="text-[10px] font-mono text-emerald-300">
                  {lastScanFeedback.code}
                  {lastScanFeedback.price !== undefined && lastScanFeedback.price > 0
                    ? ` • Rs ${lastScanFeedback.price}`
                    : ''}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-stone-950 text-[10px] font-black shrink-0 shadow-sm animate-pulse">
              +{lastScanFeedback.count} {isBn ? 'যোগ হয়েছে' : 'Added'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
