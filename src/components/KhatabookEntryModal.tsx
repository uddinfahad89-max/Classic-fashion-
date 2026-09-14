import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Delete,
  Check,
  Tag,
  Clock,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { Language, ThermalPrinterSettings } from '../types';
import { translations } from '../utils/i18n';

export type KhatabookEntryType =
  | 'you_gave' // Customer Due - You gave (Red)
  | 'you_got' // Customer Due - You got (Green)
  | 'cash_in' // Daybook - Cash In (Green)
  | 'cash_out' // Daybook - Cash Out / Expense (Red)
  | 'purchase' // Purchases - Stock / Supplier (Red)
  | 'add_cash' // Add Cash to Trip (Blue)
  | 'bill_item' // Billing - Item Addition with calculator (Blue)
  | 'calculate_value'; // Generic calculator entry / input (Blue)

export interface KhatabookEntryPayload {
  amount: number;
  details: string;
  date: string; // YYYY-MM-DD
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Other';
  category?: string;
  vendorOrParty?: string;
}

interface KhatabookEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: KhatabookEntryPayload) => void;
  entryType: KhatabookEntryType;
  partyName?: string; // Customer name, supplier name, etc.
  partyPhone?: string;
  currentDue?: number;
  settings?: ThermalPrinterSettings;
  language?: Language;
  initialAmount?: number;
  initialDetails?: string;
  categories?: { id: string; name: string }[];
  showPartyInput?: boolean;
  partyInputLabel?: string;
  tripTitle?: string;
  customSaveLabel?: string;
  onPartyNameChange?: (name: string) => void;
}

