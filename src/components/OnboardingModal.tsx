import React, { useState, useEffect, useRef } from 'react';
import { Store, Phone, MapPin, Volume2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onSave: (data: { storeName: string; storePhone: string; storeAddress: string }) => void;
  language?: Language;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onSave,
  language = 'en',
}) => {
  const isBn = language === 'bn';
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasSpokenRef = useRef(false);

  // Play Speech Alert using Web Speech API
  const playVoiceAlert = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const textToSpeak = 'Please enter your shop name and mobile number to continue.';
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (isOpen && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      // Slight delay to allow browser rendering & user awareness
      const timer = setTimeout(() => {
        playVoiceAlert();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError(isBn ? 'দয়া করে আপনার দোকানের নাম লিখুন' : 'Please enter your shop name');
      return;
    }
    if (!storePhone.trim()) {
      setError(isBn ? 'দয়া করে আপনার মোবাইল নাম্বার লিখুন' : 'Please enter your mobile number');
      return;
    }

    setError(null);
    onSave({
      storeName: storeName.trim(),
      storePhone: storePhone.trim(),
      storeAddress: storeAddress.trim(),
    });
  };

  return (
    <div
      id="onboarding-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 sm:py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isBn ? 'স্বাগতম! দোকান সেটআপ' : 'Welcome! Shop Setup'}
                </h2>
                <p className="text-xs text-blue-100 font-medium">
                  {isBn ? 'আপনার দোকানের তথ্য দিয়ে শুরু করুন' : 'Enter your store details to begin'}
                </p>
              </div>
            </div>

            {/* Voice Prompt Play Button */}
            <button
              type="button"
              onClick={playVoiceAlert}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                isSpeaking
                  ? 'bg-amber-400 text-stone-900 border-amber-300 animate-pulse'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
              }`}
              title="Listen to Voice Prompt / অডিও শুনুন"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">
                {isSpeaking ? (isBn ? 'বলছে...' : 'Playing...') : (isBn ? 'ভয়েস শুনুন' : 'Voice')}
              </span>
            </button>
          </div>

          {/* Voice Prompt Status Banner */}
          <div className="mt-3 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-blue-50">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="text-[11px] leading-snug">
              &quot;Please enter your shop name and mobile number to continue.&quot;
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Shop Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? 'দোকানের নাম (Shop Name) *' : 'Shop Name *'}</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={storeName}
              onChange={(e) => {
                setStoreName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={isBn ? 'যেমন: মেসার্স রহিম বস্ত্রালয়' : 'e.g., Metro Superstore'}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          {/* 2. Mobile Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? 'মোবাইল নম্বর (Mobile Number) *' : 'Mobile Number *'}</span>
            </label>
            <input
              type="tel"
              required
              value={storePhone}
              onChange={(e) => {
                setStorePhone(e.target.value);
                if (error) setError(null);
              }}
              placeholder={isBn ? 'যেমন: 017XXXXXXXX' : 'e.g., +880 1712 345678'}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium font-mono"
            />
          </div>

          {/* 3. Shop Address (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-500" />
              <span>
                {isBn ? 'ঠিকানা (Address - ঐচ্ছিক)' : 'Store Address (Optional)'}
              </span>
            </label>
            <input
              type="text"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder={isBn ? 'যেমন: দোকান নং ১২, নিউ মার্কেট' : 'e.g., Shop #12, Market Complex'}
              className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          <p className="text-[11px] text-stone-500 font-medium">
            💡 {isBn
              ? 'এই তথ্যগুলো আপনার ক্যাশ মেমো, ইনভয়েস ও রসিদে প্রিন্ট হবে। পরবর্তীতে টপ মেনু থেকে পরিবর্তন করা যাবে।'
              : 'These details will appear on your tax invoices and receipts. You can edit them anytime from the 3-dot menu.'}
          </p>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isBn ? 'সংরক্ষণ করুন এবং শুরু করুন' : 'Save & Start Billing'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
