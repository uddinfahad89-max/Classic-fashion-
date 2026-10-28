import React, { useState, useEffect } from 'react';
import {
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  LogIn,
  ShieldCheck,
  Send,
  Users,
} from 'lucide-react';
import { Language } from '../types';
import { firebaseService } from '../services/firebaseService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onSuccess?: (msg: string) => void;
  prefilledEmail?: string;
  initialMode?: 'request_link' | 'update_password';
  onSwitchToLogin?: (email?: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  onSuccess,
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

  const [email, setEmail] = useState(prefilledEmail || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    setEmail(prefilledEmail || '');
    setError(null);
    setSuccessMsg(null);
    setIsSent(false);
  }, [prefilledEmail, isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Secure Firebase Password Reset via standard sendPasswordResetEmail
  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(
        t(
          'দয়া করে আপনার নিবন্ধিত ইমেল ঠিকানা লিখুন',
          'Please enter your registered email address',
          'कृपया अपना पंजीकृत ईमेल दर्ज करें'
        )
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError(
        t(
          'সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)',
          'Please enter a valid email address',
          'कृपया सही ईमेल पता दर्ज करें'
        )
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await firebaseService.sendPasswordResetLink(cleanEmail);

      if (res.success) {
        const msg = t(
          'পাসওয়ার্ড রিসেট লিংক আপনার ইমেলে পাঠানো হয়েছে! ইনবক্স অথবা স্প্যাম (Spam/Junk) ফোল্ডার চেক করুন।',
          'Reset email sent! Check your Inbox or Spam folder.',
          'पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया है! इनबॉक्स और स्पैम फ़ोल्डर देखें।'
        );
        setSuccessMsg(msg);
        setIsSent(true);
        if (onSuccess) onSuccess(msg);
      } else {
        if (res.error === 'auth/user-not-found') {
          setError(
            t(
              'এই ইমেল দিয়ে কোনো নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি। সঠিক ইমেল ঠিকানা লিখুন।',
              'No account found with this email. Please check your email address.',
              'इस ईमेल से कोई खाता नहीं मिला। कृपया सही ईमेल दर्ज करें।'
            )
          );
        } else if (res.error === 'auth/invalid-email') {
          setError(
            t(
              'ইমেল ঠিকানার ফরম্যাট সঠিক নয়।',
              'Invalid email address format.',
              'ईमेल पता अमान्य है।'
            )
          );
        } else {
          setError(
            t(
              `রিসেট ইমেল পাঠাতে সমস্যা হয়েছে: ${res.error || 'নেটওয়ার্ক সংযোগ পরীক্ষা করুন'}`,
              `Could not send reset email: ${res.error || 'Check network connection'}`,
              `ईमेल नहीं भेजा जा सका: ${res.error}`
            )
          );
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error sending password reset email');
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
                {t('পাসওয়ার্ড রিসেট (Firebase Auth)', 'Reset Password (Firebase Auth)', 'पासवर्ड रीसेट')}
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {t('নিরাপদ অফিসিয়াল ইমেল ভেরিফিকেশন লিংক', 'Secure official email verification link', 'सुरक्षित ईमेल सत्यापन लिंक')}
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

        {/* Security Notice Bar */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-2 text-xs text-blue-900 font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {t(
              'অ্যাকাউন্ট সুরক্ষার জন্য পাসওয়ার্ড রিসেট লিংক নিবন্ধিত ইমেলে পাঠানো হবে।',
              'For security, a password reset link will be sent to your registered email.',
              'सुरक्षा के लिए रीसेट लिंक आपके ईमेल पर भेजा जाएगा।'
            )}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMsg}</div>
            </div>
          )}

          {isSent ? (
            /* Email Sent Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-inner">
                <Mail className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-stone-900">
                  {t('রিসেট ইমেল পাঠানো সম্পন্ন!', 'Reset Email Sent Successfully!', 'रीसेट ईमेल भेजा गया!')}
                </h3>
                <p className="text-xs text-stone-600 max-w-xs mx-auto leading-relaxed">
                  {t(
                    `আমরা "${email}" ঠিকানায় একটি পাসওয়ার্ড রিসেট লিংক পাঠিয়েছি। অনুগ্রহ করে আপনার ইনবক্স অথবা Spam / Junk ফোল্ডার চেক করে লিংকে ক্লিক করুন।`,
                    `We sent a password reset link to "${email}". Please check your Inbox or Spam/Junk folder and click the link.`,
                    `हमने "${email}" पर लिंक भेजा है। कृपया अपना इनबॉक्स देखें।`
                  )}
                </p>
              </div>

              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onSwitchToLogin) onSwitchToLogin(email);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('লগইন পেজে ফিরে যান', 'Back to Login', 'लॉगिन पर वापस जाएँ')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSent(false)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  {t('অন্য ইমেল ঠিকানা দিয়ে চেষ্টা করুন', 'Try a different email', 'दूसरे ईमेल से प्रयास करें')}
                </button>
              </div>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSendEmailLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                  <span>{t('নিবন্ধিত ইমেল ঠিকানা (Email)', 'Registered Email Address', 'पंजीकृत ईमेल')}</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    {t('মালিকের অ্যাকাউন্ট', 'Owner Account', 'मालिक खाता')}
                  </span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Staff Guidance Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span>{t('স্টাফ / কর্মচারীদের জন্য:', 'For Staff Members:', 'स्टाफ सदस्यों के लिए:')}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {t(
                    'আপনি যদি দোকানের কর্মচারী হন এবং পাসওয়ার্ড ভুলে যান, তবে দোকানের মালিক (Store Owner) উনার "+ Add / Edit Staff" প্যানেল থেকে সরাসরি আপনার পাসওয়ার্ড রিসেট বা পরিবর্তন করে দিতে পারবেন।',
                    'If you are a staff member, your Store Owner can directly reset or update your password from the Staff Management panel.',
                    'यदि आप स्टाफ सदस्य हैं, तो स्टोर मालिक सीधे स्टाफ पैनल से आपका पासवर्ड रीसेट कर सकते हैं।'
                  )}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('লিংক পাঠানো হচ্ছে...', 'Sending reset email...', 'ईमेल भेजा जा रहा है...')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t('পাসওয়ার্ড রিসেট লিংক পাঠান', 'Send Password Reset Link', 'पासवर्ड रीसेट लिंक भेजें')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer Back Link */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSwitchToLogin) onSwitchToLogin(email);
              }}
              className="text-stone-600 hover:text-stone-900 font-semibold underline cursor-pointer"
            >
              {t('লগইনে ফিরে যান', 'Back to Login', 'लॉगिन पर वापस जाएँ')}
            </button>
            <span className="text-[10px] text-stone-500 font-mono">
              Firebase Auth Security
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
