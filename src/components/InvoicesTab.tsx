import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
import { translations } from '../utils/i18n';
import { EditInvoiceModal } from './EditInvoiceModal';

interface InvoicesTabProps {
  bills: BillInvoice[];
  settings: ThermalPrinterSettings;
  language?: Language;
  onViewReceipt: (bill: BillInvoice) => void;
  onDeleteBill: (id: string) => void;
  onEditBill?: (bill: BillInvoice) => void;
  onUpdateBill?: (bill: BillInvoice) => void;
  onLoadIntoBilling?: (bill: BillInvoice) => void;
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
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';

  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'due'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string } | null>(null);
  const [editingBill, setEditingBill] = useState<BillInvoice | null>(null);

  // Helper date matchers
  const isSameDay = (timestamp: number, targetDate: Date) => {
    const d = new Date(timestamp);
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // 1. Search filter (Invoice #, Customer Name, Customer Phone, Item Name)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
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
  }, [bills, searchTerm, datePreset, customDate, paymentFilter]);

  // Financial Stats of filtered bills (Khatabook 3-pill stats)
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

  const handleDelete = (id: string, invNo: string) => {
    if (window.confirm(isBn ? `আপনি কি ইনভয়েস #${invNo} ডিলিট করতে চান?` : `Are you sure you want to delete Invoice #${invNo}?`)) {
      onDeleteBill(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3.5 pb-28">
      {/* 1. KHATABOOK / VYAPAR TOP 3 METRIC PILLS */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-sm border border-stone-200/90 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>{isBn ? 'ইনভয়েস ও বিল হিস্ট্রি' : 'Invoices & Sales Register'}</span>
          </h2>
          <span className="text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            {filteredBills.length} {isBn ? 'টি বিল' : 'Invoices'}
          </span>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Total Sales */}
          <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
            <span className="block text-[10px] uppercase font-bold text-stone-500">
              {isBn ? 'মোট বিক্রয়' : 'Total Sales'}
            </span>
            <span className="text-xs sm:text-base font-black text-stone-900 font-mono block mt-0.5">
              {sym}{stats.totalRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-stone-400 font-medium">
              {stats.totalCount} {isBn ? 'টি বিল' : 'bills'}
            </span>
          </div>

          {/* Paid Sales */}
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
            <span className="block text-[10px] uppercase font-bold text-emerald-700">
              {isBn ? 'নগদ আদায়' : 'Paid Sales'}
            </span>
            <span className="text-xs sm:text-base font-black text-emerald-700 font-mono block mt-0.5">
              {sym}{stats.paidRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">
              {isBn ? 'পরিশোধিত' : 'Settled'}
            </span>
          </div>

          {/* Due Sales */}
          <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200/80">
            <span className="block text-[10px] uppercase font-bold text-rose-700">
              {isBn ? 'বাকি বিক্রয়' : 'Due Sales'}
            </span>
            <span className="text-xs sm:text-base font-black text-rose-700 font-mono block mt-0.5">
              {sym}{stats.dueRevenue.toFixed(0)}
            </span>
            <span className="text-[9px] text-rose-600 font-medium">
              {isBn ? 'বকেয়া পাওনা' : 'Unpaid credit'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'বিল #, কাস্টমারের নাম বা ফোন দিয়ে খুঁজুন...' : 'Search Invoice #, Customer Name, or Phone...'}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 shadow-2xs transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-sm font-bold cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Date presets + Payment Mode selector */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(['all', 'today', 'yesterday', 'week', 'custom'] as DateFilterPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer capitalize ${
                  datePreset === preset
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
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
              className="bg-white border border-stone-200 text-stone-700 text-[11px] font-bold px-2 py-1 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">{isBn ? 'সকল পেমেন্ট' : 'All Modes'}</option>
              <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
              <option value="upi">UPI</option>
              <option value="card">{isBn ? 'কার্ড (Card)' : 'Card'}</option>
              <option value="due">{isBn ? 'বাকি (Due)' : 'Due / Credit'}</option>
            </select>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-stone-500 font-medium">{isBn ? 'তারিখ নির্বাচন:' : 'Select Date:'}</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-white border border-stone-200 text-xs px-2 py-1 rounded-xl font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* 3. MAIN VIEW: INVOICES LIST CARDS */}
      <div className="space-y-2">
        {filteredBills.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 space-y-2">
            <FileText className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-xs font-bold text-stone-700">
              {isBn ? 'কোনো ইনভয়েস পাওয়া যায়নি' : 'No invoices matched your filters'}
            </p>
            <p className="text-[11px] text-stone-400">
              {isBn ? 'ফিল্টার পরিবর্তন করুন বা নতুন বিল তৈরি করুন' : 'Try clearing filters or checkout a new bill'}
            </p>
          </div>
        ) : (
          filteredBills.map((bill) => {
            const isExpanded = expandedInvoiceId === bill.id;
            const isDue = bill.paymentMethod === 'due';
            const feedback = actionFeedback?.id === bill.id ? actionFeedback.message : null;

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 p-3 sm:p-3.5 shadow-2xs transition-all space-y-2.5"
              >
                {/* Header Row: Invoice #, Status badge, Amount */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-stone-900 font-mono">
                      #{bill.invoiceNo}
                    </span>

                    {/* Status Badge */}
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

                {/* Action Icons Bar (Thermal Print, WhatsApp, View Tax Invoice, Delete) */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 flex-wrap">
                  {/* Left: Expand items */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(bill.id)}
                    className="text-[11px] font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? (isBn ? 'সংক্ষেপ করুন' : 'Hide Details') : (isBn ? 'আইটেম দেখুন' : 'View Items')}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* Right: Quick Action Icons */}
                  <div className="flex items-center gap-1.5">
                    {/* 1. Quick Thermal Print */}
                    <button
                      type="button"
                      onClick={() => handleQuickPrint(bill)}
                      className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all cursor-pointer"
                      title={isBn ? 'থার্মাল প্রিন্ট' : 'Print Thermal Slip'}
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* 2. WhatsApp Share */}
                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(bill)}
                      className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-all cursor-pointer"
                      title={isBn ? 'হোয়াটসঅ্যাপে চালান পাঠান' : 'Share Bill on WhatsApp'}
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                    </button>

                    {/* 3. View Full Tax Invoice / Receipt */}
                    <button
                      type="button"
                      onClick={() => onViewReceipt(bill)}
                      className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all cursor-pointer"
                      title={isBn ? 'ট্যাক্স চালান দেখুন' : 'View / Print Tax Invoice'}
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                    </button>

                    {/* 4. Edit Bill (if allowed) */}
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

                    {/* 5. Delete Bill */}
                    <button
                      type="button"
                      onClick={() => handleDelete(bill.id, bill.invoiceNo)}
                      className="p-1.5 rounded-xl text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title={isBn ? 'ডিলিট করুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Item Breakdown */}
                {isExpanded && (
                  <div className="pt-2 border-t border-dashed border-stone-200 space-y-1.5 text-xs animate-in fade-in duration-150">
                    <div className="bg-stone-50 rounded-xl p-2.5 space-y-1 font-mono">
                      {bill.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="font-sans text-stone-800 font-medium">
                            {it.name} <span className="text-stone-400 font-mono">x{it.qty}</span>
                          </span>
                          <span className="font-bold text-stone-900">
                            {sym}{it.total.toFixed(2)}
                          </span>
                        </div>
                      ))}

                      <div className="pt-1.5 mt-1.5 border-t border-stone-200 flex justify-between font-bold text-xs">
                        <span className="font-sans text-stone-600">{isBn ? 'মোট মূল্য' : 'Grand Total'}</span>
                        <span className="text-stone-900 font-mono">{sym}{bill.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Invoice Modal if open */}
      {editingBill && onUpdateBill && (
        <EditInvoiceModal
          bill={editingBill}
          settings={settings}
          language={language}
          onClose={() => setEditingBill(null)}
          onSave={(updated) => {
            onUpdateBill(updated);
            setEditingBill(null);
          }}
        />
      )}
    </div>
  );
};
