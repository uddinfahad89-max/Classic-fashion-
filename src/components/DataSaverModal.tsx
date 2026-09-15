import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Zap,
  HardDrive,
  Download,
  Smartphone,
  ShieldCheck,
  X,
  Gauge,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Language, NetworkStatusInfo, ThermalPrinterSettings } from '../types';
import { storageService } from '../services/storageService';

interface DataSaverModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkStatus: NetworkStatusInfo;
  settings: ThermalPrinterSettings;
  onUpdateSettings: (settings: ThermalPrinterSettings) => void;
  language: Language;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DataSaverModal: React.FC<DataSaverModalProps> = ({
  isOpen,
  onClose,
  networkStatus,
  settings,
  onUpdateSettings,
  language,
  onShowToast,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (!isOpen) return null;

  const t = (bn: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'bn') return bn;
    return en;
  };

  const toggleDataSaver = () => {
    const next = !settings.isDataSaverEnabled;
    const updated = { ...settings, isDataSaverEnabled: next };
    onUpdateSettings(updated);
    onShowToast(
      next
        ? t('আল্ট্রা লো-ডাটা মোড সক্রিয় করা হয়েছে', 'Ultra Low-Data Mode activated', 'अल्ट्रा लो-डाटा मोड सक्रिय किया गया')
        : t('সাধারণ মোড সক্রিয় হয়েছে', 'Standard Mode restored', 'सामान्य मोड सक्रिय किया गया'),
      'success'
    );
  };

  const handleExportBackup = () => {
    try {
      const json = storageService.exportAllDataOffline();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `store_pos_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast(
        t('সম্পূর্ণ অফলাইন ব্যাকআপ ফাইল ডাউনলোড হয়েছে!', 'Complete offline backup downloaded!', 'पूर्ण ऑफलाइन बैकअप फ़ाइल डाउनलोड हो गई!'),
        'success'
      );
    } catch {
      onShowToast(
        t('ব্যাকআপ তৈরিতে সমস্যা হয়েছে', 'Failed to generate backup', 'बैकअप फ़ाइल बनाने में विफल'),
        'error'
      );
    }
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        onShowToast(t('অ্যাপ সফলভাবে ফোনে যুক্ত হচ্ছে!', 'App installed to home screen!', 'ऐप होम स्क्रीन पर इंस्टॉल हो रहा है!'), 'success');
      }
      setDeferredPrompt(null);
    } else {
      onShowToast(
        t(
          'আপনার ব্রাউজারের মেনু (⋮) থেকে "Add to Home Screen" চাপুন',
          'Tap "Add to Home Screen" from your browser menu (⋮)',
          'अपने ब्राउज़र मेनू (⋮) से "Add to Home Screen" चुनें'
        ),
        'info'
      );
    }
  };

  return (
    <div
      id="data-saver-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="data-saver-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="bg-linear-to-r from-emerald-600 via-teal-600 to-blue-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                <span>{t('লো-ডাটা ও অফলাইন ইঞ্জিন', 'Low-Data & Offline Engine', 'लो-डाटा व ऑफलाइन इंजन')}</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full border border-white/30">
                  {t('সক্রিয়', 'ACTIVE', 'सक्रिय')}
                </span>
              </h2>
              <p className="text-xs text-white/85 font-medium">
                {t('শুধু ডাটা অন থাকলেই চলবে — হেভি নেটওয়ার্কের দরকার নেই', 'Runs smoothly on any minimal data — zero heavy network needed', 'कम डाटा पर भी स्मूथ चलेगा — तेज इंटरनेट की ज़रूरत नहीं')}
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
          {/* Realtime Live Status Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. Network Status */}
            <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-stone-500">{t('নেটওয়ার্ক', 'Network', 'नेटवर्क')}</span>
                {networkStatus.isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                )}
              </div>
              <div className="text-xs font-black text-stone-900 truncate">
                {networkStatus.isOnline ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {networkStatus.effectiveType.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    {t('অফলাইন', 'Offline', 'ऑफलाइन')}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Bandwidth consumption */}
            <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-stone-500">{t('ব্যান্ডউইথ', 'Data Usage', 'डाटा खपत')}</span>
                <Gauge className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xs font-black text-blue-800">
                ~0 KB/s
              </div>
            </div>

            {/* 3. Storage Mode */}
            <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-stone-500">{t('স্টোরেজ', 'Storage', 'स्टोरेज')}</span>
                <HardDrive className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-xs font-black text-purple-800 truncate">
                {t('১০০% লোকাল', '100% Local', '100% लोकल')}
              </div>
            </div>

            {/* 4. Cache Engine */}
            <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-stone-500">{t('ক্যাশ ইঞ্জিন', 'Cache SW', 'कैश')}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="text-xs font-black text-teal-800 truncate">
                {t('রেডি (PWA)', 'Ready PWA', 'तैयार PWA')}
              </div>
            </div>
          </div>

          {/* Explanation Box: Why you don't need heavy network */}
          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2 mb-2 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t('কেন এই অ্যাপে হেভি ইন্টারনেট নেটওয়ার্ক লাগে না?', 'Why this app does NOT need heavy internet?', 'इस ऐप में भारी इंटरनेट की ज़रूरत क्यों नहीं है?')}</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>
                  <strong>{t('ডিভাইস-ফার্স্ট স্টোরেজ:', 'Device-First Storage:', 'डिवाइस स्टोरेज:')}</strong>{' '}
                  {t(
                    'দোকানের সব বিলিং, বাকি খাতা ও ক্যাশবুক আপনার ফোনের লোকাল স্টোরেজে তাত্ক্ষণিক প্রসেস হয়। সার্ভার ডাউন বা ধীরগতির হলেও কাজ আটকাবে না।',
                    'All bills, customer dues, and cashbook are processed locally on your phone. Works instantly even if server connection is slow.',
                    'सभी बिल, उधारी और कैशबुक सीधे आपके फ़ोन में प्रोसेस होते हैं। धीमे नेटवर्क में भी कभी नहीं अटकेगा।'
                  )}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>
                  <strong>{t('জিরো-ডাটা ব্লুটুথ প্রিন্ট:', 'Zero-Data Bluetooth Print:', 'ब्लूटूथ प्रिंट:')}</strong>{' '}
                  {t(
                    'থার্মাল প্রিন্টারে রশিদ পাঠাতে কোনো ইন্টারনেট প্রয়োজন হয় না; সরাসরি ব্লুটুথ দিয়ে সাথে সাথে প্রিন্ট হয়।',
                    'Receipt printing to thermal printer uses pure Bluetooth wireless GATT — 0 KB internet data required.',
                    'थर्मल प्रिंटर पर रसीद प्रिंट करने में कोई इंटरनेट डाटा खर्च नहीं होता; सीधे ब्लूटूथ से प्रिंट होता है।'
                  )}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>
                  <strong>{t('২জি/৩জি ও দুর্বল ডাটা সাপোর্টেড:', '2G/3G & Weak Signal Ready:', '2G/3G व कमजोर सिग्नल रेडी:')}</strong>{' '}
                  {t(
                    'শুধু সিম কার্ডে সামান্য ডাটা চালু থাকলেই অ্যাপের সব ফিচার পূর্ণ গতিতে চলবে।',
                    'Just having basic mobile data enabled is more than enough. No high-speed broadband needed.',
                    'बस मोबाइल डाटा ऑन रहना काफी है। किसी तेज़ वाई-फाई की जरूरत नहीं।'
                  )}
                </span>
              </li>
            </ul>
          </div>

          {/* Toggle: Ultra Low-Data Saver Mode */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>{t('আল্ট্রা ডাটা সেভার মোড', 'Ultra Low-Data Saver Mode', 'अल्ट्रा लो-डाटा सेवर मोड')}</span>
              </div>
              <p className="text-[11px] text-stone-500">
                {t(
                  'ভারী অ্যানিমেশন ও ব্যাকড্রপ এফেক্ট কমিয়ে অ্যাপকে সুপার-ফাস্ট ও ডাটা সাশ্রয়ী রাখে।',
                  'Minimizes animations & visual blur to run blazing fast on budget phones.',
                  'एनिमेशन कम करके बजट फ़ोन पर भी सुपरफ़ास्ट और डाटा बचत करता है।'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDataSaver}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.isDataSaverEnabled ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.isDataSaverEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Cards: PWA Install & Offline Backup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Install PWA Button */}
            <button
              type="button"
              onClick={handleInstallPwa}
              className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-blue-900 text-xs">
                  {isInstalled
                    ? t('অ্যাপ ইনস্টল করা আছে ✓', 'App Installed ✓', 'ऐप इंस्टॉल है ✓')
                    : t('ফোনে অ্যাপ ইনস্টল করুন', 'Install App on Phone', 'फ़ोन में ऐप इंस्टॉल करें')}
                </div>
                <div className="text-[10px] text-blue-700 font-medium">
                  {t('মাত্র ১ এমবি — হোম স্ক্রিন আইকন', 'Tiny 1MB — Home screen icon', 'सिर्फ 1MB — होम स्क्रीन')}
                </div>
              </div>
            </button>

            {/* Offline Backup File Button */}
            <button
              type="button"
              onClick={handleExportBackup}
              className="p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-purple-900 text-xs">
                  {t('অফলাইন ব্যাকআপ ডাউনলোড', 'Offline Backup File', 'ऑफलाइन बैकअप फ़ाइल')}
                </div>
                <div className="text-[10px] text-purple-700 font-medium">
                  {t('সব হিসাব মেমরিতে সেভ করুন', 'Save all records as JSON', 'सभी हिसाब JSON में सेव')}
                </div>
              </div>
            </button>
          </div>

          {/* Bottom Note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-100 text-stone-600 text-[11px]">
            <Info className="w-4 h-4 text-stone-500 shrink-0" />
            <span>
              {t(
                'টিপস: বাজারে বা দোকানে মোবাইল নেটওয়ার্কের ১-২ দাগ থাকলেও এই অ্যাপের বিলিং ও প্রিন্টিং পূর্ণ গতিতে চলবে।',
                'Tip: Even with weak 1-2 bar mobile signal, POS billing & printing works uninterrupted.',
                'टिप: दुकान में 1-2 बार सिग्नल होने पर भी बिलिंग और प्रिंटिंग पूरी रफ्तार से चलेगी।'
              )}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {t('ঠিক আছে', 'Got it', 'ठीक है')}
          </button>
        </div>
      </div>
    </div>
  );
};
