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
  KeyRound,
  Smartphone,
  Send,
  MessageSquare,
  Info,
  History,
} from 'lucide-react';
import { Language, SavedAccountItem } from '../types';
import { supabaseService, SUPABASE_SQL_SETUP_SCRIPT } from '../services/supabaseService';
import { otpService } from '../services/otpService';
import { storageService } from '../services/storageService';
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
    identifier: string,
    secret: string,
    method?: 'email_password' | 'otp' | 'app_pin'
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
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  // Top-level Mode: 'signup' | 'login' | 'sql_guide'
  const [activeTab, setActiveTab] = useState<'signup' | 'login' | 'sql_guide'>('signup');

  // Login & Data Restore Sub-Method: 'email_password' | 'otp' | 'app_pin'
  const [loginMethod, setLoginMethod] = useState<'email_password' | 'otp' | 'app_pin'>('email_password');

  // Sign up form state
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPin, setOwnerPin] = useState('1234');
  const [ownerName, setOwnerName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPin, setShowSignupPin] = useState(false);

  // 1. Email/Password Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // 2. Mobile OTP Login form state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);

  // 3. 4-Digit App PIN Login form state
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);

  // Saved accounts in local vault for quick restore
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountItem[]>([]);

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

  useEffect(() => {
    if (isOpen) {
      const accounts = storageService.getSavedAccounts();
      setSavedAccounts(accounts);
      if (accounts.length > 0) {
        if (!otpPhone && accounts[0].phone) setOtpPhone(accounts[0].phone);
        if (!pinIdentifier) setPinIdentifier(accounts[0].phone || accounts[0].email || accounts[0].identifier);
        if (!loginEmail && accounts[0].email) setLoginEmail(accounts[0].email);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Play Speech Alert
  const playVoiceAlert = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak =
        activeTab === 'login'
          ? 'Log in using your Email and 6-character Password, Mobile OTP, or your 4-Digit App PIN to restore your shop data.'
          : 'Welcome! Enter your shop name, mobile number, a 6-character account password, and your 4-digit App PIN to start.';
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
    if (!storePhone.trim() || storePhone.trim().replace(/[^\d+]/g, '').length < 8) {
      setError(
        t(
          'দয়া করে সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ৮-১০ ডিজিট)',
          'Please enter a valid mobile number (min 8-10 digits)',
          'कृपया सही मोबाइल नंबर दर्ज करें'
        )
      );
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError(t('দয়া করে সঠিক ইমেল অ্যাড্রেস লিখুন', 'Please enter a valid email address', 'कृपया वैध ईमेल दर्ज करें'));
      return;
    }

    // Strict minimum 6-character password rule so users don't confuse 4-digit PIN with account password
    const cleanPassword = ownerPassword.trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      const isFourDigitPinAttempt = cleanPassword.length === 4 && /^\d{4}$/.test(cleanPassword);
      setError(
        isFourDigitPinAttempt
          ? t(
              '⚠️ আপনি ৪-ডিজিটের পিন দিয়েছেন! অ্যাকাউন্ট পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে। ৪-ডিজিট অ্যাপ পিন এবং অ্যাকাউন্ট পাসওয়ার্ড আলাদা রাখুন।',
              '⚠️ You entered a 4-digit PIN! Your Account Password must be at least 6 characters so it is not confused with your 4-digit App PIN.',
              '⚠️ आपने 4-अंकीय पिन दर्ज किया है! खाता पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
            )
          : t(
              '⚠️ অ্যাকাউন্ট পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (৪-ডিজিট পিন এখানে দেবেন না)।',
              '⚠️ Account Password must be at least 6 characters (do not use your 4-digit PIN as your password).',
              '⚠️ पासवर्ड कम से कम 6 अक्षरों का होना चाहिए (यहाँ 4-अंकीय पिन न डालें)।'
            )
      );
      return;
    }

    const cleanPin = (ownerPin || '1234').trim();
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError(
        t(
          'অ্যাপ পিন অবশ্যই ৪ সংখ্যার হতে হবে (যেমন: 1234)',
          '4-Digit App PIN must be exactly 4 numeric digits (e.g. 1234)',
          'ऐप पिन ठीक 4 अंकों का होना चाहिए (जैसे: 1234)'
        )
      );
      return;
    }

    setIsLoading(true);

    try {
      // 1. Attempt Supabase Auth & Multi-User isolation if configured
      if (isSupabaseConfigured()) {
        const result = await supabaseService.signUp(ownerEmail.trim(), cleanPassword, {
          storeName: storeName.trim(),
          phone: storePhone.trim(),
          storeAddress: storeAddress.trim(),
          name: ownerName.trim() || storeName.trim(),
        });

        if (!result.success && result.error) {
          if (result.error.toLowerCase().includes('already registered')) {
            setError(
              t(
                'এই ইমেল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি আছে! অনুগ্রহ করে "লগইন ও রিস্টোর" ট্যাবে গিয়ে পাসওয়ার্ড, মোবাইল OTP অথবা ৪-ডিজিট পিন দিয়ে লগইন করুন।',
                'This email is already registered! Please switch to the "Login & Restore" tab to sign in via Email/Password, Mobile OTP, or 4-Digit PIN.',
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
        ownerPin: cleanPin,
        ownerName: ownerName.trim() || storeName.trim() || 'Store Owner',
        password: cleanPassword,
      });

      setSuccessMsg(t('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!', 'Account successfully created!', 'खाता सफलतापूर्वक बनाया गया!'));
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Send 4-Digit Mobile OTP
  const handleSendOtp = () => {
    setError(null);
    setSuccessMsg(null);
    const cleanPhone = otpPhone.trim().replace(/[^\d+]/g, '');
    if (cleanPhone.length < 8) {
      setError(
        t(
          'অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ৮-১০ ডিজিট)',
          'Please enter a valid mobile phone number (min 8-10 digits)',
          'कृपया सही मोबाइल नंबर दर्ज करें (कम से कम 8-10 अंक)'
        )
      );
      return;
    }

    setOtpSending(true);
    setTimeout(() => {
      const code = otpService.generateOtp(cleanPhone);
      setGeneratedOtp(code);
      setOtpStep('verify');
      setOtpSending(false);
      setOtpCountdown(60);
      setSuccessMsg(
        t(
          `আপনার মোবাইল নম্বরে (${cleanPhone}) ৪-ডিজিটের ওটিপি কোড পাঠানো হয়েছে!`,
          `A 4-digit OTP verification code has been sent to ${cleanPhone}!`,
          `आपके मोबाइल नंबर (${cleanPhone}) पर 4-अंकीय ओटीपी कोड भेजा गया है!`
        )
      );
    }, 300);
  };

  const handleAutoFillOtp = () => {
    if (generatedOtp) {
      setOtpCode(generatedOtp);
      setError(null);
    } else {
      const active = otpService.getOtp(otpPhone);
      if (active) {
        setOtpCode(active);
        setError(null);
      }
    }
  };

  // Handle Login & Cloud/Vault Data Restore across all 3 methods
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!onLoginExisting) return;

    // METHOD 1: EMAIL & PASSWORD
    if (loginMethod === 'email_password') {
      const cleanEmail = loginEmail.trim();
      if (!cleanEmail) {
        setError(t('দয়া করে আপনার নিবন্ধিত ইমেল লিখুন', 'Please enter your registered email', 'कृपया पंजीकृत ईमेल दर्ज करें'));
        return;
      }
      if (!loginPassword) {
        setError(t('দয়া করে আপনার অ্যাকাউন্ট পাসওয়ার্ড লিখুন', 'Please enter your account password', 'कृपया अपना खाता पासवर्ड दर्ज करें'));
        return;
      }

      if (loginPassword.trim().length < 6) {
        const isPin = loginPassword.trim().length === 4 && /^\d{4}$/.test(loginPassword.trim());
        setError(
          isPin
            ? t(
                '⚠️ আপনি ৪-ডিজিটের অ্যাপ পিন দিয়েছেন! ইমেল লগইনের জন্য কমপক্ষে ৬ অক্ষরের অ্যাকাউন্ট পাসওয়ার্ড দিন, অথবা উপরের "4-Digit App PIN" ট্যাবে গিয়ে পিন দিয়ে লগইন করুন।',
                '⚠️ You entered a 4-digit PIN! Account passwords are at least 6 characters. Please enter your 6+ character password or switch to the "4-Digit App PIN" tab above.',
                '⚠️ आपने 4-अंकीय पिन डाला है! कृपया कम से कम 6 अक्षरों का खाता पासवर्ड डालें या ऊपर "4-Digit App PIN" टैब चुनें।'
              )
            : t(
                '⚠️ অ্যাকাউন্ট পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে। ৪-ডিজিট পিন দিয়ে ঢুকতে "4-Digit App PIN" ট্যাব ব্যবহার করুন।',
                '⚠️ Account password must be at least 6 characters. To log in with your 4-digit PIN, select the "4-Digit App PIN" tab.',
                '⚠️ खाता पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
              )
        );
        return;
      }

      setIsLoading(true);
      try {
        const result = await onLoginExisting(cleanEmail, loginPassword, 'email_password');
        if (!result.success) {
          setError(
            result.error ||
              t(
                'লগইন ব্যর্থ হয়েছে! ইমেল ও পাসওয়ার্ড সঠিক কিনা পরীক্ষা করুন, অথবা "Mobile OTP" / "4-Digit App PIN" ব্যবহার করুন।',
                'Login failed! Please check your email and password, or try Mobile OTP / 4-Digit App PIN.',
                'लॉगिन विफल! कृपया ईमेल और पासवर्ड की जाँच करें।'
              )
          );
          setIsLoading(false);
          return;
        }
        setSuccessMsg(
          t(
            'লগইন সফল! আপনার দোকানের ডেটা রিস্টোর হচ্ছে...',
            'Login successful! Restoring your shop data...',
            'लॉगिन सफल! डेटा रिस्टोर हो रहा है...'
          )
        );
      } catch (err: any) {
        setError(err.message || 'Login failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // METHOD 2: MOBILE OTP
    if (loginMethod === 'otp') {
      const cleanPhone = otpPhone.trim();
      const cleanOtp = otpCode.trim();
      if (!cleanPhone || cleanPhone.replace(/[^\d+]/g, '').length < 8) {
        setError(
          t(
            'অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন',
            'Please enter a valid mobile number',
            'कृपया सही मोबाइल नंबर दर्ज करें'
          )
        );
        return;
      }
      if (!cleanOtp || cleanOtp.length !== 4) {
        setError(
          t(
            'অনুগ্রহ করে ৪-ডিজিটের ওটিপি কোডটি লিখুন (যেমন: 1234 বা SMS কোড)',
            'Please enter the 4-digit OTP code (e.g. 1234 or SMS code)',
            'कृपया 4-अंकीय ओटीपी कोड दर्ज करें'
          )
        );
        return;
      }

      setIsLoading(true);
      try {
        const result = await onLoginExisting(cleanPhone, cleanOtp, 'otp');
        if (!result.success) {
          setError(
            result.error ||
              t(
                'ওটিপি কোড সঠিক নয়! সঠিক ৪-ডিজিট কোড দিন অথবা অটো-ফিল চাপুন।',
                'Invalid OTP code! Please enter the correct 4-digit code or tap Auto-Fill.',
                'अमान्य ओटीपी कोड!'
              )
          );
          setIsLoading(false);
          return;
        }
        setSuccessMsg(
          t(
            'ওটিপি যাচাই সফল! আপনার দোকানের ডেটা রিস্টোর হচ্ছে...',
            'OTP Verified! Restoring your shop data...',
            'ओटीपी सत्यापित! डेटा रिस्टोर हो रहा है...'
          )
        );
      } catch (err: any) {
        setError(err.message || 'OTP Login failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // METHOD 3: 4-DIGIT APP PIN
    if (loginMethod === 'app_pin') {
      const cleanId = pinIdentifier.trim();
      const cleanPin = pinCode.trim();
      if (!cleanId) {
        setError(
          t(
            'অনুগ্রহ করে আপনার নিবন্ধিত মোবাইল নম্বর বা ইমেল লিখুন',
            'Please enter your registered mobile number or email',
            'कृपया अपना पंजीकृत मोबाइल नंबर या ईमेल दर्ज करें'
          )
        );
        return;
      }
      if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
        setError(
          t(
            'অনুগ্রহ করে ৪-সংখ্যার অ্যাপ পিন লিখুন (যেমন: 1234)। ৬+ অক্ষরের পাসওয়ার্ড দিয়ে ঢুকতে "Email / Password" ট্যাব ব্যবহার করুন।',
            'Please enter your 4-digit numeric App PIN (e.g. 1234). For 6+ character passwords, use the "Email / Password" tab.',
            'कृपया 4-अंकीय ऐप पिन दर्ज करें (जैसे: 1234)।'
          )
        );
        return;
      }

      setIsLoading(true);
      try {
        const result = await onLoginExisting(cleanId, cleanPin, 'app_pin');
        if (!result.success) {
          setError(
            result.error ||
              t(
                '৪-ডিজিট অ্যাপ পিন মেলেনি! সঠিক পিন দিন অথবা "Mobile OTP" দিয়ে লগইন করুন।',
                'Incorrect 4-Digit App PIN! Please check your PIN or use Mobile OTP.',
                '4-अंकीय ऐप पिन गलत है!'
              )
          );
          setIsLoading(false);
          return;
        }
        setSuccessMsg(
          t(
            'পিন লগইন সফল! আপনার দোকানের ডেটা রিস্টোর হচ্ছে...',
            'PIN Login successful! Restoring your shop data...',
            'पिन लॉगिन सफल! डेटा रिस्टोर हो रहा है...'
          )
        );
      } catch (err: any) {
        setError(err.message || 'PIN Login failed');
      } finally {
        setIsLoading(false);
      }
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

  // Live password helper flags
  const signupPassLen = ownerPassword.trim().length;
  const isSignupPassFourDigitPin = signupPassLen === 4 && /^\d{4}$/.test(ownerPassword.trim());
  const isLoginPassFourDigitPin = loginPassword.trim().length === 4 && /^\d{4}$/.test(loginPassword.trim());

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
                    Cloud & Vault
                  </span>
                </h2>
                <p className="text-xs text-blue-100 font-medium">
                  {t(
                    'নিরাপদ সাইন-আপ এবং ওটিপি / পিন / পাসওয়ার্ড ডেটা রিস্টোর',
                    'Secure Sign Up & Restore via Email, Mobile OTP, or 4-Digit PIN',
                    'सुरक्षित साइन-अप और ओटीपी / पिन / पासवर्ड डेटा रिस्टोर'
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
          <div className="mt-2.5 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-blue-50">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="text-[11px] truncate">
                {configured
                  ? t('ক্লাউড সিঙ্ক রেডি (RLS সুরক্ষিত)', 'Supabase Cloud Ready (RLS Secured)', 'क्लाउड सिंक तैयार (RLS सुरक्षित)')
                  : t('ক্লাউড ও লোকাল ভল্ট সিঙ্ক চালু', 'Cloud & Local Vault Sync Ready', 'क्लाउड व लोकल वॉल्ट सिंक चालू')}
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

        {/* Language Selection Bar & Navigation Tabs */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          {/* Main Action Tabs */}
          <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-xl text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
                setSuccessMsg(null);
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
                setSuccessMsg(null);
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('লগইন ও ডেটা রিস্টোর', 'Login & Data Restore', 'लॉगिन व डेटा रिस्टोर')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('sql_guide');
                setError(null);
                setSuccessMsg(null);
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

        {/* Form Body / Content Container */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {/* Alerts */}
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
          {/* TAB 1: NEW SHOP ONBOARDING & SIGNUP */}
          {/* ========================================================================= */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3">
              {/* Helpful Distinction Notice on Sign Up */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 text-xs text-blue-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {t(
                      'নতুন দোকান সেটআপ — পাসওয়ার্ড ও ৪-ডিজিট পিন নিয়ম:',
                      'New Shop Setup — Password vs 4-Digit PIN Rule:',
                      'नई दुकान सेटअप — पासवर्ड व 4-अंकीय पिन नियम:'
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-blue-900/90 leading-snug">
                  {t(
                    '• অ্যাকাউন্ট পাসওয়ার্ড অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে (ক্লাউড ব্যাকআপ ও ইমেল লগইনের জন্য)। আপনার ৪-ডিজিট অ্যাপ পিন এবং অ্যাকাউন্ট পাসওয়ার্ড এক করবেন না।',
                    '• Account Password must be at least 6 characters (for Email/Cloud restore). Do not confuse your 4-digit App PIN with your 6+ character Account Password.',
                    '• खाता पासवर्ड कम से कम 6 अक्षरों का होना चाहिए। अपने 4-अंकीय ऐप पिन को खाता पासवर्ड के साथ भ्रमित न करें।'
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
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold transition-all"
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
                    <span>{t('ইমেল অ্যাড্রেস (Email) *', 'Email Address *', 'ईमेल पता *')}</span>
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

              {/* 3. Account Password (Min 6 Chars) & 4-Digit App PIN Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Account Password (Min 6 Characters) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *', 'Account Password (Min 6) *', 'खाता पासवर्ड (कम से कम 6) *')}</span>
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
                    placeholder={t('কমপক্ষে ৬ অক্ষর (যেমন: shop123)', 'Min 6 chars (e.g. shop123)', 'कम से कम 6 अक्षर')}
                    className={`w-full px-3.5 py-2 text-sm bg-stone-50 border rounded-xl focus:outline-none focus:bg-white font-medium transition-all ${
                      signupPassLen > 0 && signupPassLen < 6
                        ? 'border-amber-500 bg-amber-50/40 focus:border-rose-500'
                        : signupPassLen >= 6
                        ? 'border-emerald-500 focus:border-emerald-600'
                        : 'border-stone-200 focus:border-blue-500'
                    }`}
                  />
                  {signupPassLen > 0 && signupPassLen < 6 ? (
                    <p className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg leading-tight">
                      {isSignupPassFourDigitPin
                        ? t(
                            '⚠️ এটি ৪-সংখ্যার পিন মনে হচ্ছে! পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন (৪-ডিজিট পিন ডানপাশের বক্সে দিন)।',
                            '⚠️ This looks like a 4-digit PIN! Password must be at least 6 characters.',
                            '⚠️ यह 4-अंकीय पिन लगता है! पासवर्ड कम से कम 6 अक्षरों का रखें।'
                          )
                        : t(
                            `আরও ${6 - signupPassLen}টি অক্ষর দিন (কমপক্ষে ৬ অক্ষর আবশ্যক)`,
                            `Enter ${6 - signupPassLen} more character(s) (Min 6 required)`,
                            `कम से कम 6 अक्षर आवश्यक हैं`
                          )}
                    </p>
                  ) : signupPassLen >= 6 ? (
                    <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('৬+ অক্ষরের বৈধ অ্যাকাউন্ট পাসওয়ার্ড', 'Valid 6+ character Account Password', 'वैध खाता पासवर्ड')}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-stone-500">
                      {t('ইমেল লগইন ও ক্লাউড রিস্টোরের জন্য (৬+ অক্ষর)', 'For Email Login & Cloud Restore (6+ chars)', 'ईमेल लॉगिन हेतु (6+ अक्षर)')}
                    </p>
                  )}
                </div>

                {/* 4-Digit App PIN */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t('৪-ডিজিট অ্যাপ পিন (App PIN) *', '4-Digit App PIN *', '4-अंकीय ऐप पिन *')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSignupPin(!showSignupPin)}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      {showSignupPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSignupPin ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <input
                    type={showSignupPin ? 'text' : 'password'}
                    required
                    maxLength={4}
                    inputMode="numeric"
                    value={ownerPin}
                    onChange={(e) => {
                      setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                      if (error) setError(null);
                    }}
                    placeholder="1234"
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white font-mono font-bold tracking-widest transition-all"
                  />
                  <p className="text-[10px] text-stone-500">
                    {t('প্রতিদিন দ্রুত পিন লগইন ও অ্যাপ লকের জন্য (যেমন: 1234)', 'For quick daily PIN login & App Lock (e.g. 1234)', 'त्वरित पिन लॉगिन व ऐप लॉक हेतु (जैसे: 1234)')}
                  </p>
                </div>
              </div>

              {/* 4. Owner Name & Shop Address Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-500" />
                    <span>{t('দোকানের ঠিকানা (ঐচ্ছিক)', 'Shop Address (Optional)', 'दुकान का पता')}</span>
                  </label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder={t('যেমন: নিউ মার্কেট', 'e.g., Shop #12, Market', 'उदा: मुख्य बाजार')}
                    className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                  />
                </div>
              </div>

              {/* Submit Action Button */}
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
                      : t('🚀 দোকান তৈরি করুন ও শুরু করুন', '🚀 Create Shop & Start POS', '🚀 दुकान बनाएं और शुरू करें')}
                  </span>
                </button>
              </div>

              {/* Switch to Login Link */}
              <div className="text-center pt-0.5">
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
                      'আগে থেকেই অ্যাকাউন্ট আছে? এখানে ক্লিক করে লগইন ও রিস্টোর করুন ➜',
                      'Already have an account? Click here to Login & Restore ➜',
                      'पहले से खाता है? यहाँ क्लिक करके लॉगिन करें ➜'
                    )}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: EXISTING USER LOGIN & DATA RESTORE (EMAIL/PASS, OTP, OR 4-DIGIT PIN) */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <div className="space-y-3.5">
              {/* Clear Helpful Message Explaining the Difference between 4-Digit PIN & Account Password */}
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                <div className="font-black text-amber-950 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {t(
                      '💡 ৪-ডিজিট অ্যাপ পিন বনাম অ্যাকাউন্ট পাসওয়ার্ড — পার্থক্য জানুন:',
                      '💡 4-Digit App PIN vs. Account Password — Helpful Guide:',
                      '💡 4-अंकीय ऐप पिन बनाम खाता पासवर्ड — अंतर जानें:'
                    )}
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-amber-900/95 leading-snug pl-1">
                  <li>
                    • <strong>{t('অ্যাকাউন্ট পাসওয়ার্ড (৬+ অক্ষর):', 'Account Password (6+ Chars):', 'खाता पासवर्ड (6+ अक्षर):')}</strong>{' '}
                    {t(
                      'সাইন-আপের সময় দেওয়া কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড শুধুমাত্র "Email / Password" ট্যাবে ব্যবহার করুন (এখানে ৪-সংখ্যার পিন দেবেন না)।',
                      'Use your 6+ character password in the "Email / Password" tab below (do not enter your 4-digit PIN as your password).',
                      'साइन-अप के समय बनाया गया कम से कम 6 अक्षरों का पासवर्ड "Email / Password" टैब में डालें।'
                    )}
                  </li>
                  <li>
                    • <strong>{t('৪-ডিজিট অ্যাপ পিন ও মোবাইল ওটিপি:', '4-Digit App PIN & Mobile OTP:', '4-अंकीय ऐप पिन व मोबाइल ओटीपी:')}</strong>{' '}
                    {t(
                      'শুধুমাত্র ৪ সংখ্যার পিন (যেমন 1234) দিয়ে ঢুকতে "4-Digit App PIN" ট্যাব অথবা সরাসরি ওটিপি কোড দিয়ে ঢুকতে "Mobile OTP" ট্যাবটি বেছে নিন।',
                      'To log in with your 4-digit numeric PIN (e.g. 1234) or phone verification code, select "4-Digit App PIN" or "Mobile OTP" below.',
                      '4-अंकीय पिन (जैसे 1234) या मोबाइल ओटीपी से लॉगिन करने के लिए नीचे संबंधित टैब चुनें।'
                    )}
                  </li>
                </ul>
              </div>

              {/* 3-Way Login Method Selector: Email/Password | Mobile OTP | 4-Digit App PIN */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-2xl border border-stone-200/90">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('email_password');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    loginMethod === 'email_password'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('ইমেল ও পাসওয়ার্ড', 'Email / Pass', 'ईमेल / पासवर्ड')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    loginMethod === 'otp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('মোবাইল OTP', 'Mobile OTP', 'मोबाइल OTP')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('app_pin');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    loginMethod === 'app_pin'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('৪-ডিজিট পিন', '4-Digit PIN', '4-अंकीय पिन')}</span>
                </button>
              </div>

              {/* Saved Accounts Quick Selector (if available on device) */}
              {savedAccounts.length > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-950">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('এই ডিভাইসে সংরক্ষিত অ্যাকাউন্ট:', 'Saved Accounts on Device:', 'सहेजे गए खाते:')}</span>
                    </span>
                    <span className="text-[10px] text-blue-700">{savedAccounts.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.identifier}
                        type="button"
                        onClick={() => {
                          if (acc.email) setLoginEmail(acc.email);
                          if (acc.phone) setOtpPhone(acc.phone);
                          setPinIdentifier(acc.phone || acc.email || acc.identifier);
                          setError(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-blue-100/60 border border-blue-200 text-left text-[11px] font-bold text-stone-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                      >
                        <Store className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate max-w-[130px]">{acc.storeName || acc.name}</span>
                        <span className="text-[10px] font-mono text-stone-500">
                          ({acc.phone || acc.email})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* SUB-TAB 1: EMAIL & PASSWORD */}
                {loginMethod === 'email_password' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t('নিবন্ধিত ইমেল (Registered Email) *', 'Registered Email *', 'पंजीकृत ईमेल *')}</span>
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

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            {t(
                              'অ্যাকাউন্ট পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *',
                              'Account Password (Min 6 Chars) *',
                              'खाता पासवर्ड (कम से कम 6 अक्षर) *'
                            )}
                          </span>
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
                        placeholder={t('আপনার ৬+ অক্ষরের পাসওয়ার্ড দিন', 'Enter your 6+ character password', 'अपना 6+ अक्षरों का पासवर्ड डालें')}
                        className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                      />

                      {/* Live helper if user accidentally types a 4-digit PIN here */}
                      {isLoginPassFourDigitPin && (
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 flex items-center justify-between gap-2">
                          <span>
                            {t(
                              '⚠️ এটি ৪-ডিজিটের অ্যাপ পিন মনে হচ্ছে! পিন দিয়ে লগইন করতে চান?',
                              '⚠️ This looks like a 4-digit PIN! Want to log in with your App PIN instead?',
                              '⚠️ यह 4-अंकीय पिन लग रहा है! क्या आप पिन से लॉगिन करना चाहते हैं?'
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPinIdentifier(loginEmail);
                              setPinCode(loginPassword.trim());
                              setLoginMethod('app_pin');
                              setError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                          >
                            {t('৪-ডিজিট পিন ট্যাবে যান ➜', 'Use 4-Digit PIN ➜', '4-अंकीय पिन चुनें ➜')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* SUB-TAB 2: MOBILE OTP */}
                {loginMethod === 'otp' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('মোবাইল নম্বর (Mobile Number for OTP) *', 'Mobile Number for OTP *', 'ओटीपी हेतु मोबाइल नंबर *')}</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          required
                          value={otpPhone}
                          onChange={(e) => {
                            setOtpPhone(e.target.value);
                            setOtpStep('request');
                            setOtpCode('');
                            setGeneratedOtp(null);
                            if (error) setError(null);
                          }}
                          placeholder={t('০১XXXXXXXXX / ৯৮XXXXXXXX', 'e.g. 01700000000', 'उदा: 9800000000')}
                          className="flex-1 px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white font-mono font-medium transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpSending || (otpStep === 'verify' && otpCountdown > 30)}
                          className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs transition-all"
                        >
                          {otpSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>
                            {otpStep === 'verify'
                              ? t('পুনরায় পাঠান', 'Resend', 'पुनः भेजें')
                              : t('ওটিপি পাঠান', 'Send OTP', 'ओटीपी भेजें')}
                          </span>
                        </button>
                      </div>
                    </div>

                    {generatedOtp && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-emerald-950">
                              {t('আপনার ৪-ডিজিট ওটিপি কোড:', 'Your 4-Digit OTP Code:', 'आपका 4-अंकीय ओटीपी कोड:')}
                            </span>
                          </div>
                          <span className="text-base font-mono font-black tracking-widest text-emerald-800 bg-white border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                            {generatedOtp}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={handleAutoFillOtp}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            {t('✓ ১-ক্লিকে কোড বসান (Auto-Fill)', '✓ Auto-Fill Code', '✓ ऑटो-फिल कोड')}
                          </button>
                          {otpCountdown > 0 && (
                            <span className="text-[11px] font-mono text-stone-500">{otpCountdown}s</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800">
                          {t('৪-ডিজিট ওটিপি কোড লিখুন (4-Digit OTP) *', 'Enter 4-Digit OTP Code *', '4-अंकीय ओटीपी कोड दर्ज करें *')}
                        </label>
                        <span className="text-[10px] text-stone-400">
                          {t('টেস্ট কোড: 1234 বা SMS কোড', 'Test Code: 1234 or SMS code', 'टेस्ट कोड: 1234')}
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={otpCode}
                        onChange={(e) => {
                          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                          if (error) setError(null);
                        }}
                        placeholder="••••"
                        className="w-full text-center tracking-[0.6em] font-mono font-bold text-lg py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                      />
                    </div>
                  </>
                )}

                {/* SUB-TAB 3: 4-DIGIT APP PIN */}
                {loginMethod === 'app_pin' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {t(
                            'নিবন্ধিত মোবাইল নম্বর অথবা ইমেল *',
                            'Registered Mobile Number or Email *',
                            'पंजीकृत मोबाइल नंबर या ईमेल *'
                          )}
                        </span>
                      </label>
                      <input
                        type="text"
                        required
                        value={pinIdentifier}
                        onChange={(e) => {
                          setPinIdentifier(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder={t('০১XXXXXXXXX অথবা owner@example.com', 'Mobile number or email address', 'मोबाइल नंबर या ईमेल')}
                        className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-600 focus:bg-white font-medium font-mono transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t('৪-ডিজিট অ্যাপ পিন (4-Digit App PIN) *', '4-Digit App PIN *', '4-अंकीय ऐप पिन *')}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400">
                            {t('ডিফল্ট পিন: 1234', 'Default PIN: 1234', 'डिफ़ॉल्ट पिन: 1234')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLoginPin(!showLoginPin)}
                            className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            {showLoginPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showLoginPin ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type={showLoginPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={pinCode}
                        onChange={(e) => {
                          setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                          if (error) setError(null);
                        }}
                        placeholder="1234"
                        className="w-full text-center tracking-[0.6em] font-mono font-bold text-lg py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                      />
                    </div>
                  </>
                )}

                {/* Submit Action Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] cursor-pointer transition-all disabled:opacity-50 ${
                      loginMethod === 'otp'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                        : loginMethod === 'app_pin'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20'
                        : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-blue-500/20'
                    }`}
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : loginMethod === 'otp' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : loginMethod === 'app_pin' ? (
                      <KeyRound className="w-4 h-4" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    <span>
                      {isLoading
                        ? t('লগইন ও ডেটা রিস্টোর হচ্ছে...', 'Logging in & Restoring Data...', 'लॉगिन और डेटा रिस्टोर हो रहा है...')
                        : loginMethod === 'otp'
                        ? t('📱 ওটিপি যাচাই ও ডেটা রিস্টোর করুন', '📱 Verify OTP & Restore Shop Data', '📱 ओटीपी सत्यापित करें व डेटा रिस्टोर करें')
                        : loginMethod === 'app_pin'
                        ? t('🔑 ৪-ডিজিট পিন দিয়ে লগইন ও রিস্টোর করুন', '🔑 Login with 4-Digit PIN & Restore Data', '🔑 4-अंकीय पिन से लॉगिन व डेटा रिस्टोर करें')
                        : t('☁️ ইমেল ও পাসওয়ার্ড দিয়ে লগইন ও রিস্টোর', '☁️ Login with Email/Password & Restore', '☁️ ईमेल व पासवर्ड से लॉगिन करें')}
                    </span>
                  </button>
                </div>

                {/* Switch to Signup Link */}
                <div className="text-center pt-0.5">
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
            </div>
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
