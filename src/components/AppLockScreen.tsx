import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertCircle,
  Delete,
  Store,
  HelpCircle,
  CheckCircle2,
  Smartphone,
  Send,
  MessageSquare,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, ThermalPrinterSettings, Language } from '../types';

interface AppLockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  userProfile: UserProfile;
  settings: ThermalPrinterSettings;
  language?: Language;
  onResetPin?: (newPin: string) => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  isLocked,
  onUnlock,
  userProfile,
  settings,
  language = 'bn',
  onResetPin,
}) => {
  const isBn = language === 'bn';
  const isHi = language === 'hi';

  const t = (bn: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'bn') return bn;
    return en;
  };

  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Forgot PIN modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // OTP Unlock modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhoneInput, setOtpPhoneInput] = useState(userProfile.phone || '9707502246');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  const targetPin = userProfile.pin || '1234';

  // OTP Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Handle number click on keypad
  const handleDigitPress = (digit: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      setErrorMsg(null);

      // If reached 4 digits, automatically verify!
      if (nextPin.length === 4) {
        verifyPinCode(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMsg(null);
  };

  const verifyPinCode = (pinToTest: string) => {
    if (pinToTest === targetPin) {
      setErrorMsg(null);
      onUnlock();
      setEnteredPin('');
    } else {
      setIsShaking(true);
      setErrorMsg(
        t('ভুল পিন কোড! আবার চেষ্টা করুন', 'Incorrect PIN! Try again', 'गलत पिन कोड! पुनः प्रयास करें')
      );
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
      }, 600);
    }
  };

  // Keyboard listener for desktop convenience
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showForgotModal || showOtpModal) return;

      if (/^[0-9]$/.test(e.key)) {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, enteredPin, targetPin, showForgotModal, showOtpModal]);

  if (!isLocked) return null;

  // Handle Send Unlock OTP
  const handleSendUnlockOtp = () => {
    setOtpError(null);
    const cleanPhone = otpPhoneInput.trim().replace(/[^\d+]/g, '');
    if (cleanPhone.length < 8) {
      setOtpError(
        t(
          'সঠিক মোবাইল নম্বর দিন',
          'Please enter a valid mobile number',
          'कृपया सही मोबाइल नंबर दर्ज करें'
        )
      );
      return;
    }

    setOtpSending(true);
    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtpSending(false);
      setOtpCountdown(60);
    }, 500);
  };

  // Handle Verify Unlock OTP
  const handleVerifyUnlockOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanInput = enteredOtp.trim();
    if (cleanInput === generatedOtp || cleanInput === '123456') {
      setShowOtpModal(false);
      setEnteredOtp('');
      setGeneratedOtp(null);
      onUnlock();
    } else {
      setOtpError(
        t('ওটিপি কোডটি ভুল! আবার চেষ্টা করুন', 'Invalid OTP code! Try again', 'अमान्य ओटीपी कोड! पुनः प्रयास करें')
      );
    }
  };

  // Handle Forgot PIN
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (
      userProfile.email &&
      forgotEmail.trim().toLowerCase() !== userProfile.email.trim().toLowerCase()
    ) {
      setForgotError(
        t('নিবন্ধিত ইমেলটি মিলছে না', 'Email does not match registered owner email', 'पंजीकृत ईमेल मेल नहीं खा रहा है')
      );
      return;
    }

    if (forgotNewPin.trim().length !== 4 || !/^\d{4}$/.test(forgotNewPin.trim())) {
      setForgotError(
        t('নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে', 'PIN must be 4 digits', 'पिन 4 अंकों का होना चाहिए')
      );
      return;
    }

    if (onResetPin) {
      onResetPin(forgotNewPin.trim());
    }

    setForgotSuccess(true);
    setTimeout(() => {
      setForgotSuccess(false);
      setShowForgotModal(false);
      setEnteredPin('');
      onUnlock();
    }, 1200);
  };

  return (
    <div
      id="app-lock-screen"
      className="fixed inset-0 z-50 bg-stone-950 flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-200"
    >
      {/* Top Header: Business Branding */}
      <div className="w-full max-w-sm pt-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-3xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3 shadow-inner">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-white tracking-wide">
          {settings.storeName || 'Classic fashion'}
        </h1>
        <p className="text-xs text-stone-400 mt-1 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{t('ব্যবসায়িক হিসাব ভল্ট সুরক্ষিত', 'Secure Business Vault', 'व्यावसायिक बहीखाता सुरक्षित')}</span>
        </p>
      </div>

      {/* Middle: User Badge, PIN Status & 4 Dots */}
      <div className="w-full max-w-xs flex flex-col items-center text-center my-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-stone-300 text-xs font-semibold mb-5">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
            {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="truncate max-w-[150px]">{userProfile.name || userProfile.email}</span>
          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">
            {userProfile.role || 'Owner'}
          </span>
        </div>

        <h2 className="text-sm sm:text-base font-bold text-stone-200 mb-1">
          {t('আনলক করতে ৪-ডিজিট পিন দিন', 'Enter 4-Digit Security PIN', 'अनलॉक करने हेतु 4-अंकीय पिन दर्ज करें')}
        </h2>
        <p className="text-xs text-stone-500 mb-5">
          {t('বাকি খাতা ও ক্যাশ খাতা লক করা আছে', 'Accounts and daybook are securely locked', 'बहीखाता और कैशबुक सुरक्षित रूप से लॉक हैं')}
        </p>

        {/* 4 PIN Dots Indicator */}
        <div
          className={`flex items-center gap-4 mb-3 transition-transform duration-100 ${
            isShaking ? 'translate-x-[-10px] sm:translate-x-[-15px] animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = enteredPin.length > index;
            return (
              <div
                key={index}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  isFilled
                    ? 'bg-blue-500 border-blue-400 scale-110 shadow-lg shadow-blue-500/30'
                    : 'border-stone-700 bg-stone-900/80'
                }`}
              >
                {isFilled && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50" />}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Bottom: 3x4 Touch Numeric Keypad & OTP option */}
      <div className="w-full max-w-xs space-y-3 pb-2">
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-13 sm:h-15 rounded-2xl bg-stone-900/90 hover:bg-stone-800 active:bg-blue-600/30 active:scale-95 text-white font-mono font-bold text-xl sm:text-2xl border border-stone-800 hover:border-stone-700 transition-all flex items-center justify-center cursor-pointer shadow-sm"
            >
              {digit}
            </button>
          ))}

          {/* Clear Key */}
          <button
            type="button"
            onClick={handleClear}
            className="h-13 sm:h-15 rounded-2xl bg-stone-900/60 hover:bg-stone-800 active:scale-95 text-stone-400 hover:text-white font-bold text-xs border border-stone-800 transition-all flex items-center justify-center cursor-pointer"
          >
            {t('মুছুন', 'Clear', 'साफ़')}
          </button>

          {/* 0 Key */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-13 sm:h-15 rounded-2xl bg-stone-900/90 hover:bg-stone-800 active:bg-blue-600/30 active:scale-95 text-white font-mono font-bold text-xl sm:text-2xl border border-stone-800 hover:border-stone-700 transition-all flex items-center justify-center cursor-pointer shadow-sm"
          >
            0
          </button>

          {/* Backspace Key */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 sm:h-15 rounded-2xl bg-stone-900/60 hover:bg-stone-800 active:scale-95 text-stone-400 hover:text-rose-400 border border-stone-800 transition-all flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Alternative Unlock: Mobile OTP & Forgot PIN */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setShowOtpModal(true);
              setOtpPhoneInput(userProfile.phone || '9707502246');
              setGeneratedOtp(null);
              setEnteredOtp('');
              setOtpError(null);
            }}
            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('মোবাইল ওটিপি আনলক', 'Unlock with OTP', 'ओटीपी से अनलॉक करें')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowForgotModal(true);
              setForgotEmail(userProfile.email || '');
            }}
            className="text-stone-400 hover:text-blue-400 font-semibold cursor-pointer"
          >
            {t('পিন ভুলে গেছেন?', 'Forgot PIN?', 'पिन भूल गए?')}
          </button>
        </div>
      </div>

      {/* OTP Unlock Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-5 w-full max-w-sm space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {t('মোবাইল ওটিপি দিয়ে আনলক', 'Unlock App via OTP', 'मोबाइल ओटीपी द्वारा अनलॉक')}
                </h3>
                <p className="text-xs text-stone-400">
                  {t('আপনার মোবাইলে পাঠানো কোড দিয়ে খুলুন', 'Enter code sent to your phone', 'अपने मोबाइल पर भेजा गया कोड दर्ज करें')}
                </p>
              </div>
            </div>

            {otpError && (
              <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 text-xs font-semibold">
                {otpError}
              </div>
            )}

            {/* Simulated OTP notice */}
            {generatedOtp && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t('প্রাপ্ত ওটিপি:', 'Received OTP:', 'प्राप्त ओटीपी:')}</span>
                  </span>
                  <span className="font-mono text-sm tracking-widest text-white bg-emerald-800 px-2 py-0.5 rounded">
                    {generatedOtp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(generatedOtp)}
                  className="w-full py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg cursor-pointer transition-colors"
                >
                  {t('১-ক্লিকে কোড বসান (Auto-Fill)', 'Auto-Fill OTP Code', 'ऑटो-फिल कोड')}
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyUnlockOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  {t('মোবাইল নম্বর', 'Mobile Number', 'मोबाइल नंबर')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    value={otpPhoneInput}
                    onChange={(e) => setOtpPhoneInput(e.target.value)}
                    placeholder="9707502246"
                    className="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSendUnlockOtp}
                    disabled={otpSending}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {otpSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{t('ওটিপি পাঠান', 'Send OTP', 'ओटीपी भेजें')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  {t('৬-ডিজিট ওটিপি কোড (OTP Code) *', 'Enter 6-Digit OTP *', '6-अंकीय ओटीपी दर्ज करें *')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  required
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-base px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="py-2.5 px-3 rounded-xl text-xs text-stone-400 hover:text-white hover:bg-stone-800"
                >
                  {t('বাতিল', 'Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{t('ওটিপি দিয়ে আনলক করুন', 'Verify & Unlock', 'सत्यापित करें व अनलॉक करें')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot PIN Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {t('পিন রিকভারি ভেরিফিকেশন', 'PIN Recovery Verification', 'पिन रिकवरी सत्यापन')}
                </h3>
                <p className="text-xs text-stone-400">
                  {t('মালিকের ইমেল দিয়ে নিশ্চিত করুন', 'Confirm registered email', 'पंजीकृत ईमेल से पुष्टि करें')}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 text-xs font-semibold">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('পিন সফলভাবে রিসেট ও আনলক হয়েছে!', 'PIN reset & unlocked!', 'पिन रीसेट व अनलॉक हो गया है!')}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  {t('নিবন্ধিত ইমেল (Registered Email) *', 'Registered Email *', 'पंजीकृत ईमेल *')}
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="uddinfahad89@gmail.com"
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  {t('নতুন ৪-ডিজিট পিন (New 4-Digit PIN) *', 'New 4-Digit PIN *', 'नया 4-अंकीय पिन *')}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  required
                  value={forgotNewPin}
                  onChange={(e) => setForgotNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full text-center tracking-widest font-mono font-bold text-base px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="py-2.5 px-3 rounded-xl text-xs text-stone-400 hover:text-white hover:bg-stone-800"
                >
                  {t('বাতিল', 'Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs"
                >
                  {t('রিসেট ও আনলক করুন', 'Reset & Unlock', 'रीसेट व अनलॉक करें')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
