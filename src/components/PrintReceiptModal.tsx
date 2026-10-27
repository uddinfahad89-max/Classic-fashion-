import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Tag,
  FileText,
  MoreVertical,
  Receipt,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { exportElementAsPdf, exportElementAsImage } from '../utils/exportInvoice';
import { TaxInvoiceSheet } from './TaxInvoiceSheet';
import { ProductLabelSheet } from './ProductLabelSheet';
import { sendWhatsAppBillForInvoice } from '../utils/whatsappHelper';

interface PrintReceiptModalProps {
  bill: BillInvoice | null;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: () => void;
  onUpdatePaperWidth?: (width: '58mm' | '80mm') => void;
  onToggleLabelMode?: (isLabelMode: boolean) => void;
  onToggleTotalOnlySlip?: (isTotalOnly: boolean) => void;
  initialTotalOnlySlip?: boolean;
  onEditBill?: (bill: BillInvoice) => void;
  onDeleteBill?: (id: string) => void;
  language?: Language;
  autoPrint?: boolean;
  onAutoPrintComplete?: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  bill,
  onClose,
  settings,
  bluetoothStatus,
  onConnectBluetooth,
  onUpdatePaperWidth,
  onToggleLabelMode,
  onToggleTotalOnlySlip,
  initialTotalOnlySlip,
  onEditBill,
  onDeleteBill,
  language = 'bn',
  autoPrint = false,
  onAutoPrintComplete,
}) => {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isLabelMode, setIsLabelMode] = useState<boolean>(Boolean(settings.isLabelMode));
  const [isTotalOnlySlip, setIsTotalOnlySlip] = useState<boolean>(
    Boolean(initialTotalOnlySlip !== undefined ? initialTotalOnlySlip : settings.isTotalOnlySlip)
  );

  useEffect(() => {
    setIsLabelMode(Boolean(settings.isLabelMode));
  }, [settings.isLabelMode]);

  useEffect(() => {
    if (initialTotalOnlySlip !== undefined) {
      setIsTotalOnlySlip(Boolean(initialTotalOnlySlip));
    } else {
      setIsTotalOnlySlip(false);
    }
  }, [bill?.id, initialTotalOnlySlip]);

  const effectiveSettings = useMemo(
    () => ({ ...settings, isLabelMode, isTotalOnlySlip }),
    [settings, isLabelMode, isTotalOnlySlip]
  );

  const handleToggleLabelMode = (enabled: boolean) => {
    setIsLabelMode(enabled);
    if (enabled) {
      setIsTotalOnlySlip(false);
    }
    if (onToggleLabelMode) {
      onToggleLabelMode(enabled);
    }
  };

  const handleToggleTotalOnlySlip = (enabled: boolean) => {
    setIsTotalOnlySlip(enabled);
    if (enabled) {
      setIsLabelMode(false);
    }
    if (onToggleTotalOnlySlip) {
      onToggleTotalOnlySlip(enabled);
    }
  };

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [bill?.id]);

  const [printScale, setPrintScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    try {
      const saved = localStorage.getItem('thermal_pos_print_scale');
      if (saved === 'normal' || saved === 'large' || saved === 'xlarge') return saved;
    } catch {}
    return 'large';
  });

  const handleSetPrintScale = (scale: 'normal' | 'large' | 'xlarge') => {
    setPrintScale(scale);
    try {
      localStorage.setItem('thermal_pos_print_scale', scale);
    } catch {}
  };

  const [estimateMode, setEstimateMode] = useState<boolean>(() =>
    bill
      ? bill.paymentMethod === 'estimate' ||
        bill.paymentStatus === 'ESTIMATE' ||
        Boolean(bill.isEstimate)
      : false
  );

  useEffect(() => {
    if (bill) {
      setEstimateMode(
        bill.paymentMethod === 'estimate' ||
          bill.paymentStatus === 'ESTIMATE' ||
          Boolean(bill.isEstimate)
      );
    }
  }, [bill]);

  useEffect(() => {
    if (autoPrint && bill) {
      const timer = setTimeout(() => {
        if (sheetRef.current) {
          thermalPrinterService.printTaxInvoiceElement(sheetRef.current, effectiveBill);
        }
        if (onAutoPrintComplete) {
          onAutoPrintComplete();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, bill]);

  if (!bill) return null;

  const effectiveBill: BillInvoice = {
    ...bill,
    isEstimate: estimateMode,
    paymentMethod: estimateMode ? 'estimate' : (bill.paymentMethod === 'estimate' ? 'cash' : bill.paymentMethod),
    paymentStatus: estimateMode ? 'ESTIMATE' : (bill.paymentStatus === 'ESTIMATE' ? 'PAID' : bill.paymentStatus),
    balance: estimateMode ? 0 : bill.balance,
    paidAmount: estimateMode ? 0 : bill.paidAmount,
  };

  const isEstimate = estimateMode;
  const formattedDateForFile = bill.date.replace(/[\/\s:]/g, '-');
  const prefix = isTotalOnlySlip
    ? 'TotalSlip'
    : isLabelMode
    ? 'Labels'
    : isEstimate
    ? 'EstimateBill'
    : bill.paymentMethod === 'upi'
    ? 'UPI_Bill'
    : bill.paymentMethod === 'due'
    ? 'Credit_Bill'
    : 'Cash_Memo';
  const pdfFilename = `${prefix}_${bill.invoiceNo}_${formattedDateForFile}.pdf`;
  const imageFilename = `${prefix}_${bill.invoiceNo}_${formattedDateForFile}.png`;

  // 1. Bluetooth Direct Thermal Print (Auto-connects if disconnected, then immediately prints)
  const handleBluetoothPrint = async () => {
    setIsPrintingBt(true);

    try {
      if (!bluetoothStatus?.connected || !thermalPrinterService.getIsConnected()) {
        setFeedbackMessage(
          language === 'bn'
            ? 'ব্লুটুথ থার্মাল প্রিন্টার খোঁজা হচ্ছে...'
            : 'Searching for Bluetooth Thermal Printer...'
        );
        const connectRes = await thermalPrinterService.connectBluetooth();
        if (!connectRes.success) {
          if (connectRes.isUnsupported && onConnectBluetooth) {
            onConnectBluetooth();
          } else if (connectRes.message && !connectRes.message.includes('cancelled')) {
            setFeedbackMessage(connectRes.message);
          } else {
            setFeedbackMessage(null);
          }
          setIsPrintingBt(false);
          return;
        }
      }

      setFeedbackMessage(
        language === 'bn'
          ? 'ব্লুটুথ থার্মাল প্রিন্টারে ডাটা পাঠানো হচ্ছে...'
          : 'Streaming data to Bluetooth Thermal Printer...'
      );

      const res = await thermalPrinterService.printViaBluetooth(effectiveBill, effectiveSettings);
      if (res.success) {
        setFeedbackMessage(
          language === 'bn'
            ? `✓ বিল #${bill.invoiceNo} ${isTotalOnlySlip ? '(টোটাল স্লিপ)' : isLabelMode ? '(লেবেল মোড)' : ''} ব্লুটুথ থার্মাল প্রিন্টারে প্রিন্ট হয়েছে!`
            : `✓ Invoice #${bill.invoiceNo} ${isTotalOnlySlip ? '(Total Slip)' : isLabelMode ? '(Label Mode)' : ''} printed directly via Bluetooth!`
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
      const res = await thermalPrinterService.printTestReceipt(effectiveSettings);
      setFeedbackMessage(res.message);
    } finally {
      setIsPrintingBt(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // 3. Android RawBT App Print Fallback
  const handleRawBtPrint = () => {
    thermalPrinterService.printViaRawBT(effectiveBill, effectiveSettings);
  };

  // 4. Standard Print for Tax Invoice
  const handlePrintTaxInvoice = () => {
    if (!sheetRef.current) return;
    thermalPrinterService.printTaxInvoiceElement(sheetRef.current, effectiveBill);
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
    if (isLabelMode) {
      const currency = settings.currencySymbol || '₹';
      const itemsList = bill.items
        .map((it, idx) => {
          const bcode = it.barcode || `${bill.invoiceNo || 'INV'}-${idx + 1}`;
          return `🏷️ *${it.name.toUpperCase()}*\nBarcode: ${bcode}\nPrice: ${currency}${it.price.toFixed(2)}`;
        })
        .join('\n\n');
      const message = `*PRODUCT LABELS / PRICE TAGS*\n\n${itemsList}`;
      const phone = bill.customerPhone?.replace(/[^0-9]/g, '') || '';
      const formattedPhone = phone ? (phone.length === 10 ? '91' + phone : phone) : '';
      const whatsappUrl = formattedPhone
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    sendWhatsAppBillForInvoice(bill, effectiveSettings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-stone-100 sm:rounded-2xl shadow-2xl border-0 sm:border border-stone-300 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col h-full sm:h-auto sm:max-h-[96vh]">
        {/* 1. Modal Top Bar - Clean: Connect & Print option and Close button only */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-stone-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            id="modal-bt-print-btn"
            onClick={handleBluetoothPrint}
            disabled={isPrintingBt}
            className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-[0.98] ${
              bluetoothStatus?.connected
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
            title="Bluetooth Thermal Print"
          >
            {isPrintingBt ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Bluetooth className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate font-extrabold tracking-tight">
              {bluetoothStatus?.connected
                ? language === 'bn'
                  ? '⚡ ব্লুটুথ প্রিন্ট (Bluetooth Print)'
                  : '⚡ Bluetooth Print'
                : language === 'bn'
                ? '⚡ কানেক্ট ও প্রিন্ট (Connect & Print)'
                : '⚡ Connect & Print'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
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

        {/* 3. Document Preview Area: Tax Invoice vs Product Labels */}
        <div ref={scrollContainerRef} className="p-1 sm:p-5 overflow-x-auto overflow-y-auto flex-1 bg-stone-200/70 flex flex-col items-center">
          <div ref={sheetRef} className="w-full max-w-full sm:max-w-[760px] mx-auto flex flex-col items-stretch">
            {isLabelMode ? (
              <ProductLabelSheet
                bill={bill}
                settings={effectiveSettings}
                language={language}
              />
            ) : (
              <TaxInvoiceSheet
                bill={effectiveBill}
                settings={effectiveSettings}
                isTotalOnlySlip={isTotalOnlySlip}
                language={language}
                printScale={printScale}
              />
            )}
          </div>
        </div>

        {/* 4. Bottom Footer Bar: WhatsApp Bill, Edit & Delete */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-stone-200 flex items-center justify-center gap-2 sm:gap-3 text-xs flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex-1 max-w-[200px] py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa51] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            title={language === 'bn' ? 'হোয়াটসঅ্যাপে বিল পাঠান' : 'Send WhatsApp Bill'}
          >
            <Share2 className="w-4 h-4 text-white shrink-0" />
            <span className="whitespace-nowrap">{language === 'bn' ? 'WhatsApp বিল' : 'WhatsApp Bill'}</span>
          </button>

          {onEditBill && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditBill(bill);
              }}
              className="flex-1 max-w-[170px] py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title={language === 'bn' ? 'ইনভয়েস এডিট করুন' : 'Edit Invoice'}
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{language === 'bn' ? 'এডিট (Edit)' : 'Edit'}</span>
            </button>
          )}

          {onDeleteBill ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 max-w-[170px] py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title={language === 'bn' ? 'ইনভয়েস মুছুন' : 'Delete Invoice'}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{language === 'bn' ? 'ডিলিট (Delete)' : 'Delete'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
