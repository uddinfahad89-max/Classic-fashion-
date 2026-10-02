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
} from 'lucide-react';
import { Language } from '../types';
import { useBackHandler } from '../utils/useBackHandler';

// Web Audio API POS Laser Barcode Beep Sound (Zero external assets, works 100% offline)
export const playBarcodeBeep = (enabled = true): void => {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Classic supermarket POS barcode scanner 1850Hz crisp beep
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    osc.frequency.setValueAtTime(2150, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.13);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch (e) {
    console.warn('Beep audio notice:', e);
  }
};

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeCode: string) => {
    matched: boolean;
    itemName?: string;
    price?: number;
  } | void;
  language?: Language;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const scannerRegionId = 'pos-html5-barcode-reader';

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    code: string;
    itemName?: string;
    price?: number;
    matched: boolean;
    count: number;
  } | null>(null);
  const [manualCode, setManualCode] = useState('');

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
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // ignore cleanup errors
    } finally {
      html5QrCodeRef.current = null;
      setTorchOn(false);
    }
  }, []);

  const handleDecodedCode = useCallback(
    (rawCode: string) => {
      const cleanCode = rawCode.trim();
      if (!cleanCode) return;

      const now = Date.now();
      // Prevent duplicate rapid-fire scans of the exact same barcode within 1.4 seconds
      if (
        lastScannedRef.current.code === cleanCode &&
        now - lastScannedRef.current.time < 1400
      ) {
        return;
      }
      lastScannedRef.current = { code: cleanCode, time: now };

      // 1. Play beep sound
      playBarcodeBeep(soundEnabled);

      // Vibrate on mobile devices if supported
      try {
        if (navigator.vibrate) {
          navigator.vibrate(60);
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

      // If single-scan mode is selected, close modal automatically after scan
      if (!continuousMode) {
        stopScanner().then(() => onClose());
      }
    },
    [continuousMode, onClose, onScanSuccess, soundEnabled, stopScanner]
  );

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
          fps: 15,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.5,
        };

        try {
          await qr.start(
            { facingMode: mode },
            config,
            (decodedText) => {
              handleDecodedCode(decodedText);
            },
            () => {
              // Frame scan miss - ignore
            }
          );
        } catch {
          // Fallback to any available camera if strict facingMode fails on desktop/laptop
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
      } catch (err: any) {
        console.warn('Camera scanner start error:', err);
        setCameraError(
          err?.message ||
            (isBn
              ? 'ক্যামেরা চালু করা যায়নি। ব্রাউজারে ক্যামেরা পারমিশন Allow করুন অথবা নিচের ছবি/ম্যানুয়াল বক্স ব্যবহার করুন।'
              : 'Could not start camera. Please allow camera permission or scan from photo below.')
        );
      } finally {
        setIsStarting(false);
      }
    },
    [handleDecodedCode, isBn, stopScanner]
  );

  useEffect(() => {
    if (isOpen) {
      setLastScanFeedback(null);
      const timer = setTimeout(() => {
        startScanner(facingMode);
      }, 80);
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
      if (continuousMode) {
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                <span>{isBn ? '📷 মোবাইল বারকোড স্ক্যানার' : '📷 Camera Barcode Scanner'}</span>
              </h3>
              <p className="text-[10px] text-stone-400">
                {isBn
                  ? 'বারকোডের ওপর ক্যামেরা ধরুন — অটো কার্টে ১টি আইটেম যোগ হবে'
                  : 'Point back camera at barcode to auto-add 1 item to bill'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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

        {/* Camera Viewport */}
        <div className="p-3.5 space-y-3 bg-stone-950">
          <div className="relative rounded-2xl overflow-hidden bg-black border border-stone-800 min-h-[210px] flex items-center justify-center">
            <div id={scannerRegionId} className="w-full" />

            {/* Laser Guide Line Overlay */}
            {!cameraError && !isStarting && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[250px] h-[110px] border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                </div>
              </div>
            )}

            {isStarting && (
              <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-2 text-white text-xs font-bold">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                <span>{isBn ? 'পিছনের ক্যামেরা চালু হচ্ছে...' : 'Starting back camera...'}</span>
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

          {/* Camera Controls Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                }
                className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border border-stone-700"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {facingMode === 'environment'
                    ? isBn
                      ? 'Back Cam'
                      : 'Back Cam'
                    : isBn
                    ? 'Front Cam'
                    : 'Front Cam'}
                </span>
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

            {/* Continuous vs Single Scan Mode */}
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="rounded text-emerald-500 cursor-pointer"
              />
              <span>{isBn ? 'একটানা স্ক্যান' : 'Continuous'}</span>
            </label>
          </div>
        </div>

        {/* Live Scan Status & Manual Barcode Input */}
        <div className="p-3.5 bg-white space-y-3">
          {lastScanFeedback && (
            <div
              className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
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
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                +1 {isBn ? 'যোগ হয়েছে' : 'Added'}
              </span>
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
                    ? 'অথবা বারকোড নম্বর লিখে Enter চাপুন...'
                    : 'Or type barcode number & press Enter...'
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
