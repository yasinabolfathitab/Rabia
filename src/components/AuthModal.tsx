import React, { useState } from 'react';
import { X, UserPlus, LogIn, CheckCircle2, AlertCircle, Phone, Lock, User as UserIcon, MapPin, Heart } from 'lucide-react';
import { registerUser, loginUser } from '../lib/database';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

const toEnglishDigits = (value: string): string => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = value;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }
  return res.replace(/[^0-9]/g, '');
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Feedback states
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredPendingMessage, setRegisteredPendingMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanLoginPhone = toEnglishDigits(loginPhone);
    if (!cleanLoginPhone || !loginPassword.trim()) {
      setErrorMessage('لطفاً شماره تلفن و رمز عبور خود را وارد نمایید.');
      return;
    }

    setIsSubmitting(true);
    const res = loginUser(cleanLoginPhone, loginPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName.trim()) {
      setErrorMessage('وارد کردن نام و نام خانوادگی الزامی است.');
      return;
    }

    const cleanPhone = toEnglishDigits(regPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('لطفاً یک شماره تلفن همراه معتبر 11 رقمی را فقط با اعداد انگلیسی وارد نمایید (مثال: 09121234567).');
      return;
    }

    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setErrorMessage('رمز عبور باید حداقل 4 کاراکتر باشد.');
      return;
    }

    setIsSubmitting(true);
    const res = registerUser({
      name: regName,
      phone: cleanPhone,
      password: regPassword,
      address: regAddress,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    // Show required approval notification
    setRegisteredPendingMessage(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#181311] border border-[#C87D55]/30 shadow-2xl p-4 sm:p-8 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="overflow-y-auto flex-1 pr-0.5 sm:pr-1 -mr-0.5 sm:-mr-1 pl-1">
        {registeredPendingMessage ? (
          /* Registration Success & Pending Admin Approval Screen */
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-[#FDFBF7]">
                اطلاعات شما با موفقیت ثبت شد
              </h3>
              <p className="text-xs sm:text-sm text-[#D8C7B8] leading-relaxed bg-[#221B17] p-4 rounded-2xl border border-[#C87D55]/30">
                درخواست شما برای مدیریت کافه رابیا ارسال گردید. <br />
                <strong className="text-[#E0946B] block mt-1">
                  بعد از تایید مدیریت، حساب کاربری شما فعال می‌شود.
                </strong>
                <span className="text-xs text-[#A8988C] block mt-2 flex items-center justify-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  از اینکه رابیا را انتخاب کردید متشکریم.
                </span>
              </p>
            </div>

            <div className="text-xs text-[#8C7B71]">
              پس از تایید توسط ادمین، با شماره تلفن <span className="text-[#FDFBF7] font-bold" dir="ltr">{regPhone}</span> و رمز عبور تعیین شده می‌توانید وارد شوید.
            </div>

            <button
              onClick={() => {
                setRegisteredPendingMessage(false);
                setActiveTab('login');
              }}
              className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md transition-all"
            >
              رفتن به صفحه ورود
            </button>
          </div>
        ) : (
          <div>
            {/* Header Tabs */}
            <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-[#201916] border border-[#C87D55]/20 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'login'
                    ? 'copper-gradient text-white shadow-md'
                    : 'text-[#A8988C] hover:text-[#FDFBF7]'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>ورود به حساب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'register'
                    ? 'copper-gradient text-white shadow-md'
                    : 'text-[#A8988C] hover:text-[#FDFBF7]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>ثبت‌نام جدید</span>
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1.5">
                    شماره تلفن همراه
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(toEnglishDigits(e.target.value).slice(0, 11))}
                      placeholder="09121234567"
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-[#FDFBF7] focus:outline-none text-left font-mono tracking-wider placeholder:text-neutral-500"
                    />
                    <Phone className="w-4 h-4 text-[#A8988C] absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1.5">
                    رمز عبور
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      dir="ltr"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-[#FDFBF7] focus:outline-none text-right"
                    />
                    <Lock className="w-4 h-4 text-[#A8988C] absolute left-3 top-3" />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#201A18] border border-[#C87D55]/15 text-[11px] text-[#A8988C]">
                  💡 <strong>نکته:</strong> ورود به حساب کاربری پس از تایید مدیریت کافه رابیا امکان‌پذیر خواهد بود.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#C87D55]/25 hover:shadow-[#C87D55]/40 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'در حال بررسی...' : 'ورود به حساب رابیا'}
                </button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">
                    نام و نام خانوادگی <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="مثلاً: علی احمدی"
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 pl-9 text-xs text-[#FDFBF7] focus:outline-none"
                    />
                    <UserIcon className="w-4 h-4 text-[#A8988C] absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">
                    شماره تلفن همراه <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={regPhone}
                      onChange={(e) => setRegPhone(toEnglishDigits(e.target.value).slice(0, 11))}
                      placeholder="09121234567"
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 pl-9 text-xs text-[#FDFBF7] focus:outline-none text-left font-mono tracking-wider placeholder:text-neutral-500"
                    />
                    <Phone className="w-4 h-4 text-[#A8988C] absolute left-2.5 top-2.5" />
                  </div>
                  <p className="text-[10px] text-[#A8988C] mt-1 text-right">
                    تنها اعداد انگلیسی مجاز است (مثال: 09121234567)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">
                    تعیین رمز عبور <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      dir="ltr"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="حداقل 4 کاراکتر"
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 pl-9 text-xs text-[#FDFBF7] focus:outline-none text-right"
                    />
                    <Lock className="w-4 h-4 text-[#A8988C] absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">
                    آدرس پیش‌فرض جهت سفارش بیرون‌بر (اختیاری)
                  </label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="تهران، خیابان، پلاک، زنگ..."
                      className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl p-2 text-xs text-[#FDFBF7] focus:outline-none leading-relaxed"
                    />
                  </div>
                  <span className="text-[10px] text-[#A8988C] mt-0.5 block">
                    این آدرس در سفارش‌های بیرون‌بر به صورت خودکار ثبت خواهد شد.
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#201A18] border border-[#C87D55]/20 text-[11px] text-[#D8C7B8] leading-relaxed">
                  ⚠️ ثبت‌نام شما بلافاصله در پنل مدیریت قرار می‌گیرد و پس از تایید مدیریت، حساب کاربری فعال خواهد شد.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#C87D55]/25 hover:shadow-[#C87D55]/40 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'در حال ثبت اطلاعات...' : 'ثبت‌نام و ارسال به مدیریت رابیا'}
                </button>
              </form>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
