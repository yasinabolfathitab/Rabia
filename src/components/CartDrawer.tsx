import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  MapPin, 
  Utensils, 
  CreditCard, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowLeft 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartItem, OrderType, PaymentMethod, User, Order } from '../types';
import { createOrder, getMenuItems, parseIsAvailable } from '../lib/database';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  user: User | null;
  onUpdateCartQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onOpenAuth: () => void;
  onOrderSuccess: (order: Order) => void;
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

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  user,
  onUpdateCartQuantity,
  onClearCart,
  onOpenAuth,
  onOrderSuccess,
}) => {
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('rabia_credit');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('میز شماره 1');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync with user profile on change
  useEffect(() => {
    if (user) {
      setCustomerName(user.name || '');
      setCustomerPhone(user.phone || '');
      if (user.address) {
        setDeliveryAddress(user.address);
      }
    }
  }, [user]);

  if (!isOpen) return null;

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  const packagingFee = 0; // Free in Café Rabia
  const totalAmount = subtotal + packagingFee;

  const hasEnoughRabiaCredit = user ? user.rabiaCredit >= totalAmount : false;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('سبد خرید شما خالی است.');
      return;
    }

    const currentMenu = getMenuItems();
    const outOfStockInCart = cart.find((c) => {
      const liveItem = currentMenu.find((m) => m.id === c.item.id);
      return liveItem ? !parseIsAvailable(liveItem.isAvailable) : !parseIsAvailable(c.item.isAvailable);
    });
    if (outOfStockInCart) {
      setErrorMessage(`متأسفانه آیتم "${outOfStockInCart.item.name}" در حال حاضر اتمام موجودی شده است. لطفاً آن را از سبد خرید حذف کنید.`);
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }

    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      setErrorMessage('لطفاً شماره تلفن معتبر خود را وارد کنید.');
      return;
    }

    if (orderType === 'takeaway' && !deliveryAddress.trim()) {
      setErrorMessage('برای سفارش بیرون‌بر، وارد کردن آدرس تحویل الزامی است.');
      return;
    }

    if (user?.status === 'banned') {
      setErrorMessage('حساب کاربری شما به دلیل تخلف امنیتی مسدود شده است و امکان ثبت سفارش وجود ندارد.');
      return;
    }

    if (paymentMethod === 'rabia_credit') {
      if (!user) {
        setErrorMessage('برای استفاده از اعتبار حساب رابیا، لطفاً ابتدا وارد حساب کاربری خود شوید.');
        return;
      }
      if (!hasEnoughRabiaCredit) {
        setErrorMessage(
          `موجودی اعتبار رابیا شما (${user.rabiaCredit.toLocaleString('en-US')} تومان) کمتر از مبلغ کل سفارش است. لطفاً گزینه کارت‌کشیدن در صندوق را انتخاب کنید یا حسابتان را شارژ نمایید.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderItems = cart.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
      }));

      const result = await createOrder({
        userId: user?.id,
        userName: customerName.trim(),
        userPhone: customerPhone.trim(),
        orderType,
        address: orderType === 'takeaway' ? deliveryAddress.trim() : undefined,
        tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
        items: orderItems,
        totalAmount,
        paymentMethod,
        notes: orderNotes.trim() || undefined,
      });

      if (!result.success || !result.order) {
        setErrorMessage(result.message || 'خطا در ثبت سفارش.');
        setIsSubmitting(false);
        return;
      }

      // Trigger celebration confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C87D55', '#E0946B', '#F5D3C1', '#FFFFFF'],
      });

      onClearCart();
      onClose();
      onOrderSuccess(result.order);
    } catch (err: any) {
      setErrorMessage('متاسفانه در پردازش سفارش مشکلی پیش آمد: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/70 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="w-full max-w-lg bg-[#161210] border-r sm:border-r-0 sm:border-l border-[#C87D55]/30 h-full flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-left sm:slide-in-from-right duration-300"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#C87D55]/20 flex items-center justify-between bg-[#1B1614]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl copper-gradient flex items-center justify-center text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#FDFBF7]">سبد سفارش کافه رابیا</h2>
              <span className="text-xs text-[#A8988C]">
                {cart.length} ردیف سفارش ثبت شده
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#241E1B] text-[#A8988C] hover:text-[#FDFBF7] hover:bg-[#2F2723] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-16 h-16 text-[#C87D55]/30 mx-auto mb-3" />
              <p className="text-base font-bold text-[#FDFBF7]">سبد سفارش شما در حال حاضر خالی است</p>
              <p className="text-xs text-[#A8988C] mt-1">
                نوشیدنی‌ها و دسرهای دلخواه خود را از منو انتخاب کنید.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#A8988C]">
                <span>اقلام انتخابی:</span>
                <button
                  onClick={onClearCart}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف همه</span>
                </button>
              </div>

              {cart.map((c) => {
                const currentMenu = getMenuItems();
                const liveItem = currentMenu.find((m) => m.id === c.item.id);
                const isOutOfStock = liveItem ? !parseIsAvailable(liveItem.isAvailable) : !parseIsAvailable(c.item.isAvailable);

                return (
                  <div
                    key={c.item.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      isOutOfStock
                        ? 'bg-rose-950/20 border-rose-800/60'
                        : 'bg-[#1D1815] border-[#C87D55]/20'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={c.item.image}
                        alt={c.item.name}
                        className={`w-14 h-14 rounded-xl object-cover border shrink-0 ${
                          isOutOfStock
                            ? 'grayscale contrast-75 border-rose-800/60'
                            : 'border-[#C87D55]/20'
                        }`}
                      />
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                          <span className="text-[9px] font-black text-rose-300 px-1 bg-rose-950/80 rounded border border-rose-800">
                            ناموجود
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-[#FDFBF7] truncate">
                          {c.item.name}
                        </h4>
                        {isOutOfStock && (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                            اتمام موجودی
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#E0946B] mt-1">
                        {(c.item.price * c.quantity).toLocaleString('en-US')}{' '}
                        <span className="text-[10px] text-[#A8988C]">تومان</span>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 bg-[#241E1B] border border-[#C87D55]/30 rounded-xl p-1">
                      <button
                        onClick={() => onUpdateCartQuantity(c.item.id, 1)}
                        disabled={isOutOfStock}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${
                          isOutOfStock
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'copper-gradient text-white hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-white">
                        {c.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateCartQuantity(c.item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-[#2D2420] text-[#E0946B] hover:bg-[#3D322B] flex items-center justify-center transition-all text-xs font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <form onSubmit={handleCheckout} className="space-y-5 pt-2">
              {/* Order Type Switcher (Takeaway vs Dine-In) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#E5D7CD] flex items-center gap-1.5">
                  <span>نوع دریافت سفارش:</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOrderType('takeaway')}
                    className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      orderType === 'takeaway'
                        ? 'copper-gradient text-white border-[#E0946B] shadow-md shadow-[#C87D55]/20'
                        : 'bg-[#1D1815] text-[#C4B3A5] border-[#C87D55]/20 hover:bg-[#251F1C]'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>سفارش بیرون‌بر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('dine_in')}
                    className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      orderType === 'dine_in'
                        ? 'copper-gradient text-white border-[#E0946B] shadow-md shadow-[#C87D55]/20'
                        : 'bg-[#1D1815] text-[#C4B3A5] border-[#C87D55]/20 hover:bg-[#251F1C]'
                    }`}
                  >
                    <Utensils className="w-4 h-4" />
                    <span>سرو در داخل سالن</span>
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-[#1B1614] border border-[#C87D55]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FDFBF7]">مشخصات تحویل‌گیرنده</span>
                  {!user && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="text-[11px] font-bold text-[#E0946B] hover:underline"
                    >
                      ورود به حساب کاربری
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#A8988C] block mb-1">نام و نام خانوادگی</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثلاً: علی رضایی"
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 text-xs text-[#FDFBF7] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#A8988C] block mb-1">شماره تماس (اعداد انگلیسی)</label>
                    <input
                      type="tel"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(toEnglishDigits(e.target.value).slice(0, 11))}
                      placeholder="09121234567"
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 text-xs text-[#FDFBF7] focus:outline-none text-left font-mono tracking-wider placeholder:text-neutral-500"
                    />
                  </div>
                </div>

                {/* Conditional Address or Table */}
                {orderType === 'takeaway' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-[#A8988C]">
                        آدرس دقیق جهت ارسال بیرون‌بر
                      </label>
                      {user?.address && (
                        <span className="text-[10px] text-emerald-400">
                          (بارگذاری شده از پروفایل شما)
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="تهران، خیابان، کوچه، پلاک، واحد..."
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl p-2.5 text-xs text-[#FDFBF7] focus:outline-none leading-relaxed"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-[#A8988C] block mb-1">شماره یا نام میز</label>
                    <select
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 text-xs text-[#FDFBF7] focus:outline-none"
                    >
                      <option value="میز شماره 1">میز شماره 1</option>
                      <option value="میز شماره 2">میز شماره 2</option>
                      <option value="میز شماره 3">میز شماره 3</option>
                      <option value="میز شماره 4">میز شماره 4</option>
                      <option value="میز شماره 5">میز شماره 5</option>
                      <option value="میز شماره 6">میز شماره 6</option>
                      <option value="میز شماره 7">میز شماره 7</option>
                      <option value="میز شماره 8">میز شماره 8</option>
                      <option value="میز شماره 9">میز شماره 9</option>
                      <option value="میز شماره 10">میز شماره 10</option>
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-[11px] text-[#A8988C] block mb-1">توضیحات یا سفارشی‌سازی (اختیاری)</label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="مثال: کم‌شکر، یخ کمتر، شیر داغ..."
                    className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl px-3 py-2 text-xs text-[#FDFBF7] focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#E5D7CD]">نحوه پرداخت:</label>
                
                <div className="space-y-2">
                  {/* Option 1: Rabia Credit */}
                  <div
                    onClick={() => setPaymentMethod('rabia_credit')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'rabia_credit'
                        ? 'bg-[#221B17] border-[#C87D55] shadow-md shadow-[#C87D55]/15'
                        : 'bg-[#1D1815] border-[#C87D55]/20 hover:bg-[#241D19]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl copper-gradient text-white flex items-center justify-center">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#FDFBF7]">
                            خرید با اعتبار حساب رابیا
                          </div>
                          <div className="text-[11px] text-[#A8988C]">
                            کسر آنی از شارژ هدیه و کیف‌پول شما
                          </div>
                        </div>
                      </div>

                      <div className="w-5 h-5 rounded-full border border-[#C87D55] flex items-center justify-center">
                        {paymentMethod === 'rabia_credit' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#C87D55]"></div>
                        )}
                      </div>
                    </div>

                    {/* Credit balance display */}
                    <div className="mt-3 pt-2.5 border-t border-[#C87D55]/15 flex items-center justify-between text-xs">
                      <span className="text-[#A8988C]">موجودی فعلی اعتبار رابیا:</span>
                      {user ? (
                        <span
                          className={`font-black ${
                            hasEnoughRabiaCredit ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {user.rabiaCredit.toLocaleString('en-US')} تومان
                        </span>
                      ) : (
                        <span className="text-[#E0946B]">نیازمند ورود به حساب</span>
                      )}
                    </div>

                    {user && !hasEnoughRabiaCredit && (
                      <div className="mt-2 text-[11px] text-amber-300 flex items-center gap-1.5 bg-amber-950/40 p-2 rounded-lg border border-amber-800/50">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>اعتبار شما کمتر از مبلغ سفارش است. پرداخت حضوری در صندوق را انتخاب کنید.</span>
                      </div>
                    )}
                  </div>

                  {/* Option 2: POS at Counter */}
                  <div
                    onClick={() => setPaymentMethod('counter_pos')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'counter_pos'
                        ? 'bg-[#221B17] border-[#C87D55] shadow-md shadow-[#C87D55]/15'
                        : 'bg-[#1D1815] border-[#C87D55]/20 hover:bg-[#241D19]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#2D2420] text-[#E0946B] flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#FDFBF7]">
                            کارت‌کشیدن حضوری در صندوق
                          </div>
                          <div className="text-[11px] text-[#A8988C]">
                            پرداخت توسط کارتخوان کافه هنگام تحویل
                          </div>
                        </div>
                      </div>

                      <div className="w-5 h-5 rounded-full border border-[#C87D55] flex items-center justify-center">
                        {paymentMethod === 'counter_pos' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#C87D55]"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Price summary */}
              <div className="p-4 rounded-2xl bg-[#1D1815] border border-[#C87D55]/20 space-y-2">
                <div className="flex justify-between text-xs text-[#A8988C]">
                  <span>مجموع سفارش:</span>
                  <span className="text-[#FDFBF7] font-semibold">{subtotal.toLocaleString('en-US')} تومان</span>
                </div>
                <div className="flex justify-between text-xs text-[#A8988C]">
                  <span>بسته‌بندی و سرو رابیا:</span>
                  <span className="text-emerald-400 font-semibold">رایگان (مهمان کافه)</span>
                </div>
                <div className="pt-2 border-t border-[#C87D55]/20 flex justify-between text-sm sm:text-base font-black text-[#FDFBF7]">
                  <span>مبلغ نهایی قابل پرداخت:</span>
                  <span className="text-[#E0946B]">{totalAmount.toLocaleString('en-US')} تومان</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-2xl copper-gradient text-white font-black text-sm shadow-xl shadow-[#C87D55]/30 hover:shadow-[#C87D55]/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>در حال ثبت در سیستم رابیا...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#FDFBF7]" />
                    <span>تایید نهایی و ثبت فوری سفارش</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
