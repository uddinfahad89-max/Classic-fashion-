import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Smartphone,
  Tablet,
  X,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  Camera,
  Zap,
  Volume2,
  VolumeX,
  ZoomIn,
  Send,
  ArrowRight,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Share2,
} from 'lucide-react';
import { Language } from '../types';
import { useBackHandler } from '../utils/useBackHandler';
import { playBarcodeBeep, playBarcodeWarningBeep } from './BarcodeScannerModal';
import {
  RemoteScannerConnection,
  RemoteConnectionState,
  RemoteRoomPresence,
  RemoteScanAckEvent,
  buildMobileScannerShareUrl,
  normalizeScannerRoomCode,
} from '../services/remoteScannerService';

interface ScannedLogEntry {
  scanId: string;
  barcode: string;
  scannedAt: number;
  status: 'sending' | 'added' | 'incremented' | 'needs_price' | 'duplicate_confirm' | 'error';
  itemName?: string;
  price?: number;
  qtyInBill?: number;
}

export interface RemoteScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  initialMode?: 'tablet' | 'mobile';
  // Tablet receiver props
  tabletRoomCode: string;
  isTabletReceiverActive: boolean;
  tabletConnectionState: RemoteConnectionState;
  tabletPresence: RemoteRoomPresence;
  autoIncrementDuplicate: boolean;
  onToggleTabletReceiver: (active: boolean) => void;
  onRegenerateRoomCode: () => void;
  onToggleAutoIncrementDuplicate: (enabled: boolean) => void;
  // Mobile scanner launch prop (e.g. from ?scanRoom=XXXXXX)
  initialMobileRoomCode?: string;
  currencySymbol?: string;
}

