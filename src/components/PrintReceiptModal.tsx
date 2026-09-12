import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  Edit2,
  Image as ImageIcon,
  Share2,
  FileCheck,
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
  language?: Language;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  bill,
  onClose,
  settings,
  onEditBill,
  language = 'bn',
}) => {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

        {/* 2. Clean Action Toolbar (Print, Save PDF, Image, WhatsApp) */}
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
