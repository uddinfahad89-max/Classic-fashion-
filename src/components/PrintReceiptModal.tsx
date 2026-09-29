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
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { exportElementAsPdf, exportElementAsImage } from '../utils/exportInvoice';
import { TaxInvoiceSheet } from './TaxInvoiceSheet';
import { ProductLabelSheet } from './ProductLabelSheet';

interface PrintReceiptModalProps {
  bill: BillInvoice | null;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  bluetoothStatus?: BluetoothDeviceInfo;
  onConnectBluetooth?: () => void;
  onUpdatePaperWidth?: (width: '58mm' | '80mm') => void;
  onToggleLabelMode?: (isLabelMode: boolean) => void;
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
  onToggleLabelMode,
  onEditBill,
  onDeleteBill,
  language = 'bn',
}) => {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isLabelMode, setIsLabelMode] = useState<boolean>(Boolean(settings.isLabelMode));

  useEffect(() => {
    setIsLabelMode(Boolean(settings.isLabelMode));
  }, [settings.isLabelMode]);

  const effectiveSettings = useMemo(
    () => ({ ...settings, isLabelMode }),
    [settings, isLabelMode]
  );

  const handleToggleLabelMode = (enabled: boolean) => {
    setIsLabelMode(enabled);
    if (onToggleLabelMode) {
      onToggleLabelMode(enabled);
    }
  };

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
      const res = await thermalPrinterService.printViaBluetooth(bill, effectiveSettings);
      if (res.success) {
        setFeedbackMessage(
          language === 'bn'
            ? `✓ বিল #${bill.invoiceNo} ${isLabelMode ? '(লেবেল মোড)' : ''} ব্লুটুথ প্রিন্টারে প্রিন্ট হয়েছে!`
            : `✓ Invoice #${bill.invoiceNo} ${isLabelMode ? '(Label Mode)' : ''} printed directly via Bluetooth!`
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
    thermalPrinterService.printViaRawBT(bill, effectiveSettings);
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
    let message = '';

    if (isLabelMode) {
      const itemsList = bill.items
        .map((it, idx) => {
          const bcode = it.barcode || `${bill.invoiceNo || 'INV'}-${idx + 1}`;
          return `🏷️ *${it.name.toUpperCase()}*\nBarcode: ${bcode}\nPrice: ${currency}${it.price.toFixed(2)}`;
        })
        .join('\n\n');
      message = `*PRODUCT LABELS / PRICE TAGS*\n\n${itemsList}`;
    } else {
      const store = settings.storeName || 'CLASSIC FASHION';
      const itemsList = bill.items
        .map(
          (it, idx) =>
            `${idx + 1}. ${it.name} (${it.qty}${it.unit ? ' ' + it.unit : 'x'}) = ${currency}${it.total}`
        )
        .join('\n');

      const isTailoring = Boolean(bill.isTailoring);
      const headerLine = isTailoring
        ? `*✂️ ${store} - Tailoring Order #${bill.invoiceNo}*\n`
        : `*${store} - Tax Invoice #${bill.invoiceNo}*\n`;

      let tailoringMeta = '';
      if (isTailoring) {
        if (bill.deliveryDate) {
          tailoringMeta += `Delivery Date: ${bill.deliveryDate}\n`;
        }
        if (bill.tailoringStatus) {
          tailoringMeta += `Status: ${
            bill.tailoringStatus === 'ready'
              ? 'Ready for Delivery'
              : bill.tailoringStatus === 'delivered'
              ? 'Delivered'
              : 'Stitching / Pending'
          }\n`;
        }
        if (bill.measurements) {
          const m = bill.measurements;
          const mParts: string[] = [];
          if (m.garmentType) mParts.push(`Garment: ${m.garmentType}`);
          if (m.length) mParts.push(`L:${m.length}`);
          if (m.chest) mParts.push(`Ch:${m.chest}`);
          if (m.waist) mParts.push(`W:${m.waist}`);
          if (m.shoulder) mParts.push(`Sh:${m.shoulder}`);
          if (m.sleeve) mParts.push(`Sl:${m.sleeve}`);
          if (m.neck) mParts.push(`Nk:${m.neck}`);
          if (m.hip) mParts.push(`Hp:${m.hip}`);
          if (m.bottom) mParts.push(`Bt:${m.bottom}`);
          if (mParts.length > 0) {
            tailoringMeta += `*Measurements:* ${mParts.join(' | ')}\n`;
          }
          if (m.designNotes) {
            tailoringMeta += `*Note:* ${m.designNotes}\n`;
          }
        }
      }

      message =
        headerLine +
        `Date: ${bill.date}\n` +
        `Customer: ${bill.customerName || 'Customer'}\n` +
        (tailoringMeta ? `${tailoringMeta}\n` : '\n') +
        `*Items:*\n${itemsList}\n\n` +
        `*Total Amount:* ${currency}${bill.grandTotal}\n` +
        `*${isTailoring ? 'Advance Paid' : 'Paid'}:* ${currency}${bill.paidAmount || 0}\n` +
        `*${isTailoring ? 'Balance Due' : 'Balance'}:* ${currency}${
          bill.balance !== undefined ? bill.balance : bill.grandTotal - (bill.paidAmount || 0)
        }\n\n` +
        `Thank you for choosing us!`;
    }

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

            {/* 3-Dot More Options Menu (Contains hidden Print, PDF, Image, WhatsApp, Label Mode, RawBT, 58mm/80mm) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className={`p-1.5 rounded-xl border text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
                  showMoreMenu
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                }`}
                title={language === 'bn' ? 'আরও অপশন' : 'More Options'}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handlePrintTaxInvoice();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#8C8EE8]" />
                      <span>{language === 'bn' ? 'প্রিন্ট করুন (Print)' : 'Print Document'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleSavePdf();
                      }}
                      disabled={isSavingPdf}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'bn' ? 'পিডিএফ সেভ (Save PDF)' : 'Save PDF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleSaveImage();
                      }}
                      disabled={isSavingImage}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-stone-700" />
                      <span>{language === 'bn' ? 'ছবি সেভ (Save Image)' : 'Save Image'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleWhatsAppShare();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>WhatsApp Share</span>
                    </button>

                    <div className="border-t border-stone-100 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleRawBtPrint();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-stone-600" />
                      <span>RawBT App Print</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleToggleLabelMode(!isLabelMode);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span>{language === 'bn' ? 'লেবেল মোড (Label Mode)' : 'Label Mode'}</span>
                      </span>
                      {isLabelMode && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                    </button>

                    {onUpdatePaperWidth && (
                      <div className="px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-500">Paper Roll:</span>
                        <div className="flex items-center bg-stone-100 rounded-lg p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => onUpdatePaperWidth('58mm')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              settings.paperWidth === '58mm'
                                ? 'bg-stone-800 text-white'
                                : 'text-stone-600'
                            }`}
                          >
                            58mm
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePaperWidth('80mm')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              settings.paperWidth === '80mm'
                                ? 'bg-stone-800 text-white'
                                : 'text-stone-600'
                            }`}
                          >
                            80mm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

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
            ) : (
              onConnectBluetooth && (
                <button
                  type="button"
                  id="modal-bt-connect-btn"
                  onClick={onConnectBluetooth}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>{language === 'bn' ? 'প্রিন্টার কানেক্ট করুন' : 'Connect Printer'}</span>
                </button>
              )
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

        {/* 3. Document Preview Area: Tax Invoice vs Product Labels */}
        <div className="p-2 sm:p-6 overflow-x-auto overflow-y-auto flex-1 bg-stone-200/70 flex justify-center">
          <div ref={sheetRef} className="w-full flex justify-center">
            {isLabelMode ? (
              <ProductLabelSheet
                bill={bill}
                settings={effectiveSettings}
                language={language}
              />
            ) : (
              <TaxInvoiceSheet bill={bill} settings={effectiveSettings} />
            )}
          </div>
        </div>

        {/* 4. Bottom Footer Bar: Clean status & close */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-stone-200 flex items-center justify-between text-xs">
          <span className="text-stone-500 text-[11px] font-medium flex items-center gap-1.5">
            {isLabelMode ? (
              <>
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {language === 'bn'
                    ? 'লেবেল মোড: হেডার/ফুটার ছাড়া শুধু পণ্যের নাম, বারকোড ও মূল্য প্রিন্ট হবে'
                    : 'Label Mode: Header/footer removed; product name, barcode & price only'}
                </span>
              </>
            ) : (
              <span>
                {language === 'bn' ? '✓ স্ট্যান্ডার্ড ট্যাক্স ইনভয়েস ফরম্যাট' : '✓ Standard Tax Invoice Format'}
              </span>
            )}
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
