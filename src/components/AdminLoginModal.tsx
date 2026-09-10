import React, { useState } from 'react';
import { Lock, X, AlertCircle } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '12345678') {
      setPassword('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#181311] border border-[#C87D55]/30 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#241E1B] border border-[#C87D55]/30 text-[#E0946B] mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-[#FDFBF7]">ورود به پنل مدیریت رابیا</h3>
          <p className="text-xs text-[#A8988C]">
            دسترسی به این بخش نیازمند احراز هویت مدیریت کافه می‌باشد
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>رمز عبور مدیریت اشتباه است.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#D8C7B8] block mb-1.5">
              رمز عبور امنیتی
            </label>
            <input
              type="password"
              dir="ltr"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="••••••••"
              className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3.5 py-2.5 text-center text-sm text-[#FDFBF7] tracking-widest focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md shadow-[#C87D55]/20 hover:shadow-[#C87D55]/40 transition-all"
          >
            تایید و ورود به مدیریت
          </button>
        </form>
      </div>
    </div>
  );
};
