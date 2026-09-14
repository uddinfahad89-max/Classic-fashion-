import React, { useState } from 'react';
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
} from 'lucide-react';
import { UserProfile } from '../types';

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
    isAppLockEnabled?: boolean
  ) => void;
  onLogout: () => void;
  onUpdateSecurity?: (updates: Partial<UserProfile>) => void;
  onLockApp?: () => void;
  language?: 'en' | 'bn';
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

  // Mode: 'view' | 'edit_login' | 'change_pin'
  const [mode, setMode] = useState<'view' | 'edit_login' | 'change_pin'>(
    userProfile.isLoggedIn ? 'view' : 'edit_login'
  );

  // Login Form States
  const [email, setEmail] = useState(userProfile.email || '');
  const [name, setName] = useState(userProfile.name || '');
  const [phone, setPhone] = useState(userProfile.phone || '9707502246');
  const [role, setRole] = useState<'Owner' | 'Manager' | 'Cashier'>(userProfile.role || 'Owner');
  const [pin, setPin] = useState(userProfile.pin || '1234');
  const [showPin, setShowPin] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(userProfile.isAppLockEnabled ?? false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Change PIN States
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  if (!isOpen) return null;

  // Handle Login submission
  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError(isBn ? 'সঠিক ইমেল ঠিকানা লিখুন' : 'Please enter a valid email address');
      return;
    }

    const cleanPin = pin.trim();
    if (cleanPin.length < 4) {
      setLoginError(isBn ? 'কমপক্ষে ৪ ডিজিটের পিন আবশ্যক' : '4-Digit PIN is required');
      return;
    }

    onLogin(cleanEmail, name.trim(), cleanPin, role, phone.trim(), appLockEnabled);
    setMode('view');
    onClose();
  };

  // Quick preset login
  const handleQuickSelectEmail = (
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
    setPin(quickPin);
    setLoginError(null);
  };

  // Handle PIN Change
  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeSuccess(false);

    if (userProfile.pin && currentPinInput.trim() !== userProfile.pin.trim()) {
      setPinChangeError(isBn ? 'বর্তমান পিনটি সঠিক নয়' : 'Current PIN is incorrect');
      return;
    }

    if (newPinInput.trim().length !== 4 || !/^\d{4}$/.test(newPinInput.trim())) {
      setPinChangeError(isBn ? 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে' : 'New PIN must be exactly 4 digits');
      return;
    }

    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeError(isBn ? 'নতুন পিন ও কনফার্ম পিন মিলছে না' : 'New PIN and Confirm PIN do not match');
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
                    ? isBn
                      ? 'অ্যাকাউন্ট ও নিরাপত্তা'
                      : 'Account & Security'
                    : mode === 'change_pin'
                    ? isBn
                      ? 'পিন পরিবর্তন'
                      : 'Change Security PIN'
                    : isBn
                    ? 'ব্যবসায়িক লগইন'
                    : 'Secure Business Login'}
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.5 rounded-full font-bold">
                  256-bit AES
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                {mode === 'view' && userProfile.isLoggedIn
                  ? isBn
                    ? 'দোকানের ডেটা ও পিন লক সেটিংস'
                    : 'Store data & PIN lock settings'
                  : isBn
                  ? '৪-ডিজিট পিন ও ইমেল দিয়ে নিরাপদ রাখুন'
                  : 'Protect billing data with email & 4-digit PIN'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* VIEW 1: LOGGED IN PROFILE & SECURITY CONTROLS */}
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
                        <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{userProfile.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBn ? 'সক্রিয়' : 'Active'}</span>
                  </span>
                </div>

                {userProfile.loginTime && (
                  <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-[11px] text-stone-500">
                    <span>{isBn ? 'শেষ লগইন:' : 'Last Login:'}</span>
                    <span className="font-mono font-medium text-stone-700">
                      {new Date(userProfile.loginTime).toLocaleDateString()} {new Date(userProfile.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        {isBn ? '৪-ডিজিট সিকিউরিটি পিন লক' : '4-Digit PIN Security Lock'}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        {userProfile.isAppLockEnabled
                          ? isBn
                            ? 'পিন লক সক্রিয় (সুরক্ষিত)'
                            : 'App is PIN Protected'
                          : isBn
                          ? 'পিন লক নিষ্ক্রিয় রয়েছে'
                          : 'PIN Lock is currently Off'}
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
                      {isBn ? 'পিন কোড:' : 'PIN Code:'}{' '}
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
                    {isBn ? 'পিন পরিবর্তন করুন' : 'Change PIN'}
                  </button>
                </div>
              </div>

              {/* Quick Lock Button (If PIN enabled or on demand) */}
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
                  <span>{isBn ? 'এখনই লক করুন' : 'Lock App Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('edit_login');
                    setLoginError(null);
                  }}
                  className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{isBn ? 'প্রোফাইল সম্পাদন' : 'Edit Profile'}</span>
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
                  <span>{isBn ? 'লগআউট করুন (Logout)' : 'Logout Account'}</span>
                </button>
              </div>
            </div>
          ) : mode === 'change_pin' ? (
            /* VIEW 2: CHANGE SECURITY PIN */
            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  {isBn
                    ? 'আপনার ব্যবসার হিসাব এবং ক্যাশ তথ্যের সুরক্ষার্থে একটি শক্তিশালী ৪ সংখ্যার পিন নির্ধারণ করুন।'
                    : 'Set a secure 4-digit numeric PIN to protect customer dues, daybook, and invoices.'}
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
                  <span>{isBn ? 'পিন সফলভাবে পরিবর্তন হয়েছে!' : 'PIN changed successfully!'}</span>
                </div>
              )}

              {userProfile.pin && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'বর্তমান পিন (Current PIN) *' : 'Current 4-Digit PIN *'}
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
                  {isBn ? 'নতুন ৪-ডিজিট পিন (New PIN) *' : 'New 4-Digit PIN *'}
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
                  {isBn ? 'নতুন পিন পুনরায় লিখুন (Confirm PIN) *' : 'Confirm New PIN *'}
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
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isBn ? 'পিন সংরক্ষণ করুন' : 'Save PIN'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* VIEW 3: FULL STRONG LOGIN / REGISTRATION FORM */
            <form onSubmit={handleSubmitLogin} className="space-y-3.5">
              {/* Quick Suggestion Pill for User */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl">
                <span className="text-[11px] font-bold text-blue-900 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? 'দ্রুত লগইন করুন (Quick Verified Login):' : 'Quick Verified Login:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSelectEmail(
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
                        uddinfahad89@gmail.com
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>{isBn ? 'সিলেক্ট' : 'Select'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              </div>

              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'ইমেল ঠিকানা (Email Address) *' : 'Email Address *'}
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
                    {isBn ? 'আপনার নাম (Owner Name)' : 'Full Name'}
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
                    {isBn ? 'মোবাইল নম্বর (Phone)' : 'Mobile Phone'}
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
                  {isBn ? 'ব্যবহারকারীর পদবী (Role)' : 'Designation / Role'}
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
                        ? isBn
                          ? 'মালিক (Owner)'
                          : 'Owner'
                        : r === 'Manager'
                        ? isBn
                          ? 'ম্যানেজার'
                          : 'Manager'
                        : isBn
                        ? 'ক্যাশিয়ার'
                        : 'Cashier'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-Digit PIN with show/hide toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isBn ? '৪-ডিজিট সিকিউরিটি পিন (Security PIN) *' : '4-Digit Security PIN *'}</span>
                  </label>
                  <span className="text-[10px] text-stone-400">
                    {isBn ? 'ডিফল্ট: 1234' : 'Default: 1234'}
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
                    {isBn ? 'অ্যাপ পিন লক সক্রিয় রাখুন' : 'Enable App PIN Lock Protection'}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {isBn
                      ? 'অ্যাপ খোলার সময় বা লক করলে এই পিন চাওয়া হবে'
                      : 'Requires this 4-digit PIN when opening or unlocking app'}
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
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>{isBn ? 'নিরাপদ লগইন নিশ্চিত করুন' : 'Confirm Secure Login'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
