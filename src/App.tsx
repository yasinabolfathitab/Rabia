import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { MenuSection } from './components/MenuSection';
import { CartDrawer } from './components/CartDrawer';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { CreditInfoModal } from './components/CreditInfoModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { Footer } from './components/Footer';

import { User, MenuItem, CartItem, Order } from './types';
import { getMenuItems, getUsers, subscribeRealtime, initSupabaseRealtimeSync, parseIsAvailable } from './lib/database';
import { ShoppingBag, ArrowUp } from 'lucide-react';

export default function App() {
  // Current authenticated user (persisted in session/localStorage)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('rabia_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id !== 'user-approved-1' && parsed.id !== 'user-pending-1') {
          return parsed;
        }
        localStorage.removeItem('rabia_active_user');
      }
      return null;
    } catch {
      return null;
    }
  });

  // Menu items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>(getMenuItems());

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('rabia_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCreditInfoOpen, setIsCreditInfoOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string | undefined>(undefined);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleOpenTracking = (orderNumber?: string) => {
    setTrackingOrderNumber(orderNumber);
    setIsTrackingOpen(true);
  };

  // Monitor scroll position to show/hide the back to top button
  useEffect(() => {
    const checkScrollPosition = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', checkScrollPosition, { passive: true });
    checkScrollPosition();

    return () => {
      window.removeEventListener('scroll', checkScrollPosition);
    };
  }, []);

  // Smooth scroll to top handler
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Initialize Supabase realtime synchronization on mount
  useEffect(() => {
    initSupabaseRealtimeSync();
  }, []);

  // Save cart changes
  useEffect(() => {
    localStorage.setItem('rabia_cart', JSON.stringify(cart));
  }, [cart]);

  // Save active user changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rabia_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('rabia_active_user');
    }
  }, [currentUser]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      // If menu updated
      if (event.type === 'menu_updated') {
        setMenuItems(getMenuItems());
      }

      // If user status or credit updated, refresh current user
      if (
        currentUser && 
        (event.type === 'credit_updated' || 
         event.type === 'user_updated' || 
         event.type === 'user_status_changed')
      ) {
        const users = getUsers();
        const updated = users.find((u) => u.id === currentUser.id);
        if (updated) {
          setCurrentUser(updated);
        }
      }

      // If an order status changed, update order success modal if viewing it
      if (event.type === 'order_status_updated' && successOrder) {
        if (event.payload?.id === successOrder.id) {
          setSuccessOrder(event.payload);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, successOrder]);

  // Cart operations
  const handleAddToCart = (item: MenuItem) => {
    if (!parseIsAvailable(item.isAvailable)) {
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (itemId: string, delta: number) => {
    if (delta > 0) {
      const currentItem = menuItems.find((i) => i.id === itemId);
      if (currentItem && !parseIsAvailable(currentItem.isAvailable)) {
        return;
      }
    }
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQ = c.quantity + delta;
            return newQ > 0 ? { ...c, quantity: newQ } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleScrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPrice = cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#12100E] text-[#FDFBF7] flex flex-col selection:bg-[#C87D55] selection:text-white">
      {/* Header */}
      <Header
        user={currentUser}
        cartCount={cartTotalItems}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onOpenMenu={handleScrollToMenu}
        onOpenTracking={() => handleOpenTracking()}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {/* Hero Banner */}
        <HeroBanner
          onScrollToMenu={handleScrollToMenu}
          onOpenCreditInfo={() => setIsCreditInfoOpen(true)}
        />

        {/* Menu Section */}
        <MenuSection
          items={menuItems}
          cart={cart}
          onAddToCart={handleAddToCart}
          onUpdateCartQuantity={handleUpdateCartQuantity}
        />
      </main>

      {/* Fixed Mobile Cart Button (Bottom-Left, Small & Beautiful) */}
      {cartTotalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-5 left-4 z-40 sm:hidden animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="مشاهده سبد خرید"
            className="group relative flex items-center gap-2 py-2 px-3 rounded-full bg-[#181310]/95 backdrop-blur-md border border-[#C87D55]/60 hover:border-[#E0946B] shadow-2xl shadow-black text-[#FDFBF7] active:scale-95 transition-all duration-200 ring-1 ring-[#C87D55]/30"
          >
            {/* Ambient copper pulse */}
            <span className="absolute -inset-0.5 rounded-full bg-[#C87D55]/25 blur-sm pointer-events-none animate-pulse"></span>

            {/* Shopping bag icon with badge */}
            <div className="relative w-8 h-8 rounded-full copper-gradient flex items-center justify-center text-white shadow-md shrink-0">
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FDFBF7] text-[#944B26] text-[10px] font-black flex items-center justify-center shadow-md">
                {cartTotalItems}
              </span>
            </div>

            {/* Title & Price */}
            <div className="flex flex-col text-right leading-tight pr-0.5">
              <span className="text-[11px] font-black text-[#FDFBF7]">سبد خرید</span>
              <span className="text-[10px] font-bold text-[#E0946B]">
                {cartTotalPrice.toLocaleString('en-US')} ت
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Smooth Scroll To Top Button */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="بازگشت به بالای صفحه"
        title="بازگشت به بالای صفحه"
        className={`fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#181310]/95 hover:bg-[#251D18] backdrop-blur-md border border-[#C87D55]/60 hover:border-[#E0946B] text-[#E0946B] hover:text-[#FDFBF7] shadow-2xl shadow-black/80 flex items-center justify-center transition-all duration-300 ring-1 ring-[#C87D55]/30 group active:scale-90 hover:scale-105 ${
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        <span className="absolute -inset-0.5 rounded-full bg-[#C87D55]/20 blur-sm pointer-events-none group-hover:bg-[#C87D55]/40 transition-colors"></span>
        <ArrowUp className="w-5 h-5 relative z-10 transition-transform duration-200 group-hover:-translate-y-0.5" />
      </button>

      {/* Footer strictly referencing designer and telegram */}
      <Footer
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onOpenCreditModal={() => setIsCreditInfoOpen(true)}
        onOpenTracking={() => handleOpenTracking()}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        user={currentUser}
        onUpdateCartQuantity={handleUpdateCartQuantity}
        onClearCart={handleClearCart}
        onOpenAuth={() => {
          setIsCartOpen(false);
          setIsAuthOpen(true);
        }}
        onOrderSuccess={(order) => {
          setSuccessOrder(order);
        }}
      />

      {/* Order Success & Tracking Modal */}
      <OrderSuccessModal
        order={successOrder}
        onClose={() => setSuccessOrder(null)}
        onTrackOrder={(orderNumber) => handleOpenTracking(orderNumber)}
      />

      {/* Live Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => {
          setIsTrackingOpen(false);
          setTrackingOrderNumber(undefined);
        }}
        initialOrderNumber={trackingOrderNumber}
        currentUser={currentUser}
        onOpenMenu={handleScrollToMenu}
      />

      {/* Auth Modal (Login / Register with Admin Approval message) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* User Profile Modal (Edit address & Rabia Balance) */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onUpdateUser={(u) => setCurrentUser(u)}
        onLogout={() => setCurrentUser(null)}
        onOpenCart={() => {
          setIsProfileOpen(false);
          setIsCartOpen(true);
        }}
        onOpenTracking={(orderNumber) => handleOpenTracking(orderNumber)}
      />

      {/* Admin Login Modal (password: 12345678, no hint) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          setIsAdminLoginOpen(false);
          setIsAdminOpen(true);
        }}
      />

      {/* Full Admin Panel */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          setMenuItems(getMenuItems());
        }}
        onMenuUpdated={() => {
          setMenuItems(getMenuItems());
        }}
      />

      {/* Credit System Information Modal */}
      <CreditInfoModal
        isOpen={isCreditInfoOpen}
        onClose={() => setIsCreditInfoOpen(false)}
        onOpenAuth={() => {
          setIsCreditInfoOpen(false);
          setIsAuthOpen(true);
        }}
      />
    </div>
  );
}
