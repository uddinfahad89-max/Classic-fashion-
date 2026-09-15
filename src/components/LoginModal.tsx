import React, { useState, useEffect } from 'react';
import {
  Mail,
  User,
  CheckCircle2,
  LogOut,
  Shield,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Briefcase,
  AlertCircle,
  Smartphone,
  RefreshCw,
  Send,
  MessageSquare,
  BadgeCheck,
  Key,
} from 'lucide-react';
import { UserProfile, Language } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onLogin: (
    email: string,
    name?: string,
    pin?: string,
    role?: 'Owner' | 'Manager' | 'Cashier',
    phone?: string,
    isAppLockEnabled?: boolean,
    loginMethod?: 'email_pin' | 'otp'
  ) => void;
  onLogout: () => void;
  onUpdateSecurity?: (updates: Partial<UserProfile>) => void;
  onLockApp?: () => void;
  language?: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onLogin,
  onLogout,
  onUpdateSecurity,
  onLockApp,
  language = 'bn',
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'bn') return bn;
    return en;
  };

  // Mode: 'view' | 'edit_login' | 'change_pin'
  const [mode, setMode] = useState<'view' | 'edit_login' | 'change_pin'>(
    userProfile.isLoggedIn ? 'view' : 'edit_login'
  );

  // Login Method Tab: 'otp' | 'email_pin'
  const [loginMethodTab, setLoginMethodTab] = useState<'otp' | 'email_pin'>('otp');

  // Email/PIN Login Form States
  const [email, setEmail] = useState(userProfile.email || 'uddinfahad89@gmail.com');
  const [name, setName] = useState(userProfile.name || 'Fahad Uddin');
  const [phone, setPhone] = useState(userProfile.phone || '9707502246');
  const [role, setRole] = useState<'Owner' | 'Manager' | 'Cashier'>(userProfile.role || 'Owner');
  const [pin, setPin] = useState(userProfile.pin || '1234');
  const [showPin, setShowPin] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(userProfile.isAppLockEnabled ?? false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // OTP Login Specific States
  const [otpPhone, setOtpPhone] = useState(userProfile.phone || '9707502246');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Change PIN States
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  if (!isOpen) return null;

  // Handle Request OTP
  const handleSendOtp = () => {
    setOtpError(null);
    const cleanPhone = otpPhone.trim().replace(/[^\d+]/g, '');
    if (cleanPhone.length < 8) {
      setOtpError(
        t(
          'অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ৮-১০ ডিজিট)',
          'Please enter a valid mobile phone number',
          'कृपया सही मोबाइल नंबर दर्ज करें (कम से कम 8-10 अंक)'
        )
      );
      return;
    }

    setOtpSending(true);
    setTimeout(() => {
      // Generate realistic 6-digit OTP code
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(randomCode);
      setOtpStep('verify');
      setOtpSending(false);
      setOtpCountdown(60);
      setOtpSuccessMsg(
        t(
          `আপনার মোবাইল নম্বরে (${cleanPhone}) একটি ওটিপি কোড পাঠানো হয়েছে!`,
          `A 6-digit OTP verification code has been sent to ${cleanPhone}!`,
          `आपके मोबाइल नंबर (${cleanPhone}) पर एक ओटीपी कोड भेजा गया है!`
        )
      );
    }, 600);
  };

  // Auto-fill OTP
  const handleAutoFillOtp = () => {
    if (generatedOtp) {
      setOtpCode(generatedOtp);
      setOtpError(null);
    }
  };

  // Handle Verify OTP and Login
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanInputOtp = otpCode.trim();
    if (!cleanInputOtp || cleanInputOtp.length < 4) {
      setOtpError(
        t(
          'অনুগ্রহ করে ওটিপি কোডটি সঠিকভাবে লিখুন',
          'Please enter the complete OTP code',
          'कृपया पूरा ओटीपी कोड दर्ज करें'
        )
      );
      return;
    }

    // Check OTP against generated OTP or master demo code '123456'
    if (cleanInputOtp === generatedOtp || cleanInputOtp === '123456') {
      const cleanPhone = otpPhone.trim();
      const inferredEmail =
        userProfile.email && userProfile.email.includes('@')
          ? userProfile.email
          : `${cleanPhone.replace(/[^\d]/g, '')}@posstore.com`;

      const inferredName =
        name.trim() ||
        (cleanPhone.includes('9707502246') ? 'Fahad Uddin' : userProfile.name || 'Store Owner');

      onLogin(
        inferredEmail,
        inferredName,
        userProfile.pin || '1234',
        role,
        cleanPhone,
        appLockEnabled,
        'otp'
      );

      setMode('view');
      onClose();
    } else {
      setOtpError(
        t(
          'ওটিপি কোডটি মেলেনি! অনুগ্রহ করে সঠিক কোড দিন অথবা অটো-ফিল চাপুন।',
          'Invalid OTP code! Please enter the correct code or click Auto-Fill.',
          'अमान्य ओटीपी कोड! कृपया सही कोड दर्ज करें या ऑटो-फिल दबाएं।'
        )
      );
    }
  };

  // Handle Email & PIN Login submission
  const handleSubmitEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError(
        t('সঠিক ইমেল ঠিকানা লিখুন', 'Please enter a valid email address', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    const cleanPin = pin.trim();
    if (cleanPin.length < 4) {
      setLoginError(
        t('কমপক্ষে ৪ ডিজিটের পিন আবশ্যক', '4-Digit PIN is required', 'कम से कम 4 अंकों का पिन आवश्यक है')
      );
      return;
    }

    onLogin(cleanEmail, name.trim(), cleanPin, role, phone.trim(), appLockEnabled, 'email_pin');
    setMode('view');
    onClose();
  };

  // Quick preset login
  const handleQuickSelectPreset = (
    quickEmail: string,
    quickName: string,
    quickRole: 'Owner' | 'Manager' | 'Cashier',
    quickPhone: string,
    quickPin: string
  ) => {
    setEmail(quickEmail);
    setName(quickName);
    setRole(quickRole);
    setPhone(quickPhone);
    setOtpPhone(quickPhone);
    setPin(quickPin);
    setLoginError(null);
    setOtpError(null);
  };

  // Handle PIN Change
  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeSuccess(false);

    if (userProfile.pin && currentPinInput.trim() !== userProfile.pin.trim()) {
      setPinChangeError(
        t('বর্তমান পিনটি সঠিক নয়', 'Current PIN is incorrect', 'वर्तमान पिन सही नहीं है')
      );
      return;
    }

    if (newPinInput.trim().length !== 4 || !/^\d{4}$/.test(newPinInput.trim())) {
      setPinChangeError(
        t('নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে', 'New PIN must be exactly 4 digits', 'नया पिन 4 अंकों का होना चाहिए')
      );
      return;
    }

    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeError(
        t('নতুন পিন ও কনফার্ম পিন মিলছে না', 'New PIN and Confirm PIN do not match', 'नया पिन और पुष्टि पिन मेल नहीं खा रहे हैं')
      );
      return;
    }

    if (onUpdateSecurity) {
      onUpdateSecurity({ pin: newPinInput.trim() });
    }
    setPin(newPinInput.trim());
    setPinChangeSuccess(true);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setTimeout(() => {
      setPinChangeSuccess(false);
      setMode('view');
    }, 1200);
  };

  // Toggle App Lock
  const handleToggleAppLock = () => {
    const nextVal = !userProfile.isAppLockEnabled;
    setAppLockEnabled(nextVal);
    if (onUpdateSecurity) {
      onUpdateSecurity({ isAppLockEnabled: nextVal });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  {mode === 'view' && userProfile.isLoggedIn
                    ? t('অ্যাকাউন্ট ও নিরাপত্তা', 'Account & Security', 'खाता व सुरक्षा')
                    : mode === 'change_pin'
                    ? t('পিন পরিবর্তন', 'Change Security PIN', 'सुरक्षा पिन बदलें')
                    : t('নিরাপদ লগইন', 'Secure Store Login', 'सुरक्षित दुकान लॉगिन')}
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.5 rounded-full font-bold">
                  {userProfile.otpVerified ? 'OTP Verified' : 'Verified'}
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                {mode === 'view' && userProfile.isLoggedIn
                  ? t(
                      'দোকানের হিসাব, ডেটা ও ওটিপি/পিন সুরক্ষা',
                      'Store accounts, data & PIN/OTP protection',
                      'दुकान का हिसाब, डेटा व ओटीपी/पिन सुरक्षा'
                    )
                  : t(
                      'মোবাইল ওটিপি অথবা ৪-ডিজিট পিন দিয়ে লগইন করুন',
                      'Login via Mobile OTP or 4-digit PIN',
                      'मोबाइल ओटीपी या 4-अंकों के पिन से लॉगिन करें'
                    )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* VIEW 1: LOGGED IN PROFILE & CONTROLS */}
          {mode === 'view' && userProfile.isLoggedIn ? (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200/80 shadow-2xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-sm">
                      {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{userProfile.name}</span>
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                          {userProfile.role || 'Owner'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 font-mono mt-0.5">{userProfile.email}</p>
                      {userProfile.phone && (
                        <p className="text-[11px] text-stone-600 flex items-center gap-1.5 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{userProfile.phone}</span>
                          {userProfile.otpVerified && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                              <BadgeCheck className="w-2.5 h-2.5 text-emerald-600" />
                              <span>OTP OK</span>
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('সক্রিয়', 'Active', 'सक्रिय')}</span>
                  </span>
                </div>

                {userProfile.loginTime && (
                  <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-[11px] text-stone-500">
                    <span>{t('লগইন মাধ্যম:', 'Login Method:', 'लॉगिन का तरीका:')}</span>
                    <span className="font-medium text-stone-700 flex items-center gap-1">
                      {userProfile.loginMethod === 'otp' ? (
                        <>
                          <Smartphone className="w-3 h-3 text-emerald-600" />
                          <span>{t('মোবাইল OTP ভেরিফাইড', 'Mobile OTP Verified', 'मोबाइल OTP सत्यापित')}</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3 h-3 text-blue-600" />
                          <span>{t('ইমেল ও পিন', 'Email & PIN', 'ईमेल व पिन')}</span>
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Security Shield & PIN Protection Section */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">
                        {t('৪-ডিজিট সিকিউরিটি পিন লক', '4-Digit PIN Security Lock', '4-अंकीय सुरक्षा पिन लॉक')}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        {userProfile.isAppLockEnabled
                          ? t('পিন লক সক্রিয় (সুরক্ষিত)', 'App is PIN Protected', 'पिन लॉक सक्रिय है')
                          : t('পিন লক নিষ্ক্রিয় রয়েছে', 'PIN Lock is currently Off', 'पिन लॉक बंद है')}
                      </p>
                    </div>
                  </div>

                  {/* Toggle App Lock */}
                  <button
                    type="button"
                    onClick={handleToggleAppLock}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      userProfile.isAppLockEnabled ? 'bg-blue-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        userProfile.isAppLockEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-stone-600">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {t('পিন কোড:', 'PIN Code:', 'पिन कोड:')}{' '}
                      <span className="font-mono font-bold tracking-widest text-stone-900">
                        ● ● ● ●
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('change_pin');
                      setPinChangeError(null);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    {t('পিন পরিবর্তন করুন', 'Change PIN', 'पिन बदलें')}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onLockApp) onLockApp();
                  }}
                  className="py-2.5 px-3 bg-stone-900 hover:bg-black active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('এখনই লক করুন', 'Lock App Now', 'अभी लॉक करें')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('edit_login');
                    setLoginError(null);
                    setOtpError(null);
                  }}
                  className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{t('লগইন পরিবর্তন / OTP', 'Switch / OTP Login', 'लॉगिन बदलें / OTP')}</span>
                </button>
              </div>

              {/* Logout Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setMode('edit_login');
                  }}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs border border-rose-200/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('লগআউট করুন (Logout)', 'Logout Account', 'लॉगआउट करें')}</span>
                </button>
              </div>
            </div>
          ) : mode === 'change_pin' ? (
            /* VIEW 2: CHANGE SECURITY PIN */
            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  {t(
                    'আপনার ব্যবসার হিসাব এবং ক্যাশ তথ্যের সুরক্ষার্থে একটি শক্তিশালী ৪ সংখ্যার পিন নির্ধারণ করুন।',
                    'Set a secure 4-digit numeric PIN to protect customer dues, daybook, and invoices.',
                    'अपनी दुकान के हिसाब और बहीखाते की सुरक्षा के लिए एक 4-अंकीय पिन सेट करें।'
                  )}
                </p>
              </div>

              {pinChangeError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinChangeError}</span>
                </div>
              )}

              {pinChangeSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('পিন সফলভাবে পরিবর্তন হয়েছে!', 'PIN changed successfully!', 'पिन सफलतापूर्वक बदल दिया गया है!')}</span>
                </div>
              )}

              {userProfile.pin && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('বর্তমান পিন (Current PIN) *', 'Current 4-Digit PIN *', 'वर्तमान पिन *')}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    required
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center tracking-[0.5em] font-mono font-bold text-base py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('নতুন ৪-ডিজিট পিন (New PIN) *', 'New 4-Digit PIN *', 'नया 4-अंकीय पिन *')}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.5em] font-mono font-bold text-base py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('নতুন পিন পুনরায় লিখুন (Confirm PIN) *', 'Confirm New PIN *', 'नए पिन की पुष्टि करें *')}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  required
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.5em] font-mono font-bold text-base py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="py-2.5 px-4 rounded-xl text-xs text-stone-600 hover:bg-stone-100 font-bold"
                >
                  {t('বাতিল', 'Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('পিন সংরক্ষণ করুন', 'Save PIN', 'पिन सहेजें')}</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW 3: LOGIN FORM WITH OTP AND EMAIL/PIN TABS */
            <div className="space-y-3.5">
              {/* Login Method Switcher Tabs */}
              <div className="p-1 bg-stone-100 rounded-2xl flex items-center gap-1 border border-stone-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethodTab('otp');
                    setOtpError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethodTab === 'otp'
                      ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t('মোবাইল ওটিপি (OTP)', 'Mobile OTP', 'मोबाइल ओटीपी (OTP)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethodTab('email_pin');
                    setLoginError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethodTab === 'email_pin'
                      ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t('ইমেল ও পিন', 'Email & PIN', 'ईमेल व पिन')}</span>
                </button>
              </div>

              {/* Quick Preset Banner */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl">
                <span className="text-[11px] font-bold text-blue-900 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('দ্রুত লগইন করুন (Quick Preset):', 'Quick Verified Login:', 'त्वरित लॉगिन:')}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSelectPreset(
                      'uddinfahad89@gmail.com',
                      'Fahad Uddin',
                      'Owner',
                      '9707502246',
                      '1234'
                    )
                  }
                  className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      F
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-blue-700">
                          Fahad Uddin
                        </span>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                          Owner
                        </span>
                      </div>
                      <span className="block text-[11px] font-mono text-stone-500">
                        9707502246 • uddinfahad89@gmail.com
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>{t('সিলেক্ট', 'Select', 'चुनें')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              </div>

              {/* ----------------- TAB A: MOBILE OTP LOGIN ----------------- */}
              {loginMethodTab === 'otp' ? (
                <div className="space-y-3.5">
                  {otpError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  {/* STEP 1: ENTER PHONE NUMBER */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('মোবাইল নম্বর (Phone Number for OTP) *', 'Mobile Number for OTP *', 'ओटीपी हेतु मोबाइल नंबर *')}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          required
                          value={otpPhone}
                          onChange={(e) => {
                            setOtpPhone(e.target.value);
                            setOtpStep('request');
                            setOtpCode('');
                            setGeneratedOtp(null);
                          }}
                          placeholder="9707502246"
                          className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSending || (otpStep === 'verify' && otpCountdown > 30)}
                        className="px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
                      >
                        {otpSending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {otpStep === 'verify'
                            ? t('পুনরায় পাঠান', 'Resend', 'पुनः भेजें')
                            : t('ওটিপি পাঠান', 'Send OTP', 'ओटीपी भेजें')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* SIMULATED OTP NOTIFICATION BANNER */}
                  {generatedOtp && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in zoom-in-95 duration-200 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-950 block">
                              {t('মোবাইলে ওটিপি কোড পৌঁছেছে:', 'OTP SMS Code Received:', 'मोबाइल पर प्राप्त ओटीपी कोड:')}
                            </span>
                            <p className="text-[11px] text-emerald-700">
                              {t(
                                'যাচাইয়ের জন্য নিচের কোডটি লিখুন বা অটো-ফিল বাটনে চাপুন',
                                'Enter code below or click Auto-fill to test immediately',
                                'नीचे कोड दर्ज करें या तुरंत ऑटो-फिल पर क्लिक करें'
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-black tracking-widest text-emerald-800 bg-white border border-emerald-300 px-2 py-0.5 rounded-lg shadow-2xs">
                          {generatedOtp}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={handleAutoFillOtp}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          {t('✓ ১-ক্লিকে কোড বসান (Auto-Fill)', '✓ Auto-Fill Code', '✓ ऑटो-फिल कोड')}
                        </button>
                        {otpCountdown > 0 && (
                          <span className="text-[11px] font-mono text-stone-500">
                            {otpCountdown}s
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: ENTER OTP CODE */}
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('৬-ডিজিট ওটিপি কোড (Enter 6-Digit OTP) *', 'Enter 6-Digit OTP Code *', '6-अंकीय ओटीपी दर्ज करें *')}</span>
                        </label>
                        <span className="text-[10px] text-stone-400">
                          {t('টেস্ট কোড: 123456 বা রিসিভড কোড', 'Test Code: 123456 or generated', 'टेस्ट कोड: 123456')}
                        </span>
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full text-center tracking-[0.5em] font-mono font-bold text-lg py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Role & Name Selection */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          {t('আপনার নাম', 'Your Name', 'आपका नाम')}
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Fahad Uddin"
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          {t('পদবী (Role)', 'Role', 'पद (Role)')}
                        </label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value as any)}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                        >
                          <option value="Owner">{t('মালিক (Owner)', 'Owner', 'मालिक (Owner)')}</option>
                          <option value="Manager">{t('ম্যানেজার (Manager)', 'Manager', 'मैनेजर')}</option>
                          <option value="Cashier">{t('ক্যাশিয়ার (Cashier)', 'Cashier', 'कैशियर')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {userProfile.isLoggedIn && (
                        <button
                          type="button"
                          onClick={() => setMode('view')}
                          className="py-2.5 px-3 rounded-xl text-xs text-stone-600 hover:bg-stone-100 font-bold"
                        >
                          {t('বাতিল', 'Cancel', 'रद्द करें')}
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                        <span>
                          {t(
                            'ওটিপি যাচাই ও লগইন করুন',
                            'Verify OTP & Login',
                            'ओटीपी सत्यापित करें व लॉगिन करें'
                          )}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* ----------------- TAB B: EMAIL & PIN LOGIN ----------------- */
                <form onSubmit={handleSubmitEmailLogin} className="space-y-3.5">
                  {loginError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('ইমেল ঠিকানা (Email Address) *', 'Email Address *', 'ईमेल पता *')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="uddinfahad89@gmail.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Full Name & Phone Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('আপনার নাম (Owner Name)', 'Full Name', 'आपका नाम')}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Fahad Uddin"
                          className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('মোবাইল নম্বর (Phone)', 'Mobile Phone', 'मोबाइल नंबर')}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="9707502246"
                          className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('ব্যবহারকারীর পদবী (Role)', 'Designation / Role', 'पद (Role)')}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Owner', 'Manager', 'Cashier'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                            role === r
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-600'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {r === 'Owner'
                            ? t('মালিক', 'Owner', 'मालिक')
                            : r === 'Manager'
                            ? t('ম্যানেজার', 'Manager', 'मैनेजर')
                            : t('ক্যাশিয়ার', 'Cashier', 'कैशियर')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4-Digit PIN with show/hide toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t('৪-ডিজিট সিকিউরিটি পিন (Security PIN) *', '4-Digit Security PIN *', '4-अंकीय सुरक्षा पिन *')}</span>
                      </label>
                      <span className="text-[10px] text-stone-400">
                        {t('ডিফল্ট: 1234', 'Default: 1234', 'डिफ़ॉल्ट: 1234')}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        inputMode="numeric"
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        className="w-full pl-3 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* App PIN Lock Checkbox */}
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 cursor-pointer hover:bg-stone-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={appLockEnabled}
                      onChange={(e) => setAppLockEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-stone-800 block">
                        {t('অ্যাপ পিন লক সক্রিয় রাখুন', 'Enable App PIN Lock Protection', 'ऐप पिन लॉक सुरक्षा चालू रखें')}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {t(
                          'অ্যাপ খোলার সময় বা লক করলে এই পিন চাওয়া হবে',
                          'Requires this 4-digit PIN when opening or unlocking app',
                          'ऐप खोलने या अनलॉक करते समय यह पिन मांगा जाएगा'
                        )}
                      </span>
                    </div>
                  </label>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {userProfile.isLoggedIn && (
                      <button
                        type="button"
                        onClick={() => setMode('view')}
                        className="py-3 px-4 rounded-xl text-xs text-stone-600 hover:bg-stone-100 font-bold"
                      >
                        {t('বাতিল', 'Cancel', 'रद्द करें')}
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>{t('নিরাপদ লগইন নিশ্চিত করুন', 'Confirm Secure Login', 'सुरक्षित लॉगिन की पुष्टि करें')}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
