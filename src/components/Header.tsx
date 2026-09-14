import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  MoreVertical,
  Bluetooth,
  RefreshCw,
  FileText,
  Power,
  Trash2,
  Globe,
  Settings as SettingsIcon,
  User,
  Mail,
  CheckCircle2,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import {
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  UserProfile,
  Language,
} from '../types';

interface HeaderProps {
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  onConnectBluetooth: () => void;
  onDisconnectBluetooth: (forget?: boolean) => void;
  onTestPrint: () => void;
  onOpenSettings: () => void;
  userProfile: UserProfile;
  onOpenLogin: () => void;
  language: Language;
  onToggleLanguage: () => void;
  onOpenCalculator: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  bluetoothStatus,
  onConnectBluetooth,
  onDisconnectBluetooth,
  onTestPrint,
  onOpenSettings,
  userProfile,
  onOpenLogin,
  language,
  onToggleLanguage,
  onOpenCalculator,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when tapping/clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header
      id="main-top-header"
      className="bg-white/95 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Clean, Minimal Shop Name Display */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Store className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-tight truncate">
              {settings.storeName || (language === 'bn' ? 'দোকানের নাম সেট করুন' : 'My Shop')}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium truncate">
              {settings.storePhone && (
                <span className="font-mono font-semibold text-stone-700">📞 {settings.storePhone}</span>
              )}
              {settings.storePhone && settings.storeAddress && (
                <span className="text-stone-300">•</span>
              )}
              {settings.storeAddress ? (
                <span className="truncate">{settings.storeAddress}</span>
              ) : (
                !settings.storePhone && (
                  <span className="text-stone-400">POS &amp; Billing System</span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Top-Right Area: Live status pill + 3-Dot (⋮) Menu Button */}
        <div className="flex items-center gap-2 relative" ref={menuRef}>
          {/* Subtle live printer status dot indicator */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              bluetoothStatus.connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : bluetoothStatus.isConnecting
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                bluetoothStatus.connected
                  ? 'bg-emerald-500 animate-pulse'
                  : bluetoothStatus.isConnecting
                  ? 'bg-amber-500 animate-spin'
                  : 'bg-stone-400'
              }`}
            />
            <span className="text-[11px] max-w-[120px] truncate">
              {bluetoothStatus.connected
                ? bluetoothStatus.deviceName || 'Printer'
                : bluetoothStatus.isConnecting
                ? 'Connecting...'
                : 'Printer Offline'}
            </span>
          </button>

          {/* Quick Calculator Header Button */}
          <button
            id="header-calculator-btn"
            type="button"
            onClick={onOpenCalculator}
            aria-label="Open Calculator"
            title={language === 'bn' ? 'ক্যালকুলেটর খুলুন' : 'Open Calculator'}
            className="p-2 rounded-xl text-stone-700 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 border border-stone-200/80 bg-stone-50/80 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs group"
          >
            <Calculator className="w-5 h-5 text-stone-600 group-hover:text-blue-600 transition-colors" />
            <span className="hidden md:inline text-xs font-bold text-stone-700 group-hover:text-blue-600">
              {language === 'bn' ? 'ক্যালকুলেটর' : 'Calculator'}
            </span>
          </button>

          {/* Vyapar-style 3-dot (⋮) menu button */}
          <button
            id="header-three-dot-menu-btn"
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-label="Open More Options Menu"
            className={`p-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-transparent transition-all cursor-pointer ${
              isMenuOpen ? 'bg-stone-100 text-blue-600 border-stone-200' : ''
            }`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Dropdown Menu (Vyapar App Style) */}
          {isMenuOpen && (
            <div
              id="top-three-dot-dropdown"
              className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-stone-100"
            >
              {/* Section 1: Printer Status & Controls */}
              <div className="p-2 space-y-1">
                <div className="px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        bluetoothStatus.connected
                          ? 'bg-emerald-100 text-emerald-700'
                          : bluetoothStatus.isConnecting
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <Bluetooth className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">
                        {language === 'bn' ? 'থার্মাল প্রিন্টার' : 'Thermal Printer'}
                      </p>
                      <p className="text-[10px] text-stone-500 truncate max-w-[150px]">
                        {bluetoothStatus.connected
                          ? bluetoothStatus.deviceName || (language === 'bn' ? 'কানেক্টেড' : 'Connected')
                          : bluetoothStatus.isConnecting
                          ? (language === 'bn' ? 'সংযোগ হচ্ছে...' : 'Connecting...')
                          : (language === 'bn' ? 'সংযুক্ত নয়' : 'Not Connected')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      bluetoothStatus.connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : bluetoothStatus.isConnecting
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {bluetoothStatus.connected
                      ? (language === 'bn' ? 'অনলাইন' : 'Online')
                      : (language === 'bn' ? 'অফলাইন' : 'Offline')}
                  </span>
                </div>

                {/* Printer actions */}
                {!bluetoothStatus.connected ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onConnectBluetooth();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Bluetooth className="w-4 h-4" />
                      {language === 'bn' ? 'প্রিন্টার কানেক্ট করুন' : 'Connect Printer'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="pt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onTestPrint();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{language === 'bn' ? 'টেস্ট প্রিন্ট দিন' : 'Print Test Slip'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onConnectBluetooth();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                      <span>{language === 'bn' ? 'অন্য প্রিন্টার পেয়ার করুন' : 'Pair Different Printer'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDisconnectBluetooth(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Power className="w-3.5 h-3.5 text-stone-500" />
                      <span>{language === 'bn' ? 'ডিসকানেক্ট করুন' : 'Disconnect'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDisconnectBluetooth(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>{language === 'bn' ? 'প্রিন্টার মুছে ফেলুন' : 'Forget Printer'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Quick Tools (Calculator) */}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenCalculator();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>{language === 'bn' ? 'ক্যালকুলেটর (পাইকারি ও খুচরা)' : 'Calculator (Wholesale & Retail)'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-200">
                    {language === 'bn' ? 'খুলুন' : 'Open'}
                  </span>
                </button>
              </div>

              {/* Section 3: Language Switcher */}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    onToggleLanguage();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>{language === 'bn' ? 'ভাষা: বাংলা' : 'Language: English'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px] font-bold text-stone-600 border border-stone-200">
                    {language === 'bn' ? 'Change to EN' : 'বাংলায় পরিবর্তন'}
                  </span>
                </button>
              </div>

              {/* Section 3: Store Settings */}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-stone-600" />
                    <span>{language === 'bn' ? 'দোকান ও প্রিন্টার সেটিংস' : 'Store & POS Settings'}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>
              </div>

              {/* Section 4: Profile / Account Details */}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {userProfile.isLoggedIn ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                        {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    ) : (
                      <Mail className="w-4 h-4 text-stone-600" />
                    )}
                    <span className="truncate max-w-[150px]">
                      {userProfile.isLoggedIn
                        ? userProfile.name || userProfile.email
                        : language === 'bn'
                        ? 'লগইন / ক্লাউড সিঙ্ক'
                        : 'Profile & Cloud Sync'}
                    </span>
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {userProfile.isLoggedIn
                      ? (language === 'bn' ? 'অ্যাকাউন্ট' : 'Account')
                      : (language === 'bn' ? 'সাইন ইন' : 'Sign in')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
