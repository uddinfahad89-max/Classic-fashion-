import React, { useState, useEffect } from 'react';
import {
  Store,
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
  History,
  User,
} from 'lucide-react';
import { Language, SavedAccountItem } from '../types';
import { supabaseService, SUPABASE_SQL_SETUP_SCRIPT } from '../services/supabaseService';
import { storageService } from '../services/storageService';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  setCustomSupabaseCredentials,
} from '../supabaseClient.js';
import { ResetPasswordModal } from './ResetPasswordModal';

interface OnboardingModalProps {
  isOpen: boolean;
  onSave: (data: {
    storeName: string;
    storePhone?: string;
    storeAddress?: string;
    ownerEmail: string;
    ownerName?: string;
    password: string;
  }) => void | Promise<void>;
  onLoginExisting?: (
    email: string,
    password: string,
    method?: 'email_password'
  ) => Promise<{ success: boolean; error?: string }>;
  language?: Language;
  onSelectLanguage?: (lang: Language) => void;
  onClose?: () => void;
  canDismiss?: boolean;
  onOpenForgotPassword?: (email?: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onSave,
  onLoginExisting,
  language = 'bn',
  onSelectLanguage,
  onClose,
  canDismiss = false,
  onOpenForgotPassword,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  // Navigation Tab: 'login' | 'signup' | 'sql_guide'
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'sql_guide'>('login');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Sign Up Form State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupStoreName, setSignupStoreName] = useState('');
  const [signupOwnerName, setSignupOwnerName] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Log In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Saved accounts in local vault for fast 1-click restore
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountItem[]>([]);

