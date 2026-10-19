import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Check, Bluetooth, Power, Trash2, FileText, CheckCircle2, Zap, HelpCircle, Download, Upload, Database, Tag, Copy, Cloud, ShieldCheck, Receipt, Flame, Barcode, RefreshCw, Crown, UserCheck } from 'lucide-react';
import { ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { translations } from '../utils/i18n';
import { storageService, BarcodeScanPreferences } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';
import { firebaseConfig } from '../firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  onSaveSettings: (settings: ThermalPrinterSettings) => void;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: (forceScan?: boolean) => void;
  onDisconnectBluetooth?: (forget?: boolean) => void;
  onTestPrint?: () => void;
  onOpenBluetoothHelp?: () => void;
  language?: Language;
  onDataRestored?: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenStaffManagement?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  bluetoothStatus,
  onConnectBluetooth,
  onDisconnectBluetooth,
  onTestPrint,
  onOpenBluetoothHelp,
  language = 'bn',
  onDataRestored,
  onOpenSuperAdmin,
  onOpenStaffManagement,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const [form, setForm] = useState<ThermalPrinterSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [scanPrefs, setScanPrefs] = useState<BarcodeScanPreferences>(() =>
    storageService.getBarcodeScanPreferences()
  );

  const [fbTesting, setFbTesting] = useState(false);
  const [fbTestMsg, setFbTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbSyncMsg, setFbSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fbRestoring, setFbRestoring] = useState(false);
  const [fbRestoreMsg, setFbRestoreMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showFbDetails, setShowFbDetails] = useState(false);

  useEffect(() => {
    setForm(settings);
    setBackupMsg(null);
    if (isOpen) {
      setScanPrefs(storageService.getBarcodeScanPreferences());
    }
  }, [settings, isOpen]);

  const handleUpdateScanPrefs = (partial: Partial<BarcodeScanPreferences>) => {
    const updated = { ...scanPrefs, ...partial };
    setScanPrefs(updated);
    storageService.saveBarcodeScanPreferences(updated);
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const success = storageService.importAllDataOffline(content);
        if (success) {
          setBackupMsg({
            type: 'success',
            text: isBn ? 'ডাটা সফলভাবে রিস্টোর হয়েছে!' : 'Data restored successfully!',
          });
          const updatedSettings = storageService.getSettings();
          setForm(updatedSettings);
          onSaveSettings(updatedSettings);
          if (onDataRestored) {
            onDataRestored();
          }
        } else {
          setBackupMsg({
            type: 'error',
            text: isBn ? 'ভুল ব্যাকআপ ফাইল ফরম্যাট!' : 'Invalid backup JSON file format!',
          });
        }
      } catch (err) {
        console.error('Failed to import backup:', err);
        setBackupMsg({
          type: 'error',
          text: isBn ? 'ফাইল পড়তে ব্যর্থ হয়েছে!' : 'Failed to parse backup file!',
        });
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again if desired
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md my-auto flex flex-col max-h-[92vh] overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-stone-900">{t.settingsTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-base leading-none p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
            {/* Employee Access & Permissions Quick Link (Store Owner Only) */}
            {onOpenStaffManagement && (() => {
              const currentProf = storageService.getUserProfile();
              if (!currentProf.isLoggedIn || currentProf.role === 'Staff') return null;
              return (
                <div className="p-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl text-white space-y-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black">
                          {isBn ? '👥 কর্মচারী এক্সেস ও স্টাফ পারমিশন' : '👥 Staff POS Access & Permissions'}
                        </h4>
                        <p className="text-[11px] text-blue-100">
                          {isBn
                            ? 'কর্মচারীর জন্য ইমেল/পাসওয়ার্ড ও লিমিটেড এক্সেস (বিলিং, স্টক, বাকি) দিন'
                            : 'Set up staff login & permissions for billing and stock'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStaffManagement();
                      }}
                      className="px-3 py-1.5 bg-white text-blue-900 rounded-xl text-xs font-black shadow-xs hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                    >
                      {isBn ? 'খুলুন →' : 'Open →'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Bluetooth Printer Section */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-stone-900">
                <Bluetooth className="w-4 h-4 text-blue-600" />
                <span>{isBn ? 'ব্লুটুথ থার্মাল প্রিন্টার' : 'Bluetooth Thermal Printer'}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  bluetoothStatus?.connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : bluetoothStatus?.isConnecting
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {bluetoothStatus?.connected
                  ? (isBn ? 'সংযুক্ত' : 'Connected')
                  : bluetoothStatus?.isConnecting
                  ? (isBn ? 'সংযুক্ত হচ্ছে...' : 'Connecting...')
                  : (isBn ? 'বিচ্ছিন্ন' : 'Disconnected')}
              </span>
            </div>

            <div className="text-[11px] text-stone-500">
              {bluetoothStatus?.savedPrinter ? (
                <p>
                  {isBn ? 'সংরক্ষিত প্রিন্টার:' : 'Remembered Device:'}{' '}
                  <span className="font-semibold text-stone-800">
                    {bluetoothStatus.savedPrinter.name}
                  </span>{' '}
                  ({isBn ? 'প্রিন্ট করার সময় স্বয়ংক্রিয়ভাবে রিকানেক্ট হবে' : 'Auto-reconnects on print'})
                </p>
              ) : (
                <p>{isBn ? 'এখনো কোনো প্রিন্টার পেয়ার করা হয়নি।' : 'No printer remembered yet. Pair once to enable auto-reconnect.'}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {!bluetoothStatus?.connected ? (
                <>
                  <button
                    type="button"
                    onClick={() => onConnectBluetooth?.(false)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>
                      {bluetoothStatus?.savedPrinter
                        ? isBn
                          ? 'সংরক্ষিত প্রিন্টার কানেক্ট'
                          : 'Connect Saved Printer'
                        : isBn
                        ? 'প্রিন্টার কানেক্ট করুন'
                        : 'Connect / Pair Printer'}
                    </span>
                  </button>

                  {bluetoothStatus?.savedPrinter && (
                    <button
                      type="button"
                      onClick={() => onConnectBluetooth?.(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Pair a different device"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? 'নতুন ডিভাইস স্ক্যান' : 'Scan New'}</span>
                    </button>
                  )}

                  {onOpenBluetoothHelp && (
                    <button
                      type="button"
                      onClick={onOpenBluetoothHelp}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Bluetooth Troubleshooting Guide"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? 'ব্লুটুথ নট সাপোর্ট সমাধান?' : 'Bluetooth Fix Guide'}</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onTestPrint}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isBn ? 'টেস্ট প্রিন্ট' : 'Test Slip'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnectBluetooth?.(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Power className="w-3.5 h-3.5 text-stone-500" />
                    <span>{isBn ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnect'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnectBluetooth?.(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>{isBn ? 'মুছে ফেলুন' : 'Forget'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-2.5">
            <div className="text-xs font-bold text-blue-950 flex items-center justify-between">
              <span>{isBn ? '🏪 দোকানের নাম ও ঠিকানা (Shop Name & Address)' : '🏪 Shop Name & Address'}</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {isBn ? 'যেকোনো সময় পরিবর্তনযোগ্য' : 'Editable anytime'}
              </span>
            </div>
            <div>
              <label className="block text-stone-700 font-semibold mb-1">{t.storeNameLabel}</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                placeholder={t.storeNamePlaceholder}
                className="w-full border border-stone-200 bg-white p-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-semibold mb-1">{t.storeAddressLabel}</label>
              <input
                type="text"
                value={form.storeAddress}
                onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                placeholder={t.storeAddressPlaceholder}
                className="w-full border border-stone-200 bg-white p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">{t.storePhoneLabel}</label>
              <input
                type="text"
                value={form.storePhone}
                onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">{t.currencySymbolLabel}</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.currencySymbol}
                  onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                  placeholder="Rs. or Tk."
                  className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />

                {/* 1-Tap Currency Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, hideCurrencySymbol: true })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      form.hideCurrencySymbol
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {isBn ? '✓ চিহ্ন ছাড়া (ক্লিন সংখ্যা 500.00)' : '✓ No Symbol (Clean 500.00)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, currencySymbol: 'Rs.', hideCurrencySymbol: false })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      !form.hideCurrencySymbol && form.currencySymbol === 'Rs.'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    Rs. (রুপী)
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, currencySymbol: 'Tk.', hideCurrencySymbol: false })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      !form.hideCurrencySymbol && form.currencySymbol === 'Tk.'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    Tk. (টাকা)
                  </button>
                </div>

                <p className="text-[10px] text-stone-500 leading-tight">
                  {isBn
                    ? '💡 থার্মাল রসিদে "?" চিহ্ন আসা সম্পূর্ণ বন্ধ করতে "চিহ্ন ছাড়া" অথবা "Rs." ব্যবহার করুন।'
                    : '💡 To eliminate "?" on thermal receipts, choose "No Symbol" or "Rs."'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">{t.signatoryNameLabel}</label>
              <input
                type="text"
                value={form.signatoryName || ''}
                onChange={(e) => setForm({ ...form, signatoryName: e.target.value })}
                placeholder={isBn ? '(ঐচ্ছিক)' : '(Optional)'}
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1 flex items-center justify-between">
                <span>{isBn ? 'UPI আইডি (QR কোড পেমেন্ট)' : 'UPI ID (QR Code & Due Pay)'}</span>
                {form.upiId && form.upiId.trim() && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    ✓ QR Enabled
                  </span>
                )}
              </label>
              <input
                type="text"
                value={form.upiId || ''}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                placeholder="e.g. 9876543210@paytm or shop@okaxis"
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-blue-700 font-medium pt-1 leading-tight">
                {isBn
                  ? '💡 Vyapar অ্যাপের মতো: এটি দিলে যারা বাকি (Due) নিবে তাদের বিলে ও থার্মাল প্রিন্টে অটো QR কোড আসবে, যাতে কাস্টমার স্ক্যান করে পেমেন্ট করতে পারে।'
                  : '💡 Like Vyapar app: If set, bills with Due (বাকি) will automatically print a dynamic UPI QR Code for instant scan & pay.'}
              </p>
            </div>
          </div>

          {/* Invoice Number Formatting & Sequence */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
            <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ইনভয়েস নম্বর ও সিরিয়াল সেটিংস' : 'Invoice Numbering & Sequence'}</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
                {isBn ? 'প্রিভিউ: ' : 'Preview: '}
                {(form.invoicePrefix ?? '') + (form.nextInvoiceNumber || 1)}
              </span>
            </div>

            {/* Quick Presets: Only Number vs With Prefix */}
            <div className="flex items-center gap-1.5 bg-stone-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setForm({ ...form, invoicePrefix: '' })}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !form.invoicePrefix
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isBn ? '✓ শুধু নম্বর (যেমন: ১, ২, ৩)' : '✓ Only Number (e.g. 1, 2, 3)'}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, invoicePrefix: 'INV-' })}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  form.invoicePrefix === 'INV-'
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isBn ? 'প্রিফিক্স সহ (INV-১)' : 'With Prefix (INV-1)'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                  {isBn ? 'ইনভয়েস প্রিফিক্স (Prefix)' : 'Prefix'}
                </label>
                <input
                  type="text"
                  value={form.invoicePrefix ?? ''}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                  placeholder={isBn ? 'ফাঁকা রাখুন (শুধু নম্বরের জন্য)' : 'Leave blank for only number'}
                  className="w-full border border-stone-200 bg-white p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                  {isBn ? 'পরবর্তী ইনভয়েস নম্বর' : 'Next Invoice #'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.nextInvoiceNumber ?? 1}
                  onChange={(e) => setForm({ ...form, nextInvoiceNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  placeholder="1"
                  className="w-full border border-stone-200 bg-white p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-400 leading-tight">
              {isBn
                ? 'প্রিফিক্স ফাঁকা রাখলে বিলে শুধু নম্বর (যেমন ১, ২, ৩) আসবে। প্রতিটি নতুন বিলে স্বয়ংক্রিয়ভাবে ক্রম বাড়বে।'
                : 'Leaving prefix empty generates pure numbers (e.g. 1, 2, 3). Each new bill auto-increments.'}
            </p>
          </div>

          <div>
            <label className="block text-stone-700 font-semibold mb-1">{t.paperWidthLabel}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, paperWidth: '58mm' })}
                className={`py-2 rounded-xl font-bold border text-xs transition-all ${
                  form.paperWidth === '58mm'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                58mm Roll (Standard POS)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, paperWidth: '80mm' })}
                className={`py-2 rounded-xl font-bold border text-xs transition-all ${
                  form.paperWidth === '80mm'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                80mm Roll (Wide Receipt)
              </button>
            </div>
          </div>

          {/* Label Mode Toggle in Settings */}
          <div className="p-3 bg-gradient-to-r from-amber-50/90 to-orange-50/80 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>{isBn ? 'লেবেল মোড (Label Mode - স্টিকার ও প্রাইস ট্যাগ)' : 'Label Mode (Sticker & Price Tags)'}</span>
                {form.isLabelMode && (
                  <span className="text-[10px] bg-amber-200/90 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amber-900/85 leading-tight">
                {isBn
                  ? 'থার্মাল প্রিন্টে হেডার ও ফুটার বাদ দিয়ে শুধুমাত্র পণ্যের নাম, বারকোড এবং মূল্য প্রিন্ট হবে।'
                  : 'Removes standard invoice headers & footers, focusing only on product name, barcode, and price.'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={Boolean(form.isLabelMode)}
                onChange={(e) => setForm({ ...form, isLabelMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Default Invoice Format: Estimate Bill vs Tax Invoice */}
          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ডিফল্ট বিলের শিরোনাম (Default Bill Header)' : 'Default Invoice Title Header'}</span>
              </div>
              <div className="text-[11px] text-blue-900/80 leading-tight">
                {isBn
                  ? 'দোকানের ক্যাশ মেমো / রসিদে "Estimate Bill" নাকি "Tax Invoice" লেখা থাকবে তা নির্ধারণ করুন।'
                  : 'Choose whether printed/shared receipts header says "Estimate Bill" or "Tax Invoice".'}
              </div>
            </div>
            <div className="flex items-center bg-white rounded-xl p-1 border border-blue-200 text-xs font-bold shrink-0 self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultInvoiceFormat: 'estimate' })}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  form.defaultInvoiceFormat !== 'tax_invoice'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isBn ? '📋 এস্টিমেট বিল' : 'Estimate Bill'}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultInvoiceFormat: 'tax_invoice' })}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  form.defaultInvoiceFormat === 'tax_invoice'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {isBn ? '🏛️ ট্যাক্স ইনভয়েস' : 'Tax Invoice'}
              </button>
            </div>
          </div>

          {/* Total-Only Slip Mode (Summary Bill) in Settings */}
          <div className="p-3 bg-gradient-to-r from-indigo-50/90 to-purple-50/80 rounded-2xl border border-indigo-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isBn ? 'শুধু টোটাল হিসাব স্লিপ (Total Only Slip - সংক্ষেপিত বিল)' : 'Total Only Slip (Summary Receipt)'}</span>
                {form.isTotalOnlySlip && (
                  <span className="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-1.5 py-0.2 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-indigo-900/85 leading-tight">
                {isBn
                  ? 'কিছু কাস্টমারকে পুরো বিল না দিয়ে শুধু দোকানের নাম ও মোট টাকার হিসাব দিতে এটি ডিফল্ট অন রাখতে পারেন (পণ্যের তালিকা গোপন থাকবে)।'
                  : 'Prints/shares summary receipt with store name and total money calculation without individual item list.'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={Boolean(form.isTotalOnlySlip)}
                onChange={(e) => setForm({ ...form, isTotalOnlySlip: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Data Saver Mode in Settings */}
          <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>{isBn ? 'আল্ট্রা লো-ডাটা সেভার (কম ইন্টারনেট / ২জি ডাটা)' : 'Ultra Low-Data Saver (2G/3G Mode)'}</span>
              </div>
              <div className="text-[11px] text-emerald-800">
                {isBn
                  ? 'সীমিত মেগাবাইট বা দুর্বল ডাটা সিগন্যালেও সুপার-ফাস্ট গতি নিশ্চিত করে।'
                  : 'Ensures fastest speed and lowest battery/data usage on mobile networks.'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(form.isDataSaverEnabled)}
              onChange={(e) => setForm({ ...form, isDataSaverEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Barcode Scanner & Duplicate Protection Settings */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/70 rounded-2xl border border-blue-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-blue-600" />
                <span>
                  {isBn
                    ? 'বারকোড স্ক্যানার ও ডুপ্লিকেট সুরক্ষা (Barcode Guard)'
                    : 'Barcode Duplicate Scan Guard'}
                </span>
              </div>
              <span className="text-[10px] bg-blue-200/80 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                {scanPrefs.duplicateMode === 'ask'
                  ? isBn
                    ? 'জিজ্ঞাসা করবে'
                    : 'Ask Confirm'
                  : scanPrefs.duplicateMode === 'prevent'
                  ? isBn
                    ? 'একবারই যোগ'
                    : '1 Qty Only'
                  : isBn
                  ? 'অটো বৃদ্ধি'
                  : 'Auto'}
              </span>
            </div>

            <p className="text-[11px] text-blue-900/80 leading-relaxed">
              {isBn
                ? 'ক্যামেরা বা বারকোড গান দ্রুত স্ক্যান করার ফলে একসাথে একাধিক সংখ্যা যোগ হওয়া রোধ করতে পছন্দমতো নিয়ম সেট করুন:'
                : 'Control what happens when an item is scanned multiple times rapidly:'}
            </p>

            {/* 3 Modes Radio Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateScanPrefs({ duplicateMode: 'ask' })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  scanPrefs.duplicateMode === 'ask'
                    ? 'bg-white border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-white/60 border-blue-100 hover:bg-white text-stone-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950">
                      {isBn ? '১. জিজ্ঞাসা করবে' : '1. Ask Confirm'}
                    </span>
                    {scanPrefs.duplicateMode === 'ask' && (
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                    {isBn
                      ? 'আবার স্ক্যান হলে নিশ্চিত হওয়ার জন্য জিজ্ঞাসা করবে (+১ বাড়াবেন কিনা)'
                      : 'Prompts to confirm if you want to add this item again'}
                  </p>
                </div>
                <span className="mt-2 text-[9px] font-black text-blue-600 uppercase tracking-wider">
                  {isBn ? 'রিকমেন্ডেড' : 'Recommended'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateScanPrefs({ duplicateMode: 'prevent' })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  scanPrefs.duplicateMode === 'prevent'
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                    : 'bg-white/60 border-blue-100 hover:bg-white text-stone-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">
                      {isBn ? '২. একবারই যোগ হবে' : '2. 1 Qty Only'}
                    </span>
                    {scanPrefs.duplicateMode === 'prevent' && (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                    {isBn
                      ? 'একবার ১টি যোগ হলে আর বাড়বে না, ভুল স্ক্যান পুরোপুরি বন্ধ থাকবে'
                      : 'Strictly 1 qty per item; never increases on duplicate scan'}
                  </p>
                </div>
                <span className="mt-2 text-[9px] font-black text-emerald-600 uppercase tracking-wider">
                  {isBn ? 'কড়া নিরাপত্তা' : 'Strict Mode'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateScanPrefs({ duplicateMode: 'cooldown' })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  scanPrefs.duplicateMode === 'cooldown'
                    ? 'bg-white border-purple-500 shadow-xs ring-1 ring-purple-500'
                    : 'bg-white/60 border-blue-100 hover:bg-white text-stone-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950">
                      {isBn ? '৩. অটো বৃদ্ধি' : '3. Auto Increment'}
                    </span>
                    {scanPrefs.duplicateMode === 'cooldown' && (
                      <Check className="w-3.5 h-3.5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                    {isBn
                      ? '৩.৫ সেকেন্ড ব্যবধান পর পর স্বয়ংক্রিয়ভাবে সংখ্যা ১টি বাড়বে'
                      : 'Auto increases quantity only after 3.5s cooldown'}
                  </p>
                </div>
                <span className="mt-2 text-[9px] font-black text-purple-600 uppercase tracking-wider">
                  {isBn ? 'কুলডাউন মোড' : 'Cooldown'}
                </span>
              </button>
            </div>

            {/* Toggle Warning Beep */}
            <div className="flex items-center justify-between pt-1 border-t border-blue-200/60">
              <span className="text-[11px] text-blue-900 font-semibold">
                {isBn
                  ? 'ডুপ্লিকেট স্ক্যানে সতর্কতামূলক সাউন্ড (Warning Beep)'
                  : 'Play warning sound on duplicate scan'}
              </span>
              <input
                type="checkbox"
                checked={scanPrefs.beepOnDuplicate}
                onChange={(e) => handleUpdateScanPrefs({ beepOnDuplicate: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 font-semibold mb-1">{isBn ? 'রসিদের ফুটার বার্তা' : 'Receipt Footer Note'}</label>
            <div className="space-y-1.5">
              <input
                type="text"
                value={form.footerNote}
                onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
                placeholder="Thank you! Visit again."
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, footerNote: 'Thank you! Visit again.' })}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
                >
                  {isBn ? '✓ ডিফল্ট বার্তা: "Thank you! Visit again."' : '✓ Set: "Thank you! Visit again."'}
                </button>
              </div>
              <p className="text-[10px] text-stone-400 leading-tight">
                {isBn
                  ? 'থার্মাল রসিদে "???" চিহ্ন আসা এড়াতে শুধুমাত্র ইংরেজি অক্ষর ব্যবহার করুন।'
                  : 'Use standard English to ensure thermal printers print cleanly without "???"'}
              </p>
            </div>
          </div>

          {/* Manual Backup Safety Net: Export & Import Data */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
            <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ডাটা ব্যাকআপ ও রিস্টোর (Export & Import)' : 'Data Backup & Restore (JSON)'}</span>
              </span>
              <span className="text-[10px] text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded-full font-medium">
                {isBn ? 'অফলাইন সেফটি' : 'Offline Safety'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-tight">
              {isBn
                ? 'আপনার সম্পূর্ণ বিল, কাস্টমার বাকি ও দোকানের সেটিংস একটি JSON ফাইল হিসেবে ডাউনলোড বা রিস্টোর করুন।'
                : 'Download your full bills, dues, cashbook, and store settings as a JSON file or restore from a backup.'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                id="btn-export-backup"
                onClick={() => {
                  storageService.downloadDataBackup();
                  setBackupMsg({
                    type: 'success',
                    text: isBn ? 'ব্যাকআপ JSON ফাইল ডাউনলোড হয়েছে!' : 'Backup JSON file downloaded!',
                  });
                }}
                className="w-full bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ডাটা এক্সপোর্ট' : 'Export Data'}</span>
              </button>

              <label
                id="btn-import-backup"
                className="w-full bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all text-center"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isBn ? 'ডাটা ইমপোর্ট' : 'Import Data'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackupFile}
                  className="hidden"
                />
              </label>
            </div>
            {backupMsg && (
              <p
                className={`text-[11px] font-medium pt-1 ${
                  backupMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {backupMsg.text}
              </p>
            )}
          </div>

          {/* Firebase Cloud Firestore & Auth Section */}
          <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2.5">
            <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{isBn ? 'Firebase ক্লাউড ডাটাবেস (Firestore & Auth)' : 'Firebase Cloud Database (Firestore & Auth)'}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>{isBn ? 'কানেক্টেড (classic-fashion-pos)' : 'Connected'}</span>
              </span>
            </div>

            <p className="text-[11px] text-stone-600 leading-tight">
              {isBn
                ? 'আপনার Firebase প্রোজেক্ট (classic-fashion-pos) সক্রিয় রয়েছে। ইনভয়েস, স্টক এবং Barcode Table সরাসরি Firestore ক্লাউডে সুরক্ষিত রয়েছে।'
                : 'Your Firebase project (classic-fashion-pos) is active. Invoices, Stock and Barcode Table sync directly to Firestore.'}
            </p>

            <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/80 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-stone-600">
                <span className="font-medium">Project ID:</span>
                <span className="font-mono font-bold text-stone-900">{firebaseConfig.projectId}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span className="font-medium">Active Collections:</span>
                <span className="text-stone-800 font-semibold flex items-center gap-1">
                  <Barcode className="w-3 h-3 text-indigo-600" /> barcodes, invoices, products, profiles
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={fbTesting}
                onClick={async () => {
                  setFbTesting(true);
                  setFbTestMsg(null);
                  try {
                    const res = await firebaseService.testConnection();
                    setFbTestMsg({
                      type: res.success ? 'success' : 'error',
                      text: res.message
                    });
                  } catch (err: any) {
                    setFbTestMsg({
                      type: 'error',
                      text: err?.message || 'Connection test failed'
                    });
                  } finally {
                    setFbTesting(false);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Flame className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="truncate">
                  {fbTesting
                    ? (isBn ? 'পরীক্ষা...' : 'Testing...')
                    : (isBn ? 'সংযোগ টেস্ট' : 'Test Connection')}
                </span>
              </button>

              <button
                type="button"
                disabled={fbSyncing}
                onClick={async () => {
                  setFbSyncing(true);
                  setFbSyncMsg(null);
                  try {
                    const res = await firebaseService.syncAllPOSData({
                      bills: storageService.getBills(),
                      products: storageService.getProducts(),
                      cashEntries: storageService.getCashEntries(),
                      customerDues: storageService.getCustomerDues(),
                      purchaseTrips: storageService.getPurchaseTrips(),
                      settings: form,
                      userProfile: storageService.getUserProfile()
                    });
                    if (res.success) {
                      setFbSyncMsg({
                        type: 'success',
                        text: isBn
                          ? `✓ সফলভাবে ${res.count}টি POS রেকর্ড Firestore এ সেভ হয়েছে!`
                          : `✓ Successfully saved ${res.count} POS records to Firebase Firestore!`
                      });
                    } else {
                      setFbSyncMsg({
                        type: 'error',
                        text: res.error || 'Firestore sync failed'
                      });
                    }
                  } catch (err: any) {
                    setFbSyncMsg({
                      type: 'error',
                      text: err?.message || 'Sync failed'
                    });
                  } finally {
                    setFbSyncing(false);
                  }
                }}
                className="bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${fbSyncing ? 'animate-spin text-amber-400' : ''}`} />
                <span className="truncate">
                  {fbSyncing
                    ? (isBn ? 'সেভ হচ্ছে...' : 'Saving...')
                    : (isBn ? 'Firestore এ সেভ' : 'Save to Firestore')}
                </span>
              </button>

              <button
                type="button"
                disabled={fbRestoring}
                onClick={async () => {
                  setFbRestoring(true);
                  setFbRestoreMsg(null);
                  try {
                    const res = await firebaseService.restorePOSData();
                    if (res && res.success) {
                      if (res.bills.length > 0) storageService.saveBills(res.bills);
                      if (res.products.length > 0) storageService.saveProducts(res.products);
                      if (res.cashEntries.length > 0) storageService.saveCashEntries(res.cashEntries);
                      if (res.customerDues.length > 0) storageService.saveCustomerDues(res.customerDues);
                      if (res.purchaseTrips.length > 0) storageService.savePurchaseTrips(res.purchaseTrips);
                      if (res.settings) {
                        storageService.saveSettings(res.settings);
                        setForm(res.settings);
                      }
                      setFbRestoreMsg({
                        type: 'success',
                        text: isBn
                          ? `✓ সফলভাবে ফায়ারবেস থেকে ${res.bills.length}টি ইনভয়েস ও ${res.products.length}টি পণ্য রিস্টোর হয়েছে!`
                          : `✓ Successfully restored ${res.bills.length} invoices & ${res.products.length} products from Firebase!`
                      });
                      setTimeout(() => {
                        window.location.reload();
                      }, 1500);
                    } else {
                      setFbRestoreMsg({
                        type: 'error',
                        text: isBn ? 'ফায়ারবেস থেকে ডাটা পাওয়া যায়নি।' : 'No data found in Firebase.'
                      });
                    }
                  } catch (err: any) {
                    setFbRestoreMsg({
                      type: 'error',
                      text: err?.message || 'Restore failed'
                    });
                  } finally {
                    setFbRestoring(false);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 shrink-0 ${fbRestoring ? 'animate-bounce' : ''}`} />
                <span className="truncate">
                  {fbRestoring
                    ? (isBn ? 'লোড হচ্ছে...' : 'Restoring...')
                    : (isBn ? 'Firebase থেকে রিস্টোর' : 'Restore from Firebase')}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowFbDetails(!showFbDetails)}
                className="text-[11px] text-stone-600 hover:text-stone-900 underline font-medium cursor-pointer"
              >
                {showFbDetails ? (isBn ? 'কনফিগ লুকান' : 'Hide details') : (isBn ? 'Firebase কনফিগারেশন দেখুন' : 'View Firebase config details')}
              </button>
            </div>

            {(() => {
              const profile = storageService.getUserProfile();
              const isSuper =
                Boolean(profile.isLoggedIn) &&
                profile.role !== 'Staff' &&
                (profile.isSuperAdmin ||
                  profile.role === 'Super Admin' ||
                  profile.role === 'super_admin' ||
                  (profile.email && profile.email.toLowerCase() === 'uddinfahad89@gmail.com'));

              if (isSuper && onOpenSuperAdmin) {
                return (
                  <div className="pt-2 border-t border-amber-200/80">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSuperAdmin();
                      }}
                      className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-stone-900 hover:from-purple-800 hover:to-stone-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-between shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-300" />
                        <span>{isBn ? '👑 সুপার এডমিন কন্ট্রোল ও ডাটা রিকভারি প্যানেল' : '👑 Super Admin & Data Recovery Panel'}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full font-mono">
                        OPEN
                      </span>
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {fbTestMsg && (
              <p
                className={`text-[11px] font-bold p-2 rounded-lg ${
                  fbTestMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fbTestMsg.text}
              </p>
            )}

            {fbSyncMsg && (
              <p
                className={`text-[11px] font-bold p-2 rounded-lg ${
                  fbSyncMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fbSyncMsg.text}
              </p>
            )}

            {fbRestoreMsg && (
              <p
                className={`text-[11px] font-bold p-2 rounded-lg ${
                  fbRestoreMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {fbRestoreMsg.text}
              </p>
            )}

            {showFbDetails && (
              <div className="p-2.5 bg-stone-900 text-stone-200 rounded-xl font-mono text-[10px] space-y-1">
                <div>authDomain: {firebaseConfig.authDomain}</div>
                <div>storageBucket: {firebaseConfig.storageBucket}</div>
                <div>appId: {firebaseConfig.appId}</div>
                <div className="text-amber-400 font-sans font-bold pt-1">
                  ✓ Barcode Table (Collection 'barcodes') is synced with Firestore
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Save Footer */}
        <div className="p-3 sm:p-4 border-t border-stone-200 bg-stone-50/95 flex items-center gap-2 justify-end shrink-0 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-medium cursor-pointer text-xs"
          >
            {isBn ? 'বাতিল' : 'Cancel'}
          </button>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer text-xs sm:text-sm"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span className="whitespace-nowrap">{saved ? (isBn ? 'সংরক্ষিত!' : 'Saved!') : t.saveSettingsBtn}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
);
};
