import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  Phone,
  MapPin,
  Volume2,
  Sparkles,
  CheckCircle2,
  Mail,
  Lock,
  Globe,
  LogIn,
  UserPlus,
  Cloud,
  Database,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { Language } from '../types';
import { supabaseService, SUPABASE_SQL_SETUP_SCRIPT } from '../services/supabaseService';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  setCustomSupabaseCredentials,
} from '../supabaseClient.js';

interface OnboardingModalProps {
  isOpen: boolean;
  onSave: (data: {
    storeName: string;
    storePhone: string;
    storeAddress: string;
    ownerEmail?: string;
    ownerPin?: string;
    ownerName?: string;
    password?: string;
  }) => void | Promise<void>;
  onLoginExisting?: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  language?: Language;
  onSelectLanguage?: (lang: Language) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onSave,
  onLoginExisting,
  language = 'bn',
  onSelectLanguage,
  onClose,
  canDismiss = false,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  // Mode: 'signup' | 'login' | 'sql_guide'
  const [activeTab, setActiveTab] = useState<'signup' | 'login' | 'sql_guide'>('signup');

  // Sign up form state (Completely blank by default)
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login form state (Completely blank by default)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Supabase Custom Config state
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const currentConfig = getSupabaseConfig();
  const [customUrl, setCustomUrl] = useState(currentConfig.url || '');
  const [customKey, setCustomKey] = useState(currentConfig.key || '');
  const [configSaved, setConfigSaved] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCopiedSql, setIsCopiedSql] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasSpokenRef = useRef(false);

  // Helper dictionary
  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  // Play Speech Alert
  const playVoiceAlert = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak =
        activeTab === 'login'
          ? 'Please enter your registered email and password to restore your shop data.'
          : 'Welcome! Please enter your shop name, mobile number, and password to start.';
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
      const timer = setTimeout(() => {
        playVoiceAlert();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Signup
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!storeName.trim()) {
      setError(t('দয়া করে আপনার দোকানের নাম লিখুন', 'Please enter your shop name', 'कृपया दुकान का नाम दर्ज करें'));
      return;
    }
    if (!storePhone.trim()) {
      setError(t('দয়া করে আপনার মোবাইল নম্বর লিখুন', 'Please enter your mobile number', 'कृपया मोबाइल नंबर दर्ज करें'));
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError(t('দয়া করে সঠিক ইমেল অ্যাড্রেস লিখুন', 'Please enter a valid email address', 'कृपया वैध ईमेल दर्ज करें'));
      return;
    }
    if (!ownerPassword || ownerPassword.length < 6) {
      setError(t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'));
      return;
    }

    setIsLoading(true);

    try {
      // 1. Attempt Supabase Auth & Multi-User isolation if configured
      if (isSupabaseConfigured()) {
        const result = await supabaseService.signUp(ownerEmail.trim(), ownerPassword, {
          storeName: storeName.trim(),
          phone: storePhone.trim(),
          storeAddress: storeAddress.trim(),
          name: ownerName.trim() || storeName.trim(),
        });

        if (!result.success && result.error) {
          // If already registered, suggest login
          if (result.error.toLowerCase().includes('already registered')) {
            setError(
              t(
                'এই ইমেল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি আছে! অনুগ্রহ করে "লগইন / বিদ্যমান ব্যবহারকারী" ট্যাবে লগইন করুন।',
                'This email is already registered! Please switch to the "Login / Existing User" tab.',
                'यह ईमेल पहले से पंजीकृत है! कृपया "लॉगिन" टैब पर जाएँ।'
              )
            );
            setIsLoading(false);
            return;
          }
          console.warn('Supabase signup notice:', result.error);
        }
      }

      // 2. Complete setup & state init
      await onSave({
        storeName: storeName.trim(),
        storePhone: storePhone.trim(),
        storeAddress: storeAddress.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPin: ownerPassword.slice(0, 4),
        ownerName: ownerName.trim() || storeName.trim() || 'Store Owner',
        password: ownerPassword,
      });

      setSuccessMsg(t('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!', 'Account successfully created!', 'खाता सफलतापूर्वक बनाया गया!'));
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login & Cloud Data Restore
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!loginEmail.trim()) {
      setError(t('দয়া করে আপনার নিবন্ধিত ইমেল লিখুন', 'Please enter your registered email', 'कृपया पंजीकृत ईमेल दर्ज करें'));
      return;
    }
    if (!loginPassword) {
      setError(t('দয়া করে আপনার পাসওয়ার্ড লিখুন', 'Please enter your password', 'कृपया पासवर्ड दर्ज करें'));
      return;
    }

    setIsLoading(true);

    try {
      if (onLoginExisting) {
        const result = await onLoginExisting(loginEmail.trim(), loginPassword);
        if (!result.success) {
          setError(
            result.error ||
              t(
                'লগইন ব্যর্থ হয়েছে! ইমেল ও পাসওয়ার্ড সঠিক কিনা পরীক্ষা করুন।',
                'Login failed! Please check your email and password.',
                'लॉगिन विफल! कृपया ईमेल और पासवर्ड की जाँच करें।'
              )
          );
          setIsLoading(false);
          return;
        }
      }
      setSuccessMsg(
        t(
          'লগইন সফল! আপনার ক্লাউড ডেটা রিস্টোর হচ্ছে...',
          'Login successful! Restoring cloud data...',
          'लॉगिन सफल! क्लाउड डेटा पुनर्स्थापित हो रहा है...'
        )
      );
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy SQL setup script to clipboard
  const handleCopySql = () => {
    try {
      navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCRIPT);
      setIsCopiedSql(true);
      setTimeout(() => setIsCopiedSql(false), 3000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Save custom Supabase credentials
  const handleSaveCustomCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSupabaseCredentials(customUrl, customKey);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const configured = isSupabaseConfigured();

  return (
    <div
      id="onboarding-multiuser-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-4 sm:py-5 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
                  <span>{t('মাল্টি-ইউজার ক্লাউড POS', 'Multi-User Cloud POS', 'मल्टी-यूज़र क्लाउड POS')}</span>
                  <span className="text-[10px] bg-emerald-400 text-stone-950 font-black px-2 py-0.5 rounded-full">
                    Supabase
                  </span>
                </h2>
                <p className="text-xs text-blue-100 font-medium">
                  {t(
                    'সম্পূর্ণ ডেটা আইসোলেশন ও ক্লাউড রিস্টোর সুবিধা',
                    'Full data isolation & cloud backup restore',
                    'पूर्ण डेटा अलगाव और क्लाउड बैकअप'
                  )}
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
                {isSpeaking ? (isBn ? 'বলছে...' : 'Playing...') : (isBn ? 'ভয়েস' : 'Voice')}
              </span>
            </button>
          </div>

          {/* Top Info Banner */}
          <div className="mt-3 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-blue-50">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="text-[11px] truncate">
                {configured
                  ? t('ক্লাউড সিঙ্ক রেডি (RLS সুরক্ষিত)', 'Supabase Cloud Ready (RLS Secured)', 'क्लाउड सिंक तैयार (RLS सुरक्षित)')
                  : t('ক্লাউড সিঙ্ক মোড চালু', 'Cloud Multi-User Ready', 'क्लाउड सिंक चालू')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('sql_guide')}
              className="text-[10px] underline hover:text-white shrink-0 font-bold cursor-pointer"
            >
              {t('SQL স্ক্রিপ্ট দেখুন ➜', 'View SQL Script ➜', 'SQL स्क्रिप्ट देखें ➜')}
            </button>
          </div>
        </div>

        {/* Language Selection Bar & Navigation Tabs */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          {/* Main Action Tabs */}
          <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-xl text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('নতুন দোকান (Sign Up)', 'New Shop (Sign Up)', 'नई दुकान (Sign Up)')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('লগইন (Restore)', 'Login (Restore)', 'लॉगिन (Restore)')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('sql_guide');
                setError(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'sql_guide'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
              title="Supabase Database SQL Setup"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">SQL</span>
            </button>
          </div>

          {/* Language Selector */}
          {onSelectLanguage && (
            <div className="flex items-center gap-1 bg-white border border-stone-200 p-0.5 rounded-lg text-xs font-bold shrink-0">
              <Globe className="w-3.5 h-3.5 text-stone-500 ml-1" />
              <button
                type="button"
                onClick={() => onSelectLanguage('bn')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  language === 'bn' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  language === 'en' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  language === 'hi' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                हिन्दी
              </button>
            </div>
          )}
        </div>

        {/* Form Body / Content Container */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: NEW SHOP ONBOARDING & SIGNUP (Completely Blank Form) */}
          {/* ========================================================================= */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 text-xs text-blue-900 flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  {t(
                    'নতুন দোকান শুরু করুন! আপনার দেওয়া তথ্যে নিজস্ব ক্লাউড ভল্ট তৈরি হবে। অন্য কারো ডেটা আপনার এখানে আসবে না।',
                    'Welcome! Enter your shop details below to create your isolated cloud account.',
                    'अपनी नई दुकान शुरू करें! आपकी जानकारी से आपका अपना क्लाउड खाता बनेगा।'
                  )}
                </p>
              </div>

              {/* 1. Shop Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('দোকানের নাম (Shop Name) *', 'Shop Name *', 'दुकान का नाम *')}</span>
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
                  placeholder={t('যেমন: ফ্যাশন পয়েন্ট / My Store', 'e.g., Prime Fashion / My Store', 'उदा: फैशन हब / My Store')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold transition-all"
                />
              </div>

              {/* 2. Mobile Number & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('মোবাইল নম্বর (Mobile) *', 'Mobile Number *', 'मोबाइल नंबर *')}</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={storePhone}
                    onChange={(e) => {
                      setStorePhone(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={t('০১XXXXXXXXX / ৯৮XXXXXXXX', 'e.g. 01700000000', 'उदा: 9800000000')}
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium font-mono transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('ইমেল অ্যাড্রেস (Email) *', 'Email (for Login) *', 'ईमेल (Login हेतु) *')}</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => {
                      setOwnerEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="owner@example.com"
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium font-mono transition-all"
                  />
                </div>
              </div>

              {/* 3. Password & Owner Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('পাসওয়ার্ড (Password) *', 'Password (Min 6) *', 'पासवर्ड *')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={ownerPassword}
                    onChange={(e) => {
                      setOwnerPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800">
                    {t('মালিকের নাম (Owner Name)', 'Owner Name (Optional)', 'मालिक का नाम')}
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder={t('আপনার নাম লিখুন', 'Your name', 'अपना नाम लिखें')}
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                  />
                </div>
              </div>

              {/* 4. Shop Address (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span>{t('দোকানের ঠিকানা (Shop Address - ঐচ্ছিক)', 'Shop Address (Optional)', 'दुकान का पता')}</span>
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder={t('যেমন: দোকান নং ১২, নিউ মার্কেট', 'e.g., Shop #12, Market Complex', 'उदा: दुकान नंबर १२, मुख्य बाजार')}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('অ্যাকাউন্ট তৈরি হচ্ছে...', 'Creating Account...', 'खाता बनाया जा रहा है...')
                      : t('🚀 দোকান তৈরি করুন ও শুরু করুন', '🚀 Create Shop & Start POS', '🚀 दुकान बनाएं और शुरू करें')}
                  </span>
                </button>
              </div>

              {/* Switch to Login Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline inline-flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>
                    {t(
                      'আগে থেকেই অ্যাকাউন্ট আছে? এখানে ক্লিক করে লগইন করুন ➜',
                      'Already have an account? Click here to Login & Restore ➜',
                      'पहले से खाता है? यहाँ क्लिक करके लॉगिन करें ➜'
                    )}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: EXISTING USER LOGIN & CLOUD DATA RESTORE */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-3.5 text-xs text-emerald-950 flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  {t(
                    'অন্য ডিভাইসে সুইচ করেছেন বা অ্যাপ রিস্টোর করতে চান? আপনার ইমেল ও পাসওয়ার্ড দিয়ে লগইন করলেই আপনার সব ইনভয়েস, ক্যাশবুক ও কাস্টমার বাকি স্বয়ংক্রিয়ভাবে ফিরে আসবে।',
                    'Switching devices or reinstalling? Login with your email & password to restore all your invoices, cashbook & dues.',
                    'डिवाइस बदल रहे हैं? अपने ईमेल और पासवर्ड से लॉगिन करें और सारा डेटा तुरंत प्राप्त करें।'
                  )}
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('নিবন্ধিত ইমেল (Email) *', 'Registered Email *', 'पंजीकृत ईमेल *')}</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="owner@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium font-mono transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('পাসওয়ার্ড (Password) *', 'Password *', 'पासवर्ड *')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showLoginPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('লগইন ও ডেটা রিস্টোর হচ্ছে...', 'Logging in & Restoring Data...', 'लॉगिन और डेटा रिस्टोर हो रहा है...')
                      : t('☁️ লগইন করুন ও ডেটা রিস্টোর পান', '☁️ Login & Restore My Shop Data', '☁️ लॉगिन करें और डेटा रिस्टोर करें')}
                  </span>
                </button>
              </div>

              {/* Switch to Signup Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setError(null);
                  }}
                  className="text-xs text-stone-600 hover:text-blue-600 font-bold cursor-pointer underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>
                    {t(
                      'নতুন ইউজার? নতুন দোকান অ্যাকাউন্ট খুলতে এখানে চাপুন ➜',
                      'New to POS? Click here to create a new shop account ➜',
                      'नया खाता खोलना चाहते हैं? यहाँ क्लिक करें ➜'
                    )}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SUPABASE SQL SETUP & CREDENTIALS CONFIG */}
          {/* ========================================================================= */}
          {activeTab === 'sql_guide' && (
            <div className="space-y-4">
              <div className="bg-stone-900 text-stone-100 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-xs font-bold text-white">
                      Supabase SQL Editor Setup
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    {isCopiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-400">
                  {t(
                    'আপনার Supabase ড্যাশবোর্ডে গিয়ে SQL Editor এ গিয়ে এই পুরো স্ক্রিপ্টটি রান করলেই profiles, invoices, cash_entries, customer_dues টেবিল এবং RLS সিকিউরিটি তৈরি হয়ে যাবে।',
                    'Run this script inside Supabase Dashboard > SQL Editor > New Query to create all tables and RLS policies.',
                    'Supabase SQL Editor में यह स्क्रिप्ट चलाकर सभी टेबल और RLS सुरक्षा नीतियां बनाएं।'
                  )}
                </p>
                <div className="max-h-48 overflow-y-auto bg-stone-950 p-3 rounded-xl border border-stone-800 font-mono text-[10px] text-emerald-300">
                  <pre>{SUPABASE_SQL_SETUP_SCRIPT.slice(0, 1000)} ...\n-- [Click "Copy SQL Script" for complete code with RLS]</pre>
                </div>
              </div>

              {/* Collapsible Supabase Project URL & Anon Key override */}
              <div className="border border-stone-200 rounded-2xl p-3.5 bg-stone-50 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowSupabaseSettings(!showSupabaseSettings)}
                  className="w-full flex items-center justify-between text-xs font-bold text-stone-800 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span>{t('Supabase URL ও Anon Key পরিবর্তন / কাস্টমাইজ', 'Custom Supabase URL & Anon Key', 'कस्टम Supabase URL व कुंजी')}</span>
                  </span>
                  <span className="text-[11px] text-blue-600 underline">
                    {showSupabaseSettings ? 'সংক্ষিপ্ত করুন' : 'বিস্তারিত দেখুন'}
                  </span>
                </button>

                {showSupabaseSettings && (
                  <form onSubmit={handleSaveCustomCredentials} className="space-y-3 pt-2 border-t border-stone-200">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-700">Project URL (https://xxxx.supabase.co):</label>
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://xyzproject.supabase.co"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-700">Anon Public Key:</label>
                      <input
                        type="password"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        {configSaved ? 'Saved!' : 'Save Credentials'}
                      </button>
                      {configured && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                          ✓ Connected
                        </span>
                      )}
                    </div>
                  </form>
                )}
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ← {t('সাইন-আপ ফর্মে ফিরে যান', 'Back to Sign Up', 'वापस जाएं')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
