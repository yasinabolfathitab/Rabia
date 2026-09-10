import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Users, 
  Wallet, 
  Coffee, 
  BarChart3, 
  Database, 
  LogOut, 
  Plus, 
  Search, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  MapPin, 
  Utensils, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Copy, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  Download,
  FileJson,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts';
import { 
  MenuItem, 
  Order, 
  User, 
  OrderStatus, 
  MenuCategory,
  CreditTransaction 
} from '../types';
import { 
  getOrders, 
  updateOrderStatus, 
  getUsers, 
  approveUser, 
  adjustUserCredit, 
  getMenuItems, 
  saveMenuItem, 
  toggleMenuItemStock, 
  deleteMenuItem,
  getCafeStats,
  getChartData,
  exportOrdersToExcelCSV,
  subscribeRealtime,
  createOrder,
  initSupabaseRealtimeSync,
  syncAllWithSupabase,
  exportFullDatabaseBackup,
  importFullDatabaseBackup
} from '../lib/database';
import { getSupabaseConfig, saveSupabaseConfig, SUPABASE_SQL_SCHEMA, getSupabaseClient, testSupabaseConnection, isValidSupabaseUrl } from '../lib/supabase';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'credit' | 'menu' | 'reports' | 'database_settings'>('orders');

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState(getCafeStats());
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus>('all');

  // Credit Tab states
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [chargeNote, setChargeNote] = useState<string>('شارژ کارت‌خوان صندوق رابیا');
  const [deductAmount, setDeductAmount] = useState<string>('');
  const [deductNote, setDeductNote] = useState<string>('سفارش حضوری در کافه');
  const [creditFeedback, setCreditFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Menu Management Modal states
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({
    name: '',
    nameEn: '',
    category: 'hot_coffee',
    price: 90000,
    description: '',
    ingredients: [],
    image: '',
    isAvailable: true,
  });
  const [ingredientsText, setIngredientsText] = useState('');

  // Reports states
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [chartData, setChartData] = useState(getChartData('daily'));

  // Supabase states
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [sbSavedMsg, setSbSavedMsg] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [isTestingSb, setIsTestingSb] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [sbStatus, setSbStatus] = useState<{ success: boolean; message: string; tablesFound?: boolean } | null>(null);

  // Database Settings Separate Password Protection (PIN: 4415)
  const [isDbUnlocked, setIsDbUnlocked] = useState(false);
  const [dbPinInput, setDbPinInput] = useState('');
  const [dbPinError, setDbPinError] = useState('');

  // Database Import/Export Backup states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultMsg, setImportResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Refresh all data
  const refreshData = () => {
    setOrders(getOrders());
    setUsers(getUsers());
    setMenuItems(getMenuItems());
    setStats(getCafeStats());
    setChartData(getChartData(reportPeriod));
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();

      // Load Supabase config & check connection status
      const conf = getSupabaseConfig();
      setSbUrl(conf.url);
      setSbKey(conf.key);

      if (conf.url && conf.key && isValidSupabaseUrl(conf.url)) {
        testSupabaseConnection(conf.url, conf.key).then((res) => {
          setSbStatus(res);
          if (res.success) {
            initSupabaseRealtimeSync();
            syncAllWithSupabase().then(() => refreshData());
          }
        });
      } else {
        setSbStatus(null);
      }

      // Subscribe to real-time events
      const unsubscribe = subscribeRealtime((event) => {
        refreshData();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, reportPeriod]);

  if (!isOpen) return null;

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const approvedUsers = users.filter((u) => u.status === 'approved');

  // Handle User Approval
  const handleApproveUser = (userId: string, approve: boolean) => {
    approveUser(userId, approve);
    refreshData();
  };

  // Handle Credit Search
  const handleSearchCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setCreditFeedback(null);
    const clean = searchPhone.trim().replace(/^(\+98|0098)/, '0');
    const found = users.find((u) => u.phone.includes(clean) || clean.includes(u.phone));
    if (found) {
      setSelectedUser(found);
    } else {
      setSelectedUser(null);
      setCreditFeedback({ success: false, message: 'کاربری با این شماره تلفن پیدا نشد.' });
    }
  };

  // Charge Credit
  const handleChargeCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const num = parseInt(chargeAmount, 10);
    if (isNaN(num) || num <= 0) {
      setCreditFeedback({ success: false, message: 'لطفاً مبلغ معتبری وارد کنید.' });
      return;
    }

    const res = adjustUserCredit(selectedUser.id, num, 'admin_charge', chargeNote);
    setCreditFeedback(res);
    if (res.success) {
      setChargeAmount('');
      const updated = getUsers().find((u) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
      refreshData();
    }
  };

  // In-Person Order & Deduct Credit
  const handleDeductCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const num = parseInt(deductAmount, 10);
    if (isNaN(num) || num <= 0) {
      setCreditFeedback({ success: false, message: 'لطفاً مبلغ معتبری وارد کنید.' });
      return;
    }

    if (selectedUser.rabiaCredit < num) {
      setCreditFeedback({
        success: false,
        message: `اعتبار کاربر (${selectedUser.rabiaCredit.toLocaleString('fa-IR')} تومان) کمتر از این مبلغ است!`,
      });
      return;
    }

    // Deduct credit
    const res = adjustUserCredit(selectedUser.id, -num, 'in_person_order', deductNote);
    
    // Also record order in orders table
    createOrder({
      userId: selectedUser.id,
      userName: selectedUser.name,
      userPhone: selectedUser.phone,
      orderType: 'dine_in',
      tableNumber: 'سفارش حضوری در کانتر',
      items: [{ itemId: 'in-person', name: deductNote || 'سفارش حضوری کافه', price: num, quantity: 1 }],
      totalAmount: num,
      paymentMethod: 'rabia_credit',
      notes: 'ثبت شده توسط مدیریت در صندوق',
    });

    setCreditFeedback(res);
    if (res.success) {
      setDeductAmount('');
      const updated = getUsers().find((u) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
      refreshData();
    }
  };

  // Handle Menu Save
  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem.name || !editingItem.price) return;

    const ingArray = ingredientsText
      .split('،')
      .map((s) => s.trim())
      .filter(Boolean);

    const itemToSave: MenuItem = {
      id: editingItem.id || 'item-' + Date.now(),
      name: editingItem.name,
      nameEn: editingItem.nameEn || '',
      category: editingItem.category || 'hot_coffee',
      price: Number(editingItem.price),
      description: editingItem.description || '',
      ingredients: ingArray.length > 0 ? ingArray : editingItem.ingredients || [],
      image: editingItem.image || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
      isAvailable: editingItem.isAvailable !== false,
      isFeatured: editingItem.isFeatured || false,
    };

    saveMenuItem(itemToSave);
    setIsEditingItem(false);
    refreshData();
  };

  // Handle local image file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setEditingItem((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Supabase Save & Test
  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) {
      setSbSavedMsg('لطفاً هم Project URL و هم Anon Key را وارد نمایید.');
      return;
    }

    setIsTestingSb(true);
    setSbSavedMsg('در حال برقراری ارتباط با سرورهای سوپابیس...');
    saveSupabaseConfig(sbUrl, sbKey);

    const testRes = await testSupabaseConnection(sbUrl, sbKey);
    setSbStatus(testRes);
    setIsTestingSb(false);

    if (testRes.success) {
      setSbSavedMsg(testRes.message);
      await initSupabaseRealtimeSync();
      await syncAllWithSupabase();
      refreshData();
    } else {
      setSbSavedMsg(testRes.message);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    await syncAllWithSupabase();
    refreshData();
    setTimeout(() => setIsSyncingNow(false), 600);
  };

  // Database Settings Separate PIN (4415) Verification
  const handleVerifyDbPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (dbPinInput.trim() === '4415') {
      setIsDbUnlocked(true);
      setDbPinError('');
      setDbPinInput('');
    } else {
      setDbPinError('رمز عبور وارد شده اشتباه است. دسترسی به تنظیمات دیتابیس مجاز نیست.');
      setDbPinInput('');
    }
  };

  // Export Full Database Backup (JSON)
  const handleExportBackup = () => {
    setIsExporting(true);
    try {
      exportFullDatabaseBackup();
      setImportResultMsg({ success: true, text: 'فایل پشتیبان کامل دیتابیس (JSON) با موفقیت دانلود شد.' });
    } catch (err: any) {
      setImportResultMsg({ success: false, text: `خطا در دریافت فایل پشتیبان: ${err?.message || err}` });
    } finally {
      setTimeout(() => setIsExporting(false), 600);
    }
  };

  // Import Full Database Backup (JSON)
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResultMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importFullDatabaseBackup(text, importMode);
        setImportResultMsg({ success: res.success, text: res.message });
        if (res.success) {
          refreshData();
        }
      } catch (err: any) {
        setImportResultMsg({ success: false, text: `خطا در خواندن فایل: ${err?.message || err}` });
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setImportResultMsg({ success: false, text: 'خطا در بارگذاری فایل از سیستم.' });
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex bg-black/85 backdrop-blur-md">
      <div className="w-full h-full flex flex-col bg-[#14100E] text-[#FDFBF7]">
        {/* Admin Header */}
        <div className="h-14 sm:h-16 px-3 sm:px-6 bg-[#1A1513] border-b border-[#C87D55]/30 flex items-center justify-between gap-2 shrink-0">
          {/* Brand & Panel Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl copper-gradient flex items-center justify-center text-white font-black text-sm sm:text-base shrink-0 shadow-md">
              R
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-[#FDFBF7] flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="sm:hidden">پنل مدیریت</span>
                <span className="hidden sm:inline">پنل اختصاصی مدیریت کافه رابیا</span>
                <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-[#C87D55]/20 text-[#E0946B] border border-[#C87D55]/30 shrink-0">
                  REAL-TIME
                </span>
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Supabase Status Indicator in Header */}
            {sbStatus?.success ? (
              <button
                onClick={() => setActiveTab('database_settings')}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-950 transition-all shrink-0"
                title="اتصال با دیتابیس برقرار است و سفارشات آنلاین به صورت زنده هماهنگ هستند"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="hidden sm:inline">دیتابیس:</span>
                <span>آنلاین</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('database_settings')}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-700/40 text-amber-300 text-[11px] sm:text-xs font-bold hover:bg-amber-950/70 transition-all shrink-0"
                title="تنظیمات دیتابیس"
              >
                <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">تنظیمات دیتابیس</span>
                <span className="sm:hidden">دیتابیس</span>
              </button>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncingNow}
              title="همگام‌سازی فوری داده‌ها با سرور"
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#241E1B] hover:bg-[#2F2723] border border-[#C87D55]/30 text-[#E5D7CD] hover:text-white text-xs font-medium transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E0946B] ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">سینک داده‌ها</span>
            </button>

            {/* Exit button */}
            <button
              onClick={onClose}
              title="خروج از پنل مدیریت"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/40 text-rose-300 text-xs font-semibold transition-all shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">خروج از پنل</span>
              <span className="sm:hidden">خروج</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Smooth Responsive Horizontal Scroll) */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-6 bg-[#181311] border-b border-[#C87D55]/20 overflow-x-auto scrollbar-none py-2 shrink-0">
          {[
            { 
              id: 'orders', 
              label: 'سفارش‌های آنلاین', 
              mobileLabel: 'سفارش‌ها',
              icon: <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, 
              badge: orders.filter(o => o.status === 'pending').length 
            },
            { 
              id: 'users', 
              label: 'تایید و لیست مشتریان', 
              mobileLabel: 'مشتریان',
              icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, 
              badge: pendingUsers.length 
            },
            { 
              id: 'credit', 
              label: 'شارژ اعتبار و سفارش حضوری', 
              mobileLabel: 'شارژ اعتبار',
              icon: <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            },
            { 
              id: 'menu', 
              label: 'مدیریت آیتم‌های منو', 
              mobileLabel: 'منوی کافه',
              icon: <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            },
            { 
              id: 'reports', 
              label: 'گزارش‌ها و خروجی اکسل', 
              mobileLabel: 'گزارش‌ها',
              icon: <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            },
            { 
              id: 'database_settings', 
              label: 'تنظیمات دیتابیس', 
              mobileLabel: 'دیتابیس',
              icon: isDbUnlocked ? <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C87D55]" /> 
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'copper-gradient text-white shadow-md'
                    : 'text-[#A8988C] hover:text-white hover:bg-[#241E1B]'
                }`}
              >
                {tab.icon}
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* TAB 1: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              {/* Order Status Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'همه سفارش‌ها' },
                    { id: 'pending', label: 'در انتظار باریستا' },
                    { id: 'preparing', label: 'در حال آماده‌سازی' },
                    { id: 'ready', label: 'آماده تحویل' },
                    { id: 'delivered', label: 'تحویل شده' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setOrderFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        orderFilter === f.id
                          ? 'bg-[#C87D55] text-white shadow-md'
                          : 'bg-[#201A17] text-[#A8988C] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] sm:text-xs text-[#A8988C]">
                  نمایش {filteredOrders.length} سفارش لحظه‌ای
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-16 bg-[#181311] rounded-2xl border border-[#C87D55]/20">
                  <ShoppingBag className="w-12 h-12 text-[#C87D55]/30 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#FDFBF7]">هیچ سفارشی در این وضعیت وجود ندارد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 p-4 space-y-3 shadow-lg flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-[#C87D55]/15">
                          <div>
                            <span className="text-base font-black text-[#E0946B]">{ord.orderNumber}</span>
                            <span className="text-[11px] text-[#A8988C] block">
                              {new Date(ord.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="text-left">
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                                ord.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                  : ord.status === 'preparing'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : ord.status === 'ready'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {ord.status === 'pending' && 'در انتظار تایید'}
                              {ord.status === 'preparing' && 'در حال آماده‌سازی'}
                              {ord.status === 'ready' && 'آماده تحویل/سرو'}
                              {ord.status === 'delivered' && 'تکمیل شده'}
                              {ord.status === 'cancelled' && 'لغو شده'}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Location */}
                        <div className="text-xs text-[#D8C7B8] space-y-1">
                          <div className="flex items-center justify-between font-bold text-[#FDFBF7]">
                            <span>{ord.userName}</span>
                            <span dir="ltr" className="text-[11px] text-[#A8988C]">{ord.userPhone}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-[#E0946B]">
                            {ord.orderType === 'takeaway' ? (
                              <>
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>بیرون‌بر: {ord.address || 'بدون آدرس'}</span>
                              </>
                            ) : (
                              <>
                                <Utensils className="w-3.5 h-3.5 shrink-0" />
                                <span>سرو در سالن: {ord.tableNumber || 'میز سالن'}</span>
                              </>
                            )}
                          </div>

                          {ord.notes && (
                            <div className="text-[11px] text-amber-200/90 bg-[#251D19] p-1.5 rounded-lg">
                              یادداشت: {ord.notes}
                            </div>
                          )}
                        </div>

                        {/* Items List */}
                        <div className="p-2 rounded-xl bg-[#221B18] border border-[#C87D55]/15 space-y-1">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-[#FDFBF7]">
                              <span>{it.name} × {it.quantity}</span>
                              <span className="text-[#E0946B]">{(it.price * it.quantity).toLocaleString('fa-IR')} ت</span>
                            </div>
                          ))}
                          <div className="pt-1.5 border-t border-[#C87D55]/15 flex justify-between text-xs font-black text-white">
                            <span>مبلغ کل:</span>
                            <span className="text-[#E0946B]">{ord.totalAmount.toLocaleString('fa-IR')} تومان</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-[#A8988C]">
                          روش پرداخت: {ord.paymentMethod === 'rabia_credit' ? 'اعتبار حساب رابیا' : 'کارت‌کشیدن حضوری در صندوق'}
                        </div>
                      </div>

                      {/* Status Update Buttons */}
                      <div className="pt-2 border-t border-[#C87D55]/15 flex items-center gap-1.5">
                        {ord.status === 'pending' && (
                          <button
                            onClick={() => {
                              updateOrderStatus(ord.id, 'preparing');
                              refreshData();
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all"
                          >
                            تایید و شروع آماده‌سازی
                          </button>
                        )}

                        {ord.status === 'preparing' && (
                          <button
                            onClick={() => {
                              updateOrderStatus(ord.id, 'ready');
                              refreshData();
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                          >
                            آماده شد (اعلام به مشتری)
                          </button>
                        )}

                        {ord.status === 'ready' && (
                          <button
                            onClick={() => {
                              updateOrderStatus(ord.id, 'delivered');
                              refreshData();
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg copper-gradient text-white text-xs font-bold transition-all"
                          >
                            تحویل داده شد
                          </button>
                        )}

                        {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                          <button
                            onClick={() => {
                              updateOrderStatus(ord.id, 'cancelled');
                              refreshData();
                            }}
                            className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-xs transition-all"
                            title="لغو سفارش"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER APPROVALS & USERS LIST */}
          {activeTab === 'users' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Pending Approvals Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#FDFBF7]">
                    درخواست‌های عضویت جدید در انتظار تایید مدیریت ({pendingUsers.length})
                  </h3>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-[#1A1513] border border-[#C87D55]/20 text-xs text-[#A8988C] text-center">
                    هیچ درخواست ثبت‌نامی در انتظار تایید وجود ندارد.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 rounded-2xl bg-[#201A17] border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[#FDFBF7]">{u.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              در انتظار تایید
                            </span>
                          </div>
                          <div className="text-xs text-[#A8988C] mt-1" dir="ltr">
                            شماره تماس: <strong className="text-[#FDFBF7]">{u.phone}</strong>
                          </div>
                          {u.address && (
                            <div className="text-xs text-[#D8C7B8] mt-1">
                              آدرس: {u.address}
                            </div>
                          )}
                          <div className="text-[10px] text-[#7F6F65] mt-1">
                            تاریخ درخواست: {new Date(u.createdAt).toLocaleString('fa-IR')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveUser(u.id, true)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                          >
                            <Check className="w-4 h-4" />
                            <span>تایید و فعال‌سازی حساب</span>
                          </button>
                          <button
                            onClick={() => handleApproveUser(u.id, false)}
                            className="px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <X className="w-4 h-4" />
                            <span>رد</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved Customers Directory */}
              <div className="space-y-3 pt-4 border-t border-[#C87D55]/20">
                <h3 className="text-base font-black text-[#FDFBF7]">
                  مشتریان تایید شده کافه رابیا ({approvedUsers.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {approvedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#FDFBF7]">{u.name}</span>
                        <span className="text-xs font-black text-[#E0946B]">
                          اعتبار: {u.rabiaCredit.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                      <div className="text-xs text-[#A8988C]" dir="ltr">
                        {u.phone}
                      </div>
                      {u.address && (
                        <div className="text-[11px] text-[#B8A698] truncate">
                          آدرس: {u.address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RABIA CREDIT & IN-PERSON ORDERS */}
          {activeTab === 'credit' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="p-4 rounded-2xl bg-[#1A1513] border border-[#C87D55]/30">
                <h3 className="text-base font-black text-[#FDFBF7] mb-1">
                  سیستم مدیریت اعتبار مشتریان و سفارشات حضوری
                </h3>
                <p className="text-xs text-[#A8988C] font-light leading-relaxed">
                  هنگامی که مشتری در کافه کارت می‌کشد، می‌توانید با سرچ شماره او هر مبلغی اعتبار به او اختصاص دهید.
                  همچنین برای سفارشات حضوری می‌توانید از اعتبار مشتری کسر کنید.
                </p>

                {/* Search Customer Input */}
                <form onSubmit={handleSearchCustomer} className="flex gap-2 mt-4">
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      dir="ltr"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      placeholder="شماره تماس مشتری (مثلاً 09120001122)..."
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl py-2.5 px-4 text-xs sm:text-sm text-[#FDFBF7] focus:outline-none"
                    />
                    <Search className="w-4 h-4 text-[#A8988C] absolute right-3 top-3" />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl copper-gradient text-white font-bold text-xs sm:text-sm shadow-md transition-all shrink-0"
                  >
                    جستجوی مشتری
                  </button>
                </form>
              </div>

              {creditFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    creditFeedback.success
                      ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-800 text-rose-300'
                  }`}
                >
                  {creditFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{creditFeedback.message}</span>
                </div>
              )}

              {/* Customer Selected Card */}
              {selectedUser && (
                <div className="p-5 rounded-2xl bg-[#201A17] border border-[#C87D55]/40 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#C87D55]/20">
                    <div>
                      <h4 className="text-lg font-black text-[#FDFBF7]">{selectedUser.name}</h4>
                      <div className="text-xs text-[#A8988C] mt-0.5" dir="ltr">
                        {selectedUser.phone}
                      </div>
                    </div>

                    <div className="text-right sm:text-left bg-[#2A221E] px-4 py-2 rounded-xl border border-[#C87D55]/30">
                      <span className="text-xs text-[#A8988C] block">موجودی فعلی اعتبار رابیا:</span>
                      <span className="text-xl font-black text-[#E0946B]">
                        {selectedUser.rabiaCredit.toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Action 1: Add/Charge Credit */}
                    <form onSubmit={handleChargeCredit} className="p-4 rounded-2xl bg-[#1A1513] border border-emerald-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <Plus className="w-4 h-4" />
                        <span>شارژ و افزایش اعتبار (کارت‌کشیدن مشتری)</span>
                      </div>

                      <div>
                        <label className="text-[11px] text-[#A8988C] block mb-1">مبلغ به تومان:</label>
                        <input
                          type="number"
                          value={chargeAmount}
                          onChange={(e) => setChargeAmount(e.target.value)}
                          placeholder="مثلاً: 200000"
                          className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-emerald-500 rounded-xl p-2 text-xs text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#A8988C] block mb-1">توضیحات تراکنش:</label>
                        <input
                          type="text"
                          value={chargeNote}
                          onChange={(e) => setChargeNote(e.target.value)}
                          className="w-full bg-[#241E1B] border border-[#C87D55]/30 rounded-xl p-2 text-xs text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md"
                      >
                        افزودن اعتبار به حساب کاربر
                      </button>
                    </form>

                    {/* Action 2: Manual In-person Order & Deduct */}
                    <form onSubmit={handleDeductCredit} className="p-4 rounded-2xl bg-[#1A1513] border border-amber-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <Coffee className="w-4 h-4" />
                        <span>ثبت سفارش حضوری و کسر از اعتبار رابیا</span>
                      </div>

                      <div>
                        <label className="text-[11px] text-[#A8988C] block mb-1">مبلغ سفارش به تومان:</label>
                        <input
                          type="number"
                          value={deductAmount}
                          onChange={(e) => setDeductAmount(e.target.value)}
                          placeholder="مثلاً: 145000"
                          className="w-full bg-[#241E1B] border border-[#C87D55]/30 focus:border-amber-500 rounded-xl p-2 text-xs text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#A8988C] block mb-1">شرح اقلام سفارش:</label>
                        <input
                          type="text"
                          value={deductNote}
                          onChange={(e) => setDeductNote(e.target.value)}
                          placeholder="مثلاً: ۲ تا لاته و چیزکیک سن‌سباستین"
                          className="w-full bg-[#241E1B] border border-[#C87D55]/30 rounded-xl p-2 text-xs text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md"
                      >
                        کسر از اعتبار و ثبت سفارش
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MENU ITEMS MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="space-y-5 max-w-6xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-[#FDFBF7]">
                  مدیریت آیتم‌های منوی کافه رابیا ({menuItems.length} آیتم)
                </h3>

                <button
                  onClick={() => {
                    setEditingItem({
                      name: '',
                      nameEn: '',
                      category: 'hot_coffee',
                      price: 90000,
                      description: '',
                      ingredients: [],
                      image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
                      isAvailable: true,
                    });
                    setIngredientsText('');
                    setIsEditingItem(true);
                  }}
                  className="px-4 py-2 rounded-xl copper-gradient text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن آیتم جدید به منو</span>
                </button>
              </div>

              {/* Items Table / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-3.5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20 flex flex-col justify-between gap-3"
                  >
                    <div className="flex gap-3">
                      <img
                        src={it.image}
                        alt={it.name}
                        className="w-16 h-16 rounded-xl object-cover border border-[#C87D55]/30 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-bold text-[#FDFBF7] truncate">
                            {it.name}
                          </h4>
                          <span className="text-xs font-black text-[#E0946B]">
                            {it.price.toLocaleString('fa-IR')} ت
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A8988C] line-clamp-2 mt-1">
                          {it.description}
                        </p>
                      </div>
                    </div>

                    {/* Stock Status Toggle & Edit/Delete */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#C87D55]/15">
                      <button
                        onClick={() => {
                          toggleMenuItemStock(it.id);
                          refreshData();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          it.isAvailable
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
                        }`}
                      >
                        {it.isAvailable ? '✓ موجود در منو' : '✗ اتمام موجودی'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(it);
                            setIngredientsText(it.ingredients ? it.ingredients.join('، ') : '');
                            setIsEditingItem(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#241E1B] text-[#D8C7B8] hover:text-white"
                          title="ویرایش آیتم"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`آیا از حذف آیتم "${it.name}" اطمینان دارید؟`)) {
                              deleteMenuItem(it.id);
                              refreshData();
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:text-rose-200"
                          title="حذف آیتم"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add/Edit Modal */}
              {isEditingItem && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="relative w-full max-w-lg rounded-3xl bg-[#181311] border border-[#C87D55]/40 p-6 space-y-4 shadow-2xl">
                    <button
                      onClick={() => setIsEditingItem(false)}
                      className="absolute left-4 top-4 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <h3 className="text-base font-black text-[#FDFBF7]">
                      {editingItem.id ? 'ویرایش مشخصات آیتم' : 'افزودن آیتم جدید به منو'}
                    </h3>

                    <form onSubmit={handleSaveMenuItem} className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[#A8988C] block mb-1">نام فارسی آیتم:</label>
                          <input
                            type="text"
                            required
                            value={editingItem.name || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[#A8988C] block mb-1">نام انگلیسی (اختیاری):</label>
                          <input
                            type="text"
                            value={editingItem.nameEn || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, nameEn: e.target.value })}
                            className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[#A8988C] block mb-1">دسته‌بندی:</label>
                          <select
                            value={editingItem.category || 'hot_coffee'}
                            onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as MenuCategory })}
                            className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          >
                            <option value="hot_coffee">قهوه گرم</option>
                            <option value="cold_coffee">قهوه سرد</option>
                            <option value="cold_drinks">نوشیدنی‌های سرد</option>
                            <option value="special_mocktails">ماکتیل‌های ویژه</option>
                            <option value="cakes_desserts">کیک و دسر</option>
                            <option value="breakfast_snacks">صبحانه و میان‌وعده</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[#A8988C] block mb-1">قیمت (تومان):</label>
                          <input
                            type="number"
                            required
                            value={editingItem.price || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                            className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[#A8988C] block mb-1">توضیحات و طعم‌یادها:</label>
                        <textarea
                          rows={2}
                          value={editingItem.description || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                          className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[#A8988C] block mb-1">مواد تشکیل‌دهنده (با کاما یا ویرگول جدا کنید):</label>
                        <input
                          type="text"
                          value={ingredientsText}
                          onChange={(e) => setIngredientsText(e.target.value)}
                          placeholder="مثلاً: اسپرسو دوبل، شیر تازه، سیروپ فندق"
                          className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                        />
                      </div>

                      {/* Image URL & Local Upload */}
                      <div className="space-y-2">
                        <label className="text-[#A8988C] block">عکس آیتم (آدرس اینترنتی یا آپلود فایل):</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingItem.image || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                            placeholder="https://..."
                            className="flex-1 bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          />
                          <label className="px-3 py-2 rounded-xl bg-[#2D2420] text-[#E0946B] border border-[#C87D55]/30 cursor-pointer hover:bg-[#3D322B] flex items-center gap-1 shrink-0">
                            <Upload className="w-4 h-4" />
                            <span>آپلود فایل</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>
                        </div>

                        {editingItem.image && (
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#C87D55]/40 mt-1">
                            <img src={editingItem.image} alt="پیش‌نمایش" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingItem.isAvailable !== false}
                            onChange={(e) => setEditingItem({ ...editingItem, isAvailable: e.target.checked })}
                            className="rounded accent-[#C87D55]"
                          />
                          <span className="text-[#FDFBF7]">موجود در منو برای سفارش</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editingItem.isFeatured)}
                            onChange={(e) => setEditingItem({ ...editingItem, isFeatured: e.target.checked })}
                            className="rounded accent-[#C87D55]"
                          />
                          <span className="text-[#FDFBF7]">پیشنهاد باریستا (ویژه)</span>
                        </label>
                      </div>

                      <div className="pt-3 flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 rounded-xl copper-gradient text-white font-bold text-xs shadow-md"
                        >
                          ذخیره آیتم در منو
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingItem(false)}
                          className="px-4 py-2.5 rounded-xl bg-[#241E1B] text-[#A8988C]"
                        >
                          انصراف
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REPORTS, LIVE CHARTS & EXCEL EXPORT */}
          {activeTab === 'reports' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">درآمد امروز:</span>
                  <span className="text-lg sm:text-xl font-black text-[#E0946B]">
                    {stats.todayRevenue.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">درآمد این هفته:</span>
                  <span className="text-lg sm:text-xl font-black text-[#FDFBF7]">
                    {stats.weeklyRevenue.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">درآمد ماه جاری:</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400">
                    {stats.monthlyRevenue.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">کل درآمد سالانه:</span>
                  <span className="text-lg sm:text-xl font-black copper-gradient-text">
                    {stats.yearlyRevenue.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>
              </div>

              {/* Filter bar & Excel Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A8988C]">دوره گزارش:</span>
                  {[
                    { id: 'daily', label: 'روزانه (۷ روز اخیر)' },
                    { id: 'weekly', label: 'هفتگی (۴ هفته اخیر)' },
                    { id: 'monthly', label: 'ماهانه (۶ ماه اخیر)' },
                    { id: 'yearly', label: 'سالانه' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setReportPeriod(p.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        reportPeriod === p.id
                          ? 'copper-gradient text-white shadow-sm'
                          : 'bg-[#241E1B] text-[#A8988C] hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Real Excel Export Button */}
                <button
                  onClick={exportOrdersToExcelCSV}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>دریافت خروجی اکسل سفارش‌ها (Excel / CSV)</span>
                </button>
              </div>

              {/* Chart 1: Revenue AreaChart */}
              <div className="p-5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#FDFBF7] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#E0946B]" />
                    <span>نمودار زنده روند درآمد کافه رابیا</span>
                  </h4>
                  <span className="text-xs text-[#A8988C]">بر اساس داده‌های واقعی منو و سفارشات</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C87D55" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#C87D55" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D231E" />
                      <XAxis dataKey="label" stroke="#A8988C" fontSize={11} />
                      <YAxis stroke="#A8988C" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#181311',
                          borderColor: '#C87D55',
                          borderRadius: '12px',
                          color: '#FDFBF7',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${Number(val).toLocaleString('fa-IR')} تومان`, 'درآمد']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#E0946B"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Order Volume BarChart */}
              <div className="p-5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 space-y-4">
                <h4 className="text-sm font-black text-[#FDFBF7]">
                  تعداد سفارشات ثبت شده در این دوره
                </h4>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D231E" />
                      <XAxis dataKey="label" stroke="#A8988C" fontSize={11} />
                      <YAxis stroke="#A8988C" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#181311',
                          borderColor: '#C87D55',
                          borderRadius: '12px',
                          color: '#FDFBF7',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${val} عدد`, 'تعداد سفارش']}
                      />
                      <Bar dataKey="ordersCount" fill="#C87D55" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DATABASE SETTINGS, SECURITY (PIN: 4415), IMPORT/EXPORT & SUPABASE */}
          {activeTab === 'database_settings' && !isDbUnlocked && (
            <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#2A201A] border border-[#C87D55]/40 flex items-center justify-center text-[#E0946B] shadow-inner">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-[#FDFBF7]">بخش محرمانه تنظیمات دیتابیس</h3>
                <p className="text-xs text-[#A8988C] leading-relaxed">
                  این بخش شامل تنظیمات فنی اتصال به سرور، همگام‌سازی ابری و خروجی / ورودی جامع دیتابیس است و نیاز به رمز عبور اختصاصی ارشد دارد.
                </p>
              </div>

              <form onSubmit={handleVerifyDbPin} className="space-y-4">
                <div className="space-y-2 text-right">
                  <label className="text-xs font-bold text-[#D8C7B8] flex items-center justify-between">
                    <span>رمز عبور بخش دیتابیس:</span>
                    <span className="text-[10px] text-[#A8988C]">رمز اختصاصی ۴ رقمی</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={8}
                      autoFocus
                      value={dbPinInput}
                      onChange={(e) => {
                        setDbPinInput(e.target.value);
                        setDbPinError('');
                      }}
                      placeholder="رمز عبور را وارد کنید"
                      className="w-full bg-[#120E0C] border border-[#C87D55]/40 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-[#FDFBF7] focus:outline-none focus:border-[#C87D55] placeholder:text-[#5A4D45]"
                    />
                    <KeyRound className="w-4 h-4 text-[#C87D55] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {dbPinError && (
                    <p className="text-xs text-rose-400 font-semibold flex items-center gap-1 mt-1.5 justify-center">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{dbPinError}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-6 rounded-xl copper-gradient text-white font-black text-sm shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>تایید و ورود به تنظیمات دیتابیس</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'database_settings' && isDbUnlocked && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Top Security Status Bar with Re-lock */}
              <div className="p-3 px-4 rounded-xl bg-[#241C18] border border-[#C87D55]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>دسترسی امنیتی به بخش دیتابیس باز است</span>
                  <span className="text-[10px] text-[#A8988C] mr-2">(رمز عبور تایید شده)</span>
                </div>
                <button
                  onClick={() => setIsDbUnlocked(false)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181311] hover:bg-[#2A201A] border border-[#C87D55]/30 text-xs font-semibold text-[#D8C7B8] hover:text-white transition-all self-start sm:self-auto"
                >
                  <Lock className="w-3.5 h-3.5 text-[#C87D55]" />
                  <span>قفل کردن مجدد این بخش</span>
                </button>
              </div>

              {/* Live Connection Status Banner */}
              <div className={`p-5 rounded-2xl border transition-all ${
                sbStatus?.success && sbStatus.tablesFound
                  ? 'bg-emerald-950/40 border-emerald-700/60'
                  : sbStatus?.success && !sbStatus.tablesFound
                  ? 'bg-amber-950/40 border-amber-700/60'
                  : sbStatus && !sbStatus.success
                  ? 'bg-rose-950/40 border-rose-700/60'
                  : 'bg-[#1C1613] border-[#C87D55]/30'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                      sbStatus?.success && sbStatus.tablesFound
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : sbStatus?.success && !sbStatus.tablesFound
                        ? 'bg-amber-500/20 text-amber-400'
                        : sbStatus && !sbStatus.success
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'copper-gradient text-white'
                    }`}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-[#FDFBF7]">
                          وضعیت اتصال به دیتابیس ابری
                        </h3>
                        {sbStatus?.success && sbStatus.tablesFound && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                            🟢 متصل و فعال
                          </span>
                        )}
                        {sbStatus?.success && !sbStatus.tablesFound && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                            🟡 نیازمند ساخت جداول SQL
                          </span>
                        )}
                        {sbStatus && !sbStatus.success && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                            🔴 خطای اتصال
                          </span>
                        )}
                        {!sbStatus && (
                          <span className="px-2 py-0.5 rounded-full bg-[#2A201A] border border-[#C87D55]/30 text-[#E0946B] text-[10px] font-bold">
                            ⚪ در انتظار تنظیم اطلاعات
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#D8C7B8] mt-1">
                        {sbStatus ? sbStatus.message : 'با اتصال به دیتابیس ابری، سفارشات ثبت‌شده در گوشی به صورت آنی در این پنل روی سیستم نمایش داده می‌شوند.'}
                      </p>
                    </div>
                  </div>

                  {sbStatus?.success && (
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncingNow}
                      className="px-4 py-2 rounded-xl copper-gradient text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all self-start sm:self-auto"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>همگام‌سازی فوری دیتابیس</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DATABASE BACKUP & DATA PORTABILITY (IMPORT / EXPORT) */}
              <div className="p-5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C87D55]/20 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-[#FDFBF7] flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-[#E0946B]" />
                      <span>پشتیبان‌گیری و جابه‌جایی دیتابیس (خروجی و درون‌ریزی)</span>
                    </h4>
                    <p className="text-[11px] text-[#A8988C] mt-0.5">
                      در صورتی که قصد تغییر دیتابیس یا سرور را دارید، می‌توانید از کل اطلاعات خروجی بگیرید یا فایل پشتیبان را بازنشانی نمایید.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#D8C7B8] bg-[#14100E] px-3 py-1.5 rounded-xl border border-[#C87D55]/20 shrink-0">
                    <span>داده‌های فعلی:</span>
                    <span className="text-[#E0946B] font-bold">{orders.length} سفارش</span>
                    <span>•</span>
                    <span className="text-[#E0946B] font-bold">{users.length} کاربر</span>
                    <span>•</span>
                    <span className="text-[#E0946B] font-bold">{menuItems.length} آیتم منو</span>
                  </div>
                </div>

                {importResultMsg && (
                  <div className={`p-3.5 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
                    importResultMsg.success
                      ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                      : 'bg-rose-950/70 border-rose-700 text-rose-300'
                  }`}>
                    {importResultMsg.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{importResultMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export Section */}
                  <div className="p-4 rounded-xl bg-[#181311] border border-[#C87D55]/20 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[#E0946B] font-bold text-xs">
                        <Download className="w-4 h-4" />
                        <span>خروجی کامل دیتابیس (Export Backup)</span>
                      </div>
                      <p className="text-[11px] text-[#A8988C] leading-relaxed">
                        دانلود فایل استاندارد JSON شامل تمام سفارشات، کاربران و موجودی اعتبار، منوی محصولات و سوابق مالی برای انتقال یا بایگانی.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportBackup}
                      disabled={isExporting}
                      className="w-full py-2.5 px-4 rounded-xl copper-gradient text-white font-bold text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>در حال آماده‌سازی فایل پشتیبان...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>دانلود فایل پشتیبان کامل (JSON)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Import Section */}
                  <div className="p-4 rounded-xl bg-[#181311] border border-[#C87D55]/20 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#E0946B] font-bold text-xs">
                        <Upload className="w-4 h-4" />
                        <span>درون‌ریزی و بازیابی دیتابیس (Import Backup)</span>
                      </div>
                      <p className="text-[11px] text-[#A8988C] leading-relaxed">
                        بارگذاری فایل JSON جهت بازگردانی اطلاعات یا انتقال به دیتابیس جدید:
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#D8C7B8]">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                            className="text-[#C87D55] focus:ring-0"
                          />
                          <span>ادغام با داده‌های فعلی (Merge)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#D8C7B8]">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="text-[#C87D55] focus:ring-0"
                          />
                          <span>جایگزینی کامل (Replace)</span>
                        </label>
                      </div>
                    </div>

                    <div className="relative">
                      <label className="w-full py-2.5 px-4 rounded-xl bg-[#2A201A] hover:bg-[#382C25] border border-[#C87D55]/40 text-[#E0946B] hover:text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                        {isImporting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>در حال پردازش و ثبت داده‌ها...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>انتخاب فایل پشتیبان (.json)</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleFileImport}
                          disabled={isImporting}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supabase Connection Form */}
              <div className="p-5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#FDFBF7] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#E0946B]" />
                    <span>مشخصات اتصال پروژه دیتابیس (Supabase)</span>
                  </h4>
                  <span className="text-[11px] text-[#A8988C]">اتصال مستقیم کلاینت ابری به جداول سفارشات و مشتریان</span>
                </div>

                {sbSavedMsg && (
                  <div className={`p-3 rounded-xl text-xs border ${
                    sbStatus?.success
                      ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/70 border-rose-800 text-rose-300'
                  }`}>
                    {sbSavedMsg}
                  </div>
                )}

                <form onSubmit={handleSaveSupabase} className="space-y-4 text-xs">
                  <div>
                    <label className="text-[#D8C7B8] font-semibold block mb-1.5">
                      Project URL (آدرس اختصاصی پروژه در سوپابیس):
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      placeholder="https://xyzabcdefghijklmn.supabase.co"
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 rounded-xl p-3 text-[#FDFBF7] focus:outline-none focus:border-[#C87D55]"
                    />
                    <span className="text-[10px] text-[#8C7B71] mt-1 block">
                      نمونه: https://abcdefghijklmn.supabase.co
                    </span>
                  </div>

                  <div>
                    <label className="text-[#D8C7B8] font-semibold block mb-1.5">
                      Anon Public API Key (کلید ناشناس/عمومی API):
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={sbKey}
                      onChange={(e) => setSbKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full bg-[#241E1B] border border-[#C87D55]/30 rounded-xl p-3 text-[#FDFBF7] focus:outline-none focus:border-[#C87D55] font-mono text-[11px]"
                    />
                    <span className="text-[10px] text-[#8C7B71] mt-1 block">
                      کلید anon public key در منوی Project Settings &gt; API سوپابیس
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isTestingSb}
                    className="py-3 px-6 rounded-xl copper-gradient text-white font-bold text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isTestingSb ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>در حال بررسی و اعتبارسنجی اتصال به دیتابیس...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ذخیره و تست اتصال به دیتابیس</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Ready-to-copy SQL Script Box */}
              <div className="p-5 rounded-2xl bg-[#181311] border border-[#C87D55]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#FDFBF7]">کدهای SQL آماده برای ساخت جدول‌ها در دیتابیس</h4>
                    <span className="text-[11px] text-[#A8988C]">
                      این کدها را کپی کرده و در بخش SQL Editor داشبورد سوپابیس Run کنید:
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#2A221E] hover:bg-[#382D28] text-[#E0946B] text-xs font-bold border border-[#C87D55]/30 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSql ? 'کپی شد!' : 'کپی تمام کدهای SQL'}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-[#0F0D0C] border border-[#2B231E] text-[11px] text-[#A8988C] overflow-x-auto max-h-64 font-mono dir-ltr text-left leading-relaxed">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
