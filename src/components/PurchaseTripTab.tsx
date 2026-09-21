import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  Store,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Wallet,
  AlertCircle,
  Truck,
  Coffee,
  Package,
  Layers,
  FileSpreadsheet,
  Edit2,
  Coins,
  Calculator,
  Search,
  X,
  FileText,
  Tag,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import {
  PurchaseTrip,
  PurchaseExpenseItem,
  PurchaseExpenseCategory,
  ThermalPrinterSettings,
  Language,
  BillInvoice,
} from '../types';
import { translations, getCategoryBadge } from '../utils/i18n';
import { KhatabookEntryModal, KhatabookEntryPayload } from './KhatabookEntryModal';
import { useBackHandler } from '../utils/useBackHandler';

interface PurchaseTripTabProps {
  trips: PurchaseTrip[];
  settings: ThermalPrinterSettings;
  language: Language;
  onOpenCalculator?: () => void;
  onCreateTrip: (
    title: string,
    initialCash: number,
    marketLocation?: string,
    note?: string
  ) => void;
  onUpdateTrip?: (
    tripId: string,
    updates: {
      title?: string;
      initialCash?: number;
      marketLocation?: string;
      note?: string;
    }
  ) => void;
  onAddCashToTrip?: (tripId: string, additionalCash: number) => void;
  onAddExpense: (
    tripId: string,
    expense: Omit<PurchaseExpenseItem, 'id' | 'timestamp' | 'dateFormatted'>
  ) => void;
  onDeleteExpense: (tripId: string, expenseId: string) => void;
  onUpdateTripStatus: (tripId: string, status: 'active' | 'completed') => void;
  onDeleteTrip: (tripId: string) => void;
  onSyncTripToCashbook: (trip: PurchaseTrip) => void;
  onPrintTripSlip: (bill: BillInvoice) => void;
}

