import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  Clock, 
  CheckCircle2, 
  Coffee, 
  Sparkles, 
  ShoppingBag, 
  MapPin, 
  Utensils, 
  Phone, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Flame,
  ArrowRight,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { Order, OrderStatus, User } from '../types';
import { 
  getOrders, 
  searchOrders, 
  fetchLiveOrder, 
  getRecentCustomerOrderNumbers,
  subscribeRealtime 
} from '../lib/database';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderNumber?: string;
  currentUser?: User | null;
  onOpenMenu?: () => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  initialOrderNumber,
  currentUser,
  onOpenMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [matchingOrders, setMatchingOrders] = useState<Order[]>([]);
  const [recentOrderNumbers, setRecentOrderNumbers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load recent orders and initial order
  useEffect(() => {
    if (!isOpen) return;

    const recent = getRecentCustomerOrderNumbers();
    setRecentOrderNumbers(recent);

    // If initialOrderNumber passed, prioritize it
    const target = initialOrderNumber || (recent.length > 0 ? recent[0] : '');

    if (target) {
      setSearchQuery(target);
      loadOrderByQuery(target);
    } else if (currentUser?.phone) {
      // If user logged in and no recent order, look up by phone
      setSearchQuery(currentUser.phone);
      loadOrderByQuery(currentUser.phone);
    } else {
      // Default: show latest order if available in system
      const all = getOrders();
      if (all.length > 0) {
        setActiveOrder(all[0]);
      }
    }
  }, [isOpen, initialOrderNumber, currentUser]);

  // Real-time synchronization: if order status changes, update immediately
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeRealtime(async (event) => {
      if (event.type === 'order_status_updated' || event.type === 'order_created') {
        if (activeOrder) {
          const fresh = await fetchLiveOrder(activeOrder.orderNumber);
          if (fresh) {
            setActiveOrder(fresh);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, activeOrder]);

  const loadOrderByQuery = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      // Try direct match first
      const direct = await fetchLiveOrder(q);
      if (direct) {
        setActiveOrder(direct);
        setMatchingOrders([]);
      } else {
        // Search multiple
        const results = searchOrders(q);
        if (results.length === 1) {
          setActiveOrder(results[0]);
          setMatchingOrders([]);
        } else if (results.length > 1) {
          setMatchingOrders(results);
          setActiveOrder(results[0]);
        } else {
          setActiveOrder(null);
          setMatchingOrders([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrderByQuery(searchQuery);
  };

  const handleRefresh = async () => {
    if (!activeOrder) return;
    setIsRefreshing(true);
    try {
      const fresh = await fetchLiveOrder(activeOrder.orderNumber);
      if (fresh) {
        setActiveOrder(fresh);
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCopyOrderNumber = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  // Stages calculation
  const getStageIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'delivered':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStage = activeOrder ? getStageIndex(activeOrder.status) : 0;
  const isCancelled = activeOrder?.status === 'cancelled';

  const stages = [
    {
      step: 0,
      title: 'ثبت و تایید اولیه',
      subtitle: 'سفارش دریافت و در صف باریستا ثبت شد',
      icon: CheckCircle2,
    },
    {
      step: 1,
      title: 'آماده‌سازی توسط باریستا',
      subtitle: 'عصاره‌گیری، دم‌آوری قهوه و آماده‌سازی اقلام',
      icon: Flame,
    },
    {
      step: 2,
      title: 'آماده تحویل',
      subtitle: 'آماده جهت دریافت در سالن یا تحویل به پیک',
      icon: Sparkles,
    },
    {
      step: 3,
      title: 'تحویل داده شد',
      subtitle: 'سفارش تحویل شد، نوش جان و روزتان خوش!',
      icon: Coffee,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#171311] border border-[#C87D55]/35 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#C87D55]/20 bg-[#1F1916] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-xl copper-gradient flex items-center justify-center text-white shadow-md shadow-[#C87D55]/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#FDFBF7]">
                  پیگیری آنلاین مراحل سفارش
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-600/40 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  بروزرسانی زنده
                </span>
              </div>
              <p className="text-xs text-[#A8988C] font-light mt-0.5">
                مشاهده لحظه‌ای وضعیت آماده‌سازی قهوه و خوراکی‌ها در کافه رابیا
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="بستن پنجره"
            className="p-2 rounded-xl bg-[#29211D] text-[#A8988C] hover:text-[#FDFBF7] hover:bg-[#342A25] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Search Bar & Quick Lookup */}
          <div className="space-y-2.5">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C87D55]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="شماره پیگیری (مثلاً RAB-4821#) یا شماره موبایل..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#201A17] border border-[#C87D55]/30 focus:border-[#C87D55] focus:ring-1 focus:ring-[#C87D55] text-[#FDFBF7] placeholder-[#7F7167] text-xs sm:text-sm transition-all text-right"
                  dir="rtl"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md shadow-[#C87D55]/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>استعلام</span>
              </button>
            </form>

            {/* Quick recent orders pills */}
            {recentOrderNumbers.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[#8C7B71] text-[11px] shrink-0">سفارشات اخیر شما:</span>
                <div className="flex gap-1.5 flex-nowrap">
                  {recentOrderNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setSearchQuery(num);
                        loadOrderByQuery(num);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 border ${
                        activeOrder?.orderNumber === num
                          ? 'bg-[#C87D55] text-white border-[#C87D55]'
                          : 'bg-[#241E1B] text-[#D8C7B8] hover:bg-[#2F2723] border-[#C87D55]/20'
                      }`}
                    >
                      <Receipt className="w-3 h-3 text-[#E0946B]" />
                      <span>{num}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Multiple matches list selector if searched by phone */}
          {matchingOrders.length > 1 && (
            <div className="p-3.5 rounded-2xl bg-[#201A17] border border-[#C87D55]/25 space-y-2">
              <span className="text-xs font-bold text-[#E5D7CD] block">
                چندین سفارش برای این جستجو یافت شد. لطفاً سفارش مورد نظر را انتخاب کنید:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchingOrders.map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setActiveOrder(ord)}
                    className={`p-2.5 rounded-xl text-right transition-all flex items-center justify-between border ${
                      activeOrder?.id === ord.id
                        ? 'bg-[#2D221D] border-[#C87D55] text-[#FDFBF7]'
                        : 'bg-[#181310] border-[#C87D55]/20 text-[#A8988C] hover:text-[#FDFBF7]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-[#E0946B]">{ord.orderNumber}</div>
                      <div className="text-[10px] text-[#8C7B71]">
                        {new Date(ord.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} • {ord.totalAmount.toLocaleString('fa-IR')} تومان
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1F1916] text-[#D8C7B8] border border-[#C87D55]/20">
                      {ord.status === 'pending' && 'در انتظار'}
                      {ord.status === 'preparing' && 'در حال آماده‌سازی'}
                      {ord.status === 'ready' && 'آماده تحویل'}
                      {ord.status === 'delivered' && 'تحویل شد'}
                      {ord.status === 'cancelled' && 'لغو شده'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Order Found View */}
          {activeOrder ? (
            <div className="space-y-5">
              {/* Order Status Hero Card */}
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#C87D55]/40 bg-gradient-to-br from-[#231A16] via-[#1B1512] to-[#14100E] shadow-xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#C87D55]/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Top bar of card */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#C87D55]/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#A8988C]">شماره پیگیری:</span>
                    <button
                      onClick={() => handleCopyOrderNumber(activeOrder.orderNumber)}
                      className="px-2.5 py-1 rounded-lg bg-[#2E231E] hover:bg-[#3D2F28] border border-[#C87D55]/30 text-[#F5D3C1] font-black text-sm flex items-center gap-1.5 transition-all group"
                      title="کپی شماره سفارش"
                    >
                      <span>{activeOrder.orderNumber}</span>
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#C87D55] group-hover:text-white" />
                      )}
                    </button>
                    {copied && (
                      <span className="text-[10px] text-emerald-400 font-bold animate-in fade-in">
                        کپی شد
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="px-2.5 py-1 rounded-lg bg-[#28201C] hover:bg-[#332823] border border-[#C87D55]/30 text-[#D8C7B8] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="بروزرسانی وضعیت"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#C87D55] ${isRefreshing ? 'animate-spin text-[#E0946B]' : ''}`} />
                      <span>بروزرسانی</span>
                    </button>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>زنده</span>
                    </div>
                  </div>
                </div>

                {/* Main Progress Stepper */}
                {isCancelled ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-800 mx-auto flex items-center justify-center text-rose-400">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-rose-300">
                      این سفارش لغو گردیده است
                    </h4>
                    <p className="text-xs text-[#A8988C] max-w-md mx-auto">
                      در صورت کسر وجه یا نیاز به راهنمایی بیشتر، لطفاً با پشتیبانی کافه رابیا تماس بگیرید.
                    </p>
                  </div>
                ) : (
                  <div className="py-5 sm:py-7">
                    {/* Stepper Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-2 relative">
                      {stages.map((st, idx) => {
                        const Icon = st.icon;
                        const isPassed = currentStage >= idx;
                        const isCurrent = currentStage === idx;

                        return (
                          <div
                            key={st.step}
                            className={`relative flex sm:flex-col items-center sm:items-center text-right sm:text-center p-3 sm:p-2 rounded-2xl sm:rounded-none transition-all ${
                              isCurrent
                                ? 'bg-[#291F1A]/80 sm:bg-transparent border border-[#C87D55]/50 sm:border-0 shadow-lg sm:shadow-none'
                                : 'bg-[#181310]/50 sm:bg-transparent'
                            }`}
                          >
                            {/* Icon / Circle Indicator */}
                            <div className="relative shrink-0 ml-3 sm:ml-0 sm:mb-2.5">
                              <div
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md ${
                                  isPassed
                                    ? isCurrent
                                      ? 'copper-gradient text-white ring-4 ring-[#C87D55]/30 scale-105'
                                      : 'bg-[#2E241F] text-[#E0946B] border border-[#C87D55]/40'
                                    : 'bg-[#201A17] text-[#6F6057] border border-[#3E332D]'
                                }`}
                              >
                                <Icon className={`w-5 h-5 ${isCurrent ? 'animate-bounce' : ''}`} />
                              </div>

                              {isCurrent && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E0946B] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E0946B]"></span>
                                </span>
                              )}
                            </div>

                            {/* Text labels */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center sm:justify-center gap-1.5">
                                <span
                                  className={`text-xs sm:text-sm font-black transition-colors ${
                                    isCurrent
                                      ? 'text-[#FDFBF7]'
                                      : isPassed
                                      ? 'text-[#E0946B]'
                                      : 'text-[#6F6057]'
                                  }`}
                                >
                                  {st.title}
                                </span>
                                {isPassed && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-[#9E8E82] mt-0.5 line-clamp-2 leading-relaxed font-light">
                                {st.subtitle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stepper Connected Progress Line on Desktop */}
                    <div className="hidden sm:block relative mt-4 px-6">
                      <div className="h-1.5 w-full bg-[#2B231F] rounded-full overflow-hidden">
                        <div
                          className="h-full copper-gradient transition-all duration-700 ease-out"
                          style={{
                            width: `${((currentStage + 1) / stages.length) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Realtime Barista Notification Banner */}
                <div className="mt-2 p-3 rounded-xl bg-[#1B1512] border border-[#C87D55]/20 flex items-center justify-between text-xs text-[#D8C7B8]">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-[#C87D55] shrink-0" />
                    <span>
                      {currentStage === 0 && 'سفارش در نوبت دم‌آوری و پردازش سیستم قرار دارد.'}
                      {currentStage === 1 && 'باریستای کافه رابیا هم‌اکنون در حال آماده‌سازی و دیزاین سفارش شماست.'}
                      {currentStage === 2 && 'سفارش آماده است؛ می‌توانید از بار کافه تحویل بگیرید یا منتظر تحویل سالن/پیک باشید.'}
                      {currentStage === 3 && 'سفارش با موفقیت تحویل داده شد. اوقات خوشی در رابیا برای شما آرزومندیم.'}
                      {isCancelled && 'سفارش لغو شده است.'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8C7B71] shrink-0 font-medium mr-2">
                    زمان ثبت: {new Date(activeOrder.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Order Full Breakdown & Invoice Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Col: Order Delivery & Client Info */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#1D1714] border border-[#C87D55]/25 space-y-3.5">
                  <h4 className="text-xs sm:text-sm font-bold text-[#FDFBF7] pb-2 border-b border-[#C87D55]/15 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#C87D55]" />
                    <span>مشخصات تحویل و تحویل‌گیرنده</span>
                  </h4>

                  <div className="space-y-2 text-xs text-[#D8C7B8]">
                    <div className="flex justify-between">
                      <span className="text-[#8C7B71]">نام مشتری:</span>
                      <span className="font-bold text-[#FDFBF7]">{activeOrder.userName}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#8C7B71]">شماره تماس:</span>
                      <span className="font-mono text-left">{activeOrder.userPhone}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#8C7B71]">نوع سفارش:</span>
                      <span className="font-bold text-[#E0946B] flex items-center gap-1">
                        {activeOrder.orderType === 'takeaway' ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-[#C87D55]" />
                            بیرون‌بر
                          </>
                        ) : (
                          <>
                            <Utensils className="w-3.5 h-3.5 text-[#C87D55]" />
                            سرو در سالن (میز {activeOrder.tableNumber || '-'})
                          </>
                        )}
                      </span>
                    </div>

                    {activeOrder.address && (
                      <div className="pt-1 flex flex-col gap-1 border-t border-[#C87D55]/10">
                        <span className="text-[#8C7B71]">آدرس تحویل:</span>
                        <span className="p-2 rounded-lg bg-[#241E1B] text-[11px] leading-relaxed">
                          {activeOrder.address}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1 border-t border-[#C87D55]/10">
                      <span className="text-[#8C7B71]">شیوه پرداخت:</span>
                      <span className="font-semibold text-[#FDFBF7]">
                        {activeOrder.paymentMethod === 'rabia_credit' ? (
                          <span className="text-emerald-400">اعتبار حساب رابیا (تسویه شد)</span>
                        ) : (
                          <span>پرداخت با کارتخوان در صندوق</span>
                        )}
                      </span>
                    </div>

                    {activeOrder.notes && (
                      <div className="pt-1 flex flex-col gap-1 border-t border-[#C87D55]/10">
                        <span className="text-[#8C7B71]">یادداشت سفارش:</span>
                        <span className="text-[11px] text-[#A8988C] italic">
                          "{activeOrder.notes}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Col: Ordered Items & Total */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#1D1714] border border-[#C87D55]/25 flex flex-col justify-between space-y-3.5">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#FDFBF7] pb-2 border-b border-[#C87D55]/15 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-[#C87D55]" />
                        <span>اقلام سفارش</span>
                      </div>
                      <span className="text-[10px] text-[#8C7B71] font-normal">
                        {activeOrder.items.length} آیتم
                      </span>
                    </h4>

                    <div className="divide-y divide-[#C87D55]/10 mt-2 max-h-48 overflow-y-auto pr-1">
                      {activeOrder.items.map((it, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-[#2B231F] text-[#E0946B] text-[11px] font-bold flex items-center justify-center">
                              {it.quantity}×
                            </span>
                            <span className="font-semibold text-[#FDFBF7]">{it.name}</span>
                          </div>
                          <span className="font-bold text-[#D8C7B8]">
                            {(it.price * it.quantity).toLocaleString('fa-IR')} تومان
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Bill Box */}
                  <div className="p-3 rounded-xl bg-[#241E1B] border border-[#C87D55]/20 flex items-center justify-between">
                    <span className="text-xs text-[#A8988C] font-bold">مبلغ کل فاکتور:</span>
                    <div className="text-sm sm:text-base font-black text-[#F5D3C1]">
                      {activeOrder.totalAmount.toLocaleString('fa-IR')}{' '}
                      <span className="text-xs text-[#A8988C] font-normal">تومان</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Support & Cafe Contact */}
              <div className="p-3 sm:p-4 rounded-2xl bg-[#201A17] border border-[#C87D55]/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#D8C7B8] text-center sm:text-right">
                  <Phone className="w-4 h-4 text-[#C87D55] shrink-0" />
                  <span>سؤالی درباره سفارش خود دارید؟ باریستای رابیا پاسخگوی شماست:</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href="tel:02122003344"
                    className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-[#2D2420] hover:bg-[#3D312A] text-[#F5D3C1] font-bold border border-[#C87D55]/30 text-center transition-all"
                  >
                    تماس با کافه: ۰۲۱-۲۲۰۰۳۳۴۴
                  </a>
                  {onOpenMenu && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenMenu();
                      }}
                      className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl copper-gradient text-white font-bold text-center hover:scale-105 transition-all"
                    >
                      سفارش جدید
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : hasSearched ? (
            /* Not Found Empty State */
            <div className="p-8 text-center space-y-3 rounded-2xl bg-[#1D1714] border border-[#C87D55]/20">
              <div className="w-14 h-14 rounded-full bg-[#261E1A] text-[#8C7B71] mx-auto flex items-center justify-center">
                <Search className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-[#FDFBF7]">
                سفارشی با این مشخصات یافت نشد
              </h4>
              <p className="text-xs text-[#A8988C] max-w-sm mx-auto leading-relaxed">
                لطفاً کد پیگیری سفارش خود (مثلاً <span className="text-[#E0946B] font-mono">RAB-1234#</span>) یا شماره موبایلی که با آن ثبت سفارش کرده‌اید را بررسی کرده و مجدداً امتحان کنید.
              </p>
              {recentOrderNumbers.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSearchQuery(recentOrderNumbers[0]);
                      loadOrderByQuery(recentOrderNumbers[0]);
                    }}
                    className="text-xs text-[#E0946B] hover:underline font-bold"
                  >
                    استعلام آخرین سفارش ثبت‌شده روی این دستگاه ({recentOrderNumbers[0]})
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* First open prompt */
            <div className="p-8 text-center space-y-3 rounded-2xl bg-[#1D1714] border border-[#C87D55]/20">
              <div className="w-12 h-12 rounded-full copper-gradient text-white mx-auto flex items-center justify-center shadow-md">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-[#FDFBF7]">
                کد پیگیری یا شماره تماس خود را در کادر بالا وارد کنید
              </h4>
              <p className="text-xs text-[#A8988C] max-w-sm mx-auto">
                وضعیت زنده آماده‌سازی، دم‌آوری و تحویل سفارش بلافاصله برای شما نمایش داده خواهد شد.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-[#C87D55]/20 bg-[#1A1513] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#8C7B71] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>سیستم مانیتورینگ باریستای کافه رابیا</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2A221E] hover:bg-[#382E28] text-[#D8C7B8] hover:text-white text-xs font-bold transition-all"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
