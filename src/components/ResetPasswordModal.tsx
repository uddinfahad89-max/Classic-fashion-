import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Zap,
  X,
  LogIn,
} from 'lucide-react';
import { Language } from '../types';
import { firebaseService } from '../services/firebaseService';
import { storageService } from '../services/storageService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onSuccess?: (msg: string) => void;
  initialMode?: 'request_link' | 'update_password';
  prefilledEmail?: string;
  onSwitchToLogin?: (email?: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  onSuccess,
  initialMode = 'update_password',
  prefilledEmail = '',
  onSwitchToLogin,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  // 'direct' = Instant In-App Reset (Recommended)
  // 'email'  = Send link via email
  const [activeTab, setActiveTab] = useState<'direct' | 'email'>('direct');
  const [email, setEmail] = useState(prefilledEmail || 'uddinfahad89@gmail.com');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
    setIsDone(false);
  }, [prefilledEmail, isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // 1. Direct Instant Password Reset (Directly updates Firestore users collection & local profile)
  const handleDirectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(
        t('দয়া করে আপনার নিবন্ধিত ইমেল ঠিকানা লিখুন', 'Please enter your registered email address', 'कृपया अपना पंजीकृत ईमेल दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError(
        t('সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)', 'Please enter a valid email address', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError(t('নতুন পাসওয়ার্ড লিখুন', 'Please enter a new password', 'नया पासवर्ड दर्ज करें'));
      return;
    }

    if (cleanPass.length < 6) {
      setError(
        t('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError(
        t('পাসওয়ার্ড দুটি মেলেনি! একই পাসওয়ার্ড দিন।', 'Passwords do not match. Please re-enter.', 'पासवर्ड मेल नहीं खा रहे हैं।')
      );
      return;
    }

    setIsLoading(true);
    try {
      // Direct update to Firebase Firestore users collection & Firebase Auth
      const updated = await firebaseService.updateUserPassword(cleanEmail, cleanPass);

      // Also update local storage user profile if it matches this email
      try {
        const localProfile = storageService.getUserProfile();
        if (localProfile && localProfile.email && localProfile.email.toLowerCase() === cleanEmail) {
          storageService.updateUserSecurity({ pin: localProfile.pin || '1234' });
        }
      } catch {}

      if (updated) {
        const msg = t(
          'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! আপনি এখন নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারেন।',
          'Password has been reset successfully! You can now log in with your new password.',
          'पासवर्ड सफलतापूर्वक रीसेट हो गया है! अब आप नए पासवर्ड से लॉगिन कर सकते हैं।'
        );
        setSuccessMsg(msg);
        setIsDone(true);
        if (onSuccess) {
          onSuccess(msg);
        }
      } else {
        setError(
          t('পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে। দয়া করে ইন্টারনেট সংযোগ পরীক্ষা করুন।', 'Failed to update password. Please check your internet connection.', 'पासवर्ड अपडेट करने में त्रुटि।')
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating password in Firebase');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Email Reset Link
  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(
        t('দয়া করে আপনার নিবন্ধিত ইমেল ঠিকানা লিখুন', 'Please enter your registered email address', 'कृपया अपना पंजीकृत ईमेल दर्ज करें')
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError(
        t('সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)', 'Please enter a valid email address', 'कृपया सही ईमेल पता दर्ज करें')
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await firebaseService.sendPasswordResetLink(cleanEmail);

      if (res.success) {
        const msg = t(
          'পাসওয়ার্ড রিসেট লিংক আপনার ইমেলে পাঠানো হয়েছে! অনুগ্রহ করে ইনবক্স ও Spam/Junk ফোল্ডার চেক করুন। (ইমেল না পেলে পাশের "তাৎক্ষণিক রিসেট" দিয়ে সরাসরি পরিবর্তন করুন)',
          'Password reset link has been sent to your email! Please check your inbox and spam/junk folder. (If delayed, use Instant Reset to change directly)',
          'पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया है! इनबॉक्स और स्पैम फ़ोल्डर देखें।'
        );
        setSuccessMsg(msg);
        if (onSuccess) onSuccess(msg);
      } else {
        if (res.error === 'auth/user-not-found') {
          setError(
            t(
              'এই ইমেলটি ফায়ারবেস Auth-এ পাওয়া যায়নি। চিন্তা নেই! উপরে "তাৎক্ষণিক রিসেট (Instant Reset)" ট্যাব দিয়ে কোনো ইমেলের ঝামেলা ছাড়াই সরাসরি নতুন পাসওয়ার্ড সেট করুন।',
              'Email was not registered in Firebase Auth. Don’t worry! Switch to the "Instant Reset" tab above to set a new password directly.',
              'यह ईमेल नहीं मिला। कृपया ऊपर "त्वरित रीसेट" टैब से सीधे नया पासवर्ड सेट करें।'
            )
          );
        } else {
          setError(
            t(
              `ইমেল পাঠাতে সমস্যা হয়েছে: ${res.error || 'Network error'}। আপনি উপরে "তাৎক্ষণিক রিসেট" ট্যাব দিয়ে সরাসরি পাসওয়ার্ড সেট করতে পারেন।`,
              `Could not send email: ${res.error} - You can use the "Instant Reset" tab to reset immediately without email.`,
              'ईमेल नहीं भेजा जा सका। कृपया त्वरित रीसेट टैब का उपयोग करें।'
            )
          );
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error sending reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-4 text-white shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {t('পাসওয়ার্ড ভুলে গেছেন? (Reset Password)', 'Forgot Password / Reset', 'पासवर्ड भूल गए?')}
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {t('সরাসরি বা ইমেলের মাধ্যমে নতুন পাসওয়ার্ড সেট করুন', 'Reset password instantly or receive link via email', 'नया पासवर्ड सेट करें')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: [⚡ তাৎক্ষণিক রিসেট (Instant)] & [✉️ ইমেল লিংক (Email)] */}
        <div className="bg-stone-100 border-b border-stone-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('direct');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>{t('⚡ তাৎক্ষণিক রিসেট (সুপার ফাস্ট)', '⚡ Instant Reset (Direct)', '⚡ त्वरित रीसेट')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('email');
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{t('ইমেল লিংক', 'Email Link', 'ईमेल लिंक')}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMsg}</div>
            </div>
          )}

          {isDone ? (
            /* Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">
                  {t('পাসওয়ার্ড আপডেট সম্পন্ন!', 'Password Reset Complete!', 'पासवर्ड अपडेट सफल!')}
                </h3>
                <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                  {t(
                    'আপনার অ্যাকাউন্টের পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে। নতুন পাসওয়ার্ড দিয়ে এখনই লগইন করুন।',
                    'Your password has been changed. You can now log in using your new password.',
                    'आपका पासवर्ड बदल दिया गया है। अब नए पासवर्ड से लॉगिन करें।'
                  )}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onSwitchToLogin) onSwitchToLogin(email);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('এখনই লগইন করুন (Log In Now) ➜', 'Log In Now ➜', 'अभी लॉगिन करें ➜')}</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'direct' ? (
            /* TAB 1: Instant Direct Password Reset */
            <form onSubmit={handleDirectReset} className="space-y-3.5">
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 font-medium leading-relaxed">
                {t(
                  '💡 কোনো ইমেলের জন্য অপেক্ষা করার প্রয়োজন নেই! নিচে নিবন্ধিত ইমেল ও নতুন পাসওয়ার্ড লিখুন এবং সাথে সাথে পাসওয়ার্ড পরিবর্তন করুন।',
                  '💡 No need to wait for email! Enter your registered email and new password below to reset instantly.',
                  '💡 ईमेल का इंतज़ार करने की ज़रूरत नहीं! नीचे नया पासवर्ड दर्ज करके सीधे रीसेट करें।'
                )}
              </div>

              {/* Registered Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('নিবন্ধিত ইমেল (Registered Email) *', 'Registered Email *', 'पंजीकृत ईमेल *')}</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="uddinfahad89@gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('নতুন পাসওয়ার্ড (New Password - ৬+ অক্ষর) *', 'New Password (min 6 chars) *', 'नया पासवर्ड *')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showNewPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)', 'Enter new password', 'नया पासवर्ड दर्ज करें')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) *', 'Confirm Password *', 'पासवर्ड पुष्टि करें *')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showConfirmPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('পুনরায় একই পাসওয়ার্ড লিখুন', 'Re-enter password', 'पासवर्ड पुनः दर्ज करें')}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('পাসওয়ার্ড আপডেট হচ্ছে...', 'Updating Password...', 'अपडेट हो रहा है...')
                      : t('পাসওয়ার্ড পরিবর্তন করুন (Update Password)', 'Update Password Instantly', 'पासवर्ड अपडेट करें')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('লগইন পেজে ফিরে যান', 'Back to Login', 'लॉगिन पर वापस जाएं')}</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: Email Reset Link */
            <form onSubmit={handleSendEmailLink} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                {t(
                  'আপনার অ্যাকাউন্টের নিবন্ধিত ইমেল ঠিকানা লিখুন। ফায়ারবেস Auth-এর মাধ্যমে পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।',
                  'Enter your registered email. A password reset link will be sent via Firebase Auth.',
                  'अपना पंजीकृत ईमेल दर्ज करें। पासवर्ड रीसेट लिंक भेजा जाएगा।'
                )}
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('নিবন্ধিত ইমেল (Registered Email) *', 'Registered Email *', 'पंजीकृत ईमेल *')}</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="uddinfahad89@gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('লিংক পাঠানো হচ্ছে...', 'Sending Link...', 'लिंक भेजा जा रहा है...')
                      : t('রিসেট লিংক পাঠান (Send Reset Link)', 'Send Reset Link', 'रीसेट लिंक भेजें')}
                  </span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('direct');
                      setError(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {t(
                        'ইমেল পাচ্ছেন না? সরাসরি নতুন পাসওয়ার্ড সেট করুন ➜',
                        'Not getting email? Set password directly here ➜',
                        'ईमेल नहीं मिल रहा? सीधे पासवर्ड सेट करें ➜'
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
