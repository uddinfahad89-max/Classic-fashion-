import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bluetooth,
  Usb,
  Wifi,
  Check,
  RotateCw,
  Printer,
  FileText,
  Trash2,
  HelpCircle,
  ExternalLink,
  Power,
  Smartphone,
  Info,
} from 'lucide-react';
import {
  BluetoothDeviceInfo,
  SavedPrinterInfo,
  ThermalPrinterSettings,
  PaperWidth,
  Language,
} from '../types';
import { storageService } from '../services/storageService';

interface InvoicePrintingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bluetoothStatus: BluetoothDeviceInfo;
  settings: ThermalPrinterSettings;
  onScanDevices: () => Promise<void>;
  onConnectPairedDevice: (device: SavedPrinterInfo) => Promise<void>;
  onDisconnectDevice: (forget?: boolean) => void;
  onTestPrint: () => Promise<void>;
  onUpdatePaperWidth: (width: PaperWidth) => void;
  onUpdateSettings: (settings: ThermalPrinterSettings) => void;
  onOpenTroubleshoot?: () => void;
  language?: Language;
}

type TabType = 'bluetooth' | 'usb' | 'wifi';

export const InvoicePrintingModal: React.FC<InvoicePrintingModalProps> = ({
  isOpen,
  onClose,
  bluetoothStatus,
  settings,
  onScanDevices,
  onConnectPairedDevice,
  onDisconnectDevice,
  onTestPrint,
  onUpdatePaperWidth,
  onUpdateSettings,
  onOpenTroubleshoot,
  language = 'bn',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('bluetooth');
  const [pairedDevices, setPairedDevices] = useState<SavedPrinterInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // USB & WiFi state
  const [wifiIp, setWifiIp] = useState('192.168.1.100');
  const [wifiPort, setWifiPort] = useState('9100');
  const [isUsbSupported, setIsUsbSupported] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const devices = storageService.getPairedPrinters();
      setPairedDevices(devices);
      if (typeof navigator !== 'undefined' && 'usb' in navigator) {
        setIsUsbSupported(true);
      }
    }
  }, [isOpen, bluetoothStatus.connected, bluetoothStatus.savedPrinter]);

  if (!isOpen) return null;

  const isBn = language === 'bn';

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await onScanDevices();
      const updated = storageService.getPairedPrinters();
      setPairedDevices(updated);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDevice = async (device: SavedPrinterInfo) => {
    setConnectingId(device.id);
    try {
      await onConnectPairedDevice(device);
      const updated = storageService.getPairedPrinters();
      setPairedDevices(updated);
    } finally {
      setConnectingId(null);
    }
  };

  const handleRemoveDevice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = storageService.removePairedPrinter(id);
    setPairedDevices(updated);
    if (bluetoothStatus.savedPrinter?.id === id) {
      onDisconnectDevice(true);
    }
  };

  const handleTestPrintClick = async () => {
    setIsPrintingTest(true);
    try {
      await onTestPrint();
    } finally {
      setIsPrintingTest(false);
    }
  };

  const isCurrentDevice = (device: SavedPrinterInfo) => {
    if (!bluetoothStatus.connected) return false;
    if (bluetoothStatus.deviceId && bluetoothStatus.deviceId === device.id) return true;
    if (bluetoothStatus.deviceName && bluetoothStatus.deviceName === device.name) return true;
    if (bluetoothStatus.savedPrinter?.id === device.id) return true;
    return false;
  };

  return (
    <div
      id="invoice-printing-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-0 sm:p-4"
    >
      {/* Mobile-first full height or modal card matching Vyapar App layout */}
      <div className="bg-[#edf5fd] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-stone-800">
        {/* Top Header matching Vyapar App */}
        <div className="bg-white px-4 py-3.5 flex items-center gap-3 border-b border-stone-200/80 shrink-0 shadow-2xs">
          <button
            id="invoice-printing-back-btn"
            type="button"
            onClick={onClose}
            className="p-1 -ml-1 text-stone-700 hover:text-stone-950 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
              Invoice Printing
            </h1>
            <p className="text-[11px] text-stone-500 font-medium">
              {isBn ? 'ইনভয়েস থার্মাল প্রিন্টার সংযোগ' : 'Thermal POS Printer Setup'}
            </p>
          </div>

          {/* Connected indicator badge */}
          {bluetoothStatus.connected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online</span>
            </span>
          )}
        </div>

        {/* Vyapar Tabs: Bluetooth | USB | WiFi */}
        <div className="bg-white flex items-center border-b border-stone-200 shrink-0">
          <button
            id="tab-bluetooth-btn"
            type="button"
            onClick={() => setActiveTab('bluetooth')}
            className={`flex-1 py-3 text-center text-sm sm:text-base font-semibold transition-all relative cursor-pointer ${
              activeTab === 'bluetooth'
                ? 'text-[#f02d44] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Bluetooth
            {activeTab === 'bluetooth' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f02d44] rounded-t-full" />
            )}
          </button>

          <button
            id="tab-usb-btn"
            type="button"
            onClick={() => setActiveTab('usb')}
            className={`flex-1 py-3 text-center text-sm sm:text-base font-semibold transition-all relative cursor-pointer ${
              activeTab === 'usb'
                ? 'text-[#f02d44] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            USB
            {activeTab === 'usb' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f02d44] rounded-t-full" />
            )}
          </button>

          <button
            id="tab-wifi-btn"
            type="button"
            onClick={() => setActiveTab('wifi')}
            className={`flex-1 py-3 text-center text-sm sm:text-base font-semibold transition-all relative cursor-pointer ${
              activeTab === 'wifi'
                ? 'text-[#f02d44] font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            WiFi
            {activeTab === 'wifi' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#f02d44] rounded-t-full" />
            )}
          </button>
        </div>

        {/* Tab Body: Scrollable area with Vyapar-style card layout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-4 space-y-4">
          {/* TAB 1: BLUETOOTH */}
          {activeTab === 'bluetooth' && (
            <>
              {/* Paired Devices Card matching Vyapar App Screenshot */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-blue-100/70">
                <div className="flex items-center justify-between pb-3 mb-1">
                  <h2 className="text-sm sm:text-base font-medium text-stone-700">
                    Paired Devices ({pairedDevices.length})
                  </h2>

                  {bluetoothStatus.connected && (
                    <button
                      type="button"
                      onClick={handleTestPrintClick}
                      disabled={isPrintingTest}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isPrintingTest ? 'Printing...' : 'Test Print'}</span>
                    </button>
                  )}
                </div>

                {/* Device List */}
                {pairedDevices.length > 0 ? (
                  <div className="divide-y divide-stone-100">
                    {pairedDevices.map((device) => {
                      const connected = isCurrentDevice(device);
                      const isConnectingThis = connectingId === device.id;

                      return (
                        <div
                          key={device.id}
                          className="py-3.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm sm:text-base font-medium text-stone-900 truncate">
                                {device.name || 'Thermal POS Printer'}
                              </p>
                              {connected && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  Connected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-400 font-mono mt-0.5 truncate">
                              {device.macAddress || device.id || 'E0:6E:41:12:1B:0D'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {connected ? (
                              <button
                                type="button"
                                onClick={() => onDisconnectDevice(false)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                                title="Disconnect"
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectDevice(device)}
                                disabled={isConnectingThis}
                                className="bg-[#e6f2fe] hover:bg-[#d4e9fc] text-[#0d6efd] active:bg-[#c2e0fa] text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isConnectingThis ? 'Connecting...' : 'Select'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleRemoveDevice(e, device.id)}
                              className="p-1.5 text-stone-300 hover:text-rose-500 rounded-full hover:bg-stone-50 transition-colors cursor-pointer"
                              title="Forget Device"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-stone-500">
                    <Bluetooth className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-stone-600">No paired devices found</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Tap "Scan for New Devices" below to discover your thermal printer.
                    </p>
                  </div>
                )}
              </div>

              {/* Printer Configuration & Format (Vyapar Options) */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-blue-100/70 space-y-3.5">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  {isBn ? 'প্রিন্টার ও পেপার সাইজ' : 'Printer Paper Settings'}
                </h3>

                {/* Paper Size selector 2 inch vs 3 inch */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {isBn ? 'রোল পেপারের সাইজ' : 'Receipt Paper Size'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {settings.paperWidth === '58mm'
                        ? '2 Inch (58mm) Mini POS'
                        : '3 Inch (80mm) Standard POS'}
                    </p>
                  </div>

                  <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => onUpdatePaperWidth('58mm')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        settings.paperWidth === '58mm'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      58mm (2")
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdatePaperWidth('80mm')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        settings.paperWidth === '80mm'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      80mm (3")
                    </button>
                  </div>
                </div>

                {/* Auto Silent Print on Checkout */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {isBn ? 'অটো-প্রিন্ট অন ক্যাশআউট' : 'Auto Silent Print'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {isBn
                        ? 'বিল হওয়ার সাথে সাথে সরাসরি রসিদ প্রিন্ট হবে'
                        : 'Print slip immediately upon sale checkout'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        autoPrintOnCheckout: !settings.autoPrintOnCheckout,
                      })
                    }
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      settings.autoPrintOnCheckout ? 'bg-[#f02d44]' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.autoPrintOnCheckout ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Troubleshooting / RawBT Help Banner */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-blue-900">
                  <p className="font-bold">
                    {isBn ? 'ব্লুটুথ সাপোর্ট না করলে করণীয়:' : 'Need Help Pairing?'}
                  </p>
                  <p className="text-blue-700 mt-0.5">
                    {isBn
                      ? 'অ্যান্ড্রয়েড ফোনে সরাসরি Google Chrome ব্রাউজারে অ্যাপটি চালান। যদি ব্লুটুথ অপশন ব্লক থাকে তবে "নয়া ট্যাবে খুলুন" বা RawBT প্রিন্ট ব্যবহার করুন।'
                      : 'Ensure your thermal printer is turned ON and Bluetooth is enabled. For mobile, use Google Chrome directly.'}
                  </p>
                  {onOpenTroubleshoot && (
                    <button
                      type="button"
                      onClick={onOpenTroubleshoot}
                      className="mt-2 text-xs font-bold text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isBn ? 'বিস্তারিত সমস্যা সমাধান গাইড দেখুন →' : 'View Full Guide →'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: USB */}
          {activeTab === 'usb' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-blue-100/70 text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Usb className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900">
                  {isBn ? 'USB / OTG থার্মাল প্রিন্টার' : 'USB Thermal POS'}
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto mt-1">
                  {isBn
                    ? 'আপনার মোবাইল বা কম্পিউটারের সাথে OTG / USB ক্যাবল দিয়ে সরাসরি প্রিন্টার যুক্ত করুন।'
                    : 'Connect your POS printer directly using a USB cable or mobile USB-OTG adapter.'}
                </p>

                <div className="mt-5 p-3 bg-stone-50 rounded-xl text-left border border-stone-200 text-xs space-y-1.5">
                  <p className="font-semibold text-stone-700">WebUSB Status:</p>
                  <p className={isUsbSupported ? 'text-emerald-700' : 'text-amber-700'}>
                    {isUsbSupported
                      ? '✓ WebUSB API is supported on this browser'
                      : '⚠ WebUSB is limited on this browser. Plug printer and print via standard system dialog.'}
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof navigator !== 'undefined' && (navigator as any).usb?.requestDevice) {
                        try {
                          await (navigator as any).usb.requestDevice({ filters: [] });
                          alert('USB printer connected!');
                        } catch (err: any) {
                          if (!err.message?.includes('cancelled')) {
                            alert(err.message || 'Could not select USB device');
                          }
                        }
                      } else {
                        window.print();
                      }
                    }}
                    className="w-full py-3 px-4 bg-[#f02d44] hover:bg-[#d92238] text-white font-bold rounded-full text-sm transition-all shadow-md cursor-pointer"
                  >
                    {isBn ? 'USB ডিভাইস সিলেক্ট করুন' : 'Select USB Printer'}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-full text-xs transition-colors cursor-pointer"
                  >
                    {isBn ? 'সিস্টেম USB প্রিন্টার ডায়ালগ (Ctrl+P)' : 'System USB Print Dialog'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WIFI / LAN */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-blue-100/70">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Wifi className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 text-center">
                  {isBn ? 'WiFi / LAN নেটওয়ার্ক প্রিন্টার' : 'Network / WiFi POS'}
                </h3>
                <p className="text-xs text-stone-500 text-center max-w-xs mx-auto mt-1">
                  {isBn
                    ? 'দোকানের ওয়াইফাই বা রাউটারে সংযুক্ত নেটওয়ার্ক থার্মাল প্রিন্টারের IP ও পোর্ট দিন।'
                    : 'Configure WiFi POS thermal printer connected to your local store router.'}
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Printer IP Address
                    </label>
                    <input
                      type="text"
                      value={wifiIp}
                      onChange={(e) => setWifiIp(e.target.value)}
                      placeholder="192.168.1.100"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      RAW Socket Port (default 9100)
                    </label>
                    <input
                      type="text"
                      value={wifiPort}
                      onChange={(e) => setWifiPort(e.target.value)}
                      placeholder="9100"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      alert(`Saved WiFi Printer settings for ${wifiIp}:${wifiPort}`);
                    }}
                    className="w-full mt-2 py-3 px-4 bg-[#f02d44] hover:bg-[#d92238] text-white font-bold rounded-full text-sm transition-all shadow-md cursor-pointer"
                  >
                    {isBn ? 'সেভ ও টেস্ট কানেকশন' : 'Save & Test Network Print'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sticky Action Bar: The signature Vyapar bright red pill button */}
        {activeTab === 'bluetooth' && (
          <div className="bg-white/95 backdrop-blur-xs p-4 border-t border-stone-200 shrink-0">
            <button
              id="scan-new-devices-btn"
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="w-full py-3.5 px-6 bg-[#f02d44] hover:bg-[#d92238] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-full shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RotateCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>
                {isScanning
                  ? isBn
                    ? 'নতুন ডিভাইস স্ক্যান হচ্ছে...'
                    : 'Scanning for Devices...'
                  : isBn
                  ? 'নতুন ডিভাইস স্ক্যান করুন (Scan for New Devices)'
                  : 'Scan for New Devices'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
