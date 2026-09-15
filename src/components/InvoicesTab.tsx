import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Search,
  Calendar,
  Filter,
  Printer,
  Eye,
  Smartphone,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  Banknote,
  SmartphoneNfc,
  ChevronDown,
  ChevronUp,
  Edit2,
  Download,
  Share2,
  MessageCircle,
  X,
  PlusCircle,
  MoreVertical,
  Table,
  Clock,
  User,
  Users,
  Plus,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { translations } from '../utils/i18n';
import { EditInvoiceModal } from './EditInvoiceModal';
import { SortOption } from './Header';

interface InvoicesTabProps {
  bills: BillInvoice[];
  settings: ThermalPrinterSettings;
  language?: Language;
  onViewReceipt: (bill: BillInvoice) => void;
  onDeleteBill: (id: string) => void;
  onEditBill?: (bill: BillInvoice) => void;
  onUpdateBill?: (bill: BillInvoice) => void;
  onLoadIntoBilling?: (bill: BillInvoice) => void;
  externalSearchTerm?: string;
  viewMode?: 'grid' | 'list';
  sortOption?: SortOption;
  onNavigateToBilling?: () => void;
}

type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'week' | 'custom';

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  bills,
  settings,
  language = 'bn',
  onViewReceipt,
  onDeleteBill,
  onEditBill,
  onUpdateBill,
  onLoadIntoBilling,
  externalSearchTerm = '',
  viewMode = 'grid',
  sortOption = 'date-desc',
  onNavigateToBilling,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'due'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string } | null>(null);
  const [editingBill, setEditingBill] = useState<BillInvoice | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deleteConfirmBill, setDeleteConfirmBill] = useState<{
    id: string;
    invoiceNo: string;
    amount: number;
    customerName?: string;
  } | null>(null);

  const cardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [activeMenuId]);

  // Combined search term (Header search takes priority if present, otherwise local)
  const effectiveSearchTerm = (externalSearchTerm || localSearchTerm).trim();

  // Helper date matchers
  const isSameDay = (timestamp: number, targetDate: Date) => {
    const d = new Date(timestamp);
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  };

  // Filter & Sort bills
  const filteredBills = useMemo(() => {
    const filtered = bills.filter((bill) => {
      // 1. Search filter (Invoice #, Customer Name, Customer Phone, Item Name)
      if (effectiveSearchTerm) {
        const query = effectiveSearchTerm.toLowerCase();
        const matchesInvoice = bill.invoiceNo.toLowerCase().includes(query);
        const matchesCustomer = bill.customerName?.toLowerCase().includes(query) || false;
        const matchesPhone = bill.customerPhone?.toLowerCase().includes(query) || false;
        const matchesItem = bill.items.some((it) => it.name.toLowerCase().includes(query));

        if (!matchesInvoice && !matchesCustomer && !matchesPhone && !matchesItem) {
          return false;
        }
      }

      // 2. Date filter
      if (datePreset === 'today') {
        if (!isSameDay(bill.timestamp, new Date())) return false;
      } else if (datePreset === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (!isSameDay(bill.timestamp, yesterday)) return false;
      } else if (datePreset === 'week') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (bill.timestamp < sevenDaysAgo) return false;
      } else if (datePreset === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const target = new Date(year, month - 1, day);
        if (!isSameDay(bill.timestamp, target)) return false;
      }

      // 3. Payment filter
      if (paymentFilter !== 'all') {
        if (bill.paymentMethod !== paymentFilter) return false;
      }

      return true;
    });

    // 4. Sort
    return filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return b.timestamp - a.timestamp;
        case 'date-asc':
          return a.timestamp - b.timestamp;
        case 'amount-desc':
          return b.grandTotal - a.grandTotal;
        case 'name-asc':
          return (a.customerName || a.invoiceNo).localeCompare(b.customerName || b.invoiceNo);
        default:
          return b.timestamp - a.timestamp;
      }
    });
  }, [bills, effectiveSearchTerm, datePreset, customDate, paymentFilter, sortOption]);

  // Financial Stats of filtered bills
  const stats = useMemo(() => {
    const totalCount = filteredBills.length;
    const totalRevenue = filteredBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const paidRevenue = filteredBills
      .filter((b) => b.paymentMethod !== 'due')
      .reduce((sum, b) => sum + b.grandTotal, 0);
    const dueRevenue = filteredBills
      .filter((b) => b.paymentMethod === 'due')
      .reduce((sum, b) => sum + b.grandTotal, 0);

    return { totalCount, totalRevenue, paidRevenue, dueRevenue };
  }, [filteredBills]);

  // Quick Print via Bluetooth / Browser
  const handleQuickPrint = async (bill: BillInvoice) => {
    setActionFeedback({ id: bill.id, message: isBn ? 'প্রিন্ট হচ্ছে...' : 'Printing...' });
    const res = await thermalPrinterService.printViaBluetooth(bill, settings);
    if (res.success) {
      setActionFeedback({ id: bill.id, message: isBn ? 'প্রিন্ট সম্পন্ন!' : 'Printed via BLE!' });
    } else {
      thermalPrinterService.printViaBrowser(bill, settings);
      setActionFeedback({ id: bill.id, message: isBn ? 'ব্রাউজার প্রিন্ট' : 'Browser Print' });
    }
    setTimeout(() => setActionFeedback(null), 2200);
  };

  // WhatsApp Share bill
  const handleWhatsAppShare = (bill: BillInvoice) => {
    const cleanPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
    const store = settings.storeName || 'Our Store';

    let itemsText = bill.items
      .map((it) => `• ${it.name} (${it.qty} x ${sym}${it.price}) = ${sym}${it.total}`)
      .join('\n');

    let message = isBn
      ? `🧾 *${store} - বিল চালান #${bill.invoiceNo}*\nতারিখ: ${bill.date}\nকাস্টমার: ${bill.customerName || 'সম্মানিত ক্রেতা'}\n\n*পণ্য বিবরণ:*\n${itemsText}\n\n*মোট বিল:* ${sym}${bill.grandTotal.toFixed(2)}\n*পেমেন্ট:* ${bill.paymentMethod.toUpperCase()} (${bill.paymentMethod === 'due' ? 'বাকি' : 'পরিশোধিত'})\n\nআমাদের সাথে কেনাকাটার জন্য ধন্যবাদ!`
      : `🧾 *${store} - Invoice #${bill.invoiceNo}*\nDate: ${bill.date}\nCustomer: ${bill.customerName || 'Valued Customer'}\n\n*Items:*\n${itemsText}\n\n*Grand Total:* ${sym}${bill.grandTotal.toFixed(2)}\n*Status:* ${bill.paymentMethod.toUpperCase()} (${bill.paymentMethod === 'due' ? 'DUE' : 'PAID'})\n\nThank you for your business!`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const handleDelete = (bill: BillInvoice) => {
    setDeleteConfirmBill({
      id: bill.id,
      invoiceNo: bill.invoiceNo,
      amount: bill.grandTotal,
      customerName: bill.customerName,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3 pb-28 relative">
      {/* 1. KHATABOOK / STATS SUMMARY PILLS */}
      <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-2xs border border-stone-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Table className="w-4 h-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-stone-900">
              {isBn ? 'ইনভয়েস শিট ও রেজিস্টার' : 'Invoices & Sheet Register'}
            </h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full">
            {filteredBills.length} {isBn ? 'টি ফাইল' : 'files'}
          </span>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Total Sales */}
          <div className="p-2 rounded-2xl bg-[#f8fafc] border border-stone-200/80">
            <span className="block text-[10px] uppercase font-bold text-stone-500">
              {isBn ? 'মোট বিক্রয়' : 'Total Sales'}
            </span>
            <span className="text-xs sm:text-sm font-black text-stone-900 font-mono block mt-0.5">
              {sym}{stats.totalRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-stone-400 font-medium">
              {stats.totalCount} {isBn ? 'টি চালান' : 'sheets'}
            </span>
          </div>

          {/* Paid Sales */}
          <div className="p-2 rounded-2xl bg-emerald-50/80 border border-emerald-200/70">
            <span className="block text-[10px] uppercase font-bold text-emerald-700">
              {isBn ? 'নগদ আদায়' : 'Paid Sales'}
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block mt-0.5">
              {sym}{stats.paidRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">
              {isBn ? 'পরিশোধিত' : 'Settled'}
            </span>
          </div>

          {/* Due Sales */}
          <div className="p-2 rounded-2xl bg-rose-50/80 border border-rose-200/70">
            <span className="block text-[10px] uppercase font-bold text-rose-700">
              {isBn ? 'বাকি বিক্রয়' : 'Due Sales'}
            </span>
            <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block mt-0.5">
              {sym}{stats.dueRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-rose-600 font-medium">
              {isBn ? 'বকেয়া' : 'Unpaid'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS (Date Presets & Payment Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs bg-white p-2 sm:p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {(['all', 'today', 'yesterday', 'week', 'custom'] as DateFilterPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer capitalize ${
                datePreset === preset
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {preset === 'all'
                ? isBn
                  ? 'সব'
                  : 'All'
                : preset === 'today'
                ? isBn
                  ? 'আজ'
                  : 'Today'
                : preset === 'yesterday'
                ? isBn
                  ? 'গতকাল'
                  : 'Yesterday'
                : preset === 'week'
                ? isBn
                  ? '৭ দিন'
                  : '7 Days'
                : isBn
                ? 'তারিখ'
                : 'Custom'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="bg-stone-50 border border-stone-200 text-stone-700 text-[11px] font-bold px-2 py-1 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="all">{isBn ? 'সকল পেমেন্ট' : 'All Modes'}</option>
            <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
            <option value="upi">UPI</option>
            <option value="card">{isBn ? 'কার্ড (Card)' : 'Card'}</option>
            <option value="due">{isBn ? 'বাকি (Due)' : 'Due / Credit'}</option>
          </select>
        </div>

        {datePreset === 'custom' && (
          <div className="w-full flex items-center gap-2 pt-1.5 border-t border-stone-100 mt-1">
            <span className="text-xs text-stone-500 font-medium">
              {isBn ? 'তারিখ নির্বাচন:' : 'Select Date:'}
            </span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-white border border-stone-200 text-xs px-2.5 py-1 rounded-xl font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* 3. MAIN CARDS VIEW (GRID MODE OR LIST MODE) */}
      {filteredBills.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 space-y-2">
          <FileText className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-xs font-bold text-stone-700">
            {isBn ? 'কোনো ইনভয়েস পাওয়া যায়নি' : 'No invoices or sheets found'}
          </p>
          <p className="text-[11px] text-stone-400">
            {isBn
              ? 'ফিল্টার বা সার্চ পরিবর্তন করুন অথবা নতুন বিল তৈরি করুন'
              : 'Try clearing search filters or create a new bill'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= 2-COLUMN GOOGLE SHEETS GRID CARDS (EXACT MATCH TO SCREENSHOT) ================= */
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {filteredBills.map((bill) => {
            const isDue = bill.paymentMethod === 'due';
            const feedback = actionFeedback?.id === bill.id ? actionFeedback.message : null;
            const isMenuOpen = activeMenuId === bill.id;

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group cursor-pointer select-none"
                onClick={() => onViewReceipt(bill)}
              >
                {/* Top Card Header: Green Sheet Icon with [+] + Title + 3-Dot (⋮) Menu */}
                <div
                  className="p-2.5 sm:p-3 flex items-start justify-between gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
                    onClick={() => onViewReceipt(bill)}
                  >
                    {/* Green Google Sheets Icon with White [+] */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-[#0f9d58] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </div>

                    {/* Title (Invoice No / Customer Name) */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-[13px] font-bold text-stone-900 leading-tight truncate">
                        {bill.customerName || bill.invoiceNo}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-stone-500 font-mono truncate">
                        #{bill.invoiceNo}
                      </p>
                    </div>
                  </div>

                  {/* 3-Dot (⋮) Menu Button */}
                  <div className="relative shrink-0" ref={isMenuOpen ? cardMenuRef : undefined}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : bill.id);
                      }}
                      className="p-1 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                      title={isBn ? 'অপশন' : 'Options'}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu for this Sheet Card */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-7 w-44 bg-white rounded-2xl shadow-xl border border-stone-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 divide-y divide-stone-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onViewReceipt(bill);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isBn ? 'চালান দেখুন' : 'View Receipt'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleQuickPrint(bill);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isBn ? 'থার্মাল প্রিন্ট' : 'Thermal Print'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleWhatsAppShare(bill);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        </div>

                        {onUpdateBill && (
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setEditingBill(bill);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                              <span>{isBn ? 'এডিট করুন' : 'Edit Bill'}</span>
                            </button>
                          </div>
                        )}

                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleDelete(bill);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>{isBn ? 'মুছে ফেলুন' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body: Miniature Spreadsheet Grid Lines Preview (As Seen in Google Sheets!) */}
                <div className="px-2.5 sm:px-3 pb-2.5 flex-1 flex flex-col justify-between">
                  <div className="w-full bg-[#f8fafc] border border-stone-200/70 rounded-xl p-2 sm:p-2.5 space-y-1.5 min-h-[90px] sm:min-h-[105px] flex flex-col justify-between">
                    {/* Mini Sheet Rows */}
                    <div className="space-y-1">
                      {bill.items.slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[10px] text-stone-600 leading-tight"
                        >
                          <span className="truncate max-w-[90px] font-medium">{item.name}</span>
                          <span className="font-mono text-stone-400 shrink-0">
                            {item.qty}x • {sym}{item.price}
                          </span>
                        </div>
                      ))}
                      {bill.items.length > 3 && (
                        <div className="text-[9px] text-stone-400 italic">
                          +{bill.items.length - 3} {isBn ? 'টি আইটেম...' : 'more items...'}
                        </div>
                      )}
                    </div>

                    {/* Total & Status Row inside Preview Box */}
                    <div className="pt-1 border-t border-stone-200/80 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400 font-bold uppercase">
                        {isDue ? (isBn ? 'বাকি' : 'DUE') : (isBn ? 'পরিশোধ' : 'PAID')}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 font-mono">
                        {sym}{bill.grandTotal.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Badges (Shared/Clock icon as seen in Google Sheets) */}
                  <div className="pt-2 flex items-center justify-between text-[10px] text-stone-400">
                    <div className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{bill.date.split(' ')[0]}</span>
                    </div>

                    {/* Bottom Right Badges: Due or Paid badge with icon */}
                    <div className="flex items-center gap-1">
                      {isDue ? (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800">
                          {isBn ? 'বাকি' : 'DUE'}
                        </span>
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center"
                          title="Paid"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        </div>
                      )}
                      {bill.customerPhone && (
                        <div
                          className="w-4 h-4 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center"
                          title="Customer contact saved"
                        >
                          <User className="w-2.5 h-2.5 text-stone-600" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Feedback pill if print happened */}
                {feedback && (
                  <div className="absolute inset-x-0 bottom-0 bg-blue-600 text-white text-[10px] font-bold py-1 px-2 text-center animate-in fade-in">
                    {feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= CLASSIC DETAILED LIST VIEW ================= */
        <div className="space-y-2">
          {filteredBills.map((bill) => {
            const isExpanded = expandedInvoiceId === bill.id;
            const isDue = bill.paymentMethod === 'due';
            const feedback = actionFeedback?.id === bill.id ? actionFeedback.message : null;

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 p-3 sm:p-3.5 shadow-2xs transition-all space-y-2"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-6 h-6 rounded bg-[#0f9d58] text-white flex items-center justify-center font-bold shrink-0">
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-stone-900 font-mono">
                      #{bill.invoiceNo}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isDue
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isDue ? (isBn ? 'বাকি' : 'DUE') : (isBn ? 'পরিশোধিত' : 'PAID')} • {bill.paymentMethod}
                    </span>

                    {feedback && (
                      <span className="text-[10px] font-bold text-blue-600 animate-pulse flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {feedback}
                      </span>
                    )}
                  </div>

                  {/* Grand Total */}
                  <div className="text-right">
                    <div className="text-base font-black text-stone-900 font-mono tracking-tight">
                      {sym}{bill.grandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Customer & Items Summary */}
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                  <div className="truncate flex items-center gap-1.5">
                    <span className="font-bold text-stone-800">
                      {bill.customerName || (isBn ? 'সাধারণ ক্রেতা' : 'Walk-in Customer')}
                    </span>
                    {bill.customerPhone && (
                      <span className="font-mono text-stone-400">({bill.customerPhone})</span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-stone-400">
                    <span>{bill.items.length} {isBn ? 'আইটেম' : 'items'}</span>
                    <span>•</span>
                    <span>{bill.date.split(' ')[0]}</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleExpand(bill.id)}
                    className="text-[11px] font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? (isBn ? 'সংক্ষেপ করুন' : 'Hide Details') : (isBn ? 'আইটেম দেখুন' : 'View Items')}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrint(bill)}
                      className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all cursor-pointer"
                      title={isBn ? 'থার্মাল প্রিন্ট' : 'Print Thermal Slip'}
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(bill)}
                      className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-all cursor-pointer"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewReceipt(bill)}
                      className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all cursor-pointer"
                      title={isBn ? 'ট্যাক্স চালান দেখুন' : 'View Tax Invoice'}
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                    </button>

                    {onUpdateBill && (
                      <button
                        type="button"
                        onClick={() => setEditingBill(bill)}
                        className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
                        title={isBn ? 'বিল এডিট' : 'Edit Bill'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(bill)}
                      className="p-1.5 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/70 transition-all cursor-pointer"
                      title={isBn ? 'বিল মুছুন' : 'Delete Bill'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="pt-2 border-t border-dashed border-stone-200 space-y-1 text-xs">
                    {bill.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between py-0.5 text-stone-600">
                        <span>{it.name} ({it.qty} x {sym}{it.price})</span>
                        <span className="font-mono font-bold text-stone-800">{sym}{it.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. GOOGLE SHEETS STYLE MATERIAL 3 FLOATING ACTION BUTTON (FAB) (Matching Bottom Right [+] in Screenshot!) */}
      <div className="fixed right-4 bottom-18 sm:bottom-20 z-30">
        <button
          id="google-sheets-fab-btn"
          type="button"
          onClick={() => {
            if (onNavigateToBilling) {
              onNavigateToBilling();
            }
          }}
          aria-label="Create New Bill"
          title={isBn ? 'নতুন বিল তৈরি করুন' : 'Create New Invoice'}
          className="w-14 h-14 rounded-2xl bg-[#d3e3fd] hover:bg-[#c2e7ff] active:scale-95 text-[#041e49] shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer border border-[#c2e7ff]"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>

      {/* Edit Invoice Modal */}
      {editingBill && (
        <EditInvoiceModal
          bill={editingBill}
          settings={settings}
          language={language}
          onClose={() => setEditingBill(null)}
          onSave={(updated) => {
            if (onUpdateBill) onUpdateBill(updated);
            setEditingBill(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-stone-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                {isBn ? 'ইনভয়েস মুছে ফেলতে চান?' : 'Delete this Invoice?'}
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                #{deleteConfirmBill.invoiceNo} • {sym}{deleteConfirmBill.amount.toFixed(2)}
              </p>
              {deleteConfirmBill.customerName && (
                <p className="text-xs text-stone-600 font-medium">
                  {deleteConfirmBill.customerName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBill(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBill(deleteConfirmBill.id);
                  setDeleteConfirmBill(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
              >
                {isBn ? 'হ্যাঁ, মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
