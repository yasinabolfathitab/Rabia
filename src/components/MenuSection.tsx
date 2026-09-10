import React, { useState, useMemo } from 'react';
import { MenuItem, MenuCategory, CartItem } from '../types';
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
  { id: 'hot_coffee', label: 'قهوه گرم', icon: <Coffee className="w-4 h-4" /> },
  { id: 'cold_coffee', label: 'قهوه سرد', icon: <CupSoda className="w-4 h-4" /> },
  { id: 'cold_drinks', label: 'نوشیدنی‌های سرد', icon: <GlassWater className="w-4 h-4" /> },
  { id: 'special_mocktails', label: 'ماکتیل‌های ویژه', icon: <GlassWater className="w-4 h-4" /> },
  { id: 'cakes_desserts', label: 'کیک و دسر', icon: <Cake className="w-4 h-4" /> },
  { id: 'breakfast_snacks', label: 'صبحانه و میان‌وعده', icon: <Utensils className="w-4 h-4" /> },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const qty = getItemQuantity(item.id);
          const isOutOfStock = !item.isAvailable;

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl bg-gradient-to-b from-[#1C1714] to-[#161210] border transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-lg ${
                isOutOfStock
                  ? 'border-neutral-800 opacity-80'
                  : 'border-[#C87D55]/20 hover:border-[#C87D55]/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#C87D55]/10'
              }`}
            >
              <div>
                {/* Item Image with Overlay */}
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-[#241E1B]">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      isOutOfStock ? 'grayscale' : 'group-hover:scale-105'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#161210] via-transparent to-transparent"></div>

                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                    {item.isFeatured && (
                      <span className="px-2.5 py-1 rounded-full bg-[#C87D55]/90 text-white text-[10px] font-black backdrop-blur-sm shadow-md">
                        پیشنهاد باریستا
                      </span>
                    )}
                    {isOutOfStock && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-950/90 text-rose-300 border border-rose-800 text-[10px] font-bold backdrop-blur-sm">
                        اتمام موجودی
                      </span>
                    )}
                  </div>

                  {/* English Name if available */}
                  {item.nameEn && (
                    <div className="absolute bottom-2 right-3 text-[10px] font-light text-[#C4B3A5]/80 tracking-wider">
                      {item.nameEn}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-black text-[#FDFBF7] group-hover:text-[#F5D3C1] transition-colors">
                      {item.name}
                    </h3>
                    <div className="text-left shrink-0">
                      <span className="text-base sm:text-lg font-black text-[#E0946B]">
                        {item.price.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#B8A698] font-light line-clamp-2 leading-relaxed mb-3">
                    {item.description}
                  </p>

                  {/* Ingredients chips */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {item.ingredients.map((ing, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-[#241E1B] text-[#D8C7B8] border border-[#C87D55]/20"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="p-4 sm:p-5 pt-0 mt-auto">
                {isOutOfStock ? (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-[#201A18] text-[#8C7B71] text-xs font-semibold text-center flex items-center justify-center gap-1.5 border border-neutral-800">
                    <AlertCircle className="w-4 h-4 text-[#8C7B71]" />
                    <span>در حال حاضر موجود نیست</span>
                  </div>
                ) : qty > 0 ? (
                  <div className="flex items-center justify-between bg-[#241E1B] border border-[#C87D55]/40 rounded-xl p-1.5">
                    <button
                      onClick={() => onUpdateCartQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-lg copper-gradient text-white flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-black text-[#FDFBF7] px-3">
                      {qty} عدد
                    </span>
                    <button
                      onClick={() => onUpdateCartQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-[#2F2723] text-[#E0946B] hover:bg-[#3D322D] flex items-center justify-center font-bold transition-all"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAddToCart(item)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#241E1B] hover:bg-gradient-to-r hover:from-[#C87D55] hover:to-[#A85B35] text-[#FDFBF7] hover:text-white border border-[#C87D55]/30 hover:border-transparent text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-[#E0946B] group-hover:text-white" />
                    <span>افزودن به سبد سفارش</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
