import React, { useState } from 'react';
import { Printer, Download, X, CheckCircle, Smartphone } from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';

interface PrintReceiptModalProps {
  bill: BillInvoice | null;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  onConnectBluetooth: () => void;
  onUpdatePaperWidth: (width: '58mm' | '80mm') => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  bill,
  onClose,
  settings,
  bluetoothStatus,
  onConnectBluetooth,
  onUpdatePaperWidth,
}) => {
  const [printSuccess, setPrintSuccess] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!bill) return null;

  const receiptText = thermalPrinterService.generateReceiptText(bill, settings);

  const handlePrint = async () => {
    setIsPrinting(true);
    const res = await thermalPrinterService.printViaBluetooth(bill, settings);
    setIsPrinting(false);

    if (res.success) {
      setPrintSuccess(true);
      setTimeout(() => {
        setPrintSuccess(false);
        onClose();
      }, 1500);
    } else {
      // If Bluetooth fails or is not connected, fall back to native browser print
      thermalPrinterService.printViaBrowser(bill, settings);
    }
  };

  const handleBrowserPrint = () => {
    thermalPrinterService.printViaBrowser(bill, settings);
  };

  const handleRawBtPrint = () => {
    thermalPrinterService.printViaRawBT(bill, settings);
  };

  const handleDownloadEscPos = () => {
    const bytes = thermalPrinterService.generateEscPosCommands(bill, settings);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${bill.invoiceNo}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-sm text-stone-900">Thermal Receipt Preview</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper format selector */}
        <div className="p-3 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between text-xs">
          <span className="font-medium text-stone-600">Roll Width:</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onUpdatePaperWidth('58mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                settings.paperWidth === '58mm'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              58mm (2-inch)
            </button>
            <button
              onClick={() => onUpdatePaperWidth('80mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                settings.paperWidth === '80mm'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              80mm (3-inch)
            </button>
          </div>
        </div>

        {/* Thermal Paper Monospaced Canvas */}
        <div className="p-4 bg-stone-200/60 max-h-[380px] overflow-y-auto flex justify-center">
          <div
            className={`bg-[#fffef9] shadow-md border-t-4 border-stone-400 p-4 font-mono text-[11px] leading-tight text-stone-900 select-all whitespace-pre rounded-sm transition-all ${
              settings.paperWidth === '80mm' ? 'w-[320px]' : 'w-[250px]'
            }`}
          >
            {receiptText}
          </div>
        </div>

        {/* Modal Footer & Print Controls */}
        <div className="p-4 bg-white border-t border-stone-200 space-y-2">
          {printSuccess && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
              <CheckCircle className="w-4 h-4" />
              <span>Print command sent to thermal printer!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPrinting ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                  <span>Streaming to BLE...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>
                    {bluetoothStatus.connected
                      ? `Print (${bluetoothStatus.deviceName ? bluetoothStatus.deviceName.slice(0, 10) : 'BLE'})`
                      : 'Print Bill'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={handleBrowserPrint}
              className="py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Browser print dialog formatted for 58mm / 80mm thermal paper"
            >
              <span>Browser Print</span>
            </button>
          </div>

          {/* Android RawBT 1-Tap Intent Print */}
          <button
            onClick={handleRawBtPrint}
            className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            title="Sends raw ESC/POS commands directly to the RawBT Android app via intent scheme"
          >
            <Smartphone className="w-4 h-4 text-amber-700" />
            <span>Print via RawBT (Android 1-Tap)</span>
          </button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              onClick={handleDownloadEscPos}
              className="text-stone-500 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Raw ESC/POS</span>
            </button>

            <button
              onClick={onConnectBluetooth}
              className="text-stone-700 hover:text-blue-700 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  bluetoothStatus.connected
                    ? 'bg-emerald-500'
                    : bluetoothStatus.isConnecting
                    ? 'bg-amber-500 animate-pulse'
                    : bluetoothStatus.savedPrinter
                    ? 'bg-rose-500'
                    : 'bg-stone-400'
                }`}
              />
              <span className="text-[11px]">
                {bluetoothStatus.connected
                  ? bluetoothStatus.deviceName || 'Thermal Ready'
                  : bluetoothStatus.isConnecting
                  ? 'Reconnecting...'
                  : bluetoothStatus.savedPrinter
                  ? `${bluetoothStatus.savedPrinter.name} (Auto-reconnect)`
                  : 'Pair Bluetooth'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
