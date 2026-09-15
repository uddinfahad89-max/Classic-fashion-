import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Folder,
  FolderOpen,
  ArrowDown,
  List,
  LayoutGrid,
  MoreVertical,
  X,
  Bluetooth,
  RefreshCw,
  FileText,
  Power,
  Trash2,
  Globe,
  Settings as SettingsIcon,
  Calculator,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Store,
  Receipt,
  Users,
  BookOpen,
  Truck,
  Plus,
  ShoppingBag,
  Clock,
  Sparkles,
  Phone,
  Mail,
  Zap,
  HelpCircle,
} from 'lucide-react';
import {
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  UserProfile,
  Language,
  ActiveTab,
  NetworkStatusInfo,
} from '../types';

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'name-asc';

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
  onSelectLanguage?: (lang: Language) => void;
  onOpenCalculator: () => void;
  onLockApp?: () => void;
  // Google Sheets-style bar controls:
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  totalInvoicesCount?: number;
  networkStatus?: NetworkStatusInfo;
  onOpenDataSaver?: () => void;
  onOpenBluetoothHelp?: () => void;
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
  onSelectLanguage,
  onOpenCalculator,
  onLockApp,
  activeTab,
  onSelectTab,
  searchTerm,
  onSearchChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
  totalInvoicesCount = 0,
  networkStatus,
  onOpenDataSaver,
  onOpenBluetoothHelp,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';
  const t = (bn: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'bn') return bn;
    return en;
  };

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileModalOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setIsFolderMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileModalOpen(false);
        setIsSortDropdownOpen(false);
        setIsFolderMenuOpen(false);
        setIsDrawerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sort labels mapping
  const getSortLabel = () => {
    switch (sortOption) {
      case 'date-desc':
        return t('তারিখ (নতুন আগে)', 'Date opened by me', 'दिनांक (नया पहले)');
      case 'date-asc':
        return t('তারিখ (পুরোনো আগে)', 'Date modified', 'दिनांक (पुराना पहले)');
      case 'amount-desc':
        return t('পরিমাণ (সর্বোচ্চ)', 'Amount (High to Low)', 'राशि (अधिक से कम)');
      case 'name-asc':
        return t('নাম / বিল নং (A-Z)', 'Title (A to Z)', 'शीर्षक (A से Z)');
      default:
        return t('তারিখ অনুযায়ী', 'Date opened by me', 'दिनांक अनुसार');
    }
  };

  const userInitial = userProfile.name
    ? userProfile.name.trim().charAt(0).toUpperCase()
    : userProfile.email
    ? userProfile.email.trim().charAt(0).toUpperCase()
    : 'F';

  return (
    <>
      {/* Top Google Sheets / Drive Style Container */}
      <header
        id="google-sheets-top-header"
        className="bg-white sticky top-0 z-30 border-b border-stone-200/80 shadow-2xs select-none"
      >
        {/* Top Google Red / Material Brand Accent Strip */}
        <div className="h-1 bg-gradient-to-r from-red-500 via-emerald-500 to-blue-500 w-full" />

        {/* 1. MAIN TOP APP BAR (Hamburger + Pill Search + User Avatar) */}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Hamburger Menu Button (☰) */}
          <button
            id="header-drawer-menu-btn"
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation drawer"
            className="p-2 sm:p-2.5 rounded-full text-stone-700 hover:text-stone-950 hover:bg-stone-100 active:bg-stone-200 transition-colors cursor-pointer shrink-0"
            title={isBn ? 'মেনু খুলুন' : 'Open Menu'}
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-stone-700" />
          </button>

          {/* Center: Google Sheets Style Pill Search Bar */}
          <div className="flex-1 max-w-xl relative">
            <div
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-[#edf2f7] hover:bg-[#e2e8f0]/80 focus-within:bg-white focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500/30 transition-all border border-transparent focus-within:border-blue-400`}
            >
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  t(
                    'বিল বা হিসাব খুঁজুন (Search Sheets)...',
                    'Search Sheets, bills, dues...',
                    'बिल व हिसाब खोजें (Search Sheets)...'
                  )
                }
                className="w-full bg-transparent border-none text-xs sm:text-sm text-stone-900 placeholder:text-stone-500 font-medium focus:outline-none"
              />

              {/* Clear button when text present */}
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  title={isBn ? 'মুছুন' : 'Clear search'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Folder Icon inside Search Pill (as seen in Google Sheets) */}
              <div className="relative shrink-0" ref={folderRef}>
                <button
                  type="button"
                  onClick={() => setIsFolderMenuOpen((prev) => !prev)}
                  className={`p-1.5 rounded-full text-stone-600 hover:text-blue-600 hover:bg-stone-200/80 transition-colors cursor-pointer flex items-center justify-center ${
                    isFolderMenuOpen ? 'bg-stone-200 text-blue-600' : ''
                  }`}
                  title={isBn ? 'ফোল্ডার ও ক্যাটাগরি' : 'Folders & Categories'}
                >
                  <Folder className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-stone-400/20" />
                </button>

                {/* Folder Category Popover */}
                {isFolderMenuOpen && (
                  <div className="absolute right-0 top-10 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-stone-100">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      {isBn ? 'দোকানের খাতা ফোল্ডার' : 'Sheets & Folders'}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('invoices');
                          setIsFolderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                          activeTab === 'invoices'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-emerald-600" />
                          <span>{isBn ? 'ইনভয়েস শিট (Invoices)' : 'Invoices & Bills'}</span>
                        </span>
                        {totalInvoicesCount > 0 && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                            {totalInvoicesCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('billing');
                          setIsFolderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                          activeTab === 'billing'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <span>{isBn ? 'নতুন বিলিং (New POS)' : 'New Billing / POS'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('due');
                          setIsFolderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                          activeTab === 'due'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>{isBn ? 'বাকি খাতা (Customer Dues)' : 'Customer Dues'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('cashbook');
                          setIsFolderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                          activeTab === 'cashbook'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-purple-600" />
                        <span>{isBn ? 'ডেবুক (Cashbook)' : 'Daily Cashbook'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('purchases');
                          setIsFolderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                          activeTab === 'purchases'
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <Truck className="w-4 h-4 text-teal-600" />
                        <span>{isBn ? 'মাল কেনাকাটা (Purchases)' : 'Purchase Trips'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Circular Google Account Avatar */}
          <div className="relative shrink-0" ref={profileRef}>
            <button
              id="google-avatar-btn"
              type="button"
              onClick={() => setIsProfileModalOpen((prev) => !prev)}
              aria-label="Open Account Profile and Security"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-sm shadow-xs hover:ring-2 hover:ring-blue-400/80 transition-all cursor-pointer border-2 border-white"
              title={userProfile.name || userProfile.email || 'Google Profile'}
            >
              {userProfile.isLoggedIn ? (
                <span>{userInitial}</span>
              ) : (
                <ShieldCheck className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Google Account Style Popover */}
            {isProfileModalOpen && (
              <div
                id="google-account-popover"
                className="absolute right-0 top-12 w-80 bg-white rounded-3xl shadow-2xl border border-stone-200 py-3 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-stone-100"
              >
                {/* Profile Header */}
                <div className="px-4 py-2 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xl flex items-center justify-center shadow-md mb-2">
                    {userInitial}
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 truncate">
                    {userProfile.name || 'Store Owner'}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono truncate">
                    {userProfile.email || 'uddinfahad89@gmail.com'}
                  </p>
                  {userProfile.phone && (
                    <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                      📞 {userProfile.phone}
                    </p>
                  )}
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {userProfile.role || 'Store Owner'}
                  </span>
                </div>

                {/* Printer Status in Account */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-stone-50/70">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-stone-800">
                        {isBn ? 'থার্মাল প্রিন্টার' : 'Thermal Printer'}
                      </p>
                      <p className="text-[10px] text-stone-500 truncate max-w-[140px]">
                        {bluetoothStatus.connected
                          ? bluetoothStatus.deviceName || 'Connected'
                          : bluetoothStatus.isConnecting
                          ? 'Connecting...'
                          : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      if (bluetoothStatus.connected) {
                        onTestPrint();
                      } else {
                        onConnectBluetooth();
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-blue-700 bg-white border border-stone-200 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    {bluetoothStatus.connected ? (isBn ? 'টেস্ট' : 'Test') : (isBn ? 'কানেক্ট' : 'Connect')}
                  </button>
                </div>
                {onOpenBluetoothHelp && (
                  <div className="px-4 py-1.5 bg-blue-50/50 border-b border-stone-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        onOpenBluetoothHelp();
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? 'ব্লুটুথ নট সাপোর্ট সমাধান?' : 'Bluetooth fix guide?'}</span>
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>{isBn ? 'লগইন ও পিন সেটিংস (Security)' : 'Login & Security PIN'}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {userProfile.isLoggedIn && onLockApp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        onLockApp();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>{isBn ? 'অ্যাপ লক করুন (Lock App)' : 'Lock App (PIN Vault)'}</span>
                      </span>
                      <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full font-bold">
                        PIN
                      </span>
                    </button>
                  )}

                  {/* Quick Language Selector in Profile */}
                  <div className="px-3 py-2 bg-stone-50 rounded-xl border border-stone-200/70 flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t('ভাষা', 'Language', 'भाषा')}</span>
                    </span>
                    <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectLanguage) onSelectLanguage('bn');
                          else onToggleLanguage();
                        }}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          language === 'bn' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        বাংলা
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectLanguage) onSelectLanguage('en');
                          else onToggleLanguage();
                        }}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          language === 'en' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectLanguage) onSelectLanguage('hi');
                          else onToggleLanguage();
                        }}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          language === 'hi' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        हिन्दी
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <SettingsIcon className="w-4 h-4 text-stone-600" />
                      <span>{isBn ? 'দোকান ও রসিদ সেটিংস' : 'Store & POS Settings'}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. SUB-HEADER BAR (Exactly Matching Screenshot: "Date opened by me ↓" and [≡] [⊞] pills) */}
        <div className="max-w-4xl mx-auto px-4 sm:px-5 py-2 flex items-center justify-between border-t border-stone-100 bg-[#fbfcfd]">
          {/* Left: Sort Filter Dropdown ("Date opened by me ↓") */}
          <div className="relative" ref={sortRef}>
            <button
              id="sub-header-sort-btn"
              type="button"
              onClick={() => setIsSortDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-800 hover:text-blue-700 transition-colors cursor-pointer group py-1"
            >
              <span>{getSortLabel()}</span>
              <div className="w-5 h-5 rounded-full bg-stone-200/70 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <ArrowDown className="w-3 h-3 text-stone-600 group-hover:text-blue-600" />
              </div>
            </button>

            {/* Sort Options Menu */}
            {isSortDropdownOpen && (
              <div className="absolute left-0 top-9 w-60 bg-white rounded-2xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  {isBn ? 'সাজানোর ক্রম (Sort by)' : 'Sort By'}
                </div>
                {(
                  [
                    { id: 'date-desc', label: isBn ? 'তারিখ (নতুন আগে)' : 'Date opened by me (Newest)' },
                    { id: 'date-asc', label: isBn ? 'তারিখ (পুরোনো আগে)' : 'Date modified (Oldest)' },
                    { id: 'amount-desc', label: isBn ? 'পরিমাণ (সর্বোচ্চ আগে)' : 'Amount (High to Low)' },
                    { id: 'name-asc', label: isBn ? 'নাম / বিল নং (A to Z)' : 'Title / Customer (A to Z)' },
                  ] as { id: SortOption; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSortChange(opt.id);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      sortOption === opt.id
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortOption === opt.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center: Ultra Low-Data Saver Status Pill */}
          {onOpenDataSaver && (
            <button
              id="header-data-saver-pill-btn"
              type="button"
              onClick={onOpenDataSaver}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold transition-all cursor-pointer shadow-2xs group"
              title={t(
                'লো-ডাটা ও অফলাইন ইঞ্জিন: সামান্য ডাটা অন থাকলেই যথেষ্ট',
                'Low-Data & Offline Engine: Works on minimal data',
                'लो-डाटा व ऑफलाइन इंजन: कम डाटा पर भी सक्षम'
              )}
            >
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">
                {networkStatus?.isOnline
                  ? t('লো-ডাটা মোড', 'Data Saver', 'लो-डाटा मोड')
                  : t('অফলাইন মোড', 'Offline Mode', 'ऑफलाइन मोड')}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </button>
          )}

          {/* Right: List [≡] & Grid [⊞] View Toggle Pills (As seen in Google Sheets) */}
          <div className="flex items-center gap-1 bg-[#eef2f6] p-0.5 rounded-full border border-stone-200/60">
            {/* List View Button */}
            <button
              id="view-toggle-list-btn"
              type="button"
              onClick={() => onViewModeChange('list')}
              aria-label="List view"
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#d3e3fd] text-[#041e49] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
              title={isBn ? 'তালিকা ভিউ (List)' : 'List View'}
            >
              <List className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Grid View Button */}
            <button
              id="view-toggle-grid-btn"
              type="button"
              onClick={() => onViewModeChange('grid')}
              aria-label="Grid view"
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#d3e3fd] text-[#041e49] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
              title={isBn ? 'গ্রিড ভিউ (Grid)' : 'Grid View'}
            >
              <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. GOOGLE WORKSPACE STYLE NAVIGATION DRAWER (Slides in from Left) */}
      {isDrawerOpen && (
        <div
          id="google-drawer-backdrop"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs transition-opacity duration-200 animate-in fade-in"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            id="google-drawer-panel"
            className="w-72 sm:w-80 h-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform duration-200 animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div>
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-black text-lg border border-white/20">
                    {userInitial}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <h2 className="text-base font-bold truncate">
                    {settings.storeName || 'Classic fashion'}
                  </h2>
                  <p className="text-xs text-emerald-100 font-mono truncate">
                    {userProfile.email || 'uddinfahad89@gmail.com'}
                  </p>
                  {settings.storePhone && (
                    <p className="text-[11px] text-emerald-200 font-mono mt-0.5">
                      📞 {settings.storePhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Navigation Items (Google Sheets / Workspace Style) */}
              <div className="p-2 space-y-1">
                {/* 1. Invoices / All Sheets */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('invoices');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === 'invoices'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <span>{isBn ? 'ইনভয়েস খাতা (All Sheets)' : 'Invoices (All Sheets)'}</span>
                  </span>
                  {totalInvoicesCount > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {totalInvoicesCount}
                    </span>
                  )}
                </button>

                {/* 2. New Billing */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('billing');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                    activeTab === 'billing'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <span>{isBn ? 'নতুন বিলিং (New POS)' : 'New Billing / POS'}</span>
                </button>

                {/* 3. Customer Dues */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('due');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                    activeTab === 'due'
                      ? 'bg-amber-50 text-amber-800'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Users className="w-5 h-5 text-amber-600" />
                  <span>{isBn ? 'বাকি খাতা (Customer Dues)' : 'Customer Dues'}</span>
                </button>

                {/* 4. Cashbook */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('cashbook');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                    activeTab === 'cashbook'
                      ? 'bg-purple-50 text-purple-800'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <span>{isBn ? 'ডেবুক (Cashbook)' : 'Daily Cashbook'}</span>
                </button>

                {/* 5. Purchases */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('purchases');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                    activeTab === 'purchases'
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Truck className="w-5 h-5 text-teal-600" />
                  <span>{isBn ? 'মাল কেনাকাটা (Purchases)' : 'Purchase Trips'}</span>
                </button>

                <div className="h-px bg-stone-200 my-2" />

                {/* Quick Calculator */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenCalculator();
                  }}
                  className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>{isBn ? 'ক্যালকুলেটর (পাইকারি ও খুচরা)' : 'Calculator'}</span>
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {isBn ? 'খুলুন' : 'Open'}
                  </span>
                </button>

                {/* Printer Connect & Test */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      if (bluetoothStatus.connected) {
                        onTestPrint();
                      } else {
                        onConnectBluetooth();
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Bluetooth className="w-4 h-4 text-emerald-600" />
                      <span>{isBn ? 'থার্মাল প্রিন্টার' : 'Thermal Printer'}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        bluetoothStatus.connected
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {bluetoothStatus.connected ? 'Online' : 'Connect'}
                    </span>
                  </button>
                  {onOpenBluetoothHelp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenBluetoothHelp();
                      }}
                      className="w-full text-left px-3.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 pl-10 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3 text-blue-600" />
                      <span>{isBn ? 'ব্লুটুথ নট সাপোর্ট সমাধান?' : 'Bluetooth fix guide?'}</span>
                    </button>
                  )}
                </div>

                {/* 3-Way Language Selector */}
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-stone-700">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>{t('ভাষা নির্বাচন (Language)', 'Select Language', 'भाषा चुनें (Language)')}</span>
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                      {language === 'bn' ? 'বাংলা' : language === 'hi' ? 'हिन्दी' : 'English'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-stone-200/70 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectLanguage) onSelectLanguage('bn');
                        else onToggleLanguage();
                        setIsDrawerOpen(false);
                      }}
                      className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        language === 'bn'
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-stone-600 hover:text-stone-950'
                      }`}
                    >
                      বাংলা
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectLanguage) onSelectLanguage('en');
                        else onToggleLanguage();
                        setIsDrawerOpen(false);
                      }}
                      className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        language === 'en'
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-stone-600 hover:text-stone-950'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectLanguage) onSelectLanguage('hi');
                        else onToggleLanguage();
                        setIsDrawerOpen(false);
                      }}
                      className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        language === 'hi'
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-stone-600 hover:text-stone-950'
                      }`}
                    >
                      हिन्दी
                    </button>
                  </div>
                </div>

                {/* Low-Data & Offline Engine */}
                {onOpenDataSaver && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenDataSaver();
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>{t('লো-ডাটা ও অফলাইন ইঞ্জিন', 'Low-Data & Offline Engine', 'लो-डाटा व ऑफलाइन इंजन')}</span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                      {networkStatus?.effectiveType ? networkStatus.effectiveType.toUpperCase() : '2G/3G'}
                    </span>
                  </button>
                )}

                {/* App Settings */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4 text-stone-600" />
                  <span>{isBn ? 'দোকান সেটিংস (Settings)' : 'Store Settings'}</span>
                </button>

                {/* Lock App */}
                {userProfile.isLoggedIn && onLockApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onLockApp();
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>{isBn ? 'অ্যাপ লক করুন (PIN Lock)' : 'Lock App (PIN)'}</span>
                    </span>
                    <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      ●●●●
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Bottom Info */}
            <div className="p-3 bg-stone-50 border-t border-stone-200 text-center text-[11px] text-stone-400">
              <span>Google Sheets Style POS • v2.5</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