  // Supabase Custom Config State
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const currentConfig = getSupabaseConfig();
  const [customUrl, setCustomUrl] = useState(currentConfig.url || '');
  const [customKey, setCustomKey] = useState(currentConfig.key || '');
  const [configSaved, setConfigSaved] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCopiedSql, setIsCopiedSql] = useState(false);

  // Helper translations
  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  useEffect(() => {
    if (isOpen) {
      const accounts = storageService.getSavedAccounts();
      setSavedAccounts(accounts);
      if (accounts.length > 0 && !loginEmail) {
        setLoginEmail(accounts[0].email || accounts[0].identifier || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  };

  // Handle Sign Up (Email & Password Only)
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = signupEmail.trim().toLowerCase();
    const cleanPassword = signupPassword.trim();
    const cleanStoreName = signupStoreName.trim();
    const cleanOwnerName = signupOwnerName.trim();

    if (!cleanEmail) {
      setError(
        t('দয়া করে আপনার ইমেল ঠিকানা লিখুন', 'Please enter your email address', 'कृपया अपना ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError(
        t('সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)', 'Please enter a valid email address (e.g. name@example.com)', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!cleanPassword) {
      setError(
        t('দয়া করে পাসওয়ার্ড লিখুন', 'Please enter a password', 'कृपया पासवर्ड दर्ज करें')
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setError(
        t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }

    setIsLoading(true);

    try {
      // 1. Attempt Supabase Auth Sign Up
      if (isSupabaseConfigured()) {
        const result = await supabaseService.signUp(cleanEmail, cleanPassword, {
          storeName: cleanStoreName || 'My Store',
          phone: '',
          name: cleanOwnerName || cleanEmail.split('@')[0],
        });

        if (!result.success && result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }
      }

      // 2. Complete local store & user initialization
      await onSave({
        storeName: cleanStoreName || 'My Store',
        ownerEmail: cleanEmail,
        ownerName: cleanOwnerName || cleanEmail.split('@')[0],
        password: cleanPassword,
      });

      setSuccessMsg(
        t('সাইন আপ সফল হয়েছে!', 'Sign up successful!', 'साइन अप सफल!')
      );
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login (Email & Password Only)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    if (!cleanEmail) {
      setError(
        t('দয়া করে আপনার ইমেল ঠিকানা লিখুন', 'Please enter your email address', 'कृपया अपना ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError(
        t('সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)', 'Please enter a valid email address (e.g. name@example.com)', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!cleanPassword) {
      setError(
        t('দয়া করে আপনার পাসওয়ার্ড লিখুন', 'Please enter your password', 'कृपया अपना पासवर्ड दर्ज करें')
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setError(
        t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }

    if (!onLoginExisting) return;

    setIsLoading(true);

    try {
      const result = await onLoginExisting(cleanEmail, cleanPassword, 'email_password');
      if (!result.success) {
        setError(
          result.error ||
            t(
              'ইমেল অথবা পাসওয়ার্ড সঠিক নয়!',
              'Invalid email or password',
              'ईमेल या पासवर्ड गलत है!'
            )
        );
        setIsLoading(false);
        return;
      }

      setSuccessMsg(
        t(
          'লগইন সফল! আপনার দোকানের ক্লাউড ডেটা রিস্টোর হচ্ছে...',
          'Login successful! Restoring shop cloud data...',
          'लॉगिन सफल! डेटा रिस्टोर हो रहा है...'
        )
      );
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy Supabase SQL script
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCRIPT);
      setIsCopiedSql(true);
      setTimeout(() => setIsCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy SQL script:', err);
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
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header Card */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
                  <span>{t('মাল্টি-ইউজার ক্লাউড POS', 'Multi-User Cloud POS', 'मल्टी-यूज़र क्लाउड POS')}</span>
                  <span className="text-[10px] bg-emerald-400 text-stone-950 font-black px-2 py-0.5 rounded-full">
                    Cloud Auth
                  </span>
                </h2>
                <p className="text-xs text-blue-100 font-medium">
                  {t(
                    'নিরাপদ ইমেল ও পাসওয়ার্ড লগইন এবং ক্লাউড ডেটা সিঙ্ক',
                    'Secure Email & Password Authentication & Cloud Sync',
                    'सुरक्षित ईमेल व पासवर्ड प्रमाणीकरण एवं क्लाउड सिंक'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Sub-header Connection Pill */}
          <div className="mt-2.5 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-blue-50">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="text-[11px] truncate">
                {configured
                  ? t('Supabase ক্লাউড কানেক্টেড (RLS সুরক্ষিত)', 'Supabase Cloud Connected (RLS Secured)', 'Supabase क्लाउड कनेक्टेड (RLS सुरक्षित)')
                  : t('ক্লাউড ও লোকাল ডেটাবেস প্রস্তুত', 'Cloud & Local Database Ready', 'क्लाउड व लोकल डेटाबेस तैयार')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('sql_guide')}
              className="text-[10px] underline hover:text-white shrink-0 font-bold cursor-pointer"
            >
              {t('SQL স্ক্রিপ্ট ➜', 'SQL Script ➜', 'SQL स्क्रिप्ट ➜')}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar: [Log In] and [Sign Up] */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-xl text-xs font-bold flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('লগইন (Log In)', 'Log In', 'लॉगिन')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('সাইন আপ (Sign Up)', 'Sign Up', 'साइन अप')}</span>
            </button>
          </div>

          {/* Language Selector */}
          {onSelectLanguage && (
            <div className="flex items-center gap-0.5 bg-white border border-stone-200 p-0.5 rounded-lg text-xs font-bold shrink-0">
              <Globe className="w-3.5 h-3.5 text-stone-500 ml-1" />
              <button
                type="button"
                onClick={() => onSelectLanguage('bn')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  language === 'bn' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  language === 'en' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  language === 'hi' ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                हिन्दी
              </button>
            </div>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Status Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: LOG IN (EMAIL + PASSWORD ONLY) */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              {/* Saved accounts in device (Fast 1-click selection) */}
              {savedAccounts.length > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-950">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('এই ডিভাইসে সংরক্ষিত অ্যাকাউন্ট:', 'Saved Accounts on Device:', 'सहेजे गए खाते:')}</span>
                    </span>
                    <span className="text-[10px] text-blue-700 font-mono">{savedAccounts.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.identifier}
                        type="button"
                        onClick={() => {
                          if (acc.email) setLoginEmail(acc.email);
                          setError(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-blue-100/60 border border-blue-200 text-left text-[11px] font-bold text-stone-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                      >
                        <Store className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate max-w-[120px]">{acc.storeName || acc.name}</span>
                        <span className="text-[10px] font-mono text-stone-500 truncate max-w-[100px]">
                          ({acc.email})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('ইমেল ঠিকানা (Email Address) *', 'Email Address *', 'ईमेल पता *')}</span>
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
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('পাসওয়ার্ড (Password) *', 'Password *', 'पासवर्ड *')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showLoginPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={t('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড', 'Minimum 6 character password', 'कम से कम 6 अक्षरों का पासवर्ड')}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenForgotPassword) {
                          onOpenForgotPassword(loginEmail);
                        } else {
                          setIsResetModalOpen(true);
                        }
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    >
                      {t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot Password?', 'पासवर्ड भूल गए?')}
                    </button>
                  </div>
                </div>

                {/* Submit Log In Button */}
                <div className="pt-1.5">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>
                      {isLoading
                        ? t('লগইন ও ডেটা রিস্টোর হচ্ছে...', 'Logging in & Restoring Data...', 'लॉगिन और डेटा रिस्टोर हो रहा है...')
                        : t('লগইন ও ক্লাউড ডেটা রিস্টোর', 'Log In & Restore Shop Data', 'लॉगिन व डेटा रिस्टोर करें')}
                    </span>
                  </button>
                </div>

                {/* Switch to Sign Up */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {t(
                        'নতুন দোকান? নতুন অ্যাকাউন্ট খুলতে এখানে চাপুন ➜',
                        'New to POS? Click here to Sign Up ➜',
                        'नई दुकान? नया खाता बनाने के लिए यहाँ क्लिक करें ➜'
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SIGN UP (EMAIL + PASSWORD ONLY) */}
          {/* ========================================================================= */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('ইমেল ঠিকানা (Email Address) *', 'Email Address *', 'ईमेल पता *')}</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="owner@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('পাসওয়ার্ড (Password) *', 'Password (min 6 chars) *', 'पासवर्ड *')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSignupPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড তৈরি করুন', 'Create password (min 6 characters)', 'कम से कम 6 अक्षरों का पासवर्ड बनाएं')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Shop Name (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('দোকানের নাম (Shop Name - Optional)', 'Shop Name (Optional)', 'दुकान का नाम (वैकल्पिक)')}</span>
                </label>
                <input
                  type="text"
                  value={signupStoreName}
                  onChange={(e) => {
                    setSignupStoreName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('যেমন: Classic Fashion', 'e.g. Classic Fashion', 'उदा: Classic Fashion')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Owner Name (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('মালিকের নাম (Owner Name - Optional)', 'Owner Name (Optional)', 'मालिक का नाम (वैकल्पिक)')}</span>
                </label>
                <input
                  type="text"
                  value={signupOwnerName}
                  onChange={(e) => {
                    setSignupOwnerName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('মালিক বা ক্যাশিয়ারের নাম', 'Store Owner or Cashier name', 'मालिक का नाम')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Submit Sign Up Button */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('অ্যাকাউন্ট তৈরি হচ্ছে...', 'Creating Account...', 'खाता बनाया जा रहा है...')
                      : t('নতুন অ্যাকাউন্ট খুলুন (Sign Up)', 'Create Shop Account (Sign Up)', 'साइन अप करें')}
                  </span>
                </button>
              </div>

              {/* Switch to Log In */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline inline-flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>
                    {t(
                      'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন ➜',
                      'Already have an account? Log In here ➜',
                      'पहले से खाता है? लॉगिन करें ➜'
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
                    'আপনার Supabase ড্যাশবোর্ডে গিয়ে SQL Editor এ গিয়ে এই পুরো স্ক্রিপ্টটি রান করলেই profiles, invoices, cash_entries, customer_dues, products টেবিল এবং RLS সিকিউরিটি তৈরি হয়ে যাবে।',
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

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ← {t('লগইন ফর্মে ফিরে যান', 'Back to Log In', 'वापस जाएं')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Standalone Reset Password Modal if triggered directly */}
      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        language={language}
        prefilledEmail={loginEmail}
        initialMode="request_link"
        onSuccess={() => {
          // Keep reset modal open briefly to show success
        }}
      />
    </div>
  );
};
