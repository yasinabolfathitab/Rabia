import React from 'react';
import { Coffee, MapPin, Phone, Clock, Instagram, Send, Heart, Sparkles } from 'lucide-react';

interface FooterProps {
  onOpenAdminLogin: () => void;
  onOpenCreditModal: () => void;
  onOpenTracking?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdminLogin, onOpenCreditModal, onOpenTracking }) => {
  return (
    <footer className="bg-[#0E0C0B] border-t border-[#C87D55]/20 pt-14 pb-8 text-[#D4C4B7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-[#C87D55]/15">
          {/* Col 1: Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#C87D55]/40 bg-[#F6E3CE] flex items-center justify-center p-0.5 shadow-md">
                <img src="/Rabia_Logo.jpg" alt="لوگوی کافه رابیا" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-xl font-black text-[#FDFBF7]">کافه رابیا (Rabia)</h3>
            </div>
            <p className="text-xs text-[#A8988C] font-light leading-relaxed">
              تجربه اصیل طعم قهوه تخصصی و پذیرایی با بالاترین استانداردهای کافه‌داری بین‌المللی در محیطی آرام و دلنشین.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-[#E0946B]">
              <Sparkles className="w-4 h-4" />
              <span>کیفیت، احترام و هنر دم‌آوری</span>
            </div>
          </div>

          {/* Col 2: Hours & Contact */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#FDFBF7] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C87D55]" />
              <span>ساعات کاری و پذیرایی</span>
            </h4>
            <div className="text-xs space-y-1.5 text-[#A8988C]">
              <p>شنبه تا پنج‌شنبه: ۸:۰۰ صبح الی ۲۴:۰۰</p>
              <p>جمعه‌ها و ایام تعطیل: ۹:۰۰ صبح الی ۲۴:۰۰</p>
              <p className="text-emerald-400 pt-1">سفارش بیرون‌بر و سالن فعال است</p>
            </div>
          </div>

          {/* Col 3: Address & Phone */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#FDFBF7] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C87D55]" />
              <span>آدرس و اطلاعات تماس</span>
            </h4>
            <div className="text-xs space-y-1.5 text-[#A8988C]">
              <p>تهران، خیابان ولیعصر، تقاطع فرشته، کافه رابیا</p>
              <p dir="ltr" className="text-right">تلفن پشتیبانی: ۰۲۱-۲۲۰۰۳۳۴۴</p>
              <button
                onClick={onOpenCreditModal}
                className="text-[#E0946B] hover:underline font-semibold block pt-1"
              >
                آشنایی با سیستم اعتبار حساب رابیا
              </button>
              {onOpenTracking && (
                <button
                  onClick={onOpenTracking}
                  className="text-[#F5D3C1] hover:text-white hover:underline font-bold block pt-1 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  پیگیری آنلاین وضعیت سفارش
                </button>
              )}
            </div>
          </div>

          {/* Col 4: Admin & Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#FDFBF7]">بخش مدیریت</h4>
            <p className="text-xs text-[#A8988C] font-light">
              سامانه پذیرش سفارشات لحظه‌ای باریستا، مدیریت منو و تایید مشتریان
            </p>
            <button
              onClick={onOpenAdminLogin}
              className="px-4 py-2 rounded-xl bg-[#1C1613] hover:bg-[#28201C] border border-[#C87D55]/30 hover:border-[#C87D55] text-xs font-bold text-[#FDFBF7] transition-all"
            >
              ورود به پنل مدیریت کافه
            </button>
          </div>
        </div>

        {/* Bottom copyright strictly honoring user's requirement */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A8988C]">
          <div>
            © کلیه حقوق مادی و معنوی برای کافه رابیا (Rabia Café) محفوظ است.
          </div>

          {/* REQUIRED BY USER: طراحی شده توسط یاسین ابوالفتحی با لینک به تلگرام */}
          <div className="flex items-center gap-1.5 text-sm">
            <span>طراحی شده توسط</span>
            <a
              href="https://t.me/yasinabolfathi"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#E0946B] hover:text-[#F5D3C1] hover:underline flex items-center gap-1 transition-colors"
            >
              <span>یاسین ابوالفتحی</span>
              <Send className="w-3.5 h-3.5 rotate-[-45deg]" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
