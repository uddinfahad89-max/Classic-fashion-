import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Check, Bluetooth, Power, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { ThermalPrinterSettings, BluetoothDeviceInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  onSaveSettings: (settings: ThermalPrinterSettings) => void;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: () => void;
  onDisconnectBluetooth?: (forget?: boolean) => void;
  onTestPrint?: () => void;
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
}) => {
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
            <h3 className="font-bold text-sm text-stone-900">Store & Thermal POS Settings</h3>
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
                <span>Bluetooth Thermal Printer</span>
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
                  ? 'Connected'
                  : bluetoothStatus?.isConnecting
                  ? 'Connecting...'
                  : 'Disconnected'}
              </span>
            </div>

            <div className="text-[11px] text-stone-500">
              {bluetoothStatus?.savedPrinter ? (
                <p>
                  Remembered Device:{' '}
                  <span className="font-semibold text-stone-800">
                    {bluetoothStatus.savedPrinter.name}
                  </span>{' '}
                  (Auto-reconnects on print)
                </p>
              ) : (
                <p>No printer remembered yet. Pair once to enable persistent auto-reconnect.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {!bluetoothStatus?.connected ? (
                <button
                  type="button"
                  onClick={onConnectBluetooth}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>Connect / Pair Printer</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onTestPrint}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Test Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnectBluetooth?.(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Power className="w-3.5 h-3.5 text-stone-500" />
                    <span>Disconnect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnectBluetooth?.(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Forget</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-stone-700 font-semibold mb-1">Store / Shop Name</label>
            <input
              type="text"
              required
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={form.storePhone}
                onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Currency Symbol</label>
              <input
                type="text"
                value={form.currencySymbol}
                onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                placeholder="₹ or $"
                className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 font-semibold mb-1">Store Address</label>
            <input
              type="text"
              value={form.storeAddress}
              onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
              className="w-full border border-stone-200 bg-stone-50/80 p-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-stone-700 font-semibold mb-1">Thermal Paper Roll</label>
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

          <div>
            <label className="block text-stone-700 font-semibold mb-1">Receipt Footer Note</label>
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
              className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
