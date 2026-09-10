import React, { useState } from 'react';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Wallet,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { CashEntry, CashEntryType, ThermalPrinterSettings } from '../types';

interface CashbookTabProps {
  entries: CashEntry[];
  settings: ThermalPrinterSettings;
  onAddEntry: (type: CashEntryType, amount: number, note: string) => void;
  onDeleteEntry: (id: string) => void;
}

export const CashbookTab: React.FC<CashbookTabProps> = ({
  entries,
  settings,
  onAddEntry,
  onDeleteEntry,
}) => {
  const [cashType, setCashType] = useState<CashEntryType>('Income');
  const [cashAmount, setCashAmount] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Calculate Today's Totals
  const totalIncome = entries
    .filter((e) => e.type === 'Income')
    .reduce((sum, e) => sum + e.amount, 0);

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

  const sym = settings.currencySymbol || '₹';

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* 1. CASH ENTRY FORM (Matches user's requested layout) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Cashbook (Income / Expense)</span>
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
              <option value="Income">Income (Daily Garment Sale)</option>
              <option value="Expense">Expense (Shop Cost)</option>
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
              placeholder="Note (e.g. Wholesale Cloth Purchase, Shop Rent, Staff Salary)"
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

      {/* 2. TODAY'S SUMMARY CARDS */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-stone-600 px-1">Today's Summary:</div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Total Income */}
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200/80 rounded-xl text-green-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-200/70 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-green-700 stroke-[2.5]" />
              </div>
              <span className="text-xs font-semibold">Total Income:</span>
            </div>
            <span id="totalIncome" className="text-base font-bold font-mono text-green-700">
              {sym}
              {totalIncome.toFixed(2)}
            </span>
          </div>

          {/* Total Expense */}
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200/80 rounded-xl text-red-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-200/70 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-red-700 stroke-[2.5]" />
              </div>
              <span className="text-xs font-semibold">Total Expense:</span>
            </div>
            <span id="totalExpense" className="text-base font-bold font-mono text-red-700">
              {sym}
              {totalExpense.toFixed(2)}
            </span>
          </div>

          {/* Net Balance */}
          <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-stone-700" />
              </div>
              <span className="text-xs font-semibold">Net Balance:</span>
            </div>
            <span
              className={`text-base font-bold font-mono ${
                netBalance >= 0 ? 'text-stone-900' : 'text-red-600'
              }`}
            >
              {sym}
              {netBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. ENTRIES LIST */}
      <div className="bg-white rounded-2xl shadow-xs border border-stone-200 overflow-hidden">
        <div className="p-3.5 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-800">
            Recent Cash Entries ({entries.length})
          </span>
          <span className="text-[11px] text-stone-400">All local records</span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No entries recorded yet. Use the form above to add daily sales or expenses.
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
        )}
      </div>
    </div>
  );
};
