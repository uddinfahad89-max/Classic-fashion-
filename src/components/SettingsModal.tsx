import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Check, Bluetooth, Power, Trash2, FileText, CheckCircle2, Zap, HelpCircle } from 'lucide-react';
import { ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { translations } from '../utils/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  onSaveSettings: (settings: ThermalPrinterSettings) => void;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: () => void;
  onDisconnectBluetooth?: (forget?: boolean) => void;
  onTestPrint?: () => void;
  onOpenBluetoothHelp?: () => void;
  language?: Language;
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
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const [form, setForm] = useState<ThermalPrinterSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-stone-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
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
                    onClick={onConnectBluetooth}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>{isBn ? 'প্রিন্টার কানেক্ট করুন' : 'Connect / Pair Printer'}</span>
                  </button>

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
          <div>
            <label className="block text-stone-700 font-semibold mb-1">{t.storeNameLabel}</label>
            <input
              type="text"
              required
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              placeholder={t.storeNamePlaceholder}
              className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500"
            />
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
              <input
                type="text"
                value={form.currencySymbol}
                onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                placeholder="Rs or ₹"
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
              />
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
              <label className="block text-stone-700 font-semibold mb-1">{isBn ? 'UPI আইডি (ঐচ্ছিক)' : 'UPI ID (Optional)'}</label>
              <input
                type="text"
                value={form.upiId || ''}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                placeholder="example@upi"
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 font-semibold mb-1">{t.storeAddressLabel}</label>
            <input
              type="text"
              value={form.storeAddress}
              onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
              placeholder={t.storeAddressPlaceholder}
              className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Invoice Number Formatting & Sequence */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
            <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ইনভয়েস নম্বর ও সিরিয়াল সেটিংস' : 'Invoice Numbering & Sequence'}</span>
              </span>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono font-bold">
                {(form.invoicePrefix || 'INV-') + (form.nextInvoiceNumber || 1001)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                  {isBn ? 'ইনভয়েস প্রিফিক্স' : 'Prefix'}
                </label>
                <input
                  type="text"
                  value={form.invoicePrefix ?? 'INV-'}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                  placeholder="e.g. INV-, BILL-"
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
                  value={form.nextInvoiceNumber ?? 1001}
                  onChange={(e) => setForm({ ...form, nextInvoiceNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  placeholder="1001"
                  className="w-full border border-stone-200 bg-white p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-400 leading-tight">
              {isBn
                ? 'প্রতিটি নতুন বিলে এই ক্রম অনুযায়ী সঠিক ইনভয়েস নম্বর স্বয়ংক্রিয়ভাবে তৈরি হবে।'
                : 'Every new invoice will automatically follow this exact sequence without errors.'}
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

          <div>
            <label className="block text-stone-700 font-semibold mb-1">{isBn ? 'রসিদের ফুটার বার্তা' : 'Receipt Footer Note'}</label>
            <input
              type="text"
              value={form.footerNote}
              onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
              className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-medium cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? (isBn ? 'সংরক্ষিত!' : 'Saved!') : t.saveSettingsBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
