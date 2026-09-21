import React, { useEffect } from 'react';
import { LogOut, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Language } from '../types';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  language?: Language;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  language = 'bn',
}) => {
  const isBn = language === 'bn';

  useEffect(() => {
    if (!isOpen) return;

    // Auto-dismiss after 12 seconds if no action taken
    const timer = setTimeout(() => {
      onClose();
    }, 12000);

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="exit-confirm-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="exit-confirm-sheet"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle for mobile pull down look */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                  {isBn ? 'অ্যাপ থেকে বের হতে চান?' : 'Exit Application?'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {isBn
                    ? 'আবার ব্যাক চাপলে বা নিচের বোতামে চাপলে বন্ধ হবে'
                    : 'Press Back again or tap Exit to leave'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              {isBn
                ? 'আপনার সমস্ত বিল, বাকি খাতা ও ক্যাশবুক ডাটা ব্রাউজারে সম্পূর্ণ সুরক্ষিত রয়েছে।'
                : 'All your bills, customer dues, and cashbook records are safely stored.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              id="btn-cancel-exit"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm transition-colors cursor-pointer text-center"
            >
              {isBn ? 'না, অ্যাপে থাকুন' : 'Stay in App'}
            </button>
            <button
              type="button"
              id="btn-confirm-exit"
              onClick={onConfirmExit}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>{isBn ? 'হ্যাঁ, বের হন' : 'Exit App'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
