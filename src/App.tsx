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
import { Footer } from './components/Footer';

import { User, MenuItem, CartItem, Order } from './types';
import { getMenuItems, getUsers, subscribeRealtime } from './lib/database';
import { ShoppingBag, ArrowUp } from 'lucide-react';

export default function App() {
  // Current authenticated user (persisted in session/localStorage)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('rabia_active_user');
      if (saved) return JSON.parse(saved);
      // Default to demo approved user for immediate rich testing
      const users = getUsers();
      const approved = users.find((u) => u.status === 'approved');
      return approved || null;
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
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

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
      if (currentUser && (event.type === 'credit_updated' || event.type === 'user_updated' || event.type === 'user_status_changed')) {
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

      {/* Sticky Mobile Cart Bar */}
      {cartTotalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 z-30 sm:hidden animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl copper-gradient text-white font-black text-sm flex items-center justify-between shadow-2xl shadow-black/80 border border-[#F5D3C1]/30"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-black">
                {cartTotalItems}
              </span>
              <span>مشاهده سبد و ثبت سفارش</span>
            </div>
            <div className="text-left font-black">
              {cartTotalPrice.toLocaleString('fa-IR')} تومان
            </div>
          </button>
        </div>
      )}

      {/* Footer strictly referencing designer and telegram */}
      <Footer
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onOpenCreditModal={() => setIsCreditInfoOpen(true)}
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
        onClose={() => setIsAdminOpen(false)}
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
