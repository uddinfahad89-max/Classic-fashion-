import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Share2,
  FileCheck,
  Bluetooth,
  RefreshCw,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { exportElementAsPdf, exportElementAsImage } from '../utils/exportInvoice';
import { TaxInvoiceSheet } from './TaxInvoiceSheet';

interface PrintReceiptModalProps {
  bill: BillInvoice | null;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: () => void;
  onUpdatePaperWidth?: (width: '58mm' | '80mm') => void;
  onEditBill?: (bill: BillInvoice) => void;
  onDeleteBill?: (id: string) => void;
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
  onDeleteBill,
  language = 'bn',
}) => {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  if (!bill) return null;

  const formattedDateForFile = bill.date.replace(/[\/\s:]/g, '-');
  const pdfFilename = `Sale_${bill.invoiceNo}_${formattedDateForFile}.pdf`;
  const imageFilename = `Sale_${bill.invoiceNo}_${formattedDateForFile}.png`;

  // 1. Bluetooth Direct Thermal Print
  const handleBluetoothPrint = async () => {
    if (!bluetoothStatus?.connected || !thermalPrinterService.getIsConnected()) {
      if (onConnectBluetooth) {
        onConnectBluetooth();
      }
      return;
    }

    setIsPrintingBt(true);
    setFeedbackMessage(
      language === 'bn'
        ? 'ব্লুটুথ প্রিন্টারে ডাটা পাঠানো হচ্ছে...'
        : 'Streaming data to Bluetooth printer...'
    );

    try {
      const res = await thermalPrinterService.printViaBluetooth(bill, settings);
      if (res.success) {
        setFeedbackMessage(
          language === 'bn'
            ? `✓ বিল #${bill.invoiceNo} ব্লুটুথ প্রিন্টারে সফলভাবে প্রিন্ট হয়েছে!`
            : `✓ Invoice #${bill.invoiceNo} printed directly via Bluetooth!`
        );
      } else {
        setFeedbackMessage(
          language === 'bn'
            ? `ব্লুটুথ প্রিন্ট ব্যর্থ: ${res.message}`
            : `Bluetooth print failed: ${res.message}`
        );
      }
    } catch (e: any) {
      setFeedbackMessage(e?.message || 'Bluetooth printing error');
    } finally {
      setIsPrintingBt(false);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  // 2. Test Print Slip
  const handleTestPrint = async () => {
    setIsPrintingBt(true);
    try {
      const res = await thermalPrinterService.printTestReceipt(settings);
      setFeedbackMessage(res.message);
    } finally {
      setIsPrintingBt(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // 3. Android RawBT App Print Fallback
  const handleRawBtPrint = () => {
    thermalPrinterService.printViaRawBT(bill, settings);
  };

  // 4. Standard Print for Tax Invoice
  const handlePrintTaxInvoice = () => {
    if (!sheetRef.current) return;
    thermalPrinterService.printTaxInvoiceElement(sheetRef.current, bill);
  };

  // 5. Direct PDF Save
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

  // 6. Direct Image Save (PNG)
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

  // 7. WhatsApp Share
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-stone-100 sm:rounded-2xl shadow-2xl border-0 sm:border border-stone-300 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col h-full sm:h-auto sm:max-h-[96vh]">
        {/* 1. Modal Top Bar */}
        <div className="p-3 sm:p-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#8C8EE8]/15 flex items-center justify-center text-[#8C8EE8]">
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
                title={language === 'bn' ? 'ইনভয়েস এডিট করুন' : 'Edit Invoice'}
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">{language === 'bn' ? 'এডিট' : 'Edit'}</span>
              </button>
            )}

            {onDeleteBill && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title={language === 'bn' ? 'ইনভয়েস মুছুন' : 'Delete Invoice'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">{language === 'bn' ? 'মুছুন' : 'Delete'}</span>
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

        {/* Bluetooth Thermal POS Banner & Quick Print */}
        <div
          className={`p-2.5 sm:p-3 border-b flex flex-wrap items-center justify-between gap-2.5 transition-colors ${
            bluetoothStatus?.connected
              ? 'bg-emerald-50/90 border-emerald-200'
              : 'bg-indigo-50/70 border-indigo-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                bluetoothStatus?.connected
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-indigo-600 text-white shadow-xs'
              }`}
            >
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900">
                  {bluetoothStatus?.connected
                    ? (language === 'bn' ? 'ব্লুটুথ থার্মাল প্রিন্টার' : 'Bluetooth Thermal Printer')
                    : (language === 'bn' ? 'ব্লুটুথ প্রিন্টার কানেক্ট নেই' : 'Bluetooth Printer Disconnected')}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    bluetoothStatus?.connected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      bluetoothStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                    }`}
                  />
                  {bluetoothStatus?.connected
                    ? (bluetoothStatus.deviceName || 'Connected')
                    : (language === 'bn' ? 'অফলাইন' : 'Offline')}
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                {bluetoothStatus?.connected
                  ? (language === 'bn'
                      ? 'এক ক্লিকে সরাসরি ছোট স্লিপ প্রিন্ট হবে'
                      : 'Ready for direct silent thermal slip printing')
                  : (language === 'bn'
                      ? 'ক্যাশ মেমো প্রিন্ট করতে প্রিন্টার পেয়ার করুন'
                      : 'Pair your 58mm/80mm thermal POS printer')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {bluetoothStatus?.connected ? (
              <>
                <button
                  type="button"
                  id="modal-bt-print-btn"
                  onClick={handleBluetoothPrint}
                  disabled={isPrintingBt}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                  title="Direct Bluetooth Thermal Print"
                >
                  {isPrintingBt ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>{language === 'bn' ? 'ব্লুটুথ স্লিপ প্রিন্ট' : 'Bluetooth Print'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isPrintingBt}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Print Test Slip"
                >
                  <span>{language === 'bn' ? 'টেস্ট' : 'Test'}</span>
                </button>
              </>
            ) : (
              <>
                {onConnectBluetooth && (
                  <button
                    type="button"
                    id="modal-bt-connect-btn"
                    onClick={onConnectBluetooth}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>{language === 'bn' ? 'প্রিন্টার কানেক্ট করুন' : 'Connect Printer'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRawBtPrint}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="RawBT Print via Android App"
                >
                  <Smartphone className="w-3.5 h-3.5 text-stone-600" />
                  <span>RawBT</span>
                </button>
              </>
            )}

            {onUpdatePaperWidth && (
              <div className="flex items-center bg-white rounded-xl border border-stone-200 p-0.5 text-[11px] font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => onUpdatePaperWidth('58mm')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    settings.paperWidth === '58mm'
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                  title="2-inch Roll (58mm)"
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => onUpdatePaperWidth('80mm')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    settings.paperWidth === '80mm'
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                  title="3-inch Roll (80mm)"
                >
                  80mm
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Clean Action Toolbar (Print, Save PDF, Image, WhatsApp, Edit, Delete) */}
        <div className="p-2.5 sm:p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#8C8EE8]"></span>
            <span>{language === 'bn' ? 'ইনভয়েস অ্যাকশন' : 'Invoice Actions'}:</span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. PRINT BUTTON */}
            <button
              type="button"
              onClick={handlePrintTaxInvoice}
              className="px-3.5 py-1.5 rounded-xl bg-[#8C8EE8] hover:bg-[#787AD8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
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

            {/* 5. EDIT BUTTON */}
            {onEditBill && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditBill(bill);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title={language === 'bn' ? 'ইনভয়েস এডিট করুন' : 'Edit Bill'}
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'bn' ? 'এডিট' : 'Edit'}</span>
              </button>
            )}

            {/* 6. DELETE BUTTON */}
            {onDeleteBill && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title={language === 'bn' ? 'ইনভয়েস মুছুন' : 'Delete Bill'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{language === 'bn' ? 'মুছুন' : 'Delete'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal inside PrintReceiptModal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-stone-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">
                  {language === 'bn' ? 'ইনভয়েস মুছে ফেলতে চান?' : 'Delete this Invoice?'}
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  #{bill.invoiceNo} • {settings.currencySymbol || '₹'}{(bill.grandTotal || 0).toFixed(2)}
                </p>
                {bill.customerName && (
                  <p className="text-xs text-stone-600 font-medium">
                    {bill.customerName}
                  </p>
                )}
                <p className="text-[11px] text-rose-600 pt-1">
                  {language === 'bn'
                    ? 'স্থায়ীভাবে এই ইনভয়েস মুছে যাবে।'
                    : 'This invoice will be permanently removed.'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (onDeleteBill) {
                      onDeleteBill(bill.id);
                    }
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
                >
                  {language === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Alert if saving or printing */}
        {feedbackMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-emerald-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span>{feedbackMessage}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. Document Preview Area: Tax Invoice */}
        <div className="p-2 sm:p-6 overflow-x-auto overflow-y-auto flex-1 bg-stone-200/70 flex justify-center">
          <div ref={sheetRef} className="w-full flex justify-center">
            <TaxInvoiceSheet bill={bill} settings={settings} />
          </div>
        </div>

        {/* 4. Bottom Footer Bar: Clean status & close */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-stone-200 flex items-center justify-between text-xs">
          <span className="text-stone-500 text-[11px] font-medium">
            {language === 'bn' ? '✓ স্ট্যান্ডার্ড ট্যাক্স ইনভয়েস ফরম্যাট' : '✓ Standard Tax Invoice Format'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
