import React, { useState, useMemo } from 'react';
import { MenuItem, MenuCategory, CartItem } from '../types';
import { parseIsAvailable } from '../lib/database';
import { 
  Coffee, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  Sparkles, 
  CupSoda, 
  Cake, 
  GlassWater, 
  Utensils 
} from 'lucide-react';

interface MenuSectionProps {
  items: MenuItem[];
  cart: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateCartQuantity: (itemId: string, delta: number) => void;
}

const CATEGORIES: { id: MenuCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'همه آیتم‌ها', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'espresso_milk', label: 'اسپرسو و شیر', icon: <Coffee className="w-4 h-4" /> },
  { id: 'hot_bar', label: 'هات بار', icon: <Coffee className="w-4 h-4" /> },
  { id: 'tea_bar', label: 'تی بار', icon: <Coffee className="w-4 h-4" /> },
  { id: 'ice_coffee', label: 'آیس کافی', icon: <CupSoda className="w-4 h-4" /> },
  { id: 'mocktail_bar', label: 'ماکتیل بار', icon: <GlassWater className="w-4 h-4" /> },
  { id: 'shake_smoothie', label: 'شیک و اسموتی', icon: <CupSoda className="w-4 h-4" /> },
  { id: 'signature', label: 'سیگنچر', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'antioxidant_bar', label: 'آنتی اکسیدان بار', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'affogato_bar', label: 'آفوگاتو بار', icon: <Cake className="w-4 h-4" /> },
  { id: 'cakes_desserts', label: 'کیک و دسر', icon: <Cake className="w-4 h-4" /> },
  { id: 'refresher', label: 'رفرشر', icon: <GlassWater className="w-4 h-4" /> },
];

