import React, { useState } from 'react';
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

interface PurchaseTripTabProps {
  trips: PurchaseTrip[];
  settings: ThermalPrinterSettings;
  language: Language;
  onCreateTrip: (
    title: string,
    initialCash: number,
    marketLocation?: string,
    note?: string
  ) => void;
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
  onCreateTrip,
  onAddExpense,
  onDeleteExpense,
  onUpdateTripStatus,
  onDeleteTrip,
  onSyncTripToCashbook,
  onPrintTripSlip,
}) => {
  const t = translations[language];
  const sym = settings.currencySymbol || '₹';

  // Modals state
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [activeExpenseTrip, setActiveExpenseTrip] = useState<PurchaseTrip | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(
    trips.find((t) => t.status === 'active')?.id || trips[0]?.id || null
  );

  // New Trip Form state
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripMarket, setNewTripMarket] = useState('');
  const [newTripInitialCash, setNewTripInitialCash] = useState('');
  const [newTripNote, setNewTripNote] = useState('');

  // Add Expense Form state
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<PurchaseExpenseCategory>('goods');
  const [expVendor, setExpVendor] = useState('');
  const [expNote, setExpNote] = useState('');

  // Calculations for Summary
  const totalInitialAll = trips.reduce((sum, tr) => sum + tr.initialCash, 0);
  const totalSpentAll = trips.reduce((sum, tr) => sum + tr.totalSpent, 0);
  const totalRemainingAll = trips.reduce((sum, tr) => sum + tr.remainingCash, 0);

  const activeTrips = trips.filter((t) => t.status === 'active');
  const completedTrips = trips.filter((t) => t.status === 'completed');

  // Handle New Trip Submit
  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(newTripInitialCash);
    if (!newTripTitle.trim() || isNaN(cash) || cash < 0) {
      alert(language === 'bn' ? 'সঠিক শিরোনাম ও সাথে নেওয়া টাকার পরিমাণ লিখুন' : 'Please enter valid title and cash amount');
      return;
    }

    onCreateTrip(newTripTitle.trim(), cash, newTripMarket.trim(), newTripNote.trim());
    setIsNewTripModalOpen(false);
    setNewTripTitle('');
    setNewTripMarket('');
    setNewTripInitialCash('');
    setNewTripNote('');
  };

  // Handle Add Expense Submit
  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExpenseTrip) return;
    const amount = parseFloat(expAmount);
    if (!expTitle.trim() || isNaN(amount) || amount <= 0) {
      alert(language === 'bn' ? 'সঠিক খরচের বিবরণ ও পরিমাণ লিখুন' : 'Please enter valid expense title and amount');
      return;
    }

    onAddExpense(activeExpenseTrip.id, {
      title: expTitle.trim(),
      amount,
      category: expCategory,
      vendorOrPlace: expVendor.trim(),
      note: expNote.trim(),
    });

    setActiveExpenseTrip(null);
    setExpTitle('');
    setExpAmount('');
    setExpCategory('goods');
    setExpVendor('');
    setExpNote('');
  };

  // Generate Thermal Print Slip for Trip
  const handlePrintSlip = (trip: PurchaseTrip) => {
    const invoiceNo = 'TRIP-' + String(trip.timestamp).slice(-5);
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    // Convert trip expenses to bill items for thermal receipt printer
    const items = trip.expenses.map((exp, idx) => ({
      id: exp.id || `item-${idx}`,
      name: `${exp.title}${exp.vendorOrPlace ? ` (${exp.vendorOrPlace})` : ''}`,
      price: exp.amount,
      qty: 1,
      total: exp.amount,
    }));

    if (items.length === 0) {
      items.push({
        id: 'no-exp',
        name: language === 'bn' ? 'কোনো খরচ তালিকাভুক্ত নেই' : 'No expenses recorded',
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

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      {/* 1. TOP HEADER & INTRO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-stone-900">
              {t.purchaseHeaderTitle}
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl">
            {t.purchaseHeaderSubtitle}
          </p>
        </div>

        <button
          onClick={() => setIsNewTripModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.startNewTripBtn}</span>
        </button>
      </div>

      {/* 2. THREE SUMMARY CARDS (CASH TAKEN, TOTAL SPENT, REMAINING) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Card 1: Initial Cash Carried */}
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span>{t.cashTakenCard}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-200 text-blue-800 font-mono">
              {trips.length} Trips
            </span>
          </div>
          <span className="text-2xl font-black text-blue-700 font-mono block">
            {sym}
            {totalInitialAll.toFixed(2)}
          </span>
          <p className="text-[10px] text-blue-600/80 mt-0.5">
            {language === 'bn' ? 'বাজার করার জন্য সাথে নেওয়া টাকা' : 'Total cash allocated for purchases'}
          </p>
        </div>

        {/* Card 2: Total Spent (কোথায় কত ব্যয় হলো) */}
        <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>{t.totalSpentCard}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-800">
              {totalInitialAll > 0 ? ((totalSpentAll / totalInitialAll) * 100).toFixed(0) : 0}% Spent
            </span>
          </div>
          <span className="text-2xl font-black text-rose-600 font-mono block">
            {sym}
            {totalSpentAll.toFixed(2)}
          </span>
          <p className="text-[10px] text-rose-600/80 mt-0.5">
            {language === 'bn' ? 'মাল কেনা, গাড়ি ভাড়া ও বিবিধ খরচ' : 'Spent on goods, transport & expenses'}
          </p>
        </div>

        {/* Card 3: Remaining Balance (অবশিষ্ট ক্যাশ) */}
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>{t.remainingCashCard}</span>
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                totalRemainingAll >= 0
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-rose-200 text-rose-800'
              }`}
            >
              {totalRemainingAll >= 0
                ? language === 'bn'
                  ? 'উদ্বৃত্ত ক্যাশ'
                  : 'Cash Left'
                : language === 'bn'
                ? 'বাজেট অতিরিক্ত'
                : 'Over Budget'}
            </span>
          </div>
          <span
            className={`text-2xl font-black font-mono block ${
              totalRemainingAll >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {sym}
            {totalRemainingAll.toFixed(2)}
          </span>
          <p className="text-[10px] text-emerald-600/80 mt-0.5">
            {language === 'bn' ? 'খরচের পর ক্যাশে ফেরত আসবে' : 'Cash remaining after shopping'}
          </p>
        </div>
      </div>

      {/* 3. ACTIVE SHOPPING TRIPS (চলমান ট্রিপ) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t.activeTripsHeading}</span>
            <span className="text-xs font-normal text-stone-500">({activeTrips.length})</span>
          </h2>
        </div>

        {activeTrips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-xs text-stone-500 max-w-md mx-auto">{t.noActiveTrips}</p>
            <button
              onClick={() => setIsNewTripModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.startNewTripBtn}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTrips.map((trip) => {
              const isExpanded = expandedTripId === trip.id;
              const spendPercentage =
                trip.initialCash > 0
                  ? Math.min(100, Math.round((trip.totalSpent / trip.initialCash) * 100))
                  : 0;

              return (
                <div
                  key={trip.id}
                  className="bg-white rounded-2xl border-2 border-blue-500/80 shadow-xs overflow-hidden transition-all"
                >
                  {/* Trip Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/50 via-white to-stone-50 border-b border-stone-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>{t.tripStatusActive}</span>
                          </span>
                          <span className="font-extrabold text-stone-900 text-sm sm:text-base">
                            {trip.title}
                          </span>
                          {trip.marketLocation && (
                            <span className="text-xs text-stone-600 flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md">
                              <MapPin className="w-3 h-3 text-stone-400" />
                              {trip.marketLocation}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {trip.dateFormatted}
                          </span>
                          {trip.note && <span>• {trip.note}</span>}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setActiveExpenseTrip(trip);
                            setExpTitle('');
                            setExpAmount('');
                            setExpCategory('goods');
                            setExpVendor('');
                            setExpNote('');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.addExpenseBtn}</span>
                        </button>

                        <button
                          onClick={() => handlePrintSlip(trip)}
                          className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer"
                          title={t.printTripSlipBtn}
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onUpdateTripStatus(trip.id, 'completed')}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="কেনাকাটা সম্পন্ন হিসেবে চিহ্নিত করুন"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t.finishTripBtn}</span>
                        </button>

                        <button
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="p-2 text-stone-400 hover:text-stone-700 rounded-xl transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Amount breakdown */}
                    <div className="mt-4 pt-3 border-t border-stone-200/80">
                      <div className="grid grid-cols-3 gap-2 text-center sm:text-left mb-2.5">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-semibold block">
                            {t.cashTakenCard}
                          </span>
                          <span className="text-base sm:text-lg font-black font-mono text-blue-700">
                            {sym}
                            {trip.initialCash.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-semibold block">
                            {t.totalSpentCard}
                          </span>
                          <span className="text-base sm:text-lg font-black font-mono text-rose-600">
                            {sym}
                            {trip.totalSpent.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-semibold block">
                            {t.remainingCashCard}
                          </span>
                          <span
                            className={`text-base sm:text-lg font-black font-mono ${
                              trip.remainingCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {sym}
                            {trip.remainingCash.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Visual Spending Progress Track */}
                      <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden border border-stone-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            spendPercentage > 95
                              ? 'bg-rose-500'
                              : spendPercentage > 75
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, spendPercentage)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-stone-400 mt-1 font-mono">
                        <span>{spendPercentage}% Spent</span>
                        <span>
                          {trip.remainingCash >= 0 ? 'Left' : 'Over'}: {sym}
                          {Math.abs(trip.remainingCash).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Expenses (কোথায় কত খরচ হলো) */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-stone-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-blue-600" />
                          <span>{t.whereSpent}</span>
                          <span className="text-[11px] font-normal text-stone-400">
                            ({trip.expenses?.length || 0} টি এন্ট্রি)
                          </span>
                        </h3>

                        <button
                          onClick={() => {
                            setActiveExpenseTrip(trip);
                            setExpTitle('');
                            setExpAmount('');
                            setExpCategory('goods');
                            setExpVendor('');
                            setExpNote('');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.addExpenseBtn}</span>
                        </button>
                      </div>

                      {!trip.expenses || trip.expenses.length === 0 ? (
                        <div className="p-6 text-center bg-white rounded-xl border border-stone-200 text-stone-400 text-xs">
                          <p>{t.noExpensesYet}</p>
                          <button
                            onClick={() => setActiveExpenseTrip(trip)}
                            className="mt-2 text-blue-600 hover:underline font-bold text-xs inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t.addExpenseBtn}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {trip.expenses.map((expense) => {
                            const badge = getCategoryBadge(expense.category, language);
                            return (
                              <div
                                key={expense.id}
                                className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-stone-300 transition-colors"
                              >
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.className}`}
                                    >
                                      {badge.label}
                                    </span>
                                    <span className="text-xs font-bold text-stone-900">
                                      {expense.title}
                                    </span>
                                    {expense.vendorOrPlace && (
                                      <span className="text-[11px] text-stone-600 flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md font-medium">
                                        <Store className="w-3 h-3 text-stone-400" />
                                        <span>{expense.vendorOrPlace}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-1">
                                    <span className="font-mono">{expense.dateFormatted}</span>
                                    {expense.note && <span>• {expense.note}</span>}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  <span className="text-sm font-black font-mono text-rose-600">
                                    {sym}
                                    {expense.amount.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (confirm('এই খরচের এন্ট্রি মুছে ফেলতে চান?')) {
                                        onDeleteExpense(trip.id, expense.id);
                                      }
                                    }}
                                    className="p-1 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="খরচ মুছুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Cashbook Sync & Thermal Print Action Bar */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200">
                        <div className="flex items-center gap-2">
                          {trip.syncedCashEntryId ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{t.syncedBadge}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => onSyncTripToCashbook(trip)}
                              className="text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-200/80 hover:bg-stone-300 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                              title="ক্যাশবুকে মোট খরচ এক ক্লিকে রেকর্ড করুন"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                              <span>{t.syncToCashbookBtn}</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handlePrintSlip(trip)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{t.printTripSlipBtn}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. COMPLETED TRIPS (সম্পন্ন কেনাকাটা রেকর্ড) */}
      {completedTrips.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-stone-200">
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-stone-500" />
            <span>{t.completedTripsHeading}</span>
            <span className="text-xs font-normal text-stone-400">
              ({completedTrips.length})
            </span>
          </h2>

          <div className="space-y-3">
            {completedTrips.map((trip) => {
              const isExpanded = expandedTripId === trip.id;

              return (
                <div
                  key={trip.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs"
                >
                  <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                          {t.tripStatusCompleted}
                        </span>
                        <span className="font-bold text-stone-900 text-sm">{trip.title}</span>
                        {trip.marketLocation && (
                          <span className="text-[11px] text-stone-500 font-medium">
                            • {trip.marketLocation}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                        <span>{trip.dateFormatted}</span>
                        <span>
                          • {trip.expenses?.length || 0} {language === 'bn' ? 'টি খরচ' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-xs text-stone-400 block -mb-0.5 font-mono">
                          {sym}
                          {trip.initialCash} → {sym}
                          {trip.totalSpent}
                        </span>
                        <span
                          className={`text-sm font-black font-mono ${
                            trip.remainingCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {language === 'bn' ? 'ফেরত' : 'Left'}: {sym}
                          {trip.remainingCash.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePrintSlip(trip)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
                          title={t.printTripSlipBtn}
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onUpdateTripStatus(trip.id, 'active')}
                          className="px-2 py-1 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer"
                          title="পুনরায় সক্রিয় করুন"
                        >
                          {t.reopenTripBtn}
                        </button>

                        <button
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('এই ট্রিপ সম্পূর্ণ মুছে ফেলতে চান?')) {
                              onDeleteTrip(trip.id);
                            }
                          }}
                          className="p-1.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown for Completed Trip */}
                  {isExpanded && (
                    <div className="p-3.5 sm:p-4 bg-stone-50 border-t border-stone-200 space-y-2">
                      <div className="space-y-1.5">
                        {trip.expenses?.map((exp) => (
                          <div
                            key={exp.id}
                            className="p-2 bg-white rounded-lg border border-stone-200/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-stone-800">{exp.title}</span>
                              {exp.vendorOrPlace && (
                                <span className="text-[11px] text-stone-500">
                                  ({exp.vendorOrPlace})
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-stone-900">
                              {sym}
                              {exp.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. START NEW TRIP MODAL */}
      {isNewTripModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-stone-100 bg-gradient-to-r from-blue-50/80 via-white to-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    {language === 'bn' ? 'নতুন মাল কেনাকাটা / বাজার ট্রিপ' : 'New Stock Purchase Trip'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {language === 'bn'
                      ? 'সাথে কত টাকা নিয়ে বের হচ্ছেন তা এন্ট্রি করুন'
                      : 'Record cash taken before heading out'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewTripModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTripSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.tripTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)}
                  placeholder={t.tripTitlePlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.initialCashLabel}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono font-bold">
                    {sym}
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newTripInitialCash}
                    onChange={(e) => setNewTripInitialCash(e.target.value)}
                    placeholder={t.initialCashPlaceholder}
                    className="w-full border border-stone-200 bg-stone-50/80 pl-8 pr-3 py-2.5 rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:border-blue-600 text-blue-700"
                  />
                </div>

                {/* Quick amount suggestion chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-stone-400">দ্রুত নির্বাচন:</span>
                  {[5000, 10000, 15000, 20000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setNewTripInitialCash(amt.toString())}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition-colors cursor-pointer"
                    >
                      {sym}
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.tripMarketLabel}
                </label>
                <input
                  type="text"
                  value={newTripMarket}
                  onChange={(e) => setNewTripMarket(e.target.value)}
                  placeholder={t.tripMarketPlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.tripNoteLabel}
                </label>
                <input
                  type="text"
                  value={newTripNote}
                  onChange={(e) => setNewTripNote(e.target.value)}
                  placeholder={t.tripNotePlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTripModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{t.startTripSubmit}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ADD EXPENSE MODAL (কোথায় খরচ হলো যোগ করুন) */}
      {activeExpenseTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-stone-100 bg-gradient-to-r from-rose-50/70 via-white to-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    {t.addExpenseModalTitle}
                  </h2>
                  <p className="text-xs text-stone-500 font-medium truncate max-w-[240px]">
                    {activeExpenseTrip.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveExpenseTrip(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="p-5 space-y-3.5">
              {/* Trip Current Remaining Cash Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-800">
                  {language === 'bn' ? 'বর্তমান সাথে থাকা ক্যাশ:' : 'Current Cash in Hand:'}
                </span>
                <span className="font-bold font-mono text-emerald-700 text-sm">
                  {sym}
                  {activeExpenseTrip.remainingCash.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.expenseTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder={t.expenseTitlePlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-600"
                />
              </div>

              {/* Quick suggestion tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-stone-400">{t.quickItemsTitle}</span>
                {[
                  { tag: t.tagGoodsSaree, cat: 'goods' as const },
                  { tag: t.tagFabric, cat: 'goods' as const },
                  { tag: t.tagTransport, cat: 'transport' as const },
                  { tag: t.tagSnacks, cat: 'food' as const },
                  { tag: t.tagLabour, cat: 'labour' as const },
                ].map(({ tag, cat }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setExpTitle(tag);
                      setExpCategory(cat);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.expenseAmountLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono font-bold">
                      {sym}
                    </span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-stone-200 bg-stone-50/80 pl-8 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-rose-600 text-rose-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.expenseCategoryLabel}
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as PurchaseExpenseCategory)}
                    className="w-full border border-stone-200 bg-stone-50/80 px-2.5 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-600"
                  >
                    <option value="goods">{t.catGoods}</option>
                    <option value="transport">{t.catTransport}</option>
                    <option value="food">{t.catFood}</option>
                    <option value="labour">{t.catLabour}</option>
                    <option value="packing">{t.catPacking}</option>
                    <option value="other">{t.catOther}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.expenseVendorLabel}
                </label>
                <input
                  type="text"
                  value={expVendor}
                  onChange={(e) => setExpVendor(e.target.value)}
                  placeholder={t.expenseVendorPlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.expenseNoteLabel}
                </label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder={t.expenseNotePlaceholder}
                  className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-rose-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveExpenseTrip(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{t.saveExpenseBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