export const PurchaseTripTab: React.FC<PurchaseTripTabProps> = ({
  trips,
  settings,
  language,
  onOpenCalculator,
  onCreateTrip,
  onUpdateTrip,
  onAddCashToTrip,
  onAddExpense,
  onDeleteExpense,
  onUpdateTripStatus,
  onDeleteTrip,
  onSyncTripToCashbook,
  onPrintTripSlip,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';

  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'purchases' | 'trips'>('purchases');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals state
  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<PurchaseTrip | null>(null);
  const [addCashTrip, setAddCashTrip] = useState<PurchaseTrip | null>(null);

  useBackHandler('purchaseAddExpenseModal', isAddPurchaseModalOpen, () => {
    setIsAddPurchaseModalOpen(false);
    return true;
  }, 35);

  useBackHandler('purchaseNewTripModal', isNewTripModalOpen, () => {
    setIsNewTripModalOpen(false);
    return true;
  }, 35);

  useBackHandler('purchaseEditTripModal', Boolean(editingTrip), () => {
    setEditingTrip(null);
    return true;
  }, 35);

  useBackHandler('purchaseAddCashModal', Boolean(addCashTrip), () => {
    setAddCashTrip(null);
    return true;
  }, 35);

  // Target trip selector
  const [targetTripId, setTargetTripId] = useState<string>(
    trips.find((t) => t.status === 'active')?.id || trips[0]?.id || ''
  );

  const targetTrip =
    trips.find((t) => t.id === targetTripId) ||
    trips.find((t) => t.status === 'active') ||
    trips[0];

  // New Trip form inside Modal
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripMarket, setNewTripMarket] = useState('');
  const [newTripInitialCash, setNewTripInitialCash] = useState('');
  const [newTripNote, setNewTripNote] = useState('');

  // Edit trip form
  const [editTripTitle, setEditTripTitle] = useState('');
  const [editTripMarket, setEditTripMarket] = useState('');
  const [editTripInitialCash, setEditTripInitialCash] = useState('');
  const [editTripNote, setEditTripNote] = useState('');

  // Expanded Trip Accordion in trips view
  const [expandedTripId, setExpandedTripId] = useState<string | null>(
    trips.find((t) => t.status === 'active')?.id || trips[0]?.id || null
  );

  // Sync feedback
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Active trips
  const activeTrips = trips.filter((t) => t.status === 'active');
  const completedTrips = trips.filter((t) => t.status === 'completed');

  // Overall Totals
  const totalInitialAll = trips.reduce((sum, t) => sum + t.initialCash, 0);
  const totalSpentAll = trips.reduce((sum, t) => sum + t.totalSpent, 0);
  const totalRemainingAll = trips.reduce((sum, t) => sum + t.remainingCash, 0);

  // Flat list of all stock purchases across trips
  interface FlattenedPurchase extends PurchaseExpenseItem {
    tripId: string;
    tripTitle: string;
    tripStatus: 'active' | 'completed';
  }

  const allPurchases: FlattenedPurchase[] = useMemo(() => {
    const list: FlattenedPurchase[] = [];
    trips.forEach((trip) => {
      trip.expenses.forEach((exp) => {
        list.push({
          ...exp,
          tripId: trip.id,
          tripTitle: trip.title,
          tripStatus: trip.status,
        });
      });
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [trips]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return allPurchases.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.vendorOrPlace && p.vendorOrPlace.toLowerCase().includes(q)) ||
        (p.note && p.note.toLowerCase().includes(q)) ||
        p.tripTitle.toLowerCase().includes(q)
      );
    });
  }, [allPurchases, categoryFilter, searchTerm]);

  // Total amount of filtered purchases
  const filteredPurchasesTotal = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPurchases]);

  // Handle Create Trip submit
  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const initialCash = parseFloat(newTripInitialCash);
    if (!newTripTitle.trim() || isNaN(initialCash) || initialCash < 0) {
      alert(isBn ? 'সঠিক ট্রিপের নাম ও টাকার পরিমাণ লিখুন' : 'Please enter valid title and initial cash');
      return;
    }

    onCreateTrip(
      newTripTitle.trim(),
      initialCash,
      newTripMarket.trim() || undefined,
      newTripNote.trim() || undefined
    );

    setNewTripTitle('');
    setNewTripMarket('');
    setNewTripInitialCash('');
    setNewTripNote('');
    setIsNewTripModalOpen(false);
  };

  // Handle Edit Trip
  const handleEditTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    const cash = parseFloat(editTripInitialCash);
    if (!editTripTitle.trim() || isNaN(cash) || cash < 0) return;

    if (onUpdateTrip) {
      onUpdateTrip(editingTrip.id, {
        title: editTripTitle.trim(),
        initialCash: cash,
        marketLocation: editTripMarket.trim() || undefined,
        note: editTripNote.trim() || undefined,
      });
    }
    setEditingTrip(null);
  };

  // Print Trip Receipt
  const handlePrintSlip = (trip: PurchaseTrip) => {
    const invoiceNo = 'PUR-' + String(Date.now()).slice(-5);
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const items = trip.expenses.map((exp) => ({
      id: exp.id,
      name: `${exp.title}${exp.vendorOrPlace ? ` (${exp.vendorOrPlace})` : ''}`,
      price: exp.amount,
      qty: 1,
      total: exp.amount,
    }));

    if (items.length === 0) {
      items.push({
        id: 'no-exp',
        name: isBn ? 'কোনো খরচ এন্ট্রি নেই' : 'No expenses recorded',
        price: 0,
        qty: 1,
        total: 0,
      });
    }

    const bill: BillInvoice = {
      id: 'trip-slip-' + trip.id,
      invoiceNo,
      date: dateFormatted,
      timestamp: Date.now(),
      customerName: `${trip.title}${trip.marketLocation ? ` [${trip.marketLocation}]` : ''}`,
      customerPhone: `Cash Taken: ${sym}${trip.initialCash} | Left: ${sym}${trip.remainingCash}`,
      items,
      subtotal: trip.totalSpent,
      discount: 0,
      grandTotal: trip.totalSpent,
      paymentMethod: 'cash',
      paidAmount: trip.totalSpent,
      changeAmount: trip.remainingCash,
    };

    onPrintTripSlip(bill);
  };

  // Sync to Daybook handler
  const handleSyncToCashbook = (trip: PurchaseTrip) => {
    onSyncTripToCashbook(trip);
    setSyncFeedback(trip.id);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  // Category Icon & Label helper
  const getCatMeta = (cat: PurchaseExpenseCategory) => {
    switch (cat) {
      case 'goods':
        return { label: isBn ? 'মাল / কাপড়' : 'Goods / Stock', color: 'bg-blue-100 text-blue-800' };
      case 'transport':
        return { label: isBn ? 'পরিবহন / গাড়ি' : 'Transport', color: 'bg-amber-100 text-amber-800' };
      case 'labour':
        return { label: isBn ? 'কুলি / লেবার' : 'Labour', color: 'bg-purple-100 text-purple-800' };
      case 'food':
        return { label: isBn ? 'খাবার / নাস্তা' : 'Food / Meal', color: 'bg-rose-100 text-rose-800' };
      case 'packing':
        return { label: isBn ? 'প্যাকিং / বস্তা' : 'Packaging', color: 'bg-emerald-100 text-emerald-800' };
      default:
        return { label: isBn ? 'অন্যান্য খরচ' : 'Other', color: 'bg-stone-100 text-stone-800' };
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3.5 pb-28">
      {/* 1. KHATABOOK / VYAPAR TOP SUMMARY CARDS */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-sm border border-stone-200/90 space-y-3">
        {/* Header & Calculator Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                {isBn ? 'সাপ্লায়ার ও মাল কেনাকাটা লেজার' : 'Supplier & Stock Purchases'}
              </h2>
              <p className="text-[11px] text-stone-400">
                {isBn ? 'পাইকারি কেনাকাটা ও খরচের হিসাব' : 'Stock purchases and supplier payments'}
              </p>
            </div>
          </div>

          {onOpenCalculator && (
            <button
              type="button"
              onClick={onOpenCalculator}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={isBn ? 'ক্যালকুলেটর খুলুন (পাইকারি ও ডজন হিসাব)' : 'Open Wholesale Calculator'}
            >
              <Calculator className="w-3.5 h-3.5 text-amber-700" />
              <span>{isBn ? 'ক্যালকুলেটর' : 'Calc'}</span>
            </button>
          )}
        </div>

        {/* 3 Compact Metric Cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Total Purchases */}
          <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
            <span className="block text-[10px] uppercase font-bold text-stone-500">
              {isBn ? 'মোট কেনাকাটা' : 'Total Spent'}
            </span>
            <span className="text-xs sm:text-base font-black text-stone-900 font-mono block mt-0.5">
              {sym}{totalSpentAll.toFixed(0)}
            </span>
            <span className="text-[9px] text-stone-400 font-medium">
              {allPurchases.length} {isBn ? 'টি এন্ট্রি' : 'items'}
            </span>
          </div>

          {/* Total Cash Carried / Allocated */}
          <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200/80">
            <span className="block text-[10px] uppercase font-bold text-blue-700">
              {isBn ? 'বরাদ্দকৃত ক্যাশ' : 'Cash Carried'}
            </span>
            <span className="text-xs sm:text-base font-black text-blue-700 font-mono block mt-0.5">
              {sym}{totalInitialAll.toFixed(0)}
            </span>
            <span className="text-[9px] text-blue-600 font-medium">
              {trips.length} {isBn ? 'ট্রিপ' : 'trips'}
            </span>
          </div>

          {/* Remaining Cash */}
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
            <span className="block text-[10px] uppercase font-bold text-emerald-700">
              {isBn ? 'অবশিষ্ট ক্যাশ' : 'Cash Left'}
            </span>
            <span
              className={`text-xs sm:text-base font-black font-mono block mt-0.5 ${
                totalRemainingAll >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {sym}{totalRemainingAll.toFixed(0)}
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">
              {totalRemainingAll >= 0 ? (isBn ? 'উদ্বৃত্ত' : 'Balance') : (isBn ? 'ঘাটতি' : 'Over')}
            </span>
          </div>
        </div>

        {/* View Mode Toggle: Purchases Ledger vs Shopping Trips */}
        <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveView('purchases')}
            className={`py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'purchases'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{isBn ? 'পণ্য ও সাপ্লায়ার লেজার' : 'Purchase Items'} ({allPurchases.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('trips')}
            className={`py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'trips'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isBn ? 'বাজার ট্রিপ তালিকা' : 'Market Trips'} ({trips.length})</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH & CATEGORY FILTER BAR */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isBn
                ? 'সাপ্লায়ার, পণ্যের বিবরণ বা মার্কেট দিয়ে খুঁজুন...'
                : 'Search by Supplier, item, or market...'
            }
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

        {/* Category filter pills for purchases view */}
        {activeView === 'purchases' && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {isBn ? 'সব কেনাকাটা' : 'All Purchases'}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('goods')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'goods'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
              }`}
            >
              {isBn ? 'মাল / কাপড় (Goods)' : 'Goods'}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('transport')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'transport'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {isBn ? 'পরিবহন' : 'Transport'}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('labour')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'labour'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {isBn ? 'লেবার / কুলি' : 'Labour'}
            </button>
          </div>
        )}
      </div>

      {/* 3. MAIN VIEW: SUPPLIER / PURCHASE LEDGER LIST */}
      {activeView === 'purchases' ? (
        <div className="space-y-2">
          {filteredPurchases.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 space-y-2">
              <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
              <p className="text-xs font-bold text-stone-700">
                {isBn ? 'কোনো ক্রয়ের এন্ট্রি পাওয়া যায়নি' : 'No purchase entries found'}
              </p>
              <p className="text-[11px] text-stone-400">
                {isBn
                  ? 'নিচের "+ কেনাকাটা যোগ" বোতাম দিয়ে পণ্য বা খরচ এন্ট্রি করুন'
                  : 'Tap "+ ADD PURCHASE" button below to log items bought'}
              </p>
            </div>
          ) : (
            filteredPurchases.map((purchase) => {
              const catMeta = getCatMeta(purchase.category);

              return (
                <div
                  key={purchase.id}
                  className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 p-3 sm:p-3.5 shadow-2xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    {/* Supplier / Vendor Name & Category */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                        {purchase.vendorOrPlace || (isBn ? 'পাইকারি সাপ্লায়ার' : 'Wholesale Supplier')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${catMeta.color}`}
                      >
                        {catMeta.label}
                      </span>
                    </div>

                    {/* Item Description & Trip */}
                    <p className="text-xs font-semibold text-stone-700 mt-0.5 truncate">
                      {purchase.title}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                      <span>{purchase.dateFormatted}</span>
                      <span>•</span>
                      <span className="text-stone-500 font-medium truncate max-w-[150px]">
                        {purchase.tripTitle}
                      </span>
                      {purchase.note && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{purchase.note}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black text-rose-600 font-mono tracking-tight">
                        -{sym}{purchase.amount.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold block -mt-0.5">
                        {isBn ? 'নগদ পরিশোধ' : 'Paid'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteExpense(purchase.tripId, purchase.id)}
                      className="p-1.5 rounded-xl text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title={isBn ? 'ডিলিট করুন' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 4. TRIPS ACCORDION VIEW */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600">
              {isBn ? 'বাজার ট্রিপ তালিকা' : 'Market Trips List'} ({trips.length})
            </span>
            <button
              type="button"
              onClick={() => setIsNewTripModalOpen(true)}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? '+ নতুন ট্রিপ' : '+ Start Trip'}</span>
            </button>
          </div>

          {trips.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-stone-200 text-xs text-stone-400">
              {isBn ? 'কোনো ট্রিপ নেই' : 'No trips started'}
            </div>
          ) : (
            trips.map((trip) => {
              const isExpanded = expandedTripId === trip.id;
              const isActive = trip.status === 'active';

              return (
                <div
                  key={trip.id}
                  className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                    isActive ? 'border-blue-400 ring-1 ring-blue-400/30' : 'border-stone-200'
                  }`}
                >
                  <div className="p-3.5 flex items-center justify-between gap-2.5">
                    <div
                      onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                      className="cursor-pointer min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-stone-900">{trip.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {isActive ? (isBn ? 'চলমান ট্রিপ' : 'Active') : (isBn ? 'সম্পন্ন' : 'Completed')}
                        </span>
                        {trip.marketLocation && (
                          <span className="text-[11px] text-stone-500 flex items-center gap-1 bg-stone-50 px-1.5 py-0.2 rounded">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {trip.marketLocation}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-1">
                        <span>{trip.dateFormatted}</span>
                        <span>•</span>
                        <span>{trip.expenses.length} {isBn ? 'টি আইটেম' : 'expenses'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-stone-500">
                        {isBn ? 'খরচ:' : 'Spent:'}{' '}
                        <span className="text-rose-600 font-mono font-black">{sym}{trip.totalSpent.toFixed(0)}</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {isBn ? 'ক্যাশ অবশিষ্ট:' : 'Left:'}{' '}
                        <span className="text-emerald-600 font-mono font-bold">{sym}{trip.remainingCash.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="px-3.5 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-1 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetTripId(trip.id);
                          setIsAddPurchaseModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isBn ? '+ আইটেম' : '+ Item'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAddCashTrip(trip);
                        }}
                        className="px-2.5 py-1 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-xl font-bold cursor-pointer"
                      >
                        + {isBn ? 'ক্যাশ যোগ' : 'Cash'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintSlip(trip)}
                        className="p-1.5 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-200 cursor-pointer"
                        title={isBn ? 'স্লিপ প্রিন্ট করুন' : 'Print Slip'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSyncToCashbook(trip)}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[11px] cursor-pointer"
                        title={isBn ? 'ডেবুকে খরচ সিঙ্ক করুন' : 'Sync to Daybook'}
                      >
                        {syncFeedback === trip.id ? 'Synced!' : 'Daybook'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTripStatus(trip.id, isActive ? 'completed' : 'active')
                        }
                        className={`px-2 py-1 rounded-xl font-bold text-[11px] cursor-pointer ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {isActive ? (isBn ? 'সম্পন্ন করুন' : 'Finish') : (isBn ? 'পুনরায় চালু' : 'Reopen')}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Items */}
                  {isExpanded && trip.expenses.length > 0 && (
                    <div className="p-3 bg-stone-50/50 border-t border-dashed border-stone-200 space-y-1 text-xs">
                      {trip.expenses.map((e) => (
                        <div key={e.id} className="flex justify-between items-center py-1">
                          <span className="font-medium text-stone-800">
                            {e.title} {e.vendorOrPlace && <span className="text-stone-400">({e.vendorOrPlace})</span>}
                          </span>
                          <span className="font-mono font-bold text-rose-600">
                            -{sym}{e.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. FLOATING "+ ADD PURCHASE" BUTTON (Khatabook Style) */}
      <button
        id="floating-add-purchase-btn"
        type="button"
        onClick={() => setIsAddPurchaseModalOpen(true)}
        className="fixed bottom-20 right-4 sm:right-8 z-30 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border-2 border-white cursor-pointer transition-all animate-in fade-in duration-200"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>{isBn ? '+ কেনাকাটা যোগ' : '+ ADD PURCHASE'}</span>
      </button>

      {/* 6. MODAL: ADD PURCHASE / EXPENSE ENTRY (WITH EMBEDDED KHATABOOK CALCULATOR) */}
      {isAddPurchaseModalOpen && (
        <KhatabookEntryModal
          isOpen={isAddPurchaseModalOpen}
          onClose={() => setIsAddPurchaseModalOpen(false)}
          onSave={(payload: KhatabookEntryPayload) => {
            const currentTrip = targetTrip || trips[0];
            if (!currentTrip) {
              const defaultTitle = isBn ? 'পাইকারি কেনাকাটা' : 'Stock Purchases';
              onCreateTrip(defaultTitle, payload.amount * 2, payload.vendorOrParty || (isBn ? 'পাইকারি মার্কেট' : 'Wholesale Market'));
              setIsAddPurchaseModalOpen(false);
              return;
            }
            const category = (payload.category as PurchaseExpenseCategory) || 'goods';
            const details = payload.details || (isBn ? 'পাইকারি কেনাকাটা' : 'Stock Purchase');
            onAddExpense(currentTrip.id, {
              title: details,
              category,
              amount: payload.amount,
              vendorOrPlace: payload.vendorOrParty || undefined,
            });
            setIsAddPurchaseModalOpen(false);
          }}
          entryType="purchase"
          settings={settings}
          language={language}
          tripTitle={targetTrip?.title || trips[0]?.title}
        />
      )}

      {/* 7. MODAL: START NEW PURCHASE / MARKET TRIP */}
      {isNewTripModalOpen && (
        <div
          id="new-trip-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="new-trip-modal-card"
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  {isBn ? 'নতুন বাজার ট্রিপ শুরু করুন' : 'Start New Purchase Trip'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTripModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTripSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'ট্রিপের নাম বা বিবরণ *' : 'Trip Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)}
                  placeholder={isBn ? 'উদাঃ চকবাজার থেকে পাইকারি শাড়ি কেনা' : 'e.g. Wholesale Cloth Shopping'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'মার্কেট বা বাজারের নাম' : 'Market Location'}
                </label>
                <input
                  type="text"
                  value={newTripMarket}
                  onChange={(e) => setNewTripMarket(e.target.value)}
                  placeholder={isBn ? 'উদাঃ চকবাজার / ইসলামপুর' : 'e.g. Islampur Market'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'সাথে নেওয়া ক্যাশ টাকা (বাজেট) *' : 'Initial Cash Carried *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-stone-400 text-sm">
                    {sym}
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newTripInitialCash}
                    onChange={(e) => setNewTripInitialCash(e.target.value)}
                    placeholder="10000"
                    className="w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base font-mono font-black focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'নোট' : 'Note (Optional)'}
                </label>
                <input
                  type="text"
                  value={newTripNote}
                  onChange={(e) => setNewTripNote(e.target.value)}
                  placeholder={isBn ? 'উদাঃ ঈদের কালেকশন' : 'e.g. Festive Collection'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTripModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBn ? 'ট্রিপ শুরু করুন' : 'Start Trip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: ADD ADDITIONAL CASH TO TRIP (WITH EMBEDDED KHATABOOK CALCULATOR) */}
      {addCashTrip && (
        <KhatabookEntryModal
          isOpen={!!addCashTrip}
          onClose={() => setAddCashTrip(null)}
          onSave={(payload: KhatabookEntryPayload) => {
            onAddCashToTrip(addCashTrip.id, payload.amount);
            setAddCashTrip(null);
          }}
          entryType="add_cash"
          partyName={addCashTrip.title}
          settings={settings}
          language={language}
        />
      )}
    </div>
  );
};
