import React, { useState, useEffect } from 'react';
import {
  Mail,
  User,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Store,
  History,
  UserPlus,
  LogIn,
  Globe,
  MapPin,
} from 'lucide-react';
import { UserProfile, Language, SavedAccountItem, ThermalPrinterSettings } from '../types';
import { storageService } from '../services/storageService';
import { ResetPasswordModal } from './ResetPasswordModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  settings?: ThermalPrinterSettings;
  onSaveSettings?: (settings: ThermalPrinterSettings) => void;
  onLogin: (
    email: string,
    name?: string,
    pin?: string,
    role?: 'Owner' | 'Manager' | 'Cashier',
    phone?: string,
    isAppLockEnabled?: boolean,
    loginMethod?: 'email_pin' | 'otp' | 'email_password' | 'app_pin',
    otpCode?: string,
    password?: string
  ) => boolean | void | Promise<boolean | void>;
  onRegister?: (data: {
    name: string;
    phone?: string;
    email: string;
    storeName?: string;
    password: string;
    role?: 'Owner' | 'Manager' | 'Cashier';
  }) => boolean | void | Promise<boolean | void>;
  onLogout: () => void;
  onUpdateSecurity?: (updates: Partial<UserProfile>) => void;
  onLockApp?: () => void;
  language?: Language;
  onSelectLanguage?: (lang: Language) => void;
  onOpenForgotPassword?: (email?: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  settings,
  onSaveSettings,
  onLogin,
  onRegister,
  onLogout,
  language = 'bn',
  onSelectLanguage,
  onOpenForgotPassword,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  // View state: 'view' (profile info) or 'auth' (login / signup form)
  const [mode, setMode] = useState<'view' | 'auth'>(
    userProfile.isLoggedIn ? 'view' : 'auth'
  );

  // Auth Action Tab: 'login' | 'signup'
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');

  // Log In Form
  const [loginEmail, setLoginEmail] = useState(userProfile.email || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Sign Up Form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupStoreName, setSignupStoreName] = useState(settings?.storeName || '');
  const [signupOwnerName, setSignupOwnerName] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Shop details edit states when logged in
  const [editStoreName, setEditStoreName] = useState(settings?.storeName || '');
  const [editStoreAddress, setEditStoreAddress] = useState(settings?.storeAddress || '');
  const [storeSaved, setStoreSaved] = useState(false);

  // Saved accounts
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(userProfile.isLoggedIn ? 'view' : 'auth');
      const accounts = storageService.getSavedAccounts();
      setSavedAccounts(accounts);
      if (settings) {
        setEditStoreName(settings.storeName || '');
        setEditStoreAddress(settings.storeAddress || '');
        setStoreSaved(false);
      }
      setLoginError(null);
      setSignupError(null);
    }
  }, [isOpen, userProfile.isLoggedIn, settings]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Handle Log In submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    if (!cleanEmail) {
      setLoginError(
        t('দয়া করে ইমেল ঠিকানা লিখুন', 'Please enter your email address', 'कृपया ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setLoginError(
        t('সঠিক ইমেল ঠিকানা লিখুন', 'Please enter a valid email address', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!cleanPassword) {
      setLoginError(
        t('দয়া করে পাসওয়ার্ড লিখুন', 'Please enter your password', 'कृपया पासवर्ड दर्ज करें')
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setLoginError(
        t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onLogin(
        cleanEmail,
        cleanEmail.split('@')[0],
        '1234',
        'Owner',
        '',
        false,
        'email_password',
        undefined,
        cleanPassword
      );

      if (result !== false) {
        setMode('view');
        onClose();
      } else {
        setLoginError(
          t('ইমেল বা পাসওয়ার্ড সঠিক নয়', 'Invalid email or password', 'ईमेल या पासवर्ड गलत है')
        );
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Up submission
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    const cleanEmail = signupEmail.trim().toLowerCase();
    const cleanPassword = signupPassword.trim();
    const cleanStore = signupStoreName.trim();
    const cleanName = signupOwnerName.trim();

    if (!cleanEmail) {
      setSignupError(
        t('দয়া করে ইমেল ঠিকানা লিখুন', 'Please enter your email address', 'कृपया ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setSignupError(
        t('সঠিক ইমেল ঠিকানা লিখুন', 'Please enter a valid email address', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    if (!cleanPassword) {
      setSignupError(
        t('দয়া করে পাসওয়ার্ড লিখুন', 'Please enter your password', 'कृपया पासवर्ड दर्ज करें')
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setSignupError(
        t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }

    if (onRegister) {
      setIsSubmitting(true);
      try {
        const ok = await onRegister({
          email: cleanEmail,
          password: cleanPassword,
          storeName: cleanStore || 'My Store',
          name: cleanName || cleanEmail.split('@')[0],
          role: 'Owner',
        });
        if (ok !== false) {
          setMode('view');
          onClose();
        }
      } catch (err: any) {
        setSignupError(err.message || 'Sign up failed');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Save updated store settings
  const handleSaveStoreInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !onSaveSettings) return;
    const updated: ThermalPrinterSettings = {
      ...settings,
      storeName: editStoreName.trim() || settings.storeName,
      storeAddress: editStoreAddress.trim(),
    };
    onSaveSettings(updated);
    storageService.saveSettings(updated);
    setStoreSaved(true);
    setTimeout(() => setStoreSaved(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                {mode === 'view' ? <User className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {mode === 'view'
                    ? t('প্রোফাইল ও অ্যাকাউন্ট', 'User Account Profile', 'प्रोफ़ाइल व खाता')
                    : t('ইউজার লগইন ও ক্লাউড সিঙ্ক', 'User Login & Cloud Sync', 'यूज़र लॉगिन')}
                </h2>
                <p className="text-xs text-blue-100 font-medium">
                  {userProfile.isLoggedIn
                    ? `${userProfile.email || userProfile.name} • ${userProfile.role || 'Owner'}`
                    : t('ইমেল ও পাসওয়ার্ড দিয়ে ডেটা সিঙ্ক করুন', 'Email & Password Authentication', 'ईमेल व पासवर्ड प्रमाणीकरण')}
                </p>
              </div>
            </div>

            {onSelectLanguage && (
              <div className="flex items-center gap-0.5 bg-white/15 border border-white/20 p-0.5 rounded-lg text-xs font-bold">
                <Globe className="w-3.5 h-3.5 text-blue-100 ml-1" />
                <button
                  type="button"
                  onClick={() => onSelectLanguage('bn')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    language === 'bn' ? 'bg-white text-blue-900' : 'text-white hover:bg-white/20'
                  }`}
                >
                  বাং
                </button>
                <button
                  type="button"
                  onClick={() => onSelectLanguage('en')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    language === 'en' ? 'bg-white text-blue-900' : 'text-white hover:bg-white/20'
                  }`}
                >
                  EN
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* ========================================================================= */}
          {/* VIEW MODE: LOGGED IN USER PROFILE */}
          {/* ========================================================================= */}
          {mode === 'view' ? (
            <div className="space-y-4">
              {/* Account Overview Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-black text-stone-900">{userProfile.name}</h3>
                    <p className="text-xs text-stone-600 font-mono font-medium flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>{userProfile.email || 'No email registered'}</span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">
                    {userProfile.role || 'Owner'}
                  </span>
                </div>

                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-xs text-stone-600 font-medium">
                  <span className="flex items-center gap-1 text-stone-700">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>{settings?.storeName || 'My Store'}</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Active Session</span>
                  </span>
                </div>
              </div>

              {/* Quick Edit Shop Details */}
              <form onSubmit={handleSaveStoreInfo} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('দোকানের নাম ও ঠিকানা', 'Shop Name & Address', 'दुकान का नाम व पता')}</span>
                  </span>
                  {storeSaved && (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('সংরক্ষিত!', 'Saved!', 'सहेजा गया!')}</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    placeholder="Shop Name"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={editStoreAddress}
                      onChange={(e) => setEditStoreAddress(e.target.value)}
                      placeholder="Shop Address"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs"
                  >
                    {t('সংরক্ষণ করুন', 'Save Details', 'सहेजें')}
                  </button>
                </div>
              </form>

              {/* Switch Account or Logout Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('auth');
                    setAuthTab('login');
                  }}
                  className="w-full py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t('অন্য অ্যাকাউন্টে লগইন করুন', 'Log In with Another Account', 'अन्य खाते में लॉगिन करें')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('লগআউট করুন (Log Out)', 'Log Out', 'लॉग आउट')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* AUTH MODE: LOGIN OR SIGN UP (EMAIL & PASSWORD ONLY) */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Clean Tab Switcher: [Log In] and [Sign Up] */}
              <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setLoginError(null);
                    setSignupError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t('লগইন (Log In)', 'Log In', 'लॉगिन')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('signup');
                    setLoginError(null);
                    setSignupError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authTab === 'signup'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('সাইন আপ (Sign Up)', 'Sign Up', 'साइन अप')}</span>
                </button>
              </div>

              {/* Saved accounts in device */}
              {authTab === 'login' && savedAccounts.length > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-950">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('সংরক্ষিত অ্যাকাউন্ট:', 'Saved Accounts:', 'सहेजे गए खाते:')}</span>
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
                          setLoginError(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-blue-100/60 border border-blue-200 text-left text-[11px] font-bold text-stone-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                      >
                        <Store className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate max-w-[120px]">{acc.storeName || acc.name}</span>
                        <span className="text-[10px] font-mono text-stone-500 truncate max-w-[90px]">
                          ({acc.email})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* LOG IN FORM */}
              {authTab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  {loginError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
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
                        if (loginError) setLoginError(null);
                      }}
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
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
                        if (loginError) setLoginError(null);
                      }}
                      placeholder={t('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড', 'Minimum 6 character password', 'कम से कम 6 अक्षरों का पासवर्ड')}
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                    <div className="flex justify-end pt-0.5">
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

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      <span>
                        {isSubmitting
                          ? t('লগইন হচ্ছে...', 'Logging in...', 'लॉगिन हो रहा है...')
                          : t('লগইন ও ডেটা রিস্টোর', 'Log In & Restore', 'लॉगिन करें')}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* SIGN UP FORM */}
              {authTab === 'signup' && (
                <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                  {signupError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{signupError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
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
                        if (signupError) setSignupError(null);
                      }}
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
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
                        if (signupError) setSignupError(null);
                      }}
                      placeholder={t('কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড', 'Minimum 6 character password', 'कम से कम 6 अक्षरों का पासवर्ड')}
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('দোকানের নাম (Shop Name - Optional)', 'Shop Name (Optional)', 'दुकान का नाम')}</span>
                    </label>
                    <input
                      type="text"
                      value={signupStoreName}
                      onChange={(e) => setSignupStoreName(e.target.value)}
                      placeholder="e.g. Classic Fashion"
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('মালিকের নাম (Owner Name - Optional)', 'Owner Name (Optional)', 'मालिक का नाम')}</span>
                    </label>
                    <input
                      type="text"
                      value={signupOwnerName}
                      onChange={(e) => setSignupOwnerName(e.target.value)}
                      placeholder="Store Owner"
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>
                        {isSubmitting
                          ? t('অ্যাকাউন্ট তৈরি হচ্ছে...', 'Creating Account...', 'खाता बनाया जा रहा है...')
                          : t('নতুন অ্যাকাউন্ট খুলুন (Sign Up)', 'Sign Up New Account', 'साइन अप करें')}
                      </span>
                    </button>
                  </div>
                </form>
              )}
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
          // Keep reset modal open briefly to show success, user can then return to login
        }}
      />
    </div>
  );
};
