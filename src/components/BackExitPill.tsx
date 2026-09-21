import React, { useEffect, useState } from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Language } from '../types';

interface BackExitPillProps {
  isVisible: boolean;
  onDismiss: () => void;
  onOpenConfirm: () => void;
  language?: Language;
  durationMs?: number;
}

export const BackExitPill: React.FC<BackExitPillProps> = ({
  isVisible,
  onDismiss,
  onOpenConfirm,
  language = 'bn',
  durationMs = 3500,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const isBn = language === 'bn';

  useEffect(() => {
    if (!isVisible) return;

    setSecondsLeft(3);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setSecondsLeft(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onDismiss();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isVisible, onDismiss, durationMs]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Exit warning"
      id="khatabook-back-exit-pill"
      onClick={onOpenConfirm}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-white/95 backdrop-blur-md text-stone-900 rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.18)] border border-stone-300/80 cursor-pointer select-none transition-all hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[92vw] sm:max-w-md"
    >
      {/* Mini App Brand Logo (similar to Khatabook / Vyapar pill) */}
      <div className="w-6 h-6 rounded-full bg-linear-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-xs">
        <ShoppingBag className="w-3.5 h-3.5" />
      </div>

      {/* Main text prompt */}
      <span className="text-xs sm:text-sm font-bold text-stone-800 tracking-tight whitespace-nowrap">
        {isBn ? 'অ্যাপ থেকে বের হতে আবার ব্যাক চাপুন' : 'Press Back again to exit'}
      </span>

      {/* Countdown pill badge */}
      <span className="text-[10px] font-mono font-black text-rose-600 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
        <span>{secondsLeft}s</span>
        <ArrowRight className="w-2.5 h-2.5" />
      </span>
    </aside>
  );
};
