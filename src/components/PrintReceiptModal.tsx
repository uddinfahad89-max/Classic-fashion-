import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle,
  Smartphone,
  Edit2,
  FileText,
  Image as ImageIcon,
  Share2,
  Receipt,
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { exportElementAsPdf, exportElementAsImage } from '../utils/exportInvoice';
import { TaxInvoiceSheet } from './TaxInvoiceSheet';

interface PrintReceiptModalProps {
  bill: BillInvoice | null;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  bluetoothStatus: BluetoothDeviceInfo;
  onConnectBluetooth: () => void;
  onUpdatePaperWidth: (width: '58mm' | '80mm') => void;
  onEditBill?: (bill: BillInvoice) => void;
  language?: Language;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  bill,
  onClose,
  settings,
  bluetoothStatus,
  onConnectBluetooth,
  onUpdatePaperWidth,
  onEditBill,
  language = 'bn',
}) => {
  const [activeFormat, setActiveFormat] = useState<'tax_invoice' | 'thermal'>('tax_invoice');
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPrintingThermal, setIsPrintingThermal] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  if (!bill) return null;

  const formattedDateForFile = bill.date.replace(/[\/\s:]/g, '-');
  const pdfFilename = `Sale_${bill.invoiceNo}_${formattedDateForFile}.pdf`;
  const imageFilename = `Sale_${bill.invoiceNo}_${formattedDateForFile}.png`;

  // 1. Standard Print for Tax Invoice
  const handlePrintTaxInvoice = () => {
    if (!sheetRef.current) return;
    thermalPrinterService.printTaxInvoiceElement(sheetRef.current, bill);
  };

  // 2. Direct PDF Save
  const handleSavePdf = async () => {
    if (!sheetRef.current) return;
    setIsSavingPdf(true);
    setFeedbackMessage(language === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating PDF...');

    try {
      const success = await exportElementAsPdf(sheetRef.current, pdfFilename);
      if (success) {
        setFeedbackMessage(
          language === 'bn'
            ? `✓ "${pdfFilename}" সফলভাবে সেভ হয়েছে!`
            : `✓ "${pdfFilename}" downloaded successfully!`
        );
      } else {
        setFeedbackMessage(
          language === 'bn' ? 'পিডিএফ তৈরি ব্যর্থ হয়েছে' : 'Failed to generate PDF'
        );
      }
    } catch {
      setFeedbackMessage(language === 'bn' ? 'ত্রুটি ঘটেছে' : 'Error occurred');
    } finally {
      setIsSavingPdf(false);
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  // 3. Direct Image Save (PNG)
  const handleSaveImage = async () => {
    if (!sheetRef.current) return;
    setIsSavingImage(true);
    setFeedbackMessage(language === 'bn' ? 'ছবি তৈরি হচ্ছে...' : 'Generating Image...');

    try {
      const success = await exportElementAsImage(sheetRef.current, imageFilename);
      if (success) {
        setFeedbackMessage(
          language === 'bn'
            ? `✓ "${imageFilename}" ছবি সেভ হয়েছে!`
            : `✓ "${imageFilename}" saved as Image!`
        );
      } else {
        setFeedbackMessage(
          language === 'bn' ? 'ছবি তৈরি ব্যর্থ হয়েছে' : 'Failed to save image'
        );
      }
    } catch {
      setFeedbackMessage(language === 'bn' ? 'ত্রুটি ঘটেছে' : 'Error occurred');
    } finally {
      setIsSavingImage(false);
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  // 4. WhatsApp Share
  const handleWhatsAppShare = () => {
    const currency = settings.currencySymbol || 'Rs';
    const store = settings.storeName || 'CLASSIC FASHION';
    const itemsList = bill.items
      .map((it, idx) => `${idx + 1}. ${it.name} (${it.qty}x) = ${currency}${it.total}`)
      .join('\n');

    const message = `*${store} - Tax Invoice #${bill.invoiceNo}*\n` +
      `Date: ${bill.date}\n` +
      `Customer: ${bill.customerName || 'Customer'}\n\n` +
      `*Items:*\n${itemsList}\n\n` +
      `*Total Amount:* ${currency}${bill.grandTotal}\n` +
      `*Paid:* ${currency}${bill.paidAmount || 0}\n` +
      `*Balance:* ${currency}${bill.balance !== undefined ? bill.balance : (bill.grandTotal - (bill.paidAmount || 0))}\n\n` +
      `Thank you for shopping with us!`;

    const phone = bill.customerPhone?.replace(/[^0-9]/g, '') || '';
    const whatsappUrl = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  // Thermal roll handlers
  const handlePrintThermal = async () => {
    setIsPrintingThermal(true);
    const res = await thermalPrinterService.printViaBluetooth(bill, settings);
    setIsPrintingThermal(false);

    if (res.success) {
      setFeedbackMessage(language === 'bn' ? '✓ প্রিন্টারে পাঠানো হয়েছে!' : '✓ Sent to printer!');
      setTimeout(() => setFeedbackMessage(null), 2500);
    } else {
      // Fallback to browser print dialog
      thermalPrinterService.printViaBrowser(bill, settings);
    }
  };

  const receiptText = thermalPrinterService.generateReceiptText(bill, settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-stone-100 rounded-2xl shadow-2xl border border-stone-300 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[96vh]">
        {/* 1. Modal Top Bar */}
        <div className="p-3 sm:p-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6E68D8]/10 flex items-center justify-center text-[#6E68D8]">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono font-bold text-xs sm:text-sm text-stone-900 flex items-center gap-2">
                <span>{pdfFilename}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  {bill.paymentStatus === 'PAID' ? 'PAID' : 'DUE / CREDIT'}
                </span>
              </div>
              <div className="text-[11px] text-stone-500 font-medium">
                {language === 'bn'
                  ? 'ক্লিয়ার ট্যাক্স ইনভয়েস ও প্রিন্ট/সেভ অপশন'
                  : 'Clear Tax Invoice with Print & Save options'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEditBill && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditBill(bill);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Edit Invoice"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">{language === 'bn' ? 'এডিট' : 'Edit'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Format Switcher & Action Toolbar */}
        <div className="p-2.5 sm:p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          {/* Format Tabs */}
          <div className="flex items-center bg-stone-200/80 p-1 rounded-xl gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveFormat('tax_invoice')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeFormat === 'tax_invoice'
                  ? 'bg-white text-[#6E68D8] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'ট্যাক্স ইনভয়েস (A4 Bill)' : 'Tax Invoice (A4 Bill)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormat('thermal')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeFormat === 'thermal'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'থার্মাল স্লিপ (POS Roll)' : 'Thermal Slip (POS Roll)'}</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. PRINT BUTTON */}
            <button
              type="button"
              onClick={activeFormat === 'tax_invoice' ? handlePrintTaxInvoice : handlePrintThermal}
              className="px-3.5 py-1.5 rounded-xl bg-[#6E68D8] hover:bg-[#5E58C8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              title="Print Document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'প্রিন্ট করুন' : 'Print'}</span>
            </button>

            {/* 2. SAVE PDF BUTTON */}
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              title="Download High-Res PDF"
            >
              {isSavingPdf ? (
                <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{language === 'bn' ? 'পিডিএফ সেভ' : 'Save PDF'}</span>
            </button>

            {/* 3. SAVE IMAGE BUTTON */}
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isSavingImage}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              title="Download PNG Image for gallery or sharing"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'bn' ? 'ছবি সেভ' : 'Image'}</span>
            </button>

            {/* 4. WHATSAPP SHARE */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              title="Share Bill via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert if saving or printing */}
        {feedbackMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-emerald-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span>{feedbackMessage}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. Document Preview Area */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-stone-200/70 flex justify-center">
          {activeFormat === 'tax_invoice' ? (
            /* Clear Tax Invoice Format (Exact layout from user screenshot) */
            <div ref={sheetRef} className="w-full flex justify-center">
              <TaxInvoiceSheet bill={bill} settings={settings} />
            </div>
          ) : (
            /* Thermal Monospaced Roll Format */
            <div className="flex flex-col items-center space-y-3">
              {/* Paper roll selector */}
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl shadow-2xs border border-stone-200 text-xs">
                <span className="text-stone-500 font-medium">Roll Width:</span>
                <button
                  type="button"
                  onClick={() => onUpdatePaperWidth('58mm')}
                  className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${
                    settings.paperWidth === '58mm'
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  58mm (2-inch)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdatePaperWidth('80mm')}
                  className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${
                    settings.paperWidth === '80mm'
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  80mm (3-inch)
                </button>
              </div>

              <div
                className={`bg-[#fffef9] shadow-md border-t-4 border-stone-400 p-4 font-mono text-[11px] leading-tight text-stone-900 select-all whitespace-pre rounded-sm transition-all ${
                  settings.paperWidth === '80mm' ? 'w-[320px]' : 'w-[250px]'
                }`}
              >
                {receiptText}
              </div>

              {/* Android RawBT Intent button */}
              <button
                type="button"
                onClick={() => thermalPrinterService.printViaRawBT(bill, settings)}
                className="py-2 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-amber-700" />
                <span>Print via RawBT (Android)</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Bottom Footer Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onConnectBluetooth}
              className="text-stone-700 hover:text-blue-700 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  bluetoothStatus.connected
                    ? 'bg-emerald-500'
                    : bluetoothStatus.isConnecting
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-stone-400'
                }`}
              />
              <span className="text-[11px]">
                {bluetoothStatus.connected
                  ? `Thermal Printer: ${bluetoothStatus.deviceName || 'Connected'}`
                  : 'Pair Bluetooth POS Printer'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'bn' ? 'পিডিএফ ডাউনলোড করুন' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintTaxInvoice}
              className="px-4 py-2 rounded-xl bg-[#6E68D8] hover:bg-[#5E58C8] text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'bn' ? 'প্রিন্ট করুন' : 'Print Bill'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
