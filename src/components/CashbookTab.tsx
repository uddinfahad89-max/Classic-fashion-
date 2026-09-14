import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Wallet,
  Receipt,
  CheckCircle,
  TrendingUp,
  Search,
  Calendar,
  Filter,
  Plus,
  Minus,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { CashEntry, CashEntryType, ThermalPrinterSettings, BillInvoice, Language } from '../types';
import { translations } from '../utils/i18n';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';

interface CashbookTabProps {
  entries: CashEntry[];
  bills?: BillInvoice[];
  settings: ThermalPrinterSettings;
  onAddEntry: (type: CashEntryType, amount: number, note: string) => void;
  onDeleteEntry: (id: string) => void;
  language?: Language;
}

type DaybookDateFilter = 'today' | 'yesterday' | 'week' | 'all' | 'custom';

export const CashbookTab: React.FC<CashbookTabProps> = ({
  entries,
  bills = [],
  settings,
  onAddEntry,
  onDeleteEntry,
  language = 'bn',
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';

  // Filters
  const [dateFilter, setDateFilter] = useState<DaybookDateFilter>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Income' | 'Expense'>('all');

  // Modal State for Cash In & Cash Out
  const [activeModalType, setActiveModalType] = useState<CashEntryType | null>(null);

  // Helper date matchers
  const isSameDay = (timestamp: number, target: Date) => {
    const d = new Date(timestamp);
    return (
      d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate()
    );
  };

  // 1. Filtered Bills based on date filter
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // only paid bills count towards daily cash sales
      if (b.paymentMethod === 'due') return false;

      if (dateFilter === 'today') {
        return isSameDay(b.timestamp, new Date());
      } else if (dateFilter === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return isSameDay(b.timestamp, y);
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return b.timestamp >= sevenDaysAgo;
      } else if (dateFilter === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const target = new Date(year, month - 1, day);
        return isSameDay(b.timestamp, target);
      }
      return true; // 'all'
    });
  }, [bills, dateFilter, customDate]);

  // 2. Filtered Manual Cash Entries based on date filter
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.note?.startsWith('POS ')) return false; // ignore auto-pos mirrors to prevent double counting

      if (dateFilter === 'today') {
        return isSameDay(e.timestamp, new Date());
      } else if (dateFilter === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return isSameDay(e.timestamp, y);
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return e.timestamp >= sevenDaysAgo;
      } else if (dateFilter === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-').map(Number);
        const target = new Date(year, month - 1, day);
        return isSameDay(e.timestamp, target);
      }
      return true;
    });
  }, [entries, dateFilter, customDate]);

  // Calculations for the selected period
  const totalBilledSales = useMemo(() => {
    return filteredBills.reduce((sum, b) => sum + b.grandTotal, 0);
  }, [filteredBills]);

  const totalManualIncome = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === 'Income')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [filteredEntries]);

  // 1. TOTAL CASH IN (Sales + Manual Income)
  const totalCashIn = totalBilledSales + totalManualIncome;

  // 2. TOTAL CASH OUT / EXPENSE
  const totalCashOut = useMemo(() => {
    return filteredEntries
      .filter((e) => e.type === 'Expense')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [filteredEntries]);

  // 3. NET CASH BALANCE
  const netBalance = totalCashIn - totalCashOut;

  // Combine Bills & Manual Entries into a unified timeline
  interface TimelineItem {
    id: string;
    type: 'Income' | 'Expense';
    title: string;
    tag: string;
    amount: number;
    timestamp: number;
    timeFormatted: string;
    isBill?: boolean;
    rawBill?: BillInvoice;
    rawEntry?: CashEntry;
  }

  const timelineItems: TimelineItem[] = useMemo(() => {
    const list: TimelineItem[] = [];

    // Add bills as income items
    filteredBills.forEach((b) => {
      const d = new Date(b.timestamp);
      list.push({
        id: 'bill-' + b.id,
        type: 'Income',
        title: b.customerName
          ? `${isBn ? 'বিক্রয় রশিদ' : 'Billed Sale'}: ${b.customerName} (#${b.invoiceNo})`
          : `${isBn ? 'নগদ বিক্রয়' : 'Sale'} #${b.invoiceNo}`,
        tag: b.paymentMethod.toUpperCase(),
        amount: b.grandTotal,
        timestamp: b.timestamp,
        timeFormatted: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBill: true,
        rawBill: b,
      });
    });

    // Add manual cash entries
    filteredEntries.forEach((e) => {
      const d = new Date(e.timestamp);
      // detect if note contains payment tag like [UPI], [Card]
      let tag = 'CASH';
      let cleanNote = e.note || '';
      if (cleanNote.includes('[UPI]')) {
        tag = 'UPI';
        cleanNote = cleanNote.replace('[UPI]', '').trim();
      } else if (cleanNote.includes('[Card]')) {
        tag = 'CARD';
        cleanNote = cleanNote.replace('[Card]', '').trim();
      } else if (cleanNote.includes('[Bank]')) {
        tag = 'BANK';
        cleanNote = cleanNote.replace('[Bank]', '').trim();
      }

      list.push({
        id: e.id,
        type: e.type,
        title:
          cleanNote ||
          (e.type === 'Income'
            ? isBn
              ? 'অন্যান্য জমা'
              : 'Cash In'
            : isBn
            ? 'দোকান খরচ'
            : 'General Expense'),
        tag,
        amount: e.amount,
        timestamp: e.timestamp,
        timeFormatted: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBill: false,
        rawEntry: e,
      });
    });

    // Sort descending by timestamp
    list.sort((a, b) => b.timestamp - a.timestamp);

    // Filter by search keyword and category
    return list.filter((item) => {
      if (categoryFilter !== 'all' && item.type !== categoryFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.amount.toString().includes(q)
      );
    });
  }, [filteredBills, filteredEntries, categoryFilter, searchTerm, isBn]);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3.5 pb-28">
      {/* 1. KHATABOOK TOP SUMMARY: 3 COMPACT METRICS (CASH IN, CASH OUT, NET BALANCE) */}
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-stone-200/80 p-3 sm:p-4 text-center">
          {/* Metric 1: Total Cash In */}
          <div className="p-1 sm:p-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isBn ? 'ক্যাশ ইন' : 'Total In'}</span>
            </span>
            <div className="text-sm sm:text-xl font-black text-emerald-600 font-mono mt-1 tracking-tight">
              +{sym}{totalCashIn.toFixed(0)}
            </div>
            <span className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate block">
              {filteredBills.length} {isBn ? 'বিল' : 'sales'} + {isBn ? 'জমা' : 'in'}
            </span>
          </div>

          {/* Metric 2: Total Cash Out / Expense */}
          <div className="p-1 sm:p-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              <span>{isBn ? 'ক্যাশ আউট' : 'Total Out'}</span>
            </span>
            <div className="text-sm sm:text-xl font-black text-rose-600 font-mono mt-1 tracking-tight">
              -{sym}{totalCashOut.toFixed(0)}
            </div>
            <span className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate block">
              {isBn ? 'দোকানের খরচ' : 'Expenses'}
            </span>
          </div>

          {/* Metric 3: Net Cash Balance */}
          <div className="p-1 sm:p-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? 'নেট ক্যাশ' : 'Net Cash'}</span>
            </span>
            <div
              className={`text-sm sm:text-xl font-black font-mono mt-1 tracking-tight ${
                netBalance >= 0 ? 'text-stone-900' : 'text-rose-600'
              }`}
            >
              {netBalance >= 0 ? '+' : ''}
              {sym}{netBalance.toFixed(0)}
            </div>
            <span className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate block">
              {isBn ? 'অবশিষ্ট উদ্বৃত্ত' : 'Net Balance'}
            </span>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="bg-stone-50/80 px-3 py-2 border-t border-stone-200/80 flex items-center justify-between gap-1 overflow-x-auto">
          <div className="flex items-center gap-1">
            {(['today', 'yesterday', 'week', 'all', 'custom'] as DaybookDateFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer capitalize ${
                  dateFilter === f
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-200/60'
                }`}
              >
                {f === 'today'
                  ? isBn
                    ? 'আজ'
                    : 'Today'
                  : f === 'yesterday'
                  ? isBn
                    ? 'গতকাল'
                    : 'Yesterday'
                  : f === 'week'
                  ? isBn
                    ? '৭ দিন'
                    : 'Week'
                  : f === 'all'
                  ? isBn
                    ? 'সব'
                    : 'All'
                  : isBn
                  ? 'তারিখ'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="text-xs bg-white border border-stone-200 rounded-lg px-2 py-0.5 font-mono"
            />
          )}
        </div>
      </div>

      {/* 2. SEARCH & CATEGORY CHIPS */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'বিবরণ বা ট্যাগ দিয়ে খুঁজুন...' : 'Search entries...'}
            className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            {isBn ? 'সব' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('Income')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'Income'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-emerald-200 text-emerald-700'
            }`}
          >
            <ArrowDownLeft className="w-3 h-3" />
            <span>{isBn ? 'জমা' : 'In'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('Expense')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'Expense'
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-rose-200 text-rose-700'
            }`}
          >
            <ArrowUpRight className="w-3 h-3" />
            <span>{isBn ? 'খরচ' : 'Out'}</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN VIEW: CLEAN TIMELINE CARDS */}
      <div className="space-y-2">
        {timelineItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 space-y-2">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-xs font-bold text-stone-700">
              {isBn ? 'নির্বাচিত দিনে কোনো ক্যাশ এন্ট্রি নেই' : 'No cashbook entries for this period'}
            </p>
            <p className="text-[11px] text-stone-400">
              {isBn
                ? 'নিচের "+ ক্যাশ ইন" বা "- ক্যাশ আউট" চেপে এন্ট্রি করুন'
                : 'Use "+ CASH IN" or "- CASH OUT" buttons below to record an entry'}
            </p>
          </div>
        ) : (
          timelineItems.map((item) => {
            const isIncome = item.type === 'Income';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 p-3 sm:p-3.5 shadow-2xs transition-all flex items-center justify-between gap-3"
              >
                {/* Left: Indicator Icon & Title & Time */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isIncome
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-stone-500">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {item.timeFormatted}
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-stone-100 font-mono font-bold text-[10px] text-stone-600 border border-stone-200/60">
                        {item.tag}
                      </span>
                      {item.isBill && (
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {isBn ? 'বিল্ড সেল' : 'Billed'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Delete button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {sym}{item.amount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-stone-400 block -mt-0.5">
                      {isIncome ? (isBn ? 'জমা' : 'Cash In') : (isBn ? 'খরচ' : 'Expense')}
                    </span>
                  </div>

                  {!item.isBill && (
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(item.id)}
                      className="p-1.5 rounded-xl text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title={isBn ? 'এন্ট্রি মুছে ফেলুন' : 'Delete Entry'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. TWO FLOATING BOTTOM ACTION BUTTONS: + CASH IN & - CASH OUT (Khatabook Style) */}
      <div className="fixed bottom-20 left-0 right-0 z-30 pointer-events-none flex justify-center px-4">
        <div className="w-full max-w-sm flex items-center justify-between gap-3 pointer-events-auto">
          {/* + CASH IN (Green) */}
          <button
            id="floating-cash-in-btn"
            type="button"
            onClick={() => setActiveModalType('Income')}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm py-3 px-3 rounded-2xl shadow-xl flex items-center justify-center gap-2 border-2 border-white cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isBn ? '+ ক্যাশ ইন (জমা)' : '+ CASH IN'}</span>
          </button>

          {/* - CASH OUT (Red) */}
          <button
            id="floating-cash-out-btn"
            type="button"
            onClick={() => setActiveModalType('Expense')}
            className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs sm:text-sm py-3 px-3 rounded-2xl shadow-xl flex items-center justify-center gap-2 border-2 border-white cursor-pointer transition-all"
          >
            <Minus className="w-4 h-4 stroke-[3]" />
            <span>{isBn ? '- ক্যাশ আউট (খরচ)' : '- CASH OUT'}</span>
          </button>
        </div>
      </div>

      {/* 5. FAST ENTRY POP-UP MODAL (WITH EMBEDDED KHATABOOK CALCULATOR) */}
      {activeModalType && (
        <KhatabookEntryModal
          isOpen={!!activeModalType}
          onClose={() => setActiveModalType(null)}
          onSave={(payload: KhatabookEntryPayload) => {
            const noteWithTag = payload.details
              ? `${payload.details} (${payload.paymentMode || 'Cash'})`
              : (payload.paymentMode || 'Cash');
            onAddEntry(activeModalType, payload.amount, noteWithTag);
            setActiveModalType(null);
          }}
          entryType={activeModalType === 'Income' ? 'cash_in' : 'cash_out'}
          settings={settings}
          language={language}
        />
      )}
    </div>
  );
};