export const MenuSection: React.FC<MenuSectionProps> = ({
  items,
  cart,
  onAddToCart,
  onUpdateCartQuantity,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        item.description.toLowerCase().includes(q) ||
        item.ingredients.some((ing) => ing.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Get current quantity in cart
  const getItemQuantity = (itemId: string) => {
    const found = cart.find((c) => c.item.id === itemId);
    return found ? found.quantity : 0;
  };

  return (
    <section id="menu-section" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Title and Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#C87D55] mb-2">
            <span className="w-8 h-[2px] bg-[#C87D55]"></span>
            <span>طعم‌های اختصاصی رابیا</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#FDFBF7]">
            منوی اصیل کافه رابیا
          </h2>
          <p className="text-sm text-[#A8988C] mt-1 font-light">
            کلیه نوشیدنی‌ها و دسرها با تازه‌ترین مواد اولیه روز آماده و سرو می‌شوند
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام یا مواد اولیه..."
            className="w-full bg-[#1F1A18] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm text-[#FDFBF7] placeholder-[#7F6F65] focus:outline-none transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-[#A8988C] absolute right-3.5 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-xs text-[#A8988C] hover:text-white"
            >
              پاک کردن
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 shrink-0 ${
                isSelected
                  ? 'copper-gradient text-white shadow-lg shadow-[#C87D55]/30 scale-105'
                  : 'bg-[#1D1815] text-[#C4B3A5] hover:bg-[#28211E] hover:text-[#FDFBF7] border border-[#C87D55]/20'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="py-16 text-center bg-[#1B1614] rounded-3xl border border-[#C87D55]/20 p-8">
          <Coffee className="w-12 h-12 text-[#C87D55]/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#FDFBF7]">موردی یافت نشد</h3>
          <p className="text-xs text-[#A8988C] mt-1 max-w-sm mx-auto">
            هیچ آیتمی با مشخصات یا جستجوی شما پیدا نشد. لطفاً دسته‌بندی دیگری را انتخاب کنید.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#241E1B] border border-[#C87D55]/40 text-xs font-bold text-[#E0946B] hover:bg-[#2C2420]"
          >
            نمایش تمام منو
          </button>
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {filteredItems.map((item) => {
          const qty = getItemQuantity(item.id);
          const isOutOfStock = !parseIsAvailable(item.isAvailable);

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl bg-gradient-to-b from-[#1C1714] to-[#161210] border transition-all duration-300 flex flex-col min-[380px]:flex-row items-center min-[380px]:items-stretch p-3.5 sm:p-4 gap-3.5 sm:gap-4 overflow-hidden group shadow-lg ${
                isOutOfStock
                  ? 'border-rose-900/40 opacity-85'
                  : 'border-[#C87D55]/20 hover:border-[#C87D55]/60 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#C87D55]/10'
              }`}
            >
              {/* 128x128 Item Image Container with Badges */}
              <div className="relative w-[128px] h-[128px] min-w-[128px] min-h-[128px] max-w-[128px] max-h-[128px] rounded-2xl overflow-hidden bg-[#241E1B] shrink-0 border border-[#C87D55]/25 shadow-md group-hover:border-[#C87D55]/60 transition-colors">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  width={128}
                  height={128}
                  className={`w-[128px] h-[128px] object-cover transition-transform duration-500 ${
                    isOutOfStock ? 'grayscale contrast-75 brightness-75' : 'group-hover:scale-105'
                  }`}
                />

                {/* Badges on Image */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 pointer-events-none">
                  {item.isFeatured && (
                    <span className="px-2 py-0.5 rounded-full bg-[#C87D55]/95 text-white text-[9px] font-black backdrop-blur-sm shadow-md">
                      ویژه
                    </span>
                  )}
                </div>

                {/* Out of Stock Overlay on Image */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center pointer-events-none rounded-2xl">
                    <div className="px-2 py-1 rounded-lg bg-rose-600/95 text-white font-black text-[10px] shadow-xl flex items-center gap-1 border border-rose-400">
                      <AlertCircle className="w-3 h-3 text-white shrink-0" />
                      <span>اتمام موجودی</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Details & Actions */}
              <div className="flex-1 min-w-0 flex flex-col justify-between w-full">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-[#FDFBF7] group-hover:text-[#F5D3C1] transition-colors line-clamp-1">
                        {item.name}
                      </h3>
                      {item.nameEn && (
                        <p className="text-[10px] text-[#A8988C]/80 font-light truncate">
                          {item.nameEn}
                        </p>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-sm sm:text-base font-black text-[#E0946B]">
                        {item.price.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-[9px] text-[#A8988C] mr-1">تومان</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#B8A698] font-light line-clamp-2 leading-relaxed mb-2">
                    {item.description}
                  </p>

                  {/* Ingredients Chips */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.ingredients.slice(0, 3).map((ing, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#241E1B] text-[#D8C7B8] border border-[#C87D55]/20"
                        >
                          {ing}
                        </span>
                      ))}
                      {item.ingredients.length > 3 && (
                        <span className="text-[9px] px-1 py-0.5 text-[#A8988C]">
                          +{item.ingredients.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Area */}
                <div className="mt-1 pt-1 border-t border-[#C87D55]/10">
                  {isOutOfStock ? (
                    <div className="w-full py-1.5 px-2 rounded-xl bg-rose-950/40 text-rose-300 text-[11px] font-bold text-center flex items-center justify-center gap-1.5 border border-rose-800/60 shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>اتمام موجودی</span>
                    </div>
                  ) : qty > 0 ? (
                    <div className="flex items-center justify-between bg-[#241E1B] border border-[#C87D55]/40 rounded-xl p-1">
                      <button
                        onClick={() => onUpdateCartQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg copper-gradient text-white flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-black text-[#FDFBF7] px-2">
                        {qty} عدد
                      </span>
                      <button
                        onClick={() => onUpdateCartQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-[#2F2723] text-[#E0946B] hover:bg-[#3D322D] flex items-center justify-center font-bold transition-all cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddToCart(item)}
                      className="w-full py-2 px-3 rounded-xl bg-[#241E1B] hover:bg-gradient-to-r hover:from-[#C87D55] hover:to-[#A85B35] text-[#FDFBF7] hover:text-white border border-[#C87D55]/30 hover:border-transparent text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E0946B] group-hover:text-white" />
                      <span>افزودن به سبد سفارش</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
