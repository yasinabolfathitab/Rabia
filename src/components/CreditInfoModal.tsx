import React from 'react';
import { Wallet, X, CreditCard, Sparkles, CheckCircle2, Coffee, ArrowLeft } from 'lucide-react';

interface CreditInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const CreditInfoModal: React.FC<CreditInfoModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-[#181311] border border-[#C87D55]/30 shadow-2xl p-4 sm:p-7 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl copper-gradient mx-auto flex items-center justify-center text-white shadow-xl shadow-[#C87D55]/30">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-[#FDFBF7]">
            سیستم اعتبار حساب رابیا چیست؟
          </h3>
          <p className="text-xs text-[#A8988C]">
            باشگاه مشتریان ویژه کافه رابیا
          </p>
        </div>

        <div className="space-y-3 text-xs text-[#D8C7B8] leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-[#201A17] border border-[#C87D55]/20 flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#C87D55]/20 text-[#E0946B] flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <strong className="text-[#FDFBF7] block mb-0.5">کارت‌کشیدن در کافه</strong>
              <span>
                هر زمان که به صورت حضوری تشریف می‌آورید و هر مبلغی کارت می‌کشید، مدیریت کافه می‌تواند به همان مقدار یا بیشتر، حسابتان را شارژ کند.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#201A17] border border-[#C87D55]/20 flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#C87D55]/20 text-[#E0946B] flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <strong className="text-[#FDFBF7] block mb-0.5">نشستن آنی اعتبار در پروفایل</strong>
              <span>
                اعتبار شارژ شده در همان لحظه در پروفایل و صفحه کاربری شما نمایش داده می‌شود.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#201A17] border border-[#C87D55]/20 flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#C87D55]/20 text-[#E0946B] flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <strong className="text-[#FDFBF7] block mb-0.5">پرداخت بدون کارت و نقدی</strong>
              <span>
                از این پس می‌توانید هنگام ثبت سفارش در سایت یا حتی سفارش حضوری، با اعتبار رابیا بدون نیاز به کارت‌خوان پرداخت خود را تکمیل کنید.
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenAuth();
          }}
          className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
        >
          <span>عضویت در رابیا و فعال‌سازی حساب</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
