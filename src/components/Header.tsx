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
  Receipt,
  ChevronDown,
  User,
  Mail,
  Globe,
  Truck,
} from 'lucide-react';
import {
  BluetoothDeviceInfo,
  ThermalPrinterSettings,
  ActiveTab,
  UserProfile,
  Language,
} from '../types';
import { translations } from '../utils/i18n';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cartCount: number;
  invoicesCount?: number;
  purchasesCount?: number;
  bluetoothStatus: BluetoothDeviceInfo;
  onConnectBluetooth: () => void;
  onDisconnectBluetooth: (forget?: boolean) => void;
  onTestPrint: () => void;
  onOpenSettings: () => void;
  settings: ThermalPrinterSettings;
  userProfile: UserProfile;
  onOpenLogin: () => void;
  language: Language;
  onToggleLanguage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  invoicesCount = 0,
  purchasesCount = 0,
  bluetoothStatus,
  onConnectBluetooth,
  onDisconnectBluetooth,
  onTestPrint,
  onOpenSettings,
  settings,
  userProfile,
  onOpenLogin,
  language,
  onToggleLanguage,
}) => {
  const t = translations[language];
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

        {/* Mobile Right Controls: Dedicated Connect Printer Button or Status + Settings */}
        <div className="flex items-center gap-1.5 sm:hidden relative" ref={menuRef}>
          {!bluetoothStatus.connected ? (
            <button
              id="mobile-connect-printer-btn"
              onClick={onConnectBluetooth}
              disabled={bluetoothStatus.isConnecting}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                bluetoothStatus.isConnecting
                  ? 'bg-amber-500 text-white opacity-90'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
              title="Pair Bluetooth thermal printer"
            >
              {bluetoothStatus.isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>Connect Printer</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="mobile-printer-status-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs cursor-pointer"
              title={`Connected to ${bluetoothStatus.deviceName}. Tap for options.`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="max-w-[110px] truncate">{bluetoothStatus.deviceName || 'Ready'}</span>
              <ChevronDown className="w-3 h-3 text-emerald-600" />
            </button>
          )}

          <button
            onClick={onToggleLanguage}
            className="px-2 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 cursor-pointer flex items-center gap-1"
            title={t.languageToggleTitle}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'bn' ? 'EN' : 'বাং'}</span>
          </button>

          <button
            onClick={onOpenLogin}
            className="p-1.5 rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 cursor-pointer flex items-center justify-center"
            title={userProfile.isLoggedIn ? `ইউজার অ্যাকাউন্ট: ${userProfile.email}` : 'ইমেল দিয়ে লগইন করুন'}
          >
            {userProfile.isLoggedIn ? (
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
            ) : (
              <Mail className="w-4 h-4 text-stone-600" />
            )}
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
            <div className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                    Bluetooth Thermal POS
                  </p>
                  <p className="text-xs font-bold text-stone-900 truncate">
                    {bluetoothStatus.deviceName || 'Thermal Printer'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Ready
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
                  <span>Print Test Slip</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onConnectBluetooth();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium cursor-pointer"
                >
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  <span>Pair Different Printer</span>
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
                  <span>Forget Printer</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'billing'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t.tabBilling}</span>
            {cartCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{t.tabInvoices}</span>
            {invoicesCount > 0 && (
              <span className="bg-stone-200 text-stone-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {invoicesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cashbook')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cashbook'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.tabCashbook}</span>
          </button>

          <button
            onClick={() => setActiveTab('due')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'due'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t.tabDue}</span>
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{t.tabPurchases}</span>
            {purchasesCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {purchasesCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Quick Actions: Dedicated Connect Printer Button or Status + Settings */}
        <div className="hidden sm:flex items-center gap-2 relative" ref={menuRef}>
          {!bluetoothStatus.connected ? (
            <button
              id="desktop-connect-printer-btn"
              onClick={onConnectBluetooth}
              disabled={bluetoothStatus.isConnecting}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                bluetoothStatus.isConnecting
                  ? 'bg-amber-500 text-white opacity-90'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
              title="Pair Bluetooth thermal printer via Chrome"
            >
              {bluetoothStatus.isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4" />
                  <span>Connect Printer</span>
                </>
              )}
            </button>
          ) : (
            <div className="relative">
              <button
                id="desktop-printer-status-btn"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shadow-2xs transition-all cursor-pointer"
                title={`Connected to ${bluetoothStatus.deviceName}. Click for printer options.`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <Bluetooth className="w-4 h-4 text-emerald-600" />
                <span className="max-w-[150px] truncate">
                  {bluetoothStatus.deviceName || 'Thermal Printer'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              {/* Desktop Dropdown for Printer Management */}
              {isMenuOpen && (
                <div className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                    <div>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                        Active BLE Printer
                      </p>
                      <p className="text-xs font-bold text-stone-900 truncate">
                        {bluetoothStatus.deviceName || 'Thermal POS-58'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Ready
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
                        onConnectBluetooth();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <Bluetooth className="w-4 h-4 text-blue-600" />
                      <span>Pair Different Printer</span>
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
                      <span>Forget Printer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
            title={t.languageToggleTitle}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'bn' ? 'English' : 'বাংলা'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 text-stone-700 uppercase font-mono">
              {language}
            </span>
          </button>

          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer"
            title={userProfile.isLoggedIn ? `লগইন করা অ্যাকাউন্ট: ${userProfile.email}` : 'ইমেল দিয়ে লগইন করুন'}
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
              {userProfile.isLoggedIn ? (
                userProfile.name ? (
                  userProfile.name.charAt(0).toUpperCase()
                ) : (
                  'U'
                )
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="text-left hidden lg:block">
              <span className="block text-xs font-bold text-stone-900 leading-tight truncate max-w-[120px]">
                {userProfile.isLoggedIn ? userProfile.name : 'ইমেল লগইন'}
              </span>
              {userProfile.isLoggedIn && (
                <span className="block text-[10px] text-stone-400 font-mono leading-none truncate max-w-[120px]">
                  {userProfile.email}
                </span>
              )}
            </div>
            <span className="block lg:hidden text-xs font-bold text-stone-800">
              {userProfile.isLoggedIn ? userProfile.name.split(' ')[0] : 'লগইন'}
            </span>
          </button>

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
