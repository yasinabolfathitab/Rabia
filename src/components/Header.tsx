import React from 'react';
import { Coffee, ShoppingBag, User as UserIcon, Lock, Sparkles, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenAdminLogin: () => void;
  onOpenMenu: () => void;
  onOpenTracking: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  cartCount,
  onOpenCart,
  onOpenAuth,
  onOpenProfile,
  onOpenAdminLogin,
  onOpenMenu,
  onOpenTracking,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#161311]/90 backdrop-blur-md border-b border-[#C87D55]/20 transition-all duration-300">
      {/* Top micro bar with address & status */}
      <div className="bg-[#0F0D0C] border-b border-[#C87D55]/10 text-xs text-[#E5D7CD] py-1.5 px-4 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>کافه رابیا: ساعت کاری 8:00 _ 22:00 همه روزه</span>
          </div>
          <div className="flex items-center gap-4 text-[#A8988C]">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#C87D55]" />
              کرج، فردیس، بلوار شهدای فردیس، خیابان چهل و یکم
            </span>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand logo */}
        <button
          onClick={onOpenMenu}
          className="flex items-center gap-2.5 sm:gap-3 group text-right focus:outline-none shrink-0"
        >
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg shadow-[#C87D55]/20 group-hover:scale-105 transition-transform duration-300 border border-[#C87D55]/40 bg-[#F6E3CE] flex items-center justify-center p-0.5">
            <img src="/Rabia_Logo.jpg" alt="لوگوی کافه رابیا" className="w-full h-full object-contain" />
            <div className="absolute -top-1 -right-1 w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-[#C87D55] border-2 border-[#161311]"></div>
          </div>
          {/* In mobile, hide "کافه رابیا", "RABIA", and "منوی لوکس و سیستم سفارش هوشمند" */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-black tracking-tight text-[#FDFBF7] group-hover:text-[#F5D3C1] transition-colors">
                کافه رابیا
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C87D55]/20 text-[#E0946B] border border-[#C87D55]/30">
                RABIA
              </span>
            </div>
            <p className="text-xs text-[#A8988C] font-light">
              منوی لوکس و سیستم سفارش هوشمند
            </p>
          </div>
        </button>

        {/* Action items */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* User profile / Login */}
          {user ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#241E1B] border border-[#C87D55]/30 hover:border-[#C87D55] text-right transition-all duration-200"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#C87D55]/20 text-[#E0946B] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="text-xs">
                <div className="text-[#FDFBF7] font-medium flex items-center gap-1">
                  <span className="max-w-[70px] sm:max-w-[120px] truncate">{user.name}</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                </div>
                <div className="text-[#E0946B] font-bold text-[10px] sm:text-xs">
                  {user.rabiaCredit.toLocaleString('en-US')} ت
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-[#241E1B] hover:bg-[#2F2723] border border-[#C87D55]/30 text-xs sm:text-sm font-medium text-[#FDFBF7] hover:text-[#E0946B] transition-all"
            >
              <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C87D55]" />
              <span>ورود / عضویت</span>
            </button>
          )}

          {/* Order Tracking Button */}
          <button
            onClick={onOpenTracking}
            aria-label="پیگیری سفارش"
            title="پیگیری آنلاین مراحل سفارش"
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#221B18] hover:bg-[#2C231F] border border-[#C87D55]/30 hover:border-[#C87D55] text-xs sm:text-sm font-medium text-[#FDFBF7] hover:text-[#E0946B] transition-all shrink-0 group"
          >
            <div className="relative">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C87D55] group-hover:rotate-45 transition-transform" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="hidden sm:inline">پیگیری سفارش</span>
            <span className="sm:hidden text-xs">پیگیری</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            aria-label="سبد خرید"
            className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl copper-gradient text-white font-semibold text-xs sm:text-sm shadow-md shadow-[#C87D55]/30 hover:shadow-lg hover:shadow-[#C87D55]/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">سبد سفارش</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-[#944B26] text-[10px] font-black flex items-center justify-center shadow-inner">
                {cartCount}
              </span>
            )}
          </button>

          {/* Admin Access Button (No password hint shown) */}
          <button
            onClick={onOpenAdminLogin}
            title="ورود به پنل مدیریت کافه"
            className="p-2 sm:p-2.5 rounded-xl bg-[#1F1A18] hover:bg-[#2A2320] border border-[#3E332D] text-[#8C7B71] hover:text-[#F5D3C1] hover:border-[#C87D55]/50 transition-all shrink-0"
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
