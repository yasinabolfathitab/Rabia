import React from 'react';
import { CheckCircle2, Clock, MapPin, Utensils, Coffee, X, ShoppingBag } from 'lucide-react';
import { Order } from '../types';

interface OrderSuccessModalProps {
  order: Order | null;
  onClose: () => void;
  onTrackOrder?: (orderNumber: string) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ order, onClose, onTrackOrder }) => {
  if (!order) return null;

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'pending':
        return 1;
      case 'preparing':
        return 2;
      case 'ready':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  const currentStep = getStatusStep(order.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-[#181311] border border-[#C87D55]/40 shadow-2xl p-4 sm:p-8 space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Header with official logo and checkmark */}
        <div className="text-center space-y-2.5">
          <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden border border-[#C87D55]/50 bg-[#F6E3CE] p-1 shadow-xl shadow-[#C87D55]/30">
            <img src="/Rabia_Logo.jpg" alt="لوگوی کافه رابیا" className="w-full h-full object-contain" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#181311] flex items-center justify-center text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#FDFBF7]">
            سفارش شما با موفقیت ثبت شد!
          </h3>
          <p className="text-xs sm:text-sm text-[#A8988C]">
            سفارش به صورت آنی در سیستم باریستای کافه رابیا قرار گرفت
          </p>
        </div>

        {/* Order Number & Details Card */}
        <div className="p-4 rounded-2xl bg-[#201A17] border border-[#C87D55]/30 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#C87D55]/15">
            <div>
              <span className="text-xs text-[#A8988C] block">کد پیگیری سفارش:</span>
              <span className="text-lg font-black text-[#E0946B]">{order.orderNumber}</span>
            </div>
            <div className="text-left">
              <span className="text-xs text-[#A8988C] block">نوع سفارش:</span>
              <span className="text-xs font-bold text-[#FDFBF7] flex items-center gap-1">
                {order.orderType === 'takeaway' ? (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-[#C87D55]" />
                    بیرون‌بر
                  </>
                ) : (
                  <>
                    <Utensils className="w-3.5 h-3.5 text-[#C87D55]" />
                    سرو در سالن ({order.tableNumber})
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="text-xs text-[#D8C7B8] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#8C7B71]">تحویل‌گیرنده:</span>
              <span className="font-semibold">{order.userName} ({order.userPhone})</span>
            </div>
            {order.address && (
              <div className="flex justify-between items-start gap-4">
                <span className="text-[#8C7B71] shrink-0">آدرس تحویل:</span>
                <span className="font-semibold text-left">{order.address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#8C7B71]">روش پرداخت:</span>
              <span className="font-bold text-[#E0946B]">
                {order.paymentMethod === 'rabia_credit' ? 'اعتبار حساب رابیا' : 'کارت‌کشیدن حضوری در صندوق'}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#C87D55]/10">
              <span className="text-[#8C7B71]">مبلغ کل:</span>
              <span className="font-black text-sm text-[#FDFBF7]">
                {order.totalAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>
        </div>

        {/* Live Status Tracker Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#E5D7CD]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C87D55]" />
              وضعیت آماده‌سازی سفارش (Real-Time):
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { step: 1, label: 'ثبت شد' },
              { step: 2, label: 'در حال آماده‌سازی' },
              { step: 3, label: 'آماده تحویل' },
              { step: 4, label: 'تحویل شد' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div
                  className={`h-2 rounded-full mb-1.5 transition-all duration-500 ${
                    currentStep >= s.step
                      ? 'copper-gradient shadow-sm shadow-[#C87D55]/50'
                      : 'bg-[#2B231F]'
                  }`}
                ></div>
                <span
                  className={`text-[10px] font-semibold block ${
                    currentStep >= s.step ? 'text-[#F5D3C1]' : 'text-[#6F6057]'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ordered items list */}
        <div className="p-3 rounded-2xl bg-[#1D1714] border border-[#C87D55]/15 space-y-1.5">
          <span className="text-xs font-bold text-[#A8988C] block mb-1">اقلام این سفارش:</span>
          {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-xs text-[#FDFBF7]">
              <span>{it.name} × {it.quantity}</span>
              <span className="text-[#E0946B]">{(it.price * it.quantity).toLocaleString('fa-IR')} تومان</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {onTrackOrder && (
            <button
              onClick={() => {
                onClose();
                onTrackOrder(order.orderNumber);
              }}
              className="flex-1 py-3 rounded-2xl copper-gradient text-white font-bold text-sm shadow-lg shadow-[#C87D55]/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>مشاهده زنده مراحل سفارش</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="py-3 px-5 rounded-2xl bg-[#241E1B] hover:bg-[#2F2723] border border-[#C87D55]/30 text-[#D8C7B8] hover:text-white font-bold text-sm transition-all"
          >
            بازگشت به منو
          </button>
        </div>
      </div>
    </div>
  );
};