export const KhatabookEntryModal: React.FC<KhatabookEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  entryType,
  partyName = '',
  partyPhone = '',
  currentDue,
  settings,
  language = 'bn',
  initialAmount,
  initialDetails = '',
  categories,
  showPartyInput = false,
  partyInputLabel,
  tripTitle,
  customSaveLabel,
  onPartyNameChange,
}) => {
  const isBn = language === 'bn';
  const sym = settings?.currencySymbol || '₹';

  // State
  const [expression, setExpression] = useState<string>(
    initialAmount && initialAmount > 0 ? initialAmount.toString() : ''
  );
  const [details, setDetails] = useState<string>(initialDetails);
  const [partyInputValue, setPartyInputValue] = useState<string>(partyName);
  const [entryDate, setEntryDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Other'>('Cash');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories && categories.length > 0 ? categories[0].id : 'goods'
  );
  const [memory, setMemory] = useState<number>(0);
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);

  // Blinking cursor effect for calculator display
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setExpression(initialAmount && initialAmount > 0 ? initialAmount.toString() : '');
      setDetails(initialDetails);
      setPartyInputValue(partyName);
      const today = new Date();
      setEntryDate(today.toISOString().split('T')[0]);
    }
  }, [isOpen, initialAmount, initialDetails, partyName]);

  // Determine color theme (Red for You Gave / Cash Out / Purchase, Green for You Got / Cash In, Blue for Trip Cash / Billing)
  const isRedTheme =
    entryType === 'you_gave' || entryType === 'cash_out' || entryType === 'purchase';
  const isGreenTheme = entryType === 'you_got' || entryType === 'cash_in';
  const isBlueTheme =
    entryType === 'add_cash' || entryType === 'bill_item' || entryType === 'calculate_value';

  const themePrimaryColor = isRedTheme
    ? 'bg-[#a5001e] hover:bg-[#8b0019]'
    : isGreenTheme
    ? 'bg-[#15803d] hover:bg-[#166534]'
    : 'bg-[#1d4ed8] hover:bg-[#1e40af]';

  const themeTextColor = isRedTheme
    ? 'text-[#a5001e]'
    : isGreenTheme
    ? 'text-[#15803d]'
    : 'text-[#1d4ed8]';

  // Math Expression Evaluator
  const evaluateExpression = (expr: string): { result: number; valid: boolean } => {
    if (!expr || expr.trim() === '') return { result: 0, valid: true };

    try {
      // Clean up trailing operators like "500+" -> evaluate as "500"
      let cleanExpr = expr.trim();
      while (
        cleanExpr.length > 0 &&
        ['+', '-', '×', '÷', '*', '/', '%', '.'].includes(cleanExpr.slice(-1))
      ) {
        cleanExpr = cleanExpr.slice(0, -1);
      }

      if (!cleanExpr) return { result: 0, valid: true };

      // Replace symbols for standard JS eval
      const sanitized = cleanExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/%/g, '*0.01');

      if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        return { result: 0, valid: false };
      }

      // eslint-disable-next-line no-new-func
      const func = new Function(`return (${sanitized})`);
      const val = func();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return { result: Math.round(val * 100) / 100, valid: true };
      }
      return { result: 0, valid: false };
    } catch {
      return { result: 0, valid: false };
    }
  };

  // Live evaluated amount
  const { result: evaluatedAmount } = useMemo(() => {
    return evaluateExpression(expression);
  }, [expression]);

  // Subtext formula rendering (e.g. "500+ = 500" or "500+300 = 800")
  const formulaSubtext = useMemo(() => {
    if (!expression || expression.trim() === '') return '';
    const hasOperator = /[+\-×÷*%/]/.test(expression);
    if (!hasOperator) {
      return `${expression} = ${evaluatedAmount}`;
    }
    return `${expression} = ${evaluatedAmount}`;
  }, [expression, evaluatedAmount]);

  // Header Title
  const headerTitle = useMemo(() => {
    const party = partyInputValue || partyName || (isBn ? 'সম্মানিত ব্যক্তি' : 'Party');
    const amtStr = `${sym} ${evaluatedAmount > 0 ? evaluatedAmount.toFixed(0) : '0'}`;

    if (entryType === 'you_gave') {
      return isBn
        ? `আপনি ${party}-কে ${amtStr} দিয়েছেন`
        : `You gave ${amtStr} to ${party}`;
    }
    if (entryType === 'you_got') {
      return isBn
        ? `আপনি ${party}-এর থেকে ${amtStr} পেয়েছেন`
        : `You got ${amtStr} from ${party}`;
    }
    if (entryType === 'cash_in') {
      return isBn ? `নগদ জমা ${amtStr}` : `Cash In ${amtStr}`;
    }
    if (entryType === 'cash_out') {
      return isBn ? `দোকান খরচ / ক্যাশ আউট ${amtStr}` : `Cash Out / Expense ${amtStr}`;
    }
    if (entryType === 'purchase') {
      const tripPrefix = tripTitle ? `[${tripTitle}] ` : '';
      return isBn ? `${tripPrefix}মাল কেনাকাটা ${amtStr}` : `${tripPrefix}Stock Purchase ${amtStr}`;
    }
    if (entryType === 'bill_item') {
      const itemLabel = details.trim() || partyInputValue.trim();
      if (itemLabel) {
        return isBn ? `${itemLabel} - ${amtStr}` : `${itemLabel} - ${amtStr}`;
      }
      return isBn ? `বিলে আইটেম যোগ ${amtStr}` : `Add Bill Item ${amtStr}`;
    }
    if (entryType === 'calculate_value') {
      return isBn ? `হিসাব / ক্যালকুলেশন ${amtStr}` : `Calculate Value ${amtStr}`;
    }
    return isBn ? `ক্যাশ যোগ ${amtStr}` : `Add Cash ${amtStr}`;
  }, [entryType, partyInputValue, partyName, tripTitle, details, sym, evaluatedAmount, isBn]);

  // Calculator button click handler
  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      setExpression('');
      return;
    }

    if (key === 'BACKSPACE') {
      setExpression((prev) => prev.slice(0, -1));
      return;
    }

    if (key === 'M+') {
      setMemory((prev) => prev + evaluatedAmount);
      return;
    }

    if (key === 'M-') {
      setMemory((prev) => Math.max(0, prev - evaluatedAmount));
      return;
    }

    if (key === '=') {
      // Resolve expression to final number
      if (evaluatedAmount > 0) {
        setExpression(evaluatedAmount.toString());
      }
      return;
    }

    // Check if key is operator
    const isOperator = ['+', '−', '×', '÷', '%'].includes(key);

    if (isOperator) {
      if (!expression) {
        if (key === '−') setExpression('-');
        return;
      }

      const lastChar = expression.slice(-1);
      if (['+', '−', '-', '×', '÷', '*', '/', '%'].includes(lastChar)) {
        // Replace last operator with new one
        setExpression((prev) => prev.slice(0, -1) + key);
      } else {
        setExpression((prev) => prev + key);
      }
      return;
    }

    // Numbers and Decimal
    if (key === '.') {
      const parts = expression.split(/[+\-×÷]/);
      const currentPart = parts[parts.length - 1];
      if (currentPart.includes('.')) return;
      setExpression((prev) => (prev === '' ? '0.' : prev + '.'));
      return;
    }

    // Digits 0-9
    setExpression((prev) => {
      if (prev === '0' && key !== '.') {
        return key;
      }
      return prev + key;
    });
  };

  // Save handler
  const handleSave = () => {
    const finalAmount = evaluatedAmount;
    if (finalAmount <= 0) {
      alert(isBn ? 'দয়া করে সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    if (showPartyInput && onPartyNameChange) {
      onPartyNameChange(partyInputValue);
    }

    onSave({
      amount: finalAmount,
      details: details.trim(),
      date: entryDate,
      paymentMode,
      category: selectedCategory,
      vendorOrParty: partyInputValue.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  // Format date display for button (e.g. "14 Sep 26")
  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      id="khatabook-entry-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="khatabook-entry-sheet"
        className="w-full max-w-md bg-[#f8f9fa] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-150"
      >
        {/* 1. TOP HEADER (Arrow Left + Live Title) */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1.5 rounded-full text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="min-w-0 flex-1">
            <h2
              className={`text-sm sm:text-base font-bold truncate ${
                isRedTheme ? 'text-[#a5001e]' : isGreenTheme ? 'text-[#15803d]' : 'text-stone-900'
              }`}
            >
              {headerTitle}
            </h2>
            {currentDue !== undefined && (
              <p className="text-[11px] text-stone-500 font-medium">
                {isBn ? 'বর্তমান বাকি ব্যালেন্স:' : 'Current Balance:'} {sym}
                {currentDue.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* 2. SCROLLABLE CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Party Input (if adding new customer or vendor) */}
          {showPartyInput && (
            <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-2xs space-y-1">
              <label className="block text-xs font-bold text-stone-600">
                {partyInputLabel || (isBn ? 'কাস্টমার / মহাজনের নাম' : 'Customer / Party Name')}
              </label>
              <input
                type="text"
                value={partyInputValue}
                onChange={(e) => setPartyInputValue(e.target.value)}
                placeholder={isBn ? 'নাম লিখুন...' : 'Enter name...'}
                className="w-full text-sm font-semibold text-stone-900 focus:outline-none bg-transparent"
              />
            </div>
          )}

          {/* AMOUNT DISPLAY CARD (Big Font + Subtext formula) */}
          <div className="bg-white rounded-2xl border border-stone-300 shadow-xs p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
                {sym}
              </span>
              <div className="flex-1 flex items-center min-w-0 overflow-x-auto">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight">
                  {expression || '0'}
                </span>
                <span
                  className={`inline-block w-0.5 h-7 ml-0.5 bg-blue-600 ${
                    cursorVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </div>

            {/* Subtext Formula evaluation: "500+ = 500" */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>{formulaSubtext || `${sym} 0`}</span>
              {memory > 0 && (
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                  M: {sym}{memory}
                </span>
              )}
            </div>
          </div>

          {/* DETAILS INPUT */}
          <div className="bg-white rounded-2xl border border-stone-200 p-3 shadow-2xs">
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isBn
                  ? 'বিবরণ লিখুন (পণ্যের নাম, বিল নং, পরিমাণ ইত্যাদি)'
                  : 'Enter details (Items, bill no., quantity, etc.)'
              }
              className="w-full text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none bg-transparent"
            />
          </div>

          {/* DATE SELECTOR & ATTACHMENTS ROW */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker((prev) => !prev)}
                className="px-3 py-2 bg-white border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 flex items-center gap-2 hover:bg-stone-50 cursor-pointer shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>{formatDateDisplay(entryDate)}</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {showDatePicker && (
                <div className="absolute left-0 top-full mt-1.5 z-20 bg-white p-2.5 rounded-2xl shadow-xl border border-stone-200 flex flex-col gap-1.5">
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => {
                      setEntryDate(e.target.value);
                      setShowDatePicker(false);
                    }}
                    className="text-xs border border-stone-200 rounded-xl px-2 py-1.5 font-mono focus:outline-none"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setEntryDate(today);
                        setShowDatePicker(false);
                      }}
                      className="flex-1 py-1 text-[10px] font-bold bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700"
                    >
                      {isBn ? 'আজ' : 'Today'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        setEntryDate(y.toISOString().split('T')[0]);
                        setShowDatePicker(false);
                      }}
                      className="flex-1 py-1 text-[10px] font-bold bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700"
                    >
                      {isBn ? 'গতকাল' : 'Yesterday'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Mode (for cashbook & customer payments) */}
            {(entryType === 'cash_in' ||
              entryType === 'cash_out' ||
              entryType === 'you_got' ||
              entryType === 'you_gave') && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-stone-200 text-[11px] font-bold">
                {(['Cash', 'UPI', 'Card'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`px-2 py-1 rounded-xl transition-all cursor-pointer ${
                      paymentMode === mode
                        ? 'bg-stone-900 text-white shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            {/* Category selection for Purchases */}
            {categories && categories.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. BIG FULL-WIDTH SAVE BUTTON */}
        <div className="px-4 pt-2 pb-2 bg-[#f8f9fa]">
          <button
            type="button"
            onClick={handleSave}
            className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm tracking-wider uppercase shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 ${themePrimaryColor}`}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>
              {customSaveLabel ||
                (entryType === 'bill_item'
                  ? isBn
                    ? 'বিলে আইটেম যোগ করুন'
                    : 'ADD ITEM TO BILL'
                  : entryType === 'calculate_value'
                  ? isBn
                    ? 'হিসাব প্রয়োগ করুন'
                    : 'APPLY VALUE'
                  : isBn
                  ? 'সংরক্ষণ করুন (SAVE)'
                  : 'SAVE')}
            </span>
          </button>
        </div>

        {/* 4. PINNED BUILT-IN CALCULATOR KEYPAD (Exact Khatabook 5-Row Layout) */}
        <div className="p-2 sm:p-3 bg-white border-t border-stone-200 select-none">
          <div className="space-y-1.5">
            {/* ROW 1: C | M+ | M- | Backspace (4 buttons evenly spaced) */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeyClick('C')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-bold text-sm sm:text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('M+')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                M+
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('M-')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                M-
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('BACKSPACE')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                <Delete className="w-5 h-5 stroke-[2]" />
              </button>
            </div>

            {/* ROW 2: 7 | 8 | 9 | ÷ | % */}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeyClick('7')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('8')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('9')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('÷')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-black text-lg rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                ÷
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('%')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-bold text-sm sm:text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                %
              </button>
            </div>

            {/* ROW 3: 4 | 5 | 6 | × (spans 2 cols) */}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeyClick('4')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('5')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('6')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('×')}
                className="col-span-2 py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-black text-lg rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                ×
              </button>
            </div>

            {/* ROW 4: 1 | 2 | 3 | − (Dark Blue, spans 2 cols) */}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeyClick('1')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('2')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('3')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('−')}
                className="col-span-2 py-2.5 sm:py-3 bg-[#0052cc] hover:bg-[#0047b3] active:bg-[#00388f] text-white font-black text-xl rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-sm"
              >
                −
              </button>
            </div>

            {/* ROW 5: 0 | . | = | + (Dark Blue, spans 2 cols) */}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-bold text-base sm:text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('.')}
                className="py-2.5 sm:py-3 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-black text-lg rounded-xl border border-stone-200/90 shadow-2xs cursor-pointer flex items-center justify-center"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('=')}
                className="py-2.5 sm:py-3 bg-[#e0f2fe] hover:bg-[#bae6fd] active:bg-[#7dd3fc] text-[#0369a1] font-black text-lg rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              >
                =
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('+')}
                className="col-span-2 py-2.5 sm:py-3 bg-[#0052cc] hover:bg-[#0047b3] active:bg-[#00388f] text-white font-black text-xl rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
