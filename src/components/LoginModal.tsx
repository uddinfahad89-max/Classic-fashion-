import React, { useState } from 'react';
import { Mail, User, CheckCircle, LogOut, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onLogin: (email: string, name?: string) => void;
  onLogout: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onLogin,
  onLogout,
}) => {
  const [email, setEmail] = useState(userProfile.email || '');
  const [name, setName] = useState(userProfile.name || '');
  const [isEditing, setIsEditing] = useState(!userProfile.isLoggedIn);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      alert('সঠিক ইমেল ঠিকানা লিখুন (Please enter a valid email address)');
      return;
    }
    onLogin(email.trim(), name.trim());
    setIsEditing(false);
    onClose();
  };

  const handleQuickSelectEmail = (selectedEmail: string, selectedName: string) => {
    setEmail(selectedEmail);
    setName(selectedName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-100 bg-gradient-to-r from-blue-50/80 via-white to-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {userProfile.isLoggedIn && !isEditing ? 'ইউজার প্রোফাইল (Account)' : 'ইমেল লগইন (Email Login)'}
              </h2>
              <p className="text-xs text-stone-500">
                {userProfile.isLoggedIn && !isEditing
                  ? 'বর্তমান লগইন করা অ্যাকাউন্ট'
                  : 'আপনার ইমেল দিয়ে সহজে লগইন করুন'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {userProfile.isLoggedIn && !isEditing ? (
            /* Logged In View */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-xs">
                    {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-stone-900">{userProfile.name}</span>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 font-mono mt-0.5">{userProfile.email}</p>
                    {userProfile.loginTime && (
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        Logged in: {new Date(userProfile.loginTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs text-stone-600 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-stone-800">নিরাপদ হিসাব ও বিলিং:</span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    আপনার তৈরি সব ক্যাশ এন্ট্রি, কাস্টমার ডিউ (বাকি/পাওনাদার) এবং বিল হিস্ট্রি এই অ্যাকাউন্টে সংরক্ষিত রয়েছে।
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <User className="w-4 h-4 text-stone-600" />
                  <span>অন্য ইমেলে পরিবর্তন (Switch)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setIsEditing(true);
                  }}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>লগআউট (Logout)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Login / Switch Email Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quick Suggestion Pill for User */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
                <span className="text-[11px] font-bold text-blue-800 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>দ্রুত লগইন করুন (Quick Login):</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickSelectEmail('uddinfahad89@gmail.com', 'Fahad Uddin')}
                  className="w-full text-left p-2 rounded-xl bg-white hover:bg-blue-100/50 border border-blue-200 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      F
                    </span>
                    <div>
                      <span className="text-xs font-bold text-stone-900 group-hover:text-blue-700">
                        Fahad Uddin
                      </span>
                      <span className="block text-[11px] font-mono text-stone-500">
                        uddinfahad89@gmail.com
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    Select →
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ইমেল ঠিকানা (Email Address) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. uddinfahad89@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  আপনার নাম (Owner Name)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fahad Uddin"
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {userProfile.isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-2.5 px-4 rounded-xl text-xs text-stone-600 hover:bg-stone-100 font-medium"
                  >
                    বাতিল (Cancel)
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>লগইন নিশ্চিত করুন (Confirm Login)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
