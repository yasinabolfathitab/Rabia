import React from 'react';
import { Sparkles, Award, Wallet, Clock, ArrowDown } from 'lucide-react';

interface HeroBannerProps {
  onScrollToMenu: () => void;
  onOpenCreditInfo: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onScrollToMenu, onOpenCreditInfo }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#161311] via-[#1A1614] to-[#12100E] border-b border-[#C87D55]/20 py-12 sm:py-16">
      {/* Subtle luxury glow backgrounds */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C87D55]/10 rounded-full blur-3xl pointer-events-none -z-0"></div>
      <div className="absolute bottom-0 left-10 w-72 h-72 bg-[#D98A60]/10 rounded-full blur-3xl pointer-events-none -z-0"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main content */}
          <div className="lg:col-span-7 space-y-6 text-right">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#241E1B] border border-[#C87D55]/30 text-xs font-semibold text-[#E0946B]">
              <Sparkles className="w-3.5 h-3.5 text-[#E0946B]" />
              <span>تجربه‌ای متفاوت از قهوه تخصصی و پذیرایی لوکس</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-[#FDFBF7] leading-tight tracking-tight">
              طعم اصیل آرامش در <br />
              <span className="copper-gradient-text font-black">کافه رابیا (Rabia)</span>
            </h2>

            <p className="text-sm sm:text-base text-[#D4C4B7] leading-relaxed max-w-xl font-light">
              منوی دست‌چین شده از بهترین خاستگاه‌های قهوه جهان، نوشیدنی‌های بار سرد، 
              شیرینی‌های تازه و کراسان‌های فرانسوی در محیطی آرام با ترکیب معماری مسی و کرم.
            </p>

            {/* Features pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-[#1E1917]/80 border border-[#C87D55]/20 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C87D55]/15 text-[#E0946B] flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#FDFBF7]">عربیکا ۱۰۰٪ تخصصی</div>
                  <div className="text-[10px] text-[#A8988C]">برشته‌کاری تازه</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#1E1917]/80 border border-[#C87D55]/20 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C87D55]/15 text-[#E0946B] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#FDFBF7]">اعتبار هدیه رابیا</div>
                  <div className="text-[10px] text-[#A8988C]">با هر بار خرید</div>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-[#1E1917]/80 border border-[#C87D55]/20 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C87D55]/15 text-[#E0946B] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#FDFBF7]">سفارش سریع و لحظه‌ای</div>
                  <div className="text-[10px] text-[#A8988C]">سرو در سالن و بیرون‌بر</div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={onScrollToMenu}
                className="px-6 py-3 rounded-xl copper-gradient text-white font-bold text-sm shadow-lg shadow-[#C87D55]/25 hover:shadow-[#C87D55]/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <span>مشاهده منو و سفارش آنلاین</span>
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenCreditInfo}
                className="px-5 py-3 rounded-xl bg-[#241E1B] hover:bg-[#2C2420] border border-[#C87D55]/40 text-[#F5D3C1] font-semibold text-sm transition-all"
              >
                باشگاه مشتریان و اعتبار رابیا
              </button>
            </div>
          </div>

          {/* Luxury 3D Visual Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-sm perspective-1000 group">
              <div className="relative rounded-3xl overflow-hidden border border-[#C87D55]/30 bg-gradient-to-br from-[#241E1B] to-[#161311] shadow-2xl shadow-black/80 p-4 transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-1">
                <div className="relative h-64 rounded-2xl overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
                    alt="کافه رابیا"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#161311] via-transparent to-transparent"></div>
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#161311]/80 backdrop-blur-md border border-[#C87D55]/40 text-[11px] font-bold text-[#F5D3C1]">
                    امضای کافه رابیا
                  </div>
                  <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl overflow-hidden border border-[#C87D55]/50 bg-[#F6E3CE] p-0.5 shadow-xl shadow-black/60 group-hover:scale-110 transition-transform">
                    <img src="/Rabia_Logo.jpg" alt="لوگوی کافه رابیا" className="w-full h-full object-contain" />
                  </div>
                </div>

                <div className="mt-4 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#FDFBF7]">بسته پذیرایی VIP رابیا</h3>
                    <span className="text-xs font-bold text-[#E0946B]">طراحی اختصاصی</span>
                  </div>
                  <p className="text-xs text-[#A8988C] font-light leading-relaxed">
                    با عضویت در باشگاه مشتریان رابیا، از اعتبار هدیه کافه‌داری، تخفیف‌های فصلی و ثبت سریع سفارشات حضوری بهره‌مند شوید.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