export const RemoteScannerModal: React.FC<RemoteScannerModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  initialMode = 'tablet',
  tabletRoomCode,
  isTabletReceiverActive,
  tabletConnectionState,
  tabletPresence,
  autoIncrementDuplicate,
  onToggleTabletReceiver,
  onRegenerateRoomCode,
  onToggleAutoIncrementDuplicate,
  initialMobileRoomCode = '',
  currencySymbol = 'Rs.',
}) => {
  const isBn = language === 'bn';
  const [mode, setMode] = useState<'tablet' | 'mobile'>(initialMode);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mobile scanner state
  const [mobileCodeInput, setMobileCodeInput] = useState(
    normalizeScannerRoomCode(initialMobileRoomCode)
  );
  const [connectedMobileRoom, setConnectedMobileRoom] = useState(
    normalizeScannerRoomCode(initialMobileRoomCode)
  );
  const [mobileConnState, setMobileConnState] =
    useState<RemoteConnectionState>('disconnected');
  const [mobilePresence, setMobilePresence] = useState<RemoteRoomPresence>({
    roomCode: '',
    tabletCount: 0,
    mobileCount: 0,
  });
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [scanLogs, setScanLogs] = useState<ScannedLogEntry[]>([]);

  // Mobile camera state
  const scannerRegionId = 'pos-remote-mobile-scanner-reader';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const nativeDetectorTimerRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const lastGlobalScanTimeRef = useRef<number>(0);
  const mobileConnRef = useRef<RemoteScannerConnection | null>(null);

  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  useBackHandler(
    'remoteScannerModal',
    isOpen,
    () => {
      onClose();
      return true;
    },
    60
  );

  // Sync mode when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    if (initialMobileRoomCode) {
      const clean = normalizeScannerRoomCode(initialMobileRoomCode);
      setMobileCodeInput(clean);
      setConnectedMobileRoom(clean);
    }
  }, [isOpen, initialMode, initialMobileRoomCode]);

  // Auto-enable Tablet receiver when user opens in Tablet mode
  useEffect(() => {
    if (isOpen && mode === 'tablet' && !isTabletReceiverActive) {
      onToggleTabletReceiver(true);
    }
  }, [isOpen, mode, isTabletReceiverActive, onToggleTabletReceiver]);

  // Generate QR code for Tablet Pairing URL
  const shareUrl = buildMobileScannerShareUrl(tabletRoomCode);
  useEffect(() => {
    if (!isOpen || !shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [isOpen, shareUrl]);

  // Stop mobile camera helper
  const stopMobileCamera = useCallback(async () => {
    if (nativeDetectorTimerRef.current) {
      window.clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    const inst = html5QrCodeRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
      inst.clear();
    } catch {}
    html5QrCodeRef.current = null;
  }, []);

  // Connect Mobile WebSocket client when connectedMobileRoom is active
  useEffect(() => {
    if (!isOpen || mode !== 'mobile' || !connectedMobileRoom || connectedMobileRoom.length < 4) {
      if (mobileConnRef.current) {
        mobileConnRef.current.destroy();
        mobileConnRef.current = null;
      }
      setMobileConnState('disconnected');
      return;
    }

    const conn = new RemoteScannerConnection({
      roomCode: connectedMobileRoom,
      role: 'mobile',
      onStateChange: (st) => setMobileConnState(st),
      onPresence: (pres) => setMobilePresence(pres),
      onAck: (ack: RemoteScanAckEvent) => {
        if (ack.status === 'added' || ack.status === 'incremented') {
          playBarcodeBeep(soundEnabled);
          try {
            if (navigator.vibrate) navigator.vibrate(50);
          } catch {}
        } else if (ack.status === 'needs_price' || ack.status === 'duplicate_confirm') {
          playBarcodeWarningBeep(soundEnabled);
          try {
            if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
          } catch {}
        }

        setScanLogs((prev) =>
          prev.map((entry) =>
            entry.scanId === ack.scanId
              ? {
                  ...entry,
                  status: ack.status || (ack.matched ? 'added' : 'needs_price'),
                  itemName: ack.itemName,
                  price: ack.price,
                  qtyInBill: ack.qtyInBill,
                }
              : entry
          )
        );
      },
    });

    mobileConnRef.current = conn;
    conn.connect();

    return () => {
      conn.destroy();
      mobileConnRef.current = null;
    };
  }, [isOpen, mode, connectedMobileRoom, soundEnabled]);

  // Send scanned barcode to Tablet
  const sendScannedBarcodeToTablet = useCallback(
    (rawCode: string, bypassCooldown = false) => {
      const cleanCode = (rawCode || '').trim();
      if (!cleanCode || !mobileConnRef.current) return;

      const now = Date.now();
      if (!bypassCooldown) {
        if (now - lastGlobalScanTimeRef.current < 850) return;
        if (
          lastScannedRef.current.code === cleanCode &&
          now - lastScannedRef.current.time < 2200
        ) {
          return;
        }
      }
      lastGlobalScanTimeRef.current = now;
      lastScannedRef.current = { code: cleanCode, time: now };

      // Immediate feedback tone & vibration on phone
      playBarcodeBeep(soundEnabled);
      try {
        if (navigator.vibrate) navigator.vibrate(45);
      } catch {}

      const scanId = mobileConnRef.current.sendBarcodeScan(cleanCode, 1);
      setScanLogs((prev) => [
        {
          scanId,
          barcode: cleanCode,
          scannedAt: now,
          status: 'sending',
        },
        ...prev.slice(0, 24),
      ]);
    },
    [soundEnabled]
  );

  // Turbo native BarcodeDetector inside mobile remote viewfinder
  const attachNativeDetector = useCallback(() => {
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
            sendScannedBarcodeToTablet(String(barcodes[0].rawValue));
          }
        } catch {}
      }, 90);
    } catch {}
  }, [sendScannedBarcodeToTablet]);

  const startMobileCamera = useCallback(
    async (camMode: 'environment' | 'user') => {
      setIsCameraStarting(true);
      setCameraError(null);
      await stopMobileCamera();

      try {
        const el = document.getElementById(scannerRegionId);
        if (!el) {
          setIsCameraStarting(false);
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
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.max(210, Math.floor(viewfinderWidth * 0.9)),
            height: Math.max(100, Math.floor(viewfinderHeight * 0.56)),
          }),
          aspectRatio: 1.6,
          disableFlip: false,
        };

        try {
          await qr.start(
            { facingMode: camMode },
            config,
            (decodedText) => sendScannedBarcodeToTablet(decodedText),
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
              (decodedText) => sendScannedBarcodeToTablet(decodedText),
              () => {}
            );
          } else {
            throw new Error(
              isBn
                ? 'মোবাইল ক্যামেরা পাওয়া যায়নি বা পারমিশন দেওয়া হয়নি।'
                : 'Camera not found or permission denied.'
            );
          }
        }

        try {
          await qr.applyVideoConstraints({
            advanced: [{ focusMode: 'continuous' } as any],
          });
        } catch {}

        attachNativeDetector();
      } catch (err: any) {
        setCameraError(
          err?.message ||
            (isBn
              ? 'ক্যামেরা চালু করা যায়নি। ব্রাউজারে Camera Permission Allow করুন।'
              : 'Could not start camera. Please allow camera permission.')
        );
      } finally {
        setIsCameraStarting(false);
      }
    },
    [attachNativeDetector, isBn, sendScannedBarcodeToTablet, stopMobileCamera]
  );

  // Start/stop camera automatically in mobile mode when connected to a room
  useEffect(() => {
    if (isOpen && mode === 'mobile' && connectedMobileRoom.length >= 4) {
      const timer = window.setTimeout(() => {
        startMobileCamera(facingMode);
      }, 80);
      return () => {
        window.clearTimeout(timer);
        stopMobileCamera();
      };
    } else {
      stopMobileCamera();
    }
  }, [isOpen, mode, connectedMobileRoom, facingMode, startMobileCamera, stopMobileCamera]);

  const handleToggleTorch = async () => {
    const inst = html5QrCodeRef.current;
    if (!inst || !inst.isScanning) return;
    try {
      const next = !torchOn;
      await inst.applyVideoConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {}
  };

  const handleSetZoom = async (z: number) => {
    setZoomLevel(z);
    const inst = html5QrCodeRef.current;
    if (!inst || !inst.isScanning) return;
    try {
      await inst.applyVideoConstraints({ advanced: [{ zoom: z } as any] });
    } catch {
      const regionEl = document.getElementById(scannerRegionId);
      const videoEl = regionEl?.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.style.transform = z > 1 ? `scale(${z})` : 'none';
      }
    }
  };

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(tabletRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {}
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: isBn ? 'মোবাইল বারকোড স্ক্যানার লিংক' : 'Mobile Barcode Scanner Link',
          text: isBn
            ? `টেবলেটে বিল করার জন্য এই লিংকে ক্লিক করে মোবাইল দিয়ে স্ক্যান করুন (কোড: ${tabletRoomCode})`
            : `Open on Mobile to scan barcodes straight to Tablet bill (Code: ${tabletRoomCode})`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    handleCopyLink();
  };

  const handleConnectMobileCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeScannerRoomCode(mobileCodeInput);
    if (clean.length < 4) return;
    setConnectedMobileRoom(clean);
  };

  const handleSendManualBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualBarcodeInput.trim();
    if (!clean) return;
    sendScannedBarcodeToTablet(clean, true);
    setManualBarcodeInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* Top Modal Header + Mode Switcher */}
        <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black tracking-tight truncate">
                {isBn
                  ? '📱 মোবাইল স্ক্যান → টেবলেট বিল'
                  : '📱 Mobile Scan → Tablet Bill'}
              </h3>
              <p className="text-[10px] text-stone-400 truncate">
                {isBn
                  ? 'মোবাইলে স্ক্যান করুন, সাথে সাথে টেবলেটের বিলে যোগ হবে'
                  : 'Scan products with Mobile camera, add instantly to Tablet'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            title={isBn ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="p-2 bg-stone-100 border-b border-stone-200 grid grid-cols-2 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode('tablet')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'tablet'
                ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>{isBn ? 'টেবলেট (বিল রিসিভ)' : 'Tablet (Receive)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('mobile')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'mobile'
                ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                : 'text-stone-600 hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{isBn ? 'মোবাইল (স্ক্যানার)' : 'Mobile (Scanner)'}</span>
          </button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto flex-1">
          {mode === 'tablet' ? (
            <div className="p-4 space-y-4">
              {/* Live Connection Status */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                  tabletPresence.mobileCount > 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : tabletConnectionState === 'connected'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {tabletConnectionState === 'connected' ? (
                    <Wifi
                      className={`w-5 h-5 shrink-0 ${
                        tabletPresence.mobileCount > 0 ? 'text-emerald-600' : 'text-blue-600'
                      }`}
                    />
                  ) : (
                    <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-black text-stone-900">
                      {tabletPresence.mobileCount > 0
                        ? isBn
                          ? `🟢 ${tabletPresence.mobileCount}টি মোবাইল সংযুক্ত আছে!`
                          : `🟢 ${tabletPresence.mobileCount} Mobile Connected!`
                        : tabletConnectionState === 'connected'
                        ? isBn
                          ? '📡 সার্ভারের সাথে যুক্ত — মোবাইলের অপেক্ষায়...'
                          : '📡 Ready — Waiting for Mobile to join...'
                        : isBn
                        ? 'সার্ভারের সাথে সংযোগ হচ্ছে...'
                        : 'Connecting to live relay...'}
                    </div>
                    <div className="text-[11px] text-stone-600">
                      {isBn
                        ? 'এই উইন্ডো বন্ধ করলেও ব্যাকগ্রাউন্ডে রিসিভিং চালু থাকবে।'
                        : 'Receiving stays active in the background while billing.'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleTabletReceiver(!isTabletReceiverActive)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer shrink-0 transition-all ${
                    isTabletReceiverActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {isTabletReceiverActive ? (isBn ? 'চালু ON' : 'ON') : isBn ? 'বন্ধ OFF' : 'OFF'}
                </button>
              </div>

              {/* QR Code + 6-digit Pairing Code */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs shrink-0">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Pairing QR"
                      className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center text-stone-400">
                      <QrCode className="w-12 h-12" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2.5 w-full">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      {isBn ? '৬-ডিজিট পেয়ারিং কোড' : '6-DIGIT PAIRING CODE'}
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-mono font-black tracking-[0.18em] text-stone-900 bg-white px-3 py-1 rounded-xl border border-stone-200">
                        {tabletRoomCode}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 cursor-pointer"
                        title={isBn ? 'কোড কপি করুন' : 'Copy Code'}
                      >
                        {copiedCode ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onRegenerateRoomCode}
                        className="p-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 cursor-pointer"
                        title={isBn ? 'নতুন কোড তৈরি করুন' : 'New Code'}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    {isBn
                      ? '১) মোবাইলের ক্যামেরা বা Google Lens দিয়ে QR কোডটি স্ক্যান করুন — সরাসরি মোবাইল স্ক্যানার খুলে যাবে।\n২) অথবা মোবাইলে অ্যাপটি খুলে "মোবাইল (স্ক্যানার)" ট্যাবে গিয়ে এই কোডটি লিখুন।'
                      : '1) Scan this QR with your phone camera to open Scanner directly.\n2) Or open this app on your phone, tap "Mobile (Scanner)" and enter this code.'}
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedLink ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedLink
                          ? isBn
                            ? 'লিংক কপি হয়েছে!'
                            : 'Link Copied!'
                          : isBn
                          ? 'মোবাইল লিংক কপি'
                          : 'Copy Mobile Link'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareNative}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{isBn ? 'শেয়ার / WhatsApp' : 'Share Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Behavior Preference: Auto increment qty on duplicate scan */}
              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    {isBn
                      ? 'একই প্রোডাক্ট আবার স্ক্যান হলে Qty +1 অটো বাড়বে'
                      : 'Auto-increment Qty (+1) on repeat mobile scan'}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {isBn
                      ? 'বন্ধ থাকলে ডুপ্লিকেট পণ্যে কনফার্মেশন পপআপ দেখাবে'
                      : 'When off, Tablet asks before adding duplicate items'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoIncrementDuplicate}
                  onChange={(e) => onToggleAutoIncrementDuplicate(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer shrink-0"
                />
              </label>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{isBn ? 'ঠিক আছে, টেবলেটে বিল শুরু করুন' : 'Done, Start Billing on Tablet'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* MOBILE SCANNER MODE */
            <div className="bg-stone-950 text-white flex flex-col">
              {!connectedMobileRoom || connectedMobileRoom.length < 4 ? (
                <form onSubmit={handleConnectMobileCode} className="p-5 space-y-4">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mx-auto mb-2">
                      <Camera className="w-6 h-6 text-blue-400" />
                    </div>
                    <h4 className="text-base font-black">
                      {isBn ? 'টেবলেটের কোড দিন' : 'Enter Tablet Pairing Code'}
                    </h4>
                    <p className="text-xs text-stone-400">
                      {isBn
                        ? 'টেবলেটের স্ক্রিনে দেখানো ৬-ডিজিট কোডটি নিচে লিখুন'
                        : 'Type the 6-digit code shown on your Tablet screen'}
                    </p>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobileCodeInput}
                    onChange={(e) => setMobileCodeInput(normalizeScannerRoomCode(e.target.value))}
                    placeholder="e.g. 482910"
                    className="w-full text-center text-2xl font-mono font-black tracking-[0.25em] py-3 px-4 rounded-2xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:border-blue-500"
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={mobileCodeInput.length < 4}
                    className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-sm cursor-pointer transition-all"
                  >
                    {isBn ? 'টেবলেটের সাথে কানেক্ট করুন' : 'Connect & Open Camera'}
                  </button>
                </form>
              ) : (
                <>
                  {/* Connected Room Status & Camera Controls */}
                  <div className="px-3.5 py-2.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          mobilePresence.tabletCount > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : mobileConnState === 'connected'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            mobilePresence.tabletCount > 0
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span>
                          {mobilePresence.tabletCount > 0
                            ? isBn
                              ? `টেবলেট কানেক্টেড (#${connectedMobileRoom})`
                              : `Tablet Ready (#${connectedMobileRoom})`
                            : isBn
                            ? `কোড #${connectedMobileRoom} • টেবলেটের অপেক্ষায়`
                            : `Room #${connectedMobileRoom} • Waiting for Tablet`}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setConnectedMobileRoom('')}
                        className="text-[11px] text-stone-400 hover:text-white underline cursor-pointer"
                      >
                        {isBn ? 'কোড বদলান' : 'Change'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSoundEnabled((s) => !s)}
                        className={`p-1.5 rounded-lg border cursor-pointer ${
                          soundEnabled
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-stone-800 border-stone-700 text-stone-400'
                        }`}
                        title={isBn ? 'বিপ সাউন্ড' : 'Beep Sound'}
                      >
                        {soundEnabled ? (
                          <Volume2 className="w-4 h-4" />
                        ) : (
                          <VolumeX className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleTorch}
                        className={`p-1.5 rounded-lg border cursor-pointer ${
                          torchOn
                            ? 'bg-amber-500 text-stone-950 border-amber-400'
                            : 'bg-stone-800 border-stone-700 text-stone-300'
                        }`}
                        title={isBn ? 'ফ্ল্যাশলাইট' : 'Flashlight'}
                      >
                        <Zap className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetZoom(zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : 1)}
                        className="px-2 py-1 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>{zoomLevel}x</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                        }
                        className="p-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 cursor-pointer"
                        title={isBn ? 'ক্যামেরা ঘোরান' : 'Flip Camera'}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Camera Viewfinder */}
                  <div className="relative bg-black min-h-[250px] sm:min-h-[280px] flex items-center justify-center overflow-hidden">
                    <div id={scannerRegionId} className="w-full h-full" />

                    {isCameraStarting && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 text-stone-200">
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                        <span className="text-xs font-bold">
                          {isBn ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting Camera...'}
                        </span>
                      </div>
                    )}

                    {cameraError && (
                      <div className="absolute inset-0 bg-stone-950/95 p-5 flex flex-col items-center justify-center text-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-amber-400" />
                        <p className="text-xs text-stone-200 font-semibold">{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => startMobileCamera(facingMode)}
                          className="mt-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                        >
                          {isBn ? 'আবার চেষ্টা করুন' : 'Retry Camera'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Manual Barcode Input Fallback */}
                  <form
                    onSubmit={handleSendManualBarcode}
                    className="p-2.5 bg-stone-900 border-t border-b border-stone-800 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={manualBarcodeInput}
                      onChange={(e) => setManualBarcodeInput(e.target.value)}
                      placeholder={
                        isBn
                          ? 'বারকোড / SKU লিখে পাঠান...'
                          : 'Type barcode / SKU manually...'
                      }
                      className="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-stone-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualBarcodeInput.trim()}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isBn ? 'পাঠান' : 'Send'}</span>
                    </button>
                  </form>

                  {/* Live Scan ACK Feed */}
                  <div className="p-3 bg-stone-950 max-h-44 overflow-y-auto space-y-1.5">
                    {scanLogs.length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-500">
                        {isBn
                          ? 'প্রোডাক্টের বারকোড ক্যামেরার সামনে ধরুন — সাথে সাথে টেবলেটের বিলে চলে যাবে।'
                          : 'Point camera at any product barcode — it instantly adds to Tablet bill.'}
                      </div>
                    ) : (
                      scanLogs.map((log) => (
                        <div
                          key={log.scanId}
                          className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                            log.status === 'added' || log.status === 'incremented'
                              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-100'
                              : log.status === 'needs_price' || log.status === 'duplicate_confirm'
                              ? 'bg-amber-950/60 border-amber-700/50 text-amber-100'
                              : 'bg-stone-900 border-stone-800 text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {log.status === 'sending' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                            ) : log.status === 'added' || log.status === 'incremented' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <div className="min-w-0 truncate">
                              <span className="font-bold">
                                {log.itemName || log.barcode}
                              </span>
                              {log.status === 'needs_price' && (
                                <span className="ml-1.5 text-[10px] text-amber-300">
                                  ({isBn ? 'টেবলেটে দর বসান' : 'Set rate on Tablet'})
                                </span>
                              )}
                              {log.status === 'duplicate_confirm' && (
                                <span className="ml-1.5 text-[10px] text-amber-300">
                                  ({isBn ? 'টেবলেটে কনফার্ম করুন' : 'Confirm on Tablet'})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                            {typeof log.qtyInBill === 'number' && (
                              <span className="px-1.5 py-0.5 rounded bg-white/10 font-bold">
                                x{log.qtyInBill}
                              </span>
                            )}
                            {typeof log.price === 'number' && log.price > 0 && (
                              <span className="font-bold text-emerald-300">
                                {currencySymbol}
                                {log.price}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
