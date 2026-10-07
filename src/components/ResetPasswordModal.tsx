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
  X,
} from 'lucide-react';
import { Language } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabaseClient.js';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onSuccess?: (msg: string) => void;
  initialMode?: 'request_link' | 'update_password';
  prefilledEmail?: string;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  language = 'bn',
  onSuccess,
  initialMode = 'request_link',
  prefilledEmail = '',
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (isHi) return hi;
    if (isBn) return bn;
    return en;
  };

  const [mode, setMode] = useState<'request_link' | 'update_password'>(initialMode);
  const [email, setEmail] = useState(prefilledEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setEmail(prefilledEmail);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
  }, [initialMode, prefilledEmail, isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Step 1: Request Password Reset Link
  const handleRequestLink = async (e: React.FormEvent) => {
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
      const res = await supabaseService.resetPasswordForEmail(cleanEmail);
      if (!res.success) {
        setError(res.error || t('পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে', 'Failed to send password reset link', 'पासवर्ड रीसेट लिंक भेजने में त्रुटि'));
      } else {
        const msg = t(
          'আপনার ইমেলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। দয়া করে ইনবক্স চেক করুন।',
          'Password reset link has been sent to your email. Please check your inbox.',
          'आपके ईमेल पर पासवर्ड रीसेट लिंक भेजा गया है। कृपया अपना इनबॉक्स देखें।'
        );
        setSuccessMsg(msg);
        if (onSuccess) {
          onSuccess(msg);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error sending reset email');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set New Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError(
        t('নতুন পাসওয়ার্ড লিখুন', 'Please enter a new password', 'नया पासवर्ड दर्ज करें')
      );
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
      const res = await supabaseService.updateUserPassword(cleanPass);
      if (!res.success) {
        setError(res.error || t('পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে', 'Failed to update password', 'पासवर्ड अपडेट करने में त्रुटि'));
      } else {
        const msg = t(
          'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! আপনি এখন নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারেন।',
          'Password has been updated successfully! You can now log in with your new password.',
          'पासवर्ड सफलतापूर्वक अपडेट कर दिया गया है! अब आप नए पासवर्ड से लॉगिन कर सकते हैं।'
        );
        setSuccessMsg(msg);
        if (onSuccess) {
          onSuccess(msg);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Error updating password');
    } finally {
      setIsLoading(false);
    }
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-4 text-white shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {mode === 'request_link'
                  ? t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot Password?', 'पासवर्ड भूल गए?')
                  : t('নতুন পাসওয়ার্ড সেট করুন', 'Set New Password', 'नया पासवर्ड सेट करें')}
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {mode === 'request_link'
                  ? t('ইমেলে পাসওয়ার্ড রিসেট লিংক পান', 'Receive password reset link via email', 'ईमेल पर रीसेट लिंक प्राप्त करें')
                  : t('আপনার অ্যাকাউন্টের জন্য নতুন পাসওয়ার্ড দিন', 'Create a new password for your account', 'अपने खाते के लिए नया पासवर्ड बनाएं')}
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

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMsg}</div>
            </div>
          )}

          {mode === 'request_link' ? (
            /* Mode 1: Request Password Reset Link */
            <form onSubmit={handleRequestLink} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                {t(
                  'আপনার অ্যাকাউন্টের নিবন্ধিত ইমেল ঠিকানা লিখুন। আমরা আপনাকে পাসওয়ার্ড রিসেট করার একটি নিরাপদ লিংক পাঠাব।',
                  'Enter your registered account email address. We will send you a secure link to reset your password.',
                  'अपना पंजीकृत ईमेल दर्ज करें। हम आपको पासवर्ड रीसेट करने के लिए एक सुरक्षित लिंक भेजेंगे।'
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
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="owner@example.com"
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
            /* Mode 2: Enter New Password & Confirm */
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                {t(
                  'আপনার অ্যাকাউন্টের জন্য নতুন একটি শক্তিশালী পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) লিখুন।',
                  'Enter a new secure password (minimum 6 characters) for your account.',
                  'अपने खाते के लिए नया सुरक्षित पासवर्ड (कम से कम 6 अक्षर) दर्ज करें।'
                )}
              </p>

              {/* New Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('নতুন পাসওয়ার্ড (New Password) *', 'New Password (min 6 chars) *', 'नया पासवर्ड *')}</span>
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
                  autoFocus
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t('নতুন ৬+ অক্ষরের পাসওয়ার্ড', 'Enter new password', 'नया पासवर्ड दर्ज करें')}
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? t('আপডেট হচ্ছে...', 'Updating...', 'अपडेट हो रहा है...')
                      : t('পাসওয়ার্ড আপডেট করুন', 'Update Password', 'पासवर्ड अपडेट करें')}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
