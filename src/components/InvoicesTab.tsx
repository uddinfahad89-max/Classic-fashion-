import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Search,
  ListFilter,
  Printer,
  Eye,
  Trash2,
  Edit2,
  MessageCircle,
  X,
  MoreVertical,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { BillInvoice, ThermalPrinterSettings, Language } from '../types';
import { thermalPrinterService } from '../services/thermalPrinterService';
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

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

function formatPartyDate(timestamp?: number, rawDate?: string): string {
  if (timestamp && !isNaN(timestamp)) {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()] || 'Jan';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }
  if (rawDate) {
    const datePart = rawDate.split(' ')[0];
    const parts = datePart.split(/[-/]/);
    if (parts.length === 3) {
      // Check DD-MM-YYYY vs YYYY-MM-DD
      if (parts[0].length === 4) {
        const year = Number(parts[0]);
        const monthIdx = Number(parts[1]) - 1;
        const day = String(Number(parts[2])).padStart(2, '0');
        return `${day} ${MONTH_NAMES[monthIdx] || parts[1]} ${year}`;
      } else {
        const day = String(Number(parts[0])).padStart(2, '0');
        const monthIdx = Number(parts[1]) - 1;
        const year = parts[2];
        return `${day} ${MONTH_NAMES[monthIdx] || parts[1]} ${year}`;
      }
    }
    return datePart;
  }
  return '';
}

