import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator as CalcIcon,
  X,
  RotateCcw,
  Copy,
  Check,
  History,
  Delete,
  Trash2,
  Percent,
} from 'lucide-react';
import { Language, ThermalPrinterSettings } from '../types';
import { translations } from '../utils/i18n';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ThermalPrinterSettings;
  language?: Language;
  initialValue?: number;
}

interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  isOpen,
  onClose,
  settings,
  language = 'bn',
  initialValue,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';
  const sym = settings?.currencySymbol || '₹';

  const [expression, setExpression] = useState<string>('');
  const [currentInput, setCurrentInput] = useState<string>(
    initialValue ? initialValue.toString() : '0'
  );
  const [lastOperator, setLastOperator] = useState<string | null>(null);
  const [isNewNumber, setIsNewNumber] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pos_calc_history', JSON.stringify(history.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [history]);

  // Safe evaluate helper
  const calculateResult = (expr: string): number => {
    try {
      // Replace display operators with JavaScript operators
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/%/g, '*0.01');

      // Only allow digits, operators, parentheses and decimals
      if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        return 0;
      }
      // eslint-disable-next-line no-new-func
      const func = new Function(`return (${sanitized})`);
      const val = func();
      return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  };

  const handleDigit = (digit: string) => {
    if (isNewNumber) {
      setCurrentInput(digit === '.' ? '0.' : digit);
      setIsNewNumber(false);
    } else {
      if (digit === '.' && currentInput.includes('.')) return;
      if (currentInput === '0' && digit !== '.') {
        setCurrentInput(digit);
      } else {
        if (currentInput.length < 14) {
          setCurrentInput((prev) => prev + digit);
        }
      }
    }
  };

  const handleOperator = (op: string) => {
    const prevNum = parseFloat(currentInput);
    if (isNaN(prevNum)) return;

    if (expression && !isNewNumber) {
      const fullExpr = `${expression} ${currentInput}`;
      const evalRes = calculateResult(fullExpr);
      const formattedRes = parseFloat(evalRes.toFixed(4)).toString();
      setExpression(`${formattedRes} ${op}`);
      setCurrentInput(formattedRes);
    } else {
      setExpression(`${currentInput} ${op}`);
    }

    setLastOperator(op);
    setIsNewNumber(true);
  };

  const handleEqual = () => {
    if (!expression) return;
    const fullExpr = `${expression} ${currentInput}`;
    const resultNum = calculateResult(fullExpr);
    const formattedRes = parseFloat(resultNum.toFixed(4)).toString();

    // Add to history
    const newItem: HistoryItem = {
      id: 'calc-' + Date.now(),
      expression: fullExpr,
      result: formattedRes,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory((prev) => [newItem, ...prev.slice(0, 29)]);

    setExpression(`${fullExpr} =`);
    setCurrentInput(formattedRes);
    setIsNewNumber(true);
    setLastOperator(null);
  };

  const handleClearAll = () => {
    setExpression('');
    setCurrentInput('0');
    setLastOperator(null);
    setIsNewNumber(true);
  };

  const handleClearEntry = () => {
    setCurrentInput('0');
    setIsNewNumber(true);
  };

  const handleBackspace = () => {
    if (isNewNumber) return;
    if (currentInput.length <= 1) {
      setCurrentInput('0');
      setIsNewNumber(true);
    } else {
      setCurrentInput((prev) => prev.slice(0, -1));
    }
  };

  // Wholesale shortcut: Multiply by 12 (Dozen)
  const handleMultiplyDozen = () => {
    const val = parseFloat(currentInput);
    if (isNaN(val)) return;
    const res = val * 12;
    const resStr = parseFloat(res.toFixed(4)).toString();
    const fullExpr = `${currentInput} × 12`;
    setExpression(`${fullExpr} =`);
    setCurrentInput(resStr);
    setIsNewNumber(true);

    setHistory((prev) => [
      {
        id: 'calc-' + Date.now(),
        expression: `${fullExpr} (ডজন)`,
        result: resStr,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 29),
    ]);
  };

  // Wholesale shortcut: Divide by 12 (Piece rate)
  const handleDivideDozen = () => {
    const val = parseFloat(currentInput);
    if (isNaN(val) || val === 0) return;
    const res = val / 12;
    const resStr = parseFloat(res.toFixed(2)).toString();
    const fullExpr = `${currentInput} ÷ 12`;
    setExpression(`${fullExpr} =`);
    setCurrentInput(resStr);
    setIsNewNumber(true);

    setHistory((prev) => [
      {
        id: 'calc-' + Date.now(),
        expression: `${fullExpr} (প্রতি পিস)`,
        result: resStr,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 29),
    ]);
  };

  // Quick Percentage / GST (e.g. +5%, +12%, +18%)
  const handleAddPercent = (pct: number) => {
    const val = parseFloat(currentInput);
    if (isNaN(val)) return;
    const tax = val * (pct / 100);
    const total = val + tax;
    const resStr = parseFloat(total.toFixed(2)).toString();
    const fullExpr = `${val} + ${pct}%`;
    setExpression(`${fullExpr} =`);
    setCurrentInput(resStr);
    setIsNewNumber(true);

    setHistory((prev) => [
      {
        id: 'calc-' + Date.now(),
        expression: `${val} + ${pct}% GST`,
        result: resStr,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 29),
    ]);
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(currentInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === '.') {
        handleDigit('.');
      } else if (e.key === '+') {
        handleOperator('+');
      } else if (e.key === '-') {
        handleOperator('−');
      } else if (e.key === '*') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        if (showHistory) {
          setShowHistory(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentInput, expression, isNewNumber, showHistory]);

  if (!isOpen) return null;

  return (
    <div
      id="calculator-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="calculator-modal-card"
        className="relative w-full max-w-sm bg-stone-900 text-white rounded-3xl shadow-2xl border border-stone-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        style={{ maxHeight: '92vh' }}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800/80 bg-stone-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <CalcIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100 flex items-center gap-1.5 leading-tight">
                <span>{isBn ? 'ক্যালকুলেটর' : 'POS Calculator'}</span>
              </h2>
              <p className="text-[10px] text-stone-400">
                {isBn ? 'পাইকারি, ডজন ও খুচরা হিসাব' : 'Wholesale, dozen & retail math'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Toggle History Button */}
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                showHistory
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
              title={isBn ? 'হিস্ট্রি দেখুন' : 'View history'}
            >
              <History className="w-4 h-4" />
              {history.length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-stone-700/80 px-1.5 py-0.2 rounded-full">
                  {history.length}
                </span>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-all cursor-pointer"
              aria-label="Close Calculator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* If History is active, show history drawer */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-stone-900 min-h-[360px]">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>{isBn ? 'পূর্ববর্তী হিসাবের হিস্ট্রি' : 'Calculation History'}</span>
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isBn ? 'মুছে ফেলুন' : 'Clear'}</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs">
                {isBn ? 'এখনও কোনো হিসাবের হিস্ট্রি নেই' : 'No calculations yet'}
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentInput(item.result);
                    setIsNewNumber(true);
                    setShowHistory(false);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-stone-800/60 hover:bg-stone-800 border border-stone-800/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono">
                    <span className="truncate max-w-[200px]">{item.expression}</span>
                    <span className="text-[10px] text-stone-500">{item.timestamp}</span>
                  </div>
                  <div className="text-base font-bold text-stone-100 font-mono mt-0.5 group-hover:text-blue-400 transition-colors">
                    = {item.result}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-3">
            {/* Display Screen */}
            <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-3.5 flex flex-col justify-end shadow-inner relative">
              {/* Formula / Expression */}
              <div className="min-h-[20px] text-right font-mono text-xs text-stone-400 truncate tracking-wide">
                {expression || '\u00A0'}
              </div>

              {/* Main Number Display */}
              <div className="flex items-center justify-between gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-all text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  title={isBn ? 'রেজাল্ট কপি করুন' : 'Copy result'}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[10px]">{isBn ? 'কপি!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">{isBn ? 'কপি' : 'Copy'}</span>
                    </>
                  )}
                </button>

                <div className="text-right font-mono text-2xl sm:text-3xl font-black text-white tracking-tight truncate select-all">
                  {currentInput}
                </div>
              </div>
            </div>

            {/* Wholesale & Market Shortcuts Row */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleMultiplyDozen}
                className="py-1.5 px-1 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xs"
                title={isBn ? '১২ দিয়ে গুণ (ডজন হিসাব)' : 'Multiply by 12 (Dozen)'}
              >
                <span className="font-mono font-black">× 12</span>
                <span className="text-[9px] text-amber-400/80">{isBn ? 'ডজন' : 'Dozen'}</span>
              </button>

              <button
                type="button"
                onClick={handleDivideDozen}
                className="py-1.5 px-1 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xs"
                title={isBn ? '১২ দিয়ে ভাগ (প্রতি পিস দর)' : 'Divide by 12 (Piece Rate)'}
              >
                <span className="font-mono font-black">÷ 12</span>
                <span className="text-[9px] text-amber-400/80">{isBn ? 'পিস দর' : 'Piece'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddPercent(5)}
                className="py-1.5 px-1 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="+5% GST / Tax"
              >
                <span className="font-mono font-black">+ 5%</span>
                <span className="text-[9px] text-blue-400/80">{isBn ? 'ট্যাক্স' : 'GST'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddPercent(12)}
                className="py-1.5 px-1 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="+12% GST / Tax"
              >
                <span className="font-mono font-black">+ 12%</span>
                <span className="text-[9px] text-blue-400/80">{isBn ? 'ট্যাক্স' : 'GST'}</span>
              </button>
            </div>

            {/* Standard Keypad Grid */}
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClearAll}
                className="py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 font-mono font-bold text-sm border border-rose-500/30 transition-all cursor-pointer shadow-2xs"
              >
                AC
              </button>
              <button
                type="button"
                onClick={handleClearEntry}
                className="py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-300 font-mono font-bold text-sm border border-stone-700 transition-all cursor-pointer shadow-2xs"
              >
                C
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-300 font-mono font-bold text-sm border border-stone-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleOperator('÷')}
                className={`py-3 rounded-2xl font-mono font-extrabold text-base border transition-all cursor-pointer shadow-2xs ${
                  lastOperator === '÷'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-blue-400 border-stone-700'
                }`}
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleDigit('7')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleDigit('8')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleDigit('9')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleOperator('×')}
                className={`py-3 rounded-2xl font-mono font-extrabold text-base border transition-all cursor-pointer shadow-2xs ${
                  lastOperator === '×'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-blue-400 border-stone-700'
                }`}
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleDigit('4')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleDigit('5')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleDigit('6')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleOperator('−')}
                className={`py-3 rounded-2xl font-mono font-extrabold text-base border transition-all cursor-pointer shadow-2xs ${
                  lastOperator === '−'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-blue-400 border-stone-700'
                }`}
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleDigit('1')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleDigit('2')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleDigit('3')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className={`py-3 rounded-2xl font-mono font-extrabold text-base border transition-all cursor-pointer shadow-2xs ${
                  lastOperator === '+'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-blue-400 border-stone-700'
                }`}
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleDigit('00')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                00
              </button>
              <button
                type="button"
                onClick={() => handleDigit('.')}
                className="py-3 rounded-2xl bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white font-mono font-bold text-base border border-stone-700/80 transition-all cursor-pointer shadow-2xs"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleEqual}
                className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-mono font-black text-lg border border-blue-400 shadow-md transition-all cursor-pointer flex items-center justify-center"
              >
                =
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
