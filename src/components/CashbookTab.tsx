import React, { useState } from 'react';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Wallet,
  Receipt,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { CashEntry, CashEntryType, ThermalPrinterSettings, BillInvoice } from '../types';

interface CashbookTabProps {
  entries: CashEntry[];
  bills?: BillInvoice[];
  settings: ThermalPrinterSettings;
  onAddEntry: (type: CashEntryType, amount: number, note: string) => void;
  onDeleteEntry: (id: string) => void;
}

export const CashbookTab: React.FC<CashbookTabProps> = ({
  entries,
  bills = [],
  settings,
  onAddEntry,
  onDeleteEntry,
}) => {
  const [cashType, setCashType] = useState<CashEntryType>('Expense');
  const [cashAmount, setCashAmount] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'entries' | 'bills'>('entries');

  const sym = settings.currencySymbol || '₹';

  // Helper to check if a timestamp is today
  const isToday = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  // 1. Calculate Today's Invoiced Sales
  const todaysBills = bills.filter((b) => isToday(b.timestamp));
  const todaysPaidBills = todaysBills.filter((b) => b.paymentMethod !== 'due');
  const todaysDueBills = todaysBills.filter((b) => b.paymentMethod === 'due');

  const todaysBilledSales = todaysPaidBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const todaysDueSales = todaysDueBills.reduce((sum, b) => sum + b.grandTotal, 0);

  // By payment mode today
  const cashSales = todaysPaidBills
    .filter((b) => b.paymentMethod === 'cash')
    .reduce((sum, b) => sum + b.grandTotal, 0);
  const upiSales = todaysPaidBills
    .filter((b) => b.paymentMethod === 'upi')
    .reduce((sum, b) => sum + b.grandTotal, 0);
  const cardSales = todaysPaidBills
    .filter((b) => b.paymentMethod === 'card')
    .reduce((sum, b) => sum + b.grandTotal, 0);

  // 2. Manual cashbook entries (ignore entries with 'POS ' prefix if any to prevent double-counting)
  const manualIncomeEntries = entries.filter(
    (e) => e.type === 'Income' && !e.note?.startsWith('POS ')
  );
  const manualIncome = manualIncomeEntries.reduce((sum, e) => sum + e.amount, 0);

  // Total Daily Income = All Today's Invoiced Paid Sales + Other Manual Income
  const totalIncome = todaysBilledSales + manualIncome;

  const totalExpense = entries
    .filter((e) => e.type === 'Expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cashAmount);
    if (!amount || amount <= 0) return;

    onAddEntry(cashType, amount, cashNote);

    setCashAmount('');
    setCashNote('');
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* 1. TODAY'S SALES & CASH SUMMARY CARDS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-stone-600">Today's Cashbook & Sales Summary:</span>
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            {todaysPaidBills.length} Invoices Paid Today
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Total Income */}
          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-800 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-200/70 flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold">Total Sales / In:</span>
              </div>
              <span id="totalIncome" className="text-base font-bold font-mono text-emerald-700">
                {sym}
                {totalIncome.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] text-emerald-600 flex justify-between font-medium pt-1 border-t border-emerald-200/50">
              <span>Bills: {sym}{todaysBilledSales.toFixed(0)}</span>
              <span>Manual: {sym}{manualIncome.toFixed(0)}</span>
            </div>
          </div>

          {/* Total Expense */}
          <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-800 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-rose-200/70 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-rose-700 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold">Total Expense:</span>
              </div>
              <span id="totalExpense" className="text-base font-bold font-mono text-rose-700">
                {sym}
                {totalExpense.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] text-rose-500 font-medium pt-1 border-t border-rose-200/50">
              Shop overheads & costs
            </div>
          </div>

          {/* Net Balance */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-stone-800 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-stone-200 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-stone-700" />
                </div>
                <span className="text-xs font-bold">Net Balance:</span>
              </div>
              <span
                className={`text-base font-bold font-mono ${
                  netBalance >= 0 ? 'text-stone-900' : 'text-rose-600'
                }`}
              >
                {sym}
                {netBalance.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] text-stone-500 font-medium pt-1 border-t border-stone-200/50">
              Total In minus Expenses
            </div>
          </div>
        </div>

        {/* Breakdown of Today's Invoiced Sales by Payment Mode */}
        {todaysPaidBills.length > 0 && (
          <div className="p-3 bg-white rounded-2xl border border-stone-200 text-xs shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              <span>Today's Billed Breakdown:</span>
              <span className="text-stone-700 font-mono font-bold">
                {sym}{todaysBilledSales.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center font-mono">
              <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                <span className="block text-[10px] text-stone-400 font-sans">Cash</span>
                <span className="text-xs font-bold text-stone-800">{sym}{cashSales.toFixed(0)}</span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                <span className="block text-[10px] text-stone-400 font-sans">UPI</span>
                <span className="text-xs font-bold text-blue-700">{sym}{upiSales.toFixed(0)}</span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                <span className="block text-[10px] text-stone-400 font-sans">Card</span>
                <span className="text-xs font-bold text-purple-700">{sym}{cardSales.toFixed(0)}</span>
              </div>
              <div className="bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                <span className="block text-[10px] text-rose-500 font-sans">Due Bills</span>
                <span className="text-xs font-bold text-rose-700">{sym}{todaysDueSales.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CASH ENTRY FORM */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Record Cash Entry (Manual Income / Expense)</span>
          </h2>
          {savedFeedback && (
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
              <CheckCircle className="w-3 h-3" /> Entry Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <select
              id="cashType"
              value={cashType}
              onChange={(e) => setCashType(e.target.value as CashEntryType)}
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="Expense">Expense (Shop Cost, Rent, Tea, Salary)</option>
              <option value="Income">Income (Other Direct Cash Receipts)</option>
            </select>
          </div>

          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                {sym}
              </span>
              <input
                type="number"
                id="cashAmount"
                required
                min="0.01"
                step="any"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder={`Amount (${sym})`}
                className="w-full border border-stone-200 bg-stone-50/80 pl-7 pr-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <input
              type="text"
              id="cashNote"
              value={cashNote}
              onChange={(e) => setCashNote(e.target.value)}
              placeholder="Note (e.g. Wholesale Cloth Purchase, Shop Electricity, Tea)"
              className="w-full border border-stone-200 bg-stone-50/80 px-3 py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Save Entry</span>
          </button>
        </form>
      </div>

      {/* 3. ENTRIES & TODAY'S INVOICES TABS */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
        <div className="p-2 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveSubTab('entries')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'entries'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Cash Entries ({entries.length})
            </button>
            <button
              onClick={() => setActiveSubTab('bills')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'bills'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Today's Bills ({todaysBills.length})
            </button>
          </div>

          <span className="text-[11px] text-stone-400 font-mono pr-2">
            {activeSubTab === 'entries' ? 'Manual Book' : 'Auto-counted'}
          </span>
        </div>

        {activeSubTab === 'entries' ? (
          entries.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">
              No manual cash entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
              {entries.map((entry) => {
                const isIncome = entry.type === 'Income';
                return (
                  <div
                    key={entry.id}
                    className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-stone-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isIncome
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {entry.type}
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-stone-900">
                          {entry.note}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {entry.dateFormatted}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs sm:text-sm font-bold font-mono ${
                          isIncome ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {sym}
                        {entry.amount.toFixed(2)}
                      </span>

                      <button
                        onClick={() => onDeleteEntry(entry.id)}
                        className="p-1 rounded text-stone-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : todaysBills.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No bills generated today yet.
          </div>
        ) : (
          <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
            {todaysBills.map((b) => (
              <div
                key={b.id}
                className="p-3 flex items-center justify-between hover:bg-stone-50/80 transition-colors text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-800 font-mono">#{b.invoiceNo}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        b.paymentMethod === 'due'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {b.paymentMethod}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {b.customerName || 'Walk-in'} • {b.items.length} items
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-stone-900">
                    {sym}{b.grandTotal.toFixed(2)}
                  </span>
                  {b.discount > 0 && (
                    <div className="text-[10px] text-rose-500">Disc: -{sym}{b.discount}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
