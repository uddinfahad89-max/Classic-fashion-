import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  Info,
  X,
  Printer,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Language } from '../types';

interface BluetoothHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onSystemPrintFallback?: () => void;
}

export const BluetoothHelpModal: React.FC<BluetoothHelpModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  onSystemPrintFallback,
}) => {
  const [copied, setCopied] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [browserName, setBrowserName] = useState('Unknown');
  const [isChrome, setIsChrome] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsInIframe(window.self !== window.top);
      } catch {
        setIsInIframe(true);
      }

      const ua = navigator.userAgent;
      const isIosDevice = /iPad|iPhone|iPod/.test(ua);
      setIsIOS(isIosDevice);

      if (isIosDevice) {
        setBrowserName('iOS Safari / Apple Device');
        setIsChrome(false);
      } else if (/Firefox/i.test(ua)) {
        setBrowserName('Mozilla Firefox');
        setIsChrome(false);
      } else if (/EdgA|Edg/i.test(ua)) {
        setBrowserName('Microsoft Edge');
        setIsChrome(true);
      } else if (/Chrome|CriOS/i.test(ua)) {
        setBrowserName('Google Chrome');
        setIsChrome(true);
      } else if (/SamsungBrowser/i.test(ua)) {
        setBrowserName('Samsung Internet');
        setIsChrome(true);
      } else {
        setBrowserName('Default Browser / In-App WebView');
        setIsChrome(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'bn') return bn;
    return en;
  };

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(appUrl, '_blank');
  };

  return (
    <div
      id="bluetooth-help-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="bluetooth-help-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <Bluetooth className="w-5 h-5 text-sky-200 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                <span>{t('ব্লুটুথ নট সাপোর্ট সমাধান', 'Bluetooth Fix & Guide', 'ब्लूटूथ नॉट सपोर्ट समाधान')}</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/80 px-2 py-0.5 rounded-full border border-rose-400">
                  {t('সহজ সমাধান', 'FIX GUIDE', 'समाधान')}
                </span>
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {t('কেন এই এরর আসে এবং কীভাবে ১ মিনিটে চালু করবেন', 'Why this error occurs & how to fix it in 1 minute', 'यह एरर क्यों आता है और 1 मिनट में कैसे ठीक करें')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-stone-800 text-xs sm:text-sm">
          {/* Diagnostic Status Box */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('সমস্যার মূল কারণ শনাক্ত হয়েছে:', 'Root Cause Identified:', 'समस्या का मुख्य कारण:')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200/60">
                <span className="text-stone-500 block text-[10px] font-bold">{t('বর্তমান ব্রাউজার', 'Current Browser', 'वर्तमान ब्राउज़र')}</span>
                <span className="font-bold text-stone-900 truncate block">{browserName}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200/60">
                <span className="text-stone-500 block text-[10px] font-bold">{t('প্রিভিউ স্ট্যাটাস', 'Preview Status', 'स्थिति')}</span>
                <span className={`font-bold block truncate ${isInIframe ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {isInIframe
                    ? t('আইফ্রেম প্রিভিউ (ব্লকড)', 'Inside Iframe (Blocked)', 'आईफ्रेम (ब्लॉक्ड)')
                    : t('সরাসরি ব্রাউজার ট্যাব', 'Direct Tab', 'सीधे ब्राउज़र टैब')}
                </span>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
              {isInIframe
                ? t(
                    '📌 আপনি AI Studio এর প্রিভিউ স্ক্রিন বা ফ্রেমের ভেতরে আছেন। ব্রাউজার সিকিউরিটির কারণে ফ্রেমের ভেতর থেকে সরাসরি ব্লুটুথ ডিভাইস খোঁজা বন্ধ থাকে।',
                    '📌 You are inside an iframe/in-app preview window. Browser security restricts Bluetooth hardware access inside embedded frames.',
                    '📌 आप AI Studio के प्रीव्यू फ्रेम के अंदर हैं। ब्राउज़र सुरक्षा के कारण फ्रेम के अंदर से ब्लूटूथ अनुमति बंद रहती है।'
                  )
                : !isChrome
                ? t(
                    '📌 আপনি এমন একটি ব্রাউজার বা ডিভাইসে আছেন যা Web Bluetooth সমর্থন করে না (যেমন ফায়ারফক্স বা আইফোন)। গুগল ক্রোম (Google Chrome) ব্যবহার করলেই এটি কাজ করবে।',
                    '📌 Your current browser does not support Web Bluetooth. Web Bluetooth is natively supported in Google Chrome & Microsoft Edge on Android.',
                    '📌 आपका वर्तमान ब्राउज़र वेब ब्लूटूथ सपोर्ट नहीं करता। एंड्रॉइड पर सिर्फ Google Chrome या Edge का उपयोग करें।'
                  )
                : t(
                    '📌 আপনার ডিভাইসে ব্লুটুথ সংযোগ শুরু করতে নিচের নির্দেশনাগুলো অনুসরণ করুন।',
                    '📌 Follow the steps below to connect your Bluetooth thermal printer.',
                    '📌 ब्लूटूथ प्रिंटर कनेक्ट करने के लिए नीचे दिए गए चरणों का पालन करें।'
                  )}
            </p>
          </div>

          {/* Step 1: Open in Google Chrome (Direct Tab) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-blue-900 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                ১
              </span>
              <span>{t('আসল Google Chrome ব্রাউজারে খুলুন', 'Open in real Google Chrome Browser', 'असली Google Chrome में खोलें')}</span>
            </div>
            <p className="text-xs text-blue-950/80 font-medium">
              {t(
                'নিচের বাটনটি চেপে অ্যাপের লিঙ্কটি কপি করুন এবং আপনার ফোনের আসল Google Chrome ব্রাউজারে পেস্ট করে খুলুন:',
                'Copy the app link below and open it directly inside the real Google Chrome browser app on your phone:',
                'नीचे दिए गए बटन से लिंक कॉपी करें और अपने फोन के Google Chrome में खोलें:'
              )}
            </p>

            {/* Link Copy & Open Action */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copied
                    ? t('লিঙ্ক কপি হয়েছে!', 'Link Copied!', 'लिंक कॉपी हो गया!')
                    : t('অ্যাপের লিঙ্ক কপি করুন', 'Copy Direct Link', 'डायरेक्ट लिंक कॉपी करें')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-3.5 py-2.5 bg-white hover:bg-stone-50 border border-blue-300 text-blue-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('নতুন ট্যাবে খুলুন', 'Open in New Tab', 'नये टैब में खोलें')}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Install as App / PWA */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                ২
              </span>
              <span>{t('ফোনে অ্যাপ হিসেবে ইনস্টল করুন (সবচেয়ে ভালো উপায়)', 'Install as Phone App (Best Method)', 'फोन में ऐप इंस्टॉल करें (सर्वश्रेष्ठ तरीका)')}</span>
            </div>
            <p className="text-xs text-emerald-950 font-medium leading-relaxed">
              {t(
                'ক্রোমে লিঙ্ক খোলার পর ডানদিকের ৩-ডট মেনু (⋮) থেকে "Add to Home screen" বা "Install App" চাপুন। হোম স্ক্রিনের আইকন থেকে ওপেন করলে ব্রাউজার ফ্রেম ছাড়াই এটি আসল অ্যান্ড্রোয়েড অ্যাপের মতো ১০০% ব্লুটুথ ক্ষমতা পাবে।',
                'In Chrome, tap the 3-dot menu (⋮) and select "Add to Home screen" / "Install App". Running from home screen unlocks full hardware Bluetooth access.',
                'क्रोम में 3-डॉट मेनू (⋮) दबाकर "Add to Home screen" चुनें। होमस्क्रीन से चलाने पर फुल ब्लूटूथ सुविधा मिलती है।'
              )}
            </p>
          </div>

          {/* Step 3: Phone Bluetooth & Location Permissions */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                ৩
              </span>
              <span>{t('ফোনের সেটিংস চেক করুন', 'Check Phone Settings', 'फ़ोन सेटिंग्स चेक करें')}</span>
            </div>
            <ul className="space-y-1 text-xs text-stone-700 font-medium pl-6 list-disc">
              <li>{t('আপনার ফোনের Bluetooth ও Location (GPS) চালু রাখুন।', 'Ensure phone Bluetooth & Location (GPS) are turned ON.', 'फ़ोन का ब्लूटूथ और लोकेशन चालू रखें।')}</li>
              <li>{t('থার্মাল প্রিন্টারের পাওয়ার বাটন অন আছে এবং নীল লাইট জ্বলছে কিনা দেখুন।', 'Ensure your thermal printer is ON with blue light active.', 'थर्मल प्रिंटर का पावर ऑन रखें।')}</li>
              <li>{t('অ্যান্ড্রয়েড ১২+ হলে Chrome অ্যাপের "Nearby devices" পারমিশন Allow করুন।', 'On Android 12+, allow Chrome "Nearby devices" permission.', 'एंड्रॉइड 12+ पर क्रोम की "Nearby devices" परमिशन दें।')}</li>
            </ul>
          </div>

          {/* Alternative: System Print / RawBT / PDF */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-purple-600" />
                <span>{t('ব্লুটুথ ছাড়াও প্রিন্ট করা সম্ভব!', 'Print Without Bluetooth Available!', 'बिना ब्लूटूथ भी प्रिंट संभव!')}</span>
              </div>
              <p className="text-[11px] text-purple-800 mt-0.5">
                {t(
                  'যেকোনো সময় বিলের "সিস্টেম প্রিন্ট (Print)" বা "PDF রসিদ" দিয়ে প্রিন্টার বা মেমো বের করতে পারবেন।',
                  'You can always use standard System Print or PDF Download to print receipts on any printer.',
                  'आप हमेशा सिस्टम प्रिंट या PDF से किसी भी प्रिंटर पर बिल निकाल सकते हैं।'
                )}
              </p>
            </div>
            {onSystemPrintFallback && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSystemPrintFallback();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 cursor-pointer"
              >
                {t('সিস্টেম প্রিন্ট', 'System Print', 'सिस्टम प्रिंट')}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 font-medium">
            {t('অ্যান্ড্রয়েড ক্রোম ও এজ সাপোর্টেড', 'Android Chrome & Edge supported', 'एंड्रॉइड क्रोम सपोर्टेड')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {t('বুঝেছি / বন্ধ করুন', 'Understood', 'समझ गया')}
          </button>
        </div>
      </div>
    </div>
  );
};