function getPartyDisplayName(customerName?: string): string {
  const trimmed = (customerName || '').trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'customer' ||
    trimmed.toLowerCase() === 'cash customer' ||
    trimmed.toLowerCase() === 'walk-in customer' ||
    trimmed === 'সাধারণ ক্রেতা'
  ) {
    return 'Cash Sale';
  }
  return trimmed;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  bills,
  settings,
  language = 'bn',
  onViewReceipt,
  onDeleteBill,
  onUpdateBill,
  onLoadIntoBilling,
  externalSearchTerm = '',
  sortOption = 'date-desc',
  onNavigateToBilling,
}) => {
  const isBn = language === 'bn';
  const rawSym = (settings.currencySymbol || 'Rs').replace(/\?/g, '').trim();
  const sym = rawSym === '₹' || !rawSym ? 'Rs' : rawSym;

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSummaryCard, setShowSummaryCard] = useState(false);
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'due'>('all');
  const [localSort, setLocalSort] = useState<SortOption>(sortOption);
  const [editingBill, setEditingBill] = useState<BillInvoice | null>(null);
  const [deleteConfirmBill, setDeleteConfirmBill] = useState<{
    id: string;
    invoiceNo: string;
    amount: number;
    customerName?: string;
  } | null>(null);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSort(sortOption);
  }, [sortOption]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [showMoreMenu]);

  const effectiveSearchTerm = (localSearchTerm || externalSearchTerm).trim();

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
      if (effectiveSearchTerm) {
        const query = effectiveSearchTerm.toLowerCase();
        const partyName = getPartyDisplayName(bill.customerName).toLowerCase();
        const matchesInvoice = bill.invoiceNo.toLowerCase().includes(query);
        const matchesCustomer =
          (bill.customerName?.toLowerCase().includes(query) || false) ||
          partyName.includes(query);
        const matchesPhone = bill.customerPhone?.toLowerCase().includes(query) || false;
        const matchesItem = bill.items.some((it) => it.name.toLowerCase().includes(query));

        if (!matchesInvoice && !matchesCustomer && !matchesPhone && !matchesItem) {
          return false;
        }
      }

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

      if (paymentFilter !== 'all') {
        if (bill.paymentMethod !== paymentFilter) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      switch (localSort) {
        case 'date-desc':
          return b.timestamp - a.timestamp;
        case 'date-asc':
          return a.timestamp - b.timestamp;
        case 'amount-desc':
          return b.grandTotal - a.grandTotal;
        case 'name-asc':
          return getPartyDisplayName(a.customerName).localeCompare(
            getPartyDisplayName(b.customerName)
          );
        default:
          return b.timestamp - a.timestamp;
      }
    });
  }, [bills, effectiveSearchTerm, datePreset, customDate, paymentFilter, localSort]);

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

  const formatAmount = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    const isWhole = rounded % 1 === 0;
    return rounded.toLocaleString('en-IN', {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  const hasActiveFilters = datePreset !== 'all' || paymentFilter !== 'all';

  return (
    <div className="max-w-3xl mx-auto bg-white min-h-[calc(100vh-120px)] pb-24 shadow-2xs">
      {/* 1. TOP BAR: SEARCH PARTY | FILTER ICON | + New Party | 3-DOTS (Exact match to uploaded reference) */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2 bg-white sticky top-0 z-20">
        {/* Left: Blue Magnifying Glass + SEARCH PARTY Input */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Search className="w-5 h-5 text-[#0066cc] stroke-[2.2] shrink-0" />
          <input
            type="text"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            placeholder="SEARCH PARTY"
            className="w-full bg-transparent border-none text-sm text-stone-900 placeholder:text-stone-400 placeholder:tracking-wider placeholder:font-normal focus:outline-none"
          />
          {localSearchTerm && (
            <button
              type="button"
              onClick={() => setLocalSearchTerm('')}
              className="p-1 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Filter Circle + "+ New Party" Pill + 3 Dots */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Circular Filter Button */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer relative ${
              showFilters || hasActiveFilters
                ? 'bg-blue-100 text-[#0066cc]'
                : 'bg-[#f1f3f5] hover:bg-stone-200 text-stone-600'
            }`}
            title={isBn ? 'ফিল্টার ও তারিখ' : 'Filter Party & Dates'}
          >
            <ListFilter className="w-4 h-4 stroke-[2.2]" />
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#0066cc] absolute top-1.5 right-1.5" />
            )}
          </button>

          {/* + New Party Button */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToBilling) {
                onNavigateToBilling();
              }
            }}
            className="px-3.5 py-1.5 rounded-full bg-[#e8f3ff] hover:bg-[#d8ebff] active:scale-[0.98] text-[#0066cc] font-semibold text-xs sm:text-sm flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Party</span>
          </button>

          {/* 3 Vertical Dots Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-10 w-52 bg-white rounded-2xl shadow-xl border border-stone-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 divide-y divide-stone-100">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSummaryCard((prev) => !prev);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center justify-between cursor-pointer"
                  >
                    <span>{isBn ? 'মোট হিসাব সামারি দেখুন' : 'Show Sales Summary'}</span>
                    {showSummaryCard && <CheckCircle2 className="w-3.5 h-3.5 text-[#129958]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFilters((prev) => !prev);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center justify-between cursor-pointer"
                  >
                    <span>{isBn ? 'তারিখ ও পেমেন্ট ফিল্টার' : 'Date & Mode Filters'}</span>
                    {showFilters && <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />}
                  </button>
                </div>

                <div className="py-1">
                  <div className="px-3.5 py-1 text-[10px] font-bold text-stone-400 uppercase">
                    {isBn ? 'সাজানোর ক্রম' : 'Sort By'}
                  </div>
                  {(
                    [
                      { id: 'date-desc', label: isBn ? 'নতুন বিল আগে' : 'Newest First' },
                      { id: 'date-asc', label: isBn ? 'পুরোনো বিল আগে' : 'Oldest First' },
                      { id: 'amount-desc', label: isBn ? 'টাকার পরিমাণ (বেশি)' : 'Amount (High to Low)' },
                      { id: 'name-asc', label: isBn ? 'পার্টির নাম (A-Z)' : 'Party Name (A-Z)' },
                    ] as { id: SortOption; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setLocalSort(opt.id);
                        setShowMoreMenu(false);
                      }}
                      className={`w-full text-left px-3.5 py-1.5 text-xs font-medium flex items-center justify-between cursor-pointer ${
                        localSort === opt.id
                          ? 'text-[#0066cc] font-bold bg-blue-50/60'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {localSort === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#0066cc]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Summary Bar (only shown if toggled from 3-dots menu) */}
      {showSummaryCard && (
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 grid grid-cols-3 gap-2 text-center animate-in fade-in duration-150">
          <div className="p-2 rounded-xl bg-white border border-stone-200/80">
            <span className="block text-[10px] uppercase font-bold text-stone-500">
              {isBn ? 'মোট বিক্রয়' : 'Total Sales'}
            </span>
            <span className="text-xs sm:text-sm font-black text-stone-900 block mt-0.5">
              {sym} {formatAmount(stats.totalRevenue)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white border border-emerald-200/80">
            <span className="block text-[10px] uppercase font-bold text-[#129958]">
              {isBn ? 'নগদ আদায়' : 'Paid'}
            </span>
            <span className="text-xs sm:text-sm font-black text-[#129958] block mt-0.5">
              {sym} {formatAmount(stats.paidRevenue)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white border border-rose-200/80">
            <span className="block text-[10px] uppercase font-bold text-rose-600">
              {isBn ? 'বাকি' : 'Due'}
            </span>
            <span className="text-xs sm:text-sm font-black text-rose-600 block mt-0.5">
              {sym} {formatAmount(stats.dueRevenue)}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible Filter Bar (when Filter icon is tapped) */}
      {showFilters && (
        <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(['all', 'today', 'yesterday', 'week', 'custom'] as DateFilterPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                  datePreset === preset
                    ? 'bg-[#0066cc] text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {preset === 'all'
                  ? 'All'
                  : preset === 'today'
                  ? 'Today'
                  : preset === 'yesterday'
                  ? 'Yesterday'
                  : preset === 'week'
                  ? '7 Days'
                  : 'Custom'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-white border border-stone-200 text-stone-700 text-[11px] font-semibold px-2.5 py-1 rounded-full focus:outline-none focus:border-[#0066cc] cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="due">Due</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setDatePreset('all');
                  setPaymentFilter('all');
                  setCustomDate('');
                }}
                className="text-[11px] text-rose-600 font-semibold px-2 py-0.5 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {datePreset === 'custom' && (
            <div className="w-full flex items-center gap-2 pt-1.5 border-t border-stone-200/70 mt-1">
              <span className="text-xs text-stone-500 font-medium">Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white border border-stone-200 text-xs px-2.5 py-1 rounded-lg font-mono focus:outline-none focus:border-[#0066cc]"
              />
            </div>
          )}
        </div>
      )}

      {/* 2. PARTY / INVOICE LIST ROWS (Exact match to uploaded screenshot) */}
      {filteredBills.length === 0 ? (
        <div className="py-16 px-4 text-center space-y-2">
          <FileText className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-sm font-semibold text-stone-700">
            {isBn ? 'কোনো পার্টি বা বিল পাওয়া যায়নি' : 'No party or invoices found'}
          </p>
          <p className="text-xs text-stone-400">
            {isBn
              ? 'নতুন বিল তৈরি করতে উপরে "+ New Party" বাটনে ট্যাপ করুন'
              : 'Tap "+ New Party" above to create a new bill'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 bg-white">
          {filteredBills.map((bill) => {
            const partyName = getPartyDisplayName(bill.customerName);
            const formattedDate = formatPartyDate(bill.timestamp, bill.date);

            return (
              <div
                key={bill.id}
                onClick={() => onViewReceipt(bill)}
                className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/80 active:bg-stone-100 transition-colors cursor-pointer select-none"
              >
                {/* Left Column: Party Name & Date */}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] sm:text-[16px] font-normal text-stone-900 leading-snug truncate">
                    {partyName}
                  </div>
                  <div className="text-[12px] sm:text-[13px] font-normal text-stone-400 mt-0.5">
                    {formattedDate}
                  </div>
                </div>

                {/* Right Column: Amount & You'll Get */}
                <div className="text-right shrink-0">
                  <div className="text-[15px] sm:text-[16px] font-normal text-[#129958] leading-snug">
                    {sym} {formatAmount(bill.grandTotal)}
                  </div>
                  <div className="text-[12px] font-normal text-[#129958] mt-0.5">
                    You&apos;ll Get
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingBill && (
        <EditInvoiceModal
          bill={editingBill}
          isOpen={Boolean(editingBill)}
          settings={settings}
          language={language}
          onClose={() => setEditingBill(null)}
          onSave={(updated) => {
            if (onUpdateBill) onUpdateBill(updated);
            setEditingBill(null);
          }}
          onDelete={(id) => {
            onDeleteBill(id);
            setEditingBill(null);
          }}
          onLoadInBilling={(bill) => {
            if (onLoadIntoBilling) {
              onLoadIntoBilling(bill);
            }
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
                #{deleteConfirmBill.invoiceNo} • {sym} {formatAmount(deleteConfirmBill.amount)}
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
