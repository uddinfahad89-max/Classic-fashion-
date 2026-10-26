import React from 'react';
import {
  X,
  Tablet,
  Smartphone,
  Maximize2,
  Check,
  Type,
  Monitor,
  Sparkles,
  Info,
} from 'lucide-react';
import { ThermalPrinterSettings, Language } from '../types';
import { useTabletMode } from '../utils/useTabletMode';

interface TabletModeSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThermalPrinterSettings;
  onUpdateSettings: (newSettings: ThermalPrinterSettings) => void;
  language?: Language;
}

export const TabletModeSwitcherModal: React.FC<TabletModeSwitcherModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const tabletInfo = useTabletMode(settings);

  if (!isOpen) return null;

  const currentMode = settings.tabletMode || 'auto';
  const currentScale = settings.uiScale || 'normal';

  const handleSelectMode = (mode: 'auto' | 'always' | 'disabled') => {
    onUpdateSettings({ ...settings, tabletMode: mode });
  };

  const handleSelectScale = (scale: 'normal' | 'large' | 'extra_large') => {
    onUpdateSettings({ ...settings, uiScale: scale });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-700 via-emerald-700 to-blue-700 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <Tablet className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                {isBn ? '১০" ট্যাবলেট ও বড় স্ক্রিন মোড' : '10" Tablet & Large Screen Mode'}
              </h2>
              <p className="text-[11px] text-teal-100 font-medium">
                {isBn
                  ? 'বড় স্ক্রিনে স্বয়ংক্রিয়ভাবে পুরো ডিসপ্লে দখল করবে ও লেখা বড় হবে'
                  : 'Automatically fills full screen and scales fonts on tablets'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Live Device Status Banner */}
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-teal-700 shrink-0" />
              <div>
                <div className="font-bold text-teal-950 text-xs">
                  {isBn ? 'বর্তমান স্ক্রিন রেজুলেশন:' : 'Current Screen:'}{' '}
                  <span className="font-mono">
                    {tabletInfo.windowWidth} × {tabletInfo.windowHeight} px
                  </span>
                </div>
                <div className="text-[11px] text-teal-800">
                  {tabletInfo.isTabletActive
                    ? isBn
                      ? '✓ ট্যাবলেট / ফুল স্ক্রিন ভিউ সক্রিয় রয়েছে'
                      : '✓ Tablet Full Screen View is Active'
                    : isBn
                    ? '📱 কমপ্যাক্ট মোবাইল ভিউ চলছে'
                    : '📱 Compact Mobile View'}
                </div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full bg-teal-600 text-white font-mono font-black text-[10px] shrink-0">
              {tabletInfo.isTabletActive ? 'ACTIVE' : 'COMPACT'}
            </span>
          </div>

          {/* Option 1: Screen Layout Mode */}
          <div className="space-y-2">
            <label className="font-black text-stone-900 text-xs flex items-center gap-1.5">
              <Maximize2 className="w-4 h-4 text-blue-600" />
              <span>{isBn ? 'স্ক্রিন লেআউট মোড (Layout)' : 'Screen Layout Mode'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Auto */}
              <button
                type="button"
                onClick={() => handleSelectMode('auto')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  currentMode === 'auto'
                    ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {currentMode === 'auto' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isBn ? 'অটো ট্যাবলেট' : 'Auto Detect'}</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                  {isBn
                    ? '১০" ট্যাবলেট বা বড় ডিসপ্লে হলে নিজে থেকেই ফুল স্ক্রিন হবে।'
                    : 'Auto-activates on 10" tablets and larger screens.'}
                </p>
                <span className="mt-1.5 inline-block text-[9px] font-black uppercase text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                  {isBn ? 'সুপারিশকৃত' : 'Recommended'}
                </span>
              </button>

              {/* Always Full Screen */}
              <button
                type="button"
                onClick={() => handleSelectMode('always')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  currentMode === 'always'
                    ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {currentMode === 'always' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                  <Tablet className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? 'সবসময় ফুল' : 'Always Full'}</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                  {isBn
                    ? 'যেকোনো ডিভাইসেই পুরো স্ক্রিন জুড়ে বড় টেবিল ও বড় বোতাম দেখাবে।'
                    : 'Forces full width and large buttons on every device.'}
                </p>
              </button>

              {/* Compact Phone */}
              <button
                type="button"
                onClick={() => handleSelectMode('disabled')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  currentMode === 'disabled'
                    ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {currentMode === 'disabled' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                  <Smartphone className="w-3.5 h-3.5 text-stone-600" />
                  <span>{isBn ? 'কমপ্যাক্ট ফোন' : 'Compact Phone'}</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                  {isBn
                    ? 'ছোট মোবাইল ফোনের মতো সংকীর্ণ সেন্ট্রাল কলাম ভিউ।'
                    : 'Classic compact phone view.'}
                </p>
              </button>
            </div>
          </div>

          {/* Option 2: Font / Text Size Scale */}
          <div className="space-y-2 pt-1 border-t border-stone-100">
            <label className="font-black text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Type className="w-4 h-4 text-purple-600" />
                <span>{isBn ? 'লেখা ও অক্ষরের সাইজ (Text & Font Size)' : 'Font & Text Size'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {currentScale === 'extra_large'
                  ? isBn
                    ? 'অতি বড় (+30%)'
                    : 'Extra Large (+30%)'
                  : currentScale === 'large'
                  ? isBn
                    ? 'বড় (+15%)'
                    : 'Large (+15%)'
                  : isBn
                  ? 'স্বাভাবিক (100%)'
                  : 'Normal (100%)'}
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectScale('normal')}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  currentScale === 'normal'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <div className="text-sm">A</div>
                <div className="text-[10px]">{isBn ? 'স্বাভাবিক' : 'Normal'}</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectScale('large')}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  currentScale === 'large'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <div className="text-base font-black">A+</div>
                <div className="text-[10px]">{isBn ? 'বড় (ট্যাবলেট)' : 'Large'}</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectScale('extra_large')}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  currentScale === 'extra_large'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <div className="text-lg font-black">A++</div>
                <div className="text-[10px]">{isBn ? 'অতি বড়' : 'Extra Large'}</div>
              </button>
            </div>
          </div>

          <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-start gap-2 text-[11px] text-blue-900 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              {isBn
                ? '💡 ১০ ইঞ্চি ট্যাবলেটে ক্যাশ কাউন্টারে দাঁড়িয়ে কাজ করার সময় "অটো ট্যাবলেট" এবং "বড় (A+)" রাখলে চোখ না টানিয়ে দূর থেকেই প্রতিটি পণ্যের নাম ও দাম সহজে পড়া যায় এবং সহজে স্পর্শ করা যায়।'
                : '💡 On 10-inch tablets at the counter, "Auto Detect" with "Large (A+)" allows reading items and prices easily from arm’s length.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            {isBn ? 'ঠিক আছে (Done)' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
