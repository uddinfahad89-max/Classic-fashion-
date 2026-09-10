import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingBag,
  BookOpen,
  Users,
  Bluetooth,
  Printer,
  Settings,
  CheckCircle2,
  RefreshCw,
  Power,
  Trash2,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { BluetoothDeviceInfo, ThermalPrinterSettings } from '../types';

interface HeaderProps {
  activeTab: 'billing' | 'cashbook' | 'due';
  setActiveTab: (tab: 'billing' | 'cashbook' | 'due') => void;
  cartCount: number;
  bluetoothStatus: BluetoothDeviceInfo;
  onConnectBluetooth: () => void;
  onDisconnectBluetooth: (forget?: boolean) => void;
  onTestPrint: () => void;
  onOpenSettings: () => void;
  settings: ThermalPrinterSettings;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  bluetoothStatus,
  onConnectBluetooth,
  onDisconnectBluetooth,
  onTestPrint,
  onOpenSettings,
  settings,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBadgeClick = () => {
    if (!bluetoothStatus.connected && !bluetoothStatus.isConnecting) {
      onConnectBluetooth();
    } else {
      setIsMenuOpen((prev) => !prev);
    }
  };

  const getStatusContent = () => {
    if (bluetoothStatus.isConnecting) {
      return {
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
        dot: (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-amber-600 border-t-transparent"></span>
          </span>
        ),
        textDesktop: '🟡 Connecting...',
        textMobile: '🟡 Connecting',
        title: 'Attempting background reconnection to printer',
      };
    }

    if (bluetoothStatus.connected) {
      const name = bluetoothStatus.deviceName || 'Thermal Printer';
      return {
        badgeClass:
          'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs',
        dot: (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        ),
        textDesktop: `🟢 ${name.length > 16 ? name.slice(0, 14) + '…' : name} Ready`,
        textMobile: '🟢 Printer Ready',
        title: `Connected to ${name}. Click for printer options.`,
      };
    }

    // Disconnected state
    const hasSaved = !!bluetoothStatus.savedPrinter;
    return {
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 transition-colors shadow-2xs animate-pulse',
      dot: <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block"></span>,
      textDesktop: hasSaved
        ? `🔴 Disconnected - Tap to Connect`
        : '🔴 Disconnected - Tap to Connect',
      textMobile: '🔴 Tap to Connect',
      title: hasSaved
        ? `Saved printer: ${bluetoothStatus.savedPrinter?.name}. Tap to auto-reconnect.`
        : 'No printer connected. Tap to pair Bluetooth printer.',
    };
  };

  const status = getStatusContent();

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        {/* Brand & Store Name + Mobile Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                {settings.storeName || 'Simple POS & Cashbook'}
              </h1>
              <p className="text-[11px] text-stone-500 font-medium">
                Thermal POS • Daily Cashbook • Due Khata
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: Status Badge + Settings */}
          <div className="flex items-center gap-1.5 sm:hidden" ref={menuRef}>
            <button
              onClick={handleBadgeClick}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${status.badgeClass}`}
              title={status.title}
            >
              {status.dot}
              <span>{status.textMobile}</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 cursor-pointer"
              title="Store Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Mobile Dropdown Menu when connected */}
            {isMenuOpen && bluetoothStatus.connected && (
              <div className="absolute top-14 right-3 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                  <div>
                    <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">
                      Thermal Device
                    </p>
                    <p className="text-xs font-bold text-stone-900">
                      {bluetoothStatus.deviceName || 'Thermal POS'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Online
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onTestPrint();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-stone-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-semibold cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Print Test Receipt</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDisconnectBluetooth(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-stone-700 hover:bg-stone-100 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Power className="w-4 h-4 text-stone-500" />
                    <span>Disconnect</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDisconnectBluetooth(true);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Forget & Pair New</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Billing</span>
            {cartCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cashbook')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'cashbook'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Cashbook</span>
          </button>

          <button
            onClick={() => setActiveTab('due')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'due'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Due</span>
          </button>
        </div>

        {/* Desktop Quick Actions: Status Badge & Settings */}
        <div className="hidden sm:flex items-center gap-2 relative" ref={menuRef}>
          {/* Visual Status Indicator Badge */}
          <div className="relative">
            <button
              onClick={handleBadgeClick}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${status.badgeClass}`}
              title={status.title}
            >
              {status.dot}
              <span>{status.textDesktop}</span>
              {bluetoothStatus.connected && <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
            </button>

            {/* Desktop Dropdown for Printer Management */}
            {isMenuOpen && bluetoothStatus.connected && (
              <div className="absolute top-10 right-0 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                  <div>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      Connected Printer
                    </p>
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {bluetoothStatus.deviceName || 'Thermal POS-58'}
                    </p>
                    {bluetoothStatus.savedPrinter && (
                      <p className="text-[10px] text-stone-400">
                        Saved in Local Storage
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Online
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onTestPrint();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-stone-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Print Test Slip</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDisconnectBluetooth(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-stone-700 hover:bg-stone-100 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <Power className="w-4 h-4 text-stone-500" />
                    <span>Disconnect</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDisconnectBluetooth(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Forget & Pair New</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
            title="Settings & Receipt Options"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
