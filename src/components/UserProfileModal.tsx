import React, { useState, useEffect } from 'react';
import { 
  X, 
  User as UserIcon, 
  Wallet, 
  MapPin, 
  Phone, 
  Save, 
  LogOut, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  History,
  ShoppingBag
} from 'lucide-react';
import { User, Order, CreditTransaction } from '../types';
import { updateUserProfile, getOrders, getTransactions } from '../lib/database';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  onOpenCart: () => void;
  onOpenTracking?: (orderNumber: string) => void;
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

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onLogout,
  onOpenCart,
  onOpenTracking,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'credit'>('profile');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAddress(user.address || '');

      // Load user's orders
      const allOrders = getOrders();
      const myOrders = allOrders.filter(
        (o) => o.userId === user.id || o.userPhone === user.phone
      );
      setUserOrders(myOrders);

      // Load credit history
      const allTx = getTransactions();
      const myTx = allTx.filter((t) => t.userId === user.id || t.userPhone === user.phone);
      setUserTransactions(myTx);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateUserProfile(user.id, {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });

    if (updated) {
      onUpdateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#181311] border border-[#C87D55]/30 shadow-2xl p-4 sm:p-8 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto flex-1 pr-0.5 sm:pr-1 -mr-0.5 sm:-mr-1 pl-1 space-y-4 sm:space-y-6">
          {/* User Top Summary & Rabia Credit Card */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-[#C87D55]/50 bg-gradient-to-br from-[#2D221D] via-[#1E1714] to-[#14100E] shadow-xl">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#C87D55]/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl copper-gradient flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg shadow-[#C87D55]/30 shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[#FDFBF7]">{user.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] font-bold border border-emerald-500/30">
                      عضو تایید شده
                    </span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#A8988C] mt-0.5" dir="ltr">
                    {user.phone}
                  </div>
                </div>
              </div>

              {/* Rabia Credit Box */}
              <div className="bg-[#181210]/90 border border-[#C87D55]/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-right">
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#D8C7B8] mb-0.5 sm:mb-1">
                  <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E0946B]" />
                  <span>اعتبار حساب رابیا</span>
                </div>
                <div className="text-lg sm:text-2xl font-black copper-gradient-text">
                  {user.rabiaCredit.toLocaleString('en-US')}
                  <span className="text-[10px] sm:text-xs text-[#E0946B] mr-1">تومان</span>
                </div>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-[#C87D55]/20 text-[10px] sm:text-[11px] text-[#A8988C] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E0946B] shrink-0" />
              <span>
                هر بار کارت کشیدن در کافه = شارژ اعتبار مستقیم توسط مدیریت برای سفارشات بعدی
              </span>
            </div>
          </div>

          {/* Tab Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#C87D55]/20 pb-2.5 sm:pb-3 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'copper-gradient text-white'
                  : 'text-[#A8988C] hover:text-white bg-[#201A17]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>مشخصات و آدرس</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'copper-gradient text-white'
                  : 'text-[#A8988C] hover:text-white bg-[#201A17]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>سفارش‌ها ({userOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('credit')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap ${
                activeTab === 'credit'
                  ? 'copper-gradient text-white'
                  : 'text-[#A8988C] hover:text-white bg-[#201A17]'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>تراکنش‌های اعتبار ({userTransactions.length})</span>
            </button>
          </div>

          {/* Tab 1: Edit Profile & Address */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-3 sm:space-y-4">
              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>مشخصات شما با موفقیت در دیتابیس رابیا ذخیره گردید.</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">نام و نام خانوادگی</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs text-[#FDFBF7] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#D8C7B8] block mb-1">شماره تلفن همراه (اعداد انگلیسی)</label>
                <input
                  type="tel"
                  dir="ltr"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => setPhone(toEnglishDigits(e.target.value).slice(0, 11))}
                  placeholder="09121234567"
                  className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs text-[#FDFBF7] focus:outline-none text-left font-mono tracking-wider"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#D8C7B8]">
                    آدرس پیش‌فرض جهت سفارش‌های بیرون‌بر
                  </label>
                  <span className="text-[10px] text-[#A8988C]">ارسال خودکار در سفارشات</span>
                </div>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="آدرس دقیق خود را برای سفارش‌های بیرون‌بر اینجا بنویسید..."
                  className="w-full bg-[#221B17] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl p-2.5 sm:p-3 text-xs text-[#FDFBF7] focus:outline-none leading-relaxed"
                />
              </div>

              <div className="pt-1 sm:pt-2 flex items-center justify-between gap-2.5 sm:gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 sm:py-3 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 sm:gap-2 hover:scale-[1.01] transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره مشخصات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Orders History */}
          {activeTab === 'orders' && (
            <div className="space-y-2.5 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto pr-1">
              {userOrders.length === 0 ? (
                <div className="text-center py-8 sm:py-10 text-xs text-[#A8988C]">
                  هنوز سفارشی توسط شما ثبت نشده است.
                </div>
              ) : (
                userOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#201A17] border border-[#C87D55]/20 space-y-1.5 sm:space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#E0946B]">{ord.orderNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E241F] text-[#D8C7B8]">
                          {ord.orderType === 'takeaway' ? 'بیرون‌بر' : 'سرو در سالن'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#FDFBF7]">
                        {ord.totalAmount.toLocaleString('en-US')} تومان
                      </span>
                    </div>

                    <div className="text-xs text-[#A8988C]">
                      {ord.items.map((it) => `${it.name} (${it.quantity})`).join('، ')}
                    </div>

                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#8C7B71] pt-1.5 border-t border-[#C87D55]/10">
                      <span>{new Date(ord.createdAt).toLocaleDateString('en-US')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#E0946B] font-semibold">
                          {ord.status === 'delivered' ? 'تحویل داده شده' : 'در حال پیگیری'}
                        </span>
                        {onOpenTracking && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenTracking(ord.orderNumber);
                            }}
                            className="px-2 py-0.5 rounded bg-[#2F241F] hover:bg-[#C87D55] text-[#F5D3C1] hover:text-white font-bold transition-colors"
                          >
                            پیگیری مراحل
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Credit Transactions */}
          {activeTab === 'credit' && (
            <div className="space-y-2.5 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto pr-1">
              {userTransactions.length === 0 ? (
                <div className="text-center py-8 sm:py-10 text-xs text-[#A8988C]">
                  هنوز تراکنش اعتباری ثبت نشده است. هر بار کارت‌کشیدن در کافه توسط مدیریت شارژ خواهد شد.
                </div>
              ) : (
                userTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#201A17] border border-[#C87D55]/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#FDFBF7]">{tx.description}</div>
                      <div className="text-[10px] text-[#A8988C] mt-0.5">
                        {new Date(tx.createdAt).toLocaleString('en-US')}
                      </div>
                    </div>

                    <div
                      className={`text-xs sm:text-sm font-black ${
                        tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount.toLocaleString('en-US')} تومان
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
