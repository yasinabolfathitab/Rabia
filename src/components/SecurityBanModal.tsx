import React from 'react';
import { ShieldAlert, LogOut, PhoneCall } from 'lucide-react';
import { User } from '../types';

interface SecurityBanModalProps {
  user: User | null;
  reason?: string;
  onAcknowledge: () => void;
}

export const SecurityBanModal: React.FC<SecurityBanModalProps> = ({ user, reason, onAcknowledge }) => {
  if (!user || user.status !== 'banned') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#181311] border-2 border-rose-600/80 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(225,29,72,0.3)] text-center space-y-5">
        {/* Animated Warning Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-rose-950/70 border border-rose-500/50 flex items-center justify-center shadow-inner animate-pulse">
          <ShieldAlert className="w-11 h-11 text-rose-500" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 mb-2">
            🚨 هشدار امنیتی سیستم رابیا
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#FDFBF7]">
            حساب کاربری شما مسدود شد
          </h2>
          <p className="text-xs sm:text-sm text-[#D8C7B8] mt-2 leading-relaxed">
            سیستم امنیتی کافه رابیا تلاش غیرمجاز برای دستکاری داده‌ها، باز کردن ابزارهای Inspect یا جعل اعتبار کیف پول را شناسایی کرد.
          </p>
        </div>

        {/* Security Incident Details Box */}
        <div className="p-4 rounded-2xl bg-black/40 border border-rose-800/40 text-right space-y-2 text-xs">
          <div className="flex justify-between items-center text-[#C4B3A5]">
            <span>نام کاربری:</span>
            <strong className="text-[#FDFBF7]">{user.name}</strong>
          </div>
          <div className="flex justify-between items-center text-[#C4B3A5]">
            <span>شماره تماس:</span>
            <strong className="text-[#FDFBF7]" dir="ltr">{user.phone}</strong>
          </div>
          <div className="flex justify-between items-center text-[#C4B3A5]">
            <span>علت انسداد:</span>
            <span className="text-rose-400 font-bold text-[11px]">
              {user.banReason || reason || 'تلاش برای دستکاری و افزایش غیرمجاز اعتبار'}
            </span>
          </div>
          {user.securityAlert && (
            <div className="pt-2 border-t border-rose-900/30 text-[10px] text-rose-300/80">
              گزارش ثبت شده: {user.securityAlert}
            </div>
          )}
          <div className="text-[10px] text-[#8F7E73] text-left pt-1" dir="ltr">
            زمان ثبت تخلف: {user.bannedAt ? new Date(user.bannedAt).toLocaleString('en-US') : new Date().toLocaleString('en-US')}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#241D1A] border border-[#C87D55]/20 text-[11px] text-[#A8988C] flex items-center gap-2 justify-center">
          <PhoneCall className="w-4 h-4 text-[#C87D55] shrink-0" />
          <span>این گزارش به همراه شماره تماس در پنل مدیریت کافه ثبت گردید.</span>
        </div>

        <button
          onClick={onAcknowledge}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>خروج از حساب کاربری</span>
        </button>
      </div>
    </div>
  );
};
