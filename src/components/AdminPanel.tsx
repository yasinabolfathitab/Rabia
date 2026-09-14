import React, { useState, useEffect, useRef } from 'react';
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
  ChevronLeft,
  TrendingUp,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  Download,
  FileJson,
  ShieldCheck,
  ShieldAlert,
  UserX,
  AlertTriangle,
  Bell,
  Volume2,
  Wifi,
  Calendar
} from 'lucide-react';
import { playOrderAlertSound } from '../lib/sound';
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
  unbanUser,
  resetUserPassword,
  adjustUserCredit, 
  getMenuItems, 
  saveMenuItem, 
  toggleMenuItemStock, 
  deleteMenuItem,
  parseIsAvailable,
  getCafeStats,
  getChartData,
  exportOrdersToExcelCSV,
  subscribeRealtime,
  createOrder,
  initSupabaseRealtimeSync,
  syncAllWithSupabase,
  exportFullDatabaseBackup,
  exportDailyDatabaseBackup,
  getTodayBackupStats,
  importFullDatabaseBackup,
  clearAllOrders,
  clearAllUsers,
  clearAllDatabaseData
} from '../lib/database';
import { getSupabaseConfig, saveSupabaseConfig, SUPABASE_SQL_SCHEMA, getSupabaseClient, testSupabaseConnection, isValidSupabaseUrl } from '../lib/supabase';

const CATEGORY_LABELS: Record<string, string> = {
  espresso_milk: 'اسپرسو و شیر',
  hot_bar: 'هات بار',
  tea_bar: 'تی بار',
  ice_coffee: 'آیس کافی',
  mocktail_bar: 'ماکتیل بار',
  shake_smoothie: 'شیک و اسموتی',
  signature: 'سیگنچر',
  antioxidant_bar: 'آنتی اکسیدان بار',
  affogato_bar: 'آفوگاتو بار',
  cakes_desserts: 'کیک و دسر',
  refresher: 'رفرشر',
};

const AdminOrderTimer: React.FC<{ order: Order }> = ({ order }) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (order.status !== 'preparing') return;

    const calcRemaining = () => {
      const targetTime = order.estimatedReadyAt 
        ? new Date(order.estimatedReadyAt).getTime() 
        : (order.prepStartedAt ? new Date(order.prepStartedAt).getTime() : new Date(order.createdAt).getTime()) + (order.estimatedPrepMinutes || 15) * 60 * 1000;
      
      const now = Date.now();
      return Math.max(0, Math.floor((targetTime - now) / 1000));
    };

    setRemainingSeconds(calcRemaining());

    const interval = setInterval(() => {
      const diff = calcRemaining();
      setRemainingSeconds(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.id, order.status, order.estimatedReadyAt, order.prepStartedAt, order.estimatedPrepMinutes, order.createdAt]);

  if (order.status !== 'preparing') return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const isUrgent = remainingSeconds < 60 && remainingSeconds > 0;

  return (
    <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-md flex items-center gap-1 ${
      remainingSeconds <= 0 
        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' 
        : isUrgent 
          ? 'bg-rose-950/60 text-rose-300 border-rose-800/40 animate-pulse'
          : 'bg-sky-950/60 text-sky-300 border-sky-800/40'
    }`}>
      <Clock className="w-3 h-3" />
      <span dir="ltr">
        {remainingSeconds <= 0 ? 'آماده' : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`}
      </span>
    </span>
  );
};

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuUpdated?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onMenuUpdated }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'credit' | 'menu' | 'reports' | 'database_settings'>('orders');

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState(getCafeStats());
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus>('all');

  // Credit Tab states
  const [isCreditUnlocked, setIsCreditUnlocked] = useState(false);
  const [creditPin, setCreditPin] = useState('');
  const [creditPinError, setCreditPinError] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [chargeNote, setChargeNote] = useState<string>('شارژ با پرداخت نقدی در کافه');
  const [deductAmount, setDeductAmount] = useState<string>('');
  const [deductNote, setDeductNote] = useState<string>('سفارش حضوری در کافه');
  const [creditFeedback, setCreditFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Menu Management Modal states
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({
    name: '',
    nameEn: '',
    category: 'espresso_milk',
    price: 90000,
    description: '',
    ingredients: [],
    image: '',
    isAvailable: true,
  });
  const [ingredientsText, setIngredientsText] = useState('');

  // Menu Item Deletion, Filter and Feedback states
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [menuFeedback, setMenuFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<'all' | MenuCategory>('all');

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
  const [isCheckingSb, setIsCheckingSb] = useState(true);

  // Database Settings Separate Password Protection (PIN: 4415)
  const [isDbUnlocked, setIsDbUnlocked] = useState(false);
  const [dbPinInput, setDbPinInput] = useState('');
  const [dbPinError, setDbPinError] = useState('');

  // Database Import/Export Backup states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultMsg, setImportResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Database Purge / Clear states (Orders, Users, All with confirmation dialog)
  const [purgeTarget, setPurgeTarget] = useState<'orders' | 'users' | 'all' | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPurgeMenu, setShowPurgeMenu] = useState(false);

  // User tab states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [customPasswordInput, setCustomPasswordInput] = useState('1234');
  const [userActionFeedback, setUserActionFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Daily Exit Backup Modal states (پرسش از مدیر هنگام خروج از پنل برای بک‌آپ روزانه)
  const [showExitBackupConfirm, setShowExitBackupConfirm] = useState(false);
  const [todayBackupStats, setTodayBackupStats] = useState<ReturnType<typeof getTodayBackupStats> | null>(null);
  const [backupDownloadSuccess, setBackupDownloadSuccess] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState('');

  // Order Prep Time Modal states (تعیین زمان آماده‌سازی هنگام تایید سفارش)
  const [orderToPrepare, setOrderToPrepare] = useState<Order | null>(null);
  const [selectedPrepMinutes, setSelectedPrepMinutes] = useState<number>(15);
  const [customPrepMinutes, setCustomPrepMinutes] = useState<string>('');

  const handleRequestExit = () => {
    const stats = getTodayBackupStats();
    setTodayBackupStats(stats);
    setBackupDownloadSuccess(false);
    setDownloadedFileName('');
    setShowExitBackupConfirm(true);
  };

  const handleConfirmExitWithBackup = () => {
    const result = exportDailyDatabaseBackup();
    setDownloadedFileName(result.fileName);
    setBackupDownloadSuccess(true);
    setTimeout(() => {
      setShowExitBackupConfirm(false);
      onClose();
    }, 750);
  };

  const handleConfirmExitWithoutBackup = () => {
    setShowExitBackupConfirm(false);
    onClose();
  };

  const handleOpenPrepTimeModal = (ord: Order) => {
    setOrderToPrepare(ord);
    setSelectedPrepMinutes(ord.estimatedPrepMinutes || 15);
    setCustomPrepMinutes('');
  };

  const handleConfirmOrderPreparation = () => {
    if (!orderToPrepare) return;
    const minutes = customPrepMinutes ? parseInt(customPrepMinutes, 10) || selectedPrepMinutes : selectedPrepMinutes;
    const finalMinutes = Math.max(1, Math.min(180, minutes || 15));

    updateOrderStatus(orderToPrepare.id, 'preparing', { estimatedPrepMinutes: finalMinutes });
    refreshData();
    setOrderToPrepare(null);
  };

  // Execute purge after confirmation ("بله")
  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    setIsPurging(true);
    setPurgeResult(null);

    try {
      let res: { success: boolean; message: string } = { success: false, message: '' };

      if (purgeTarget === 'orders') {
        res = await clearAllOrders();
      } else if (purgeTarget === 'users') {
        res = await clearAllUsers();
      } else if (purgeTarget === 'all') {
        res = await clearAllDatabaseData();
        if (onMenuUpdated) {
          onMenuUpdated();
        }
      }

      setPurgeResult(res);
      refreshData();
      setSelectedUser(null);

      if (res.success) {
        setTimeout(() => {
          setPurgeTarget(null);
          setPurgeResult(null);
        }, 1200);
      }
    } catch (err: any) {
      setPurgeResult({ success: false, message: err?.message || 'خطا در عملیات پاکسازی.' });
    } finally {
      setIsPurging(false);
    }
  };

  // New incoming order real-time alert banner
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  // Unconfirmed pending orders reminder state
  const [unconfirmedPendingCount, setUnconfirmedPendingCount] = useState<number>(0);
  const ordersRef = useRef<Order[]>([]);

  // Refresh all data
  const refreshData = () => {
    const currentOrders = getOrders();
    ordersRef.current = currentOrders;
    setOrders(currentOrders);
    const pendingCount = currentOrders.filter((o) => o.status === 'pending').length;
    setUnconfirmedPendingCount(pendingCount);
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
        setIsCheckingSb(true);
        testSupabaseConnection(conf.url, conf.key)
          .then((res) => {
            setSbStatus(res);
            setIsCheckingSb(false);
            if (res.success) {
              initSupabaseRealtimeSync();
              syncAllWithSupabase().then(() => refreshData());
            }
          })
          .catch(() => {
            setIsCheckingSb(false);
          });
      } else {
        setSbStatus(null);
        setIsCheckingSb(false);
      }

      // Subscribe to real-time events
      const unsubscribe = subscribeRealtime((event) => {
        refreshData();
        if (event.type === 'order_created' && event.payload) {
          playOrderAlertSound();
          setNewOrderAlert(event.payload);
          setTimeout(() => {
            setNewOrderAlert((cur) => (cur?.id === event.payload.id ? null : cur));
          }, 10000);
        }
      });

      // Periodic reminder: if there are pending orders waiting for confirmation and prep start,
      // replay the chime sound every 60 seconds (1 minute) to notify the manager:
      // "وقتی برای مدیریت سفارشی اومد و مدیر یادش رفت روی تایید و شروع آماده سازی بزنه، هر یک دقیقه یکبار یک صدای دینگ یا نوتیف پخش کن"
      const reminderInterval = setInterval(() => {
        const pendingOrders = ordersRef.current.filter((o) => o.status === 'pending');
        if (pendingOrders.length > 0) {
          playOrderAlertSound();
          setUnconfirmedPendingCount(pendingOrders.length);
        }
      }, 60000);

      return () => {
        unsubscribe();
        clearInterval(reminderInterval);
      };
    }
  }, [isOpen, reportPeriod]);

  if (!isOpen) return null;

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((it) => {
    if (menuCategoryFilter !== 'all' && it.category !== menuCategoryFilter) return false;
    if (menuSearch.trim()) {
      const q = menuSearch.trim().toLowerCase();
      const matchName = it.name.toLowerCase().includes(q);
      const matchEn = it.nameEn ? it.nameEn.toLowerCase().includes(q) : false;
      return matchName || matchEn;
    }
    return true;
  });

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const approvedUsers = users.filter((u) => u.status === 'approved');

  // Handle User Approval
  const handleApproveUser = (userId: string, approve: boolean) => {
    approveUser(userId, approve);
    refreshData();
  };

  // Handle User Password Reset
  const handleResetPassword = (userId: string, newPass?: string) => {
    const passToSet = (newPass || customPasswordInput || '1234').trim();
    if (!passToSet) {
      setUserActionFeedback({ success: false, message: 'رمز عبور نمی‌تواند خالی باشد.' });
      return;
    }
    const result = resetUserPassword(userId, passToSet);
    setUserActionFeedback(result);
    setPasswordResetUser(null);
    refreshData();
    setTimeout(() => {
      setUserActionFeedback(null);
    }, 5000);
  };

  // Handle User Unban
  const handleUnbanUser = (userId: string) => {
    const res = unbanUser(userId);
    setCreditFeedback(res);
    refreshData();
    if (selectedUser?.id === userId) {
      const updated = getUsers().find((u) => u.id === userId);
      setSelectedUser(updated || null);
    }
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
  const handleDeductCredit = async (e: React.FormEvent) => {
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
        message: `اعتبار کاربر (${selectedUser.rabiaCredit.toLocaleString('en-US')} تومان) کمتر از این مبلغ است!`,
      });
      return;
    }

    // Deduct credit
    const res = adjustUserCredit(selectedUser.id, -num, 'in_person_order', deductNote);
    
    // Also record order in orders table
    await createOrder({
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
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem.name || editingItem.price === undefined || editingItem.price === null) return;

    const ingArray = ingredientsText
      .split('،')
      .map((s) => s.trim())
      .filter(Boolean);

    const itemToSave: MenuItem = {
      id: editingItem.id || 'item-' + Date.now(),
      name: editingItem.name,
      nameEn: editingItem.nameEn || '',
      category: editingItem.category || 'espresso_milk',
      price: Number(editingItem.price) >= 0 ? Number(editingItem.price) : 0,
      description: editingItem.description || '',
      ingredients: ingArray.length > 0 ? ingArray : editingItem.ingredients || [],
      image: editingItem.image || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
      isAvailable: editingItem.isAvailable !== false,
      isFeatured: editingItem.isFeatured || false,
    };

    await saveMenuItem(itemToSave);
    setIsEditingItem(false);
    refreshData();
    onMenuUpdated?.();
  };

  // Toggle item stock
  const handleToggleStock = async (itemId: string) => {
    // Optimistically update local state immediately
    setMenuItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, isAvailable: !parseIsAvailable(it.isAvailable) } : it
      )
    );
    await toggleMenuItemStock(itemId);
    refreshData();
    onMenuUpdated?.();
  };

  // Handle Menu Item Deletion
  const handleConfirmDeleteItem = () => {
    if (!itemToDelete) return;
    const targetName = itemToDelete.name;
    const targetId = itemToDelete.id;

    // Optimistically update local state immediately
    setMenuItems((prev) => prev.filter((it) => it.id !== targetId));

    deleteMenuItem(targetId);
    setItemToDelete(null);
    setIsEditingItem(false);
    refreshData();
    onMenuUpdated?.();

    setMenuFeedback({
      success: true,
      message: `آیتم «${targetName}» با موفقیت از منوی کافه رابیا حذف شد.`,
    });
    setTimeout(() => {
      setMenuFeedback(null);
    }, 4000);
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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl overflow-hidden border border-[#C87D55]/40 bg-[#F6E3CE] flex items-center justify-center p-0.5 shrink-0 shadow-md">
              <img src="/Rabia_Logo.jpg" alt="لوگوی کافه رابیا" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-[#FDFBF7] flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="sm:hidden">پنل مدیریت</span>
                <span className="hidden sm:inline">پنل اختصاصی مدیریت کافه رابیا</span>
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Supabase Status Indicator in Header */}
            {isCheckingSb ? (
              <button
                onClick={() => setActiveTab('database_settings')}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#241E1B] border border-[#C87D55]/30 text-[#D8C7B8] text-[11px] sm:text-xs font-bold transition-all shrink-0"
                title="در حال بررسی اتصال به دیتابیس..."
              >
                <RefreshCw className="w-3 h-3 text-[#E0946B] animate-spin shrink-0" />
                <span className="hidden sm:inline">دیتابیس:</span>
                <span>در حال اتصال...</span>
              </button>
            ) : sbStatus?.success ? (
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

            {/* Quick Purge Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPurgeMenu(!showPurgeMenu)}
                title="گزینه‌های پاکسازی دیتابیس"
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-bold transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">پاکسازی داده‌ها</span>
                <span className="sm:hidden">پاکسازی</span>
              </button>

              {showPurgeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPurgeMenu(false)}
                  />
                  <div className="absolute left-0 mt-2 w-60 rounded-2xl bg-[#1C1412] border border-rose-800/60 shadow-2xl p-2.5 z-50 space-y-1.5">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-rose-400/90 border-b border-rose-900/30">
                      عملیات پاکسازی دیتابیس
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPurgeMenu(false);
                        setPurgeTarget('orders');
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-rose-200 hover:bg-rose-900/50 flex items-center justify-between transition-all"
                    >
                      <span>پاکسازی تمام سفارش‌ها</span>
                      <span className="text-[10px] text-rose-400 font-mono">({orders.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPurgeMenu(false);
                        setPurgeTarget('users');
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-rose-200 hover:bg-rose-900/50 flex items-center justify-between transition-all"
                    >
                      <span>پاکسازی یوزرها</span>
                      <span className="text-[10px] text-rose-400 font-mono">({users.length})</span>
                    </button>
                    <div className="border-t border-rose-900/40 my-1"></div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPurgeMenu(false);
                        setPurgeTarget('all');
                      }}
                      className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-between transition-all shadow-md"
                    >
                      <span>پاکسازی همه</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Exit button with Daily Backup confirmation */}
            <button
              onClick={handleRequestExit}
              title="خروج از پنل مدیریت"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/40 text-rose-300 text-xs font-semibold transition-all shrink-0 cursor-pointer"
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
              {/* Realtime New Order Audio & Visual Alert Banner */}
              {newOrderAlert && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/80 to-[#1C1613] border-2 border-emerald-500 shadow-2xl flex items-center justify-between gap-4 animate-in bounce-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/30 border border-emerald-400 text-emerald-300 flex items-center justify-center shrink-0 animate-pulse">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-500/40">
                          🔔 سفارش جدید ثبت شد!
                        </span>
                        <span className="text-xs text-emerald-200 font-bold">
                          {newOrderAlert.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-white mt-1">
                        {newOrderAlert.userName} • {newOrderAlert.orderType === 'dine_in' ? `میز ${newOrderAlert.tableNumber || 'حضوری'}` : 'بیرون‌بر'} • {newOrderAlert.totalAmount?.toLocaleString('en-US')} تومان
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNewOrderAlert(null)}
                    className="p-2 rounded-xl bg-black/40 hover:bg-black/60 text-emerald-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Unconfirmed Pending Orders 1-Minute Alert Notification Bar */}
              {unconfirmedPendingCount > 0 && !newOrderAlert && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#26170F] to-[#1C120B] border border-amber-500/50 shadow-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0">
                      <Volume2 className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-300">
                          {unconfirmedPendingCount} سفارش در انتظار تایید و تعیین زمان آماده‌سازی
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                          یادآور صوتی هر ۱ دقیقه فعال است
                        </span>
                      </div>
                      <p className="text-[11px] text-[#D8C7B8] mt-0.5 font-light">
                        لطفاً روی دکمه «تایید و شروع آماده‌سازی» کلیک کرده و زمان مورد نیاز را انتخاب کنید تا تایمر معکوس برای مشتری فعال شود.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOrderFilter('pending')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shrink-0 shadow-md"
                  >
                    مشاهده سفارش‌ها
                  </button>
                </div>
              )}

              {/* Online Cloud Database Status Banner */}
              {isCheckingSb ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-[#241E1B] border border-[#C87D55]/30 text-[#D8C7B8] text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-[#E0946B] animate-spin shrink-0" />
                    <span>در حال بررسی وضعیت اتصال به دیتابیس ابری (Supabase)...</span>
                  </div>
                  <span className="text-[10px] text-[#A8988C] hidden sm:inline">Connecting...</span>
                </div>
              ) : sbStatus?.success ? (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span>همگام‌سازی ابری فعال است؛ سفارشات مشتریان به‌صورت لحظه‌ای دریافت می‌شوند.</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 hidden sm:inline">Online</span>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <strong className="block text-[#FDFBF7] font-bold text-xs sm:text-sm">
                        دیتابیس آنلاین (Supabase) متصل نیست!
                      </strong>
                      <p className="text-[11px] sm:text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                        {sbStatus?.message || 'برای اینکه سفارش‌های ثبت‌شده در گوشی مشتریان به این لپ‌تاپ برسد، اتصال دیتابیس را فعال کنید.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setIsCheckingSb(true);
                      const conf = getSupabaseConfig();
                      const res = await testSupabaseConnection(conf.url, conf.key);
                      setSbStatus(res);
                      setIsCheckingSb(false);
                      if (res.success) {
                        initSupabaseRealtimeSync();
                        syncAllWithSupabase().then(() => refreshData());
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition-all shrink-0 self-end sm:self-center"
                  >
                    اتصال سریع دیتابیس
                  </button>
                </div>
              )}

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

                <div className="flex items-center gap-2">
                  <div className="text-[11px] sm:text-xs text-[#A8988C]">
                    نمایش {filteredOrders.length} سفارش لحظه‌ای
                  </div>
                  <button
                    type="button"
                    onClick={() => setPurgeTarget('orders')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 border border-rose-800/40 text-rose-300 text-xs font-bold transition-all shrink-0 shadow-sm"
                    title="پاکسازی تمام سفارش‌های ثبت شده در سیستم"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>پاکسازی تمام سفارش‌ها</span>
                  </button>
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
                              {new Date(ord.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
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
                              <span className="text-[#E0946B]">{(it.price * it.quantity).toLocaleString('en-US')} ت</span>
                            </div>
                          ))}
                          <div className="pt-1.5 border-t border-[#C87D55]/15 flex justify-between text-xs font-black text-white">
                            <span>مبلغ کل:</span>
                            <span className="text-[#E0946B]">{ord.totalAmount.toLocaleString('en-US')} تومان</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-[#A8988C] flex items-center justify-between">
                          <span>روش پرداخت: {ord.paymentMethod === 'rabia_credit' ? 'اعتبار حساب رابیا' : 'کارت‌کشیدن حضوری در صندوق'}</span>
                          {ord.status === 'preparing' && <AdminOrderTimer order={ord} />}
                        </div>
                      </div>

                      {/* Status Update Buttons */}
                      <div className="pt-2 border-t border-[#C87D55]/15 flex items-center gap-1.5">
                        {ord.status === 'pending' && (
                          <button
                            onClick={() => handleOpenPrepTimeModal(ord)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>تایید و شروع آماده‌سازی</span>
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
              {/* Header Bar with Clear Users Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#C87D55]/20">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-black text-[#FDFBF7]">
                    لیست و مدیریت کاربران کافه رابیا
                  </h3>
                  <span className="text-xs text-[#E0946B] bg-[#241E1B] px-2.5 py-0.5 rounded-full border border-[#C87D55]/30">
                    مجموع: {users.length} کاربر
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPurgeTarget('users')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 text-xs font-bold transition-all shrink-0 self-start sm:self-auto shadow-sm"
                  title="پاکسازی تمام کاربران ثبت شده"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>پاکسازی یوزرها</span>
                </button>
              </div>

              {/* User Action Feedback Toast */}
              {userActionFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-lg transition-all ${
                    userActionFeedback.success
                      ? 'bg-emerald-950/90 border border-emerald-700 text-emerald-300'
                      : 'bg-rose-950/90 border border-rose-700 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {userActionFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span className="font-semibold">{userActionFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserActionFeedback(null)}
                    className="p-1 hover:bg-black/20 rounded-lg text-[#A8988C]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

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
                            تاریخ درخواست: {new Date(u.createdAt).toLocaleString('en-US')}
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h3 className="text-base font-black text-[#FDFBF7]">
                      مشتریان تایید شده کافه رابیا ({approvedUsers.length})
                    </h3>
                    <p className="text-[11px] text-[#A8988C] mt-0.5">
                      امکان مشاهده، جستجو و بازنشانی رمز عبور مشتریان در صورت فراموشی
                    </p>
                  </div>

                  {/* Search inside users */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="جستجوی نام یا شماره مشتری..."
                      className="w-full bg-[#1C1613] border border-[#C87D55]/30 focus:border-[#C87D55] rounded-xl py-1.5 px-3 pr-8 text-xs text-[#FDFBF7] focus:outline-none placeholder:text-neutral-500"
                    />
                    <Search className="w-3.5 h-3.5 text-[#A8988C] absolute right-2.5 top-2.5" />
                    {userSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setUserSearchTerm('')}
                        className="absolute left-2.5 top-2 text-[#A8988C] hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {(() => {
                  const filteredUsers = approvedUsers.filter((u) => {
                    if (!userSearchTerm.trim()) return true;
                    const q = userSearchTerm.trim().toLowerCase();
                    return (
                      u.name?.toLowerCase().includes(q) ||
                      u.phone?.includes(q) ||
                      u.address?.toLowerCase().includes(q)
                    );
                  });

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="p-5 rounded-2xl bg-[#1A1513] border border-[#C87D55]/20 text-xs text-[#A8988C] text-center">
                        هیچ کاربری با این مشخصات یافت نشد.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          className="p-3.5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20 space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-[#FDFBF7]">{u.name}</span>
                              <span className="text-xs font-black text-[#E0946B]">
                                اعتبار: {u.rabiaCredit.toLocaleString('en-US')} تومان
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

                          {/* Customer Actions: Reset Password */}
                          <div className="pt-2 border-t border-[#C87D55]/10 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordResetUser(u);
                                setCustomPasswordInput('1234');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#241E1B] hover:bg-[#2F2622] border border-[#C87D55]/30 hover:border-[#C87D55] text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                              title="بازنشانی رمز عبور کاربر به رمز پیش‌فرض"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                              <span>بازنشانی رمز عبور</span>
                            </button>

                            <span className="text-[10px] text-[#8C7A6E]">
                              شناسه: {u.id.slice(0, 6)}...
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 3: RABIA CREDIT & IN-PERSON ORDERS */}
          {activeTab === 'credit' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {!isCreditUnlocked ? (
                <div className="p-8 rounded-2xl bg-[#1A1513] border border-[#C87D55]/30 flex flex-col items-center justify-center max-w-sm mx-auto mt-10">
                  <div className="w-16 h-16 rounded-full bg-[#C87D55]/10 flex items-center justify-center mb-4 border border-[#C87D55]/20">
                    <Lock className="w-8 h-8 text-[#E0946B]" />
                  </div>
                  <h3 className="text-base font-black text-[#FDFBF7] mb-2 text-center">
                    ورود به بخش اعتبار و سفارش حضوری
                  </h3>
                  <p className="text-xs text-[#A8988C] mb-6 text-center leading-relaxed">
                    این بخش حاوی اطلاعات مالی و اعتباری مشتریان است. لطفاً برای دسترسی، رمز عبور را وارد کنید.
                  </p>
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (creditPin === '4415') {
                        setIsCreditUnlocked(true);
                        setCreditPinError(false);
                        setCreditPin('');
                      } else {
                        setCreditPinError(true);
                      }
                    }} 
                    className="w-full space-y-4"
                  >
                    <div>
                      <input
                        type="password"
                        dir="ltr"
                        autoFocus
                        value={creditPin}
                        onChange={(e) => {
                          setCreditPin(e.target.value);
                          setCreditPinError(false);
                        }}
                        placeholder="رمز عبور (PIN)"
                        className={`w-full bg-[#241E1B] border rounded-xl py-3 px-4 text-center text-lg tracking-[0.5em] text-[#FDFBF7] focus:outline-none transition-colors ${
                          creditPinError ? 'border-rose-500/50 focus:border-rose-500 text-rose-300' : 'border-[#C87D55]/30 focus:border-[#C87D55]'
                        }`}
                      />
                      {creditPinError && (
                        <p className="text-rose-400 text-[10px] text-center mt-2 font-bold animate-pulse">رمز عبور اشتباه است</p>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl copper-gradient text-white font-bold text-sm shadow-md transition-all flex justify-center items-center gap-2 hover:opacity-90"
                    >
                      <span>تایید و ورود</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-[#1A1513] border border-[#C87D55]/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-black text-[#FDFBF7]">
                        سیستم مدیریت اعتبار مشتریان و سفارشات حضوری
                      </h3>
                      <button 
                        onClick={() => setIsCreditUnlocked(false)}
                        className="text-[10px] text-[#A8988C] hover:text-rose-400 transition-colors flex items-center gap-1 border border-transparent hover:border-rose-900/50 px-2 py-1 rounded-md"
                      >
                        <Lock className="w-3 h-3" />
                        قفل کردن مجدد
                      </button>
                    </div>
                    <p className="text-xs text-[#A8988C] font-light leading-relaxed">
                      هنگامی که مشتری در کافه پرداخت نقدی انجام می‌دهد، می‌توانید با سرچ شماره او هر مبلغی اعتبار به او اختصاص دهید.
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

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordResetUser(selectedUser);
                          setCustomPasswordInput('1234');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#2A221E] hover:bg-[#342A25] border border-[#C87D55]/30 hover:border-[#C87D55] text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="بازنشانی رمز عبور این مشتری"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>بازنشانی رمز</span>
                      </button>

                      <div className="text-right sm:text-left bg-[#2A221E] px-4 py-2 rounded-xl border border-[#C87D55]/30">
                        <span className="text-xs text-[#A8988C] block">موجودی فعلی اعتبار رابیا:</span>
                        <span className="text-xl font-black text-[#E0946B]">
                          {selectedUser.rabiaCredit.toLocaleString('en-US')} تومان
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Action 1: Add/Charge Credit */}
                    <form onSubmit={handleChargeCredit} className="p-4 rounded-2xl bg-[#1A1513] border border-emerald-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <Plus className="w-4 h-4" />
                        <span>شارژ و افزایش اعتبار (پرداخت نقدی مشتری)</span>
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
                          placeholder="مثلاً: 2 تا لاته و چیزکیک سن‌سباستین"
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
                </>
              )}
            </div>
          )}

          {/* TAB 4: MENU ITEMS MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="space-y-5 max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-[#FDFBF7]">
                    مدیریت آیتم‌های منوی کافه رابیا ({menuItems.length} آیتم)
                  </h3>
                  <p className="text-[11px] text-[#A8988C] mt-0.5">
                    امکان ویرایش قیمت، عکس، وضعیت موجودی و حذف قطعی آیتم‌ها
                  </p>
                </div>

                <button
                  id="admin-add-new-menu-item-btn"
                  onClick={() => {
                    setEditingItem({
                      name: '',
                      nameEn: '',
                      category: 'espresso_milk',
                      price: 90000,
                      description: '',
                      ingredients: [],
                      image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
                      isAvailable: true,
                    });
                    setIngredientsText('');
                    setIsEditingItem(true);
                  }}
                  className="px-4 py-2 rounded-xl copper-gradient text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن آیتم جدید به منو</span>
                </button>
              </div>

              {/* Toast Feedback Notification */}
              {menuFeedback && (
                <div
                  className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all animate-in fade-in duration-200 ${
                    menuFeedback.success
                      ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-600/70 shadow-md'
                      : 'bg-rose-950/80 text-rose-200 border border-rose-600/70 shadow-md'
                  }`}
                >
                  {menuFeedback.success ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{menuFeedback.message}</span>
                </div>
              )}

              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#C87D55] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="جستجوی نام فارسی یا انگلیسی آیتم منو..."
                    className="w-full pl-8 pr-9 py-2 rounded-xl bg-[#241E1B] border border-[#C87D55]/30 text-white placeholder-[#A8988C]/60 text-xs focus:outline-none focus:border-[#C87D55]"
                  />
                  {menuSearch && (
                    <button
                      onClick={() => setMenuSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-[#A8988C] hover:text-white"
                      title="پاک کردن جستجو"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A8988C] shrink-0">دسته‌بندی:</span>
                  <select
                    value={menuCategoryFilter}
                    onChange={(e) => setMenuCategoryFilter(e.target.value as any)}
                    className="py-2 px-3 rounded-xl bg-[#241E1B] border border-[#C87D55]/30 text-white text-xs focus:outline-none focus:border-[#C87D55] cursor-pointer"
                  >
                    <option value="all">همه دسته‌ها ({menuItems.length})</option>
                    {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
                      <option key={catKey} value={catKey}>
                        {catLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table / Cards */}
              {filteredMenuItems.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20 text-center space-y-3">
                  <Coffee className="w-10 h-10 text-[#C87D55]/40 mx-auto" />
                  <p className="text-xs text-[#A8988C] font-semibold">
                    {menuSearch || menuCategoryFilter !== 'all'
                      ? 'هیچ آیتمی با فیلتر یا عبارت جستجوی انتخابی یافت نشد.'
                      : 'منوی کافه در حال حاضر هیچ آیتمی ندارد.'}
                  </p>
                  {(menuSearch || menuCategoryFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setMenuSearch('');
                        setMenuCategoryFilter('all');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#241E1B] text-[#E0946B] text-xs font-bold hover:bg-[#2D2420]"
                    >
                      نمایش همه آیتم‌ها
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenuItems.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20 flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div className="flex flex-col min-[380px]:flex-row gap-3.5 items-center min-[380px]:items-start">
                        <div className="relative w-[128px] h-[128px] min-w-[128px] min-h-[128px] max-w-[128px] max-h-[128px] rounded-2xl overflow-hidden border border-[#C87D55]/30 shrink-0 shadow-md bg-[#241E1B]">
                          <img
                            src={it.image}
                            alt={it.name}
                            width={128}
                            height={128}
                            className="w-[128px] h-[128px] object-cover"
                          />
                          {!parseIsAvailable(it.isAvailable) && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-1">
                              <span className="text-[10px] font-bold text-rose-300 bg-rose-950/90 px-2 py-0.5 rounded border border-rose-800">
                                اتمام موجودی
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between w-full h-full">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs sm:text-sm font-bold text-[#FDFBF7] truncate">
                                {it.name}
                              </h4>
                              <span className="text-xs font-black text-[#E0946B] shrink-0">
                                {it.price.toLocaleString('en-US')} ت
                              </span>
                            </div>
                            {it.nameEn && (
                              <p className="text-[10px] text-[#A8988C]/80 truncate">{it.nameEn}</p>
                            )}
                            <p className="text-[11px] text-[#A8988C] line-clamp-2 mt-1">
                              {it.description}
                            </p>
                          </div>
                          <div className="mt-2 text-[10px] text-[#C4B3A5]/60">
                            دسته‌بندی: {CATEGORY_LABELS[it.category] || it.category}
                          </div>
                        </div>
                      </div>

                      {/* Stock Status Toggle & Edit/Delete */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#C87D55]/15">
                        <button
                          onClick={() => handleToggleStock(it.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                            parseIsAvailable(it.isAvailable)
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/70 hover:bg-emerald-900/90'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-600/70 hover:bg-rose-900/90'
                          }`}
                          title={parseIsAvailable(it.isAvailable) ? 'کلیک کنید تا اتمام موجودی شود' : 'کلیک کنید تا موجود در منو شود'}
                        >
                          <span className={`w-2 h-2 rounded-full ${parseIsAvailable(it.isAvailable) ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          <span>{parseIsAvailable(it.isAvailable) ? '✓ موجود در منو' : '✗ اتمام موجودی'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            id={`edit-menu-item-${it.id}`}
                            onClick={() => {
                              setEditingItem(it);
                              setIngredientsText(it.ingredients ? it.ingredients.join('، ') : '');
                              setIsEditingItem(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#241E1B] text-[#D8C7B8] hover:text-white border border-transparent hover:border-[#C87D55]/40 transition-colors cursor-pointer"
                            title="ویرایش آیتم"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-menu-item-${it.id}`}
                            onClick={() => setItemToDelete(it)}
                            className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900 hover:text-white border border-rose-800/60 transition-colors cursor-pointer shadow-sm"
                            title={`حذف «${it.name}» از منو`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                            value={editingItem.category || 'espresso_milk'}
                            onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as MenuCategory })}
                            className="w-full bg-[#221B17] border border-[#C87D55]/30 rounded-xl p-2 text-[#FDFBF7] focus:outline-none"
                          >
                            <option value="espresso_milk">اسپرسو و شیر</option>
                            <option value="hot_bar">هات بار</option>
                            <option value="tea_bar">تی بار</option>
                            <option value="ice_coffee">آیس کافی</option>
                            <option value="mocktail_bar">ماکتیل بار</option>
                            <option value="shake_smoothie">شیک و اسموتی</option>
                            <option value="signature">سیگنچر</option>
                            <option value="antioxidant_bar">آنتی اکسیدان بار</option>
                            <option value="affogato_bar">آفوگاتو بار</option>
                            <option value="cakes_desserts">کیک و دسر</option>
                            <option value="refresher">رفرشر</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[#A8988C] block mb-1">قیمت (تومان):</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={editingItem.price !== undefined && editingItem.price !== null ? editingItem.price : ''}
                            onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
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
                          <div className="w-[128px] h-[128px] min-w-[128px] min-h-[128px] max-w-[128px] max-h-[128px] rounded-2xl overflow-hidden border border-[#C87D55]/40 mt-2 shadow-md bg-[#241E1B]">
                            <img
                              src={editingItem.image}
                              alt="پیش‌نمایش"
                              width={128}
                              height={128}
                              className="w-[128px] h-[128px] object-cover"
                            />
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

                      <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#C87D55]/20">
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            id="admin-save-menu-item-btn"
                            className="px-5 py-2.5 rounded-xl copper-gradient text-white font-bold text-xs shadow-md cursor-pointer hover:opacity-95"
                          >
                            ذخیره آیتم در منو
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingItem(false)}
                            className="px-4 py-2.5 rounded-xl bg-[#241E1B] text-[#A8988C] hover:text-white text-xs font-semibold cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>

                        {editingItem.id && (
                          <button
                            type="button"
                            id={`modal-delete-item-${editingItem.id}`}
                            onClick={() => {
                              const fullItem =
                                menuItems.find((i) => i.id === editingItem.id) ||
                                (editingItem as MenuItem);
                              setItemToDelete(fullItem);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 border border-rose-600/70 text-rose-300 hover:bg-rose-900 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="حذف قطعی این آیتم از منو"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف این آیتم</span>
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Dedicated Item Deletion Confirmation Modal */}
              {itemToDelete && (
                <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                  <div className="relative w-full max-w-md rounded-3xl bg-[#181311] border border-rose-600/60 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
                    <button
                      onClick={() => setItemToDelete(null)}
                      className="absolute left-4 top-4 p-2 rounded-full bg-[#241E1B] text-[#A8988C] hover:text-white cursor-pointer"
                      title="بستن پنجره"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 text-rose-400">
                      <div className="w-11 h-11 rounded-2xl bg-rose-950/90 border border-rose-600/60 flex items-center justify-center shrink-0 shadow-inner">
                        <Trash2 className="w-5 h-5 text-rose-400" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-white">تأیید حذف آیتم از منو</h4>
                        <p className="text-[11px] text-rose-300/80">
                          این عملیات بلافاصله در دیتابیس و منوی سفارش ثبت می‌شود
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#221B17] border border-[#C87D55]/25 flex items-center gap-3">
                      {itemToDelete.image ? (
                        <img
                          src={itemToDelete.image}
                          alt={itemToDelete.name}
                          className="w-14 h-14 rounded-xl object-cover border border-[#C87D55]/30 shrink-0 bg-[#1A1412]"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#2D2420] border border-[#C87D55]/30 flex items-center justify-center shrink-0">
                          <Coffee className="w-6 h-6 text-[#C87D55]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                          {itemToDelete.name}
                        </h5>
                        {itemToDelete.nameEn && (
                          <p className="text-[10px] text-[#A8988C] truncate" dir="ltr">
                            {itemToDelete.nameEn}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-[#A8988C] text-[10px]">
                            {CATEGORY_LABELS[itemToDelete.category] || itemToDelete.category}
                          </span>
                          <span className="font-black text-[#E0946B]">
                            {itemToDelete.price.toLocaleString('en-US')} تومان
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#D8C7B8] leading-relaxed">
                      آیا مطمئن هستید که می‌خواهید آیتم{' '}
                      <span className="font-black text-white underline decoration-rose-500">
                        «{itemToDelete.name}»
                      </span>{' '}
                      را برای همیشه از منوی کافه رابیا حذف کنید؟
                    </p>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(null)}
                        className="px-4 py-2.5 rounded-xl bg-[#241E1B] text-[#A8988C] hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        id="confirm-delete-menu-item-btn"
                        onClick={handleConfirmDeleteItem}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-950/60 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>بله، حذف قطعی شود</span>
                      </button>
                    </div>
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
                    {stats.todayRevenue.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">درآمد این هفته:</span>
                  <span className="text-lg sm:text-xl font-black text-[#FDFBF7]">
                    {stats.weeklyRevenue.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">درآمد ماه جاری:</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400">
                    {stats.monthlyRevenue.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C1613] border border-[#C87D55]/30">
                  <span className="text-[11px] text-[#A8988C] block">کل درآمد سالانه:</span>
                  <span className="text-lg sm:text-xl font-black copper-gradient-text">
                    {stats.yearlyRevenue.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-[#A8988C] mr-1">تومان</span>
                </div>
              </div>

              {/* Filter bar & Excel Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#1C1613] border border-[#C87D55]/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A8988C]">دوره گزارش:</span>
                  {[
                    { id: 'daily', label: 'روزانه (7 روز اخیر)' },
                    { id: 'weekly', label: 'هفتگی (4 هفته اخیر)' },
                    { id: 'monthly', label: 'ماهانه (6 ماه اخیر)' },
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
                        formatter={(val: any) => [`${Number(val).toLocaleString('en-US')} تومان`, 'درآمد']}
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
                    <span className="text-[10px] text-[#A8988C]">رمز اختصاصی 4 رقمی</span>
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

              {/* PURGE / DANGER ZONE (عملیات پاکسازی داده‌ها) */}
              <div className="p-5 rounded-2xl bg-[#1C1412] border border-rose-900/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-900/40 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>عملیات پاکسازی داده‌های دیتابیس (منطقه حساس)</span>
                    </h4>
                    <p className="text-[11px] text-[#A8988C] mt-0.5">
                      گزینه‌های زیر برای ریست داده‌ها یا پاکسازی دوره‌ای دیتابیس تعبیه شده‌اند. قبل از حذف، تاییدیه «بله/خیر» دریافت می‌شود.
                    </p>
                  </div>
                  <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2.5 py-1 rounded-full font-bold self-start sm:self-auto">
                    ⚠️ اقدامات غیرقابل بازگشت
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Option 1: Clear All Orders */}
                  <div className="p-4 rounded-xl bg-[#17110F] border border-rose-900/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#FDFBF7]">پاکسازی تمام سفارش‌ها</span>
                        <span className="text-[10px] text-rose-400 font-mono">({orders.length} سفارش)</span>
                      </div>
                      <p className="text-[11px] text-[#8C7B71] mt-1.5 leading-relaxed">
                        حذف تمامی سفارش‌های ثبت‌شده (جاری، آماده و تحویل‌شده) از حافظه محلی و دیتابیس ابری.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurgeTarget('orders')}
                      className="w-full py-2 px-3 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>پاکسازی تمام سفارش‌ها</span>
                    </button>
                  </div>

                  {/* Option 2: Clear Users */}
                  <div className="p-4 rounded-xl bg-[#17110F] border border-rose-900/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#FDFBF7]">پاکسازی یوزرها</span>
                        <span className="text-[10px] text-rose-400 font-mono">({users.length} کاربر)</span>
                      </div>
                      <p className="text-[11px] text-[#8C7B71] mt-1.5 leading-relaxed">
                        حذف تمامی یوزرها، حساب‌های کاربری ثبت شده، درخواست‌ها و سوابق اعتباری آن‌ها.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurgeTarget('users')}
                      className="w-full py-2 px-3 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>پاکسازی یوزرها</span>
                    </button>
                  </div>

                  {/* Option 3: Clear All */}
                  <div className="p-4 rounded-xl bg-[#221210] border border-rose-700/50 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-rose-300">پاکسازی همه</span>
                        <span className="text-[10px] text-amber-300 font-bold">ریست کامل</span>
                      </div>
                      <p className="text-[11px] text-[#A8988C] mt-1.5 leading-relaxed">
                        حذف تمام اطلاعات ذخیره شده در دیتابیس شامل سفارشات، یوزرها و تراکنش‌های مالی به طور کامل.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurgeTarget('all')}
                      className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>پاکسازی همه</span>
                    </button>
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
                    <h4 className="text-sm font-bold text-[#FDFBF7]">کدهای SQL آماده برای ساخت جدول‌ها و ستون‌های تایمر</h4>
                    <span className="text-[11px] text-[#A8988C]">
                      این کدها را کپی کرده و در بخش SQL Editor داشبورد سوپابیس Run کنید (حاوی دستورات افزودن ستون‌های زمان‌سنجی):
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

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 text-amber-400 font-bold">نکته:</span>
                  <span>
                    اگر قبلاً جداول را ساخته‌اید، برای فعال‌سازی ذخیره زمان آماده‌سازی در سوپابیس کافیست دستورات ALTER TABLE موجود در این اسکریپت را یک‌بار در SQL Editor سوپابیس اجرا نمایید. (حتی در صورت اجرا نشدن، سیستم به صورت هوشمند وضعیت سفارش را بدون خطا در سوپابیس و کلاینت به‌روز می‌کند).
                  </span>
                </div>

                <pre className="p-4 rounded-xl bg-[#0F0D0C] border border-[#2B231E] text-[11px] text-[#A8988C] overflow-x-auto max-h-64 font-mono dir-ltr text-left leading-relaxed">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION MODAL FOR PURGING DATA */}
      {purgeTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1412] border border-rose-700/60 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />

            {/* Warning Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>

            {/* Title / Question */}
            <div className="space-y-2">
              <h3 className="text-xl font-black text-[#FDFBF7]">
                مطمئنی که می‌خوای پاک کنی؟
              </h3>
              <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed px-2">
                {purgeTarget === 'orders' && (
                  <>
                    آیا از حذف <strong className="text-white underline">تمام سفارش‌های ثبت شده</strong> اطمینان دارید؟ با تایید این مورد، تمامی سوابق سفارشات جاری و آرشیو شده به صورت دائمی پاک خواهند شد.
                  </>
                )}
                {purgeTarget === 'users' && (
                  <>
                    آیا از حذف <strong className="text-white underline">تمام یوزرها و مشتریان</strong> اطمینان دارید؟ تمامی اطلاعات کاربری و سوابق اعتبارات پاک خواهند شد.
                  </>
                )}
                {purgeTarget === 'all' && (
                  <>
                    ⚠️ هشدار: شما در حال پاکسازی <strong className="text-white underline">تمام اطلاعات ذخیره شده در دیتابیس</strong> هستید! همه سفارش‌ها، یوزرها و تراکنش‌ها به صورت کامل پاک خواهند شد.
                  </>
                )}
              </p>
            </div>

            {/* Feedback / Result notification */}
            {purgeResult && (
              <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 ${
                purgeResult.success
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-700 text-rose-300'
              }`}>
                {purgeResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{purgeResult.message}</span>
              </div>
            )}

            {/* Action Buttons: YES (بله) and NO (خیر) */}
            {!purgeResult?.success && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* YES BUTTON (بله) */}
                <button
                  type="button"
                  onClick={handleConfirmPurge}
                  disabled={isPurging}
                  className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 cursor-pointer"
                >
                  {isPurging ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال پاکسازی...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>بله</span>
                    </>
                  )}
                </button>

                {/* NO BUTTON (خیر) */}
                <button
                  type="button"
                  onClick={() => {
                    setPurgeTarget(null);
                    setPurgeResult(null);
                  }}
                  disabled={isPurging}
                  className="py-3 px-4 rounded-xl bg-[#2A201A] hover:bg-[#382C25] border border-[#C87D55]/30 text-[#D8C7B8] hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>خیر</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Automatic Backup Exit Modal (پرسش از مدیر هنگام خروج از پنل) */}
      {showExitBackupConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#181311] border-2 border-[#C87D55]/60 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(200,125,85,0.25)] text-center space-y-5">
            {/* Header Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#2A201A] border border-[#C87D55]/40 flex items-center justify-center shadow-inner">
              <Database className="w-8 h-8 text-[#E29D74] animate-pulse" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider bg-[#C87D55]/15 text-[#E29D74] border border-[#C87D55]/30">
                <Calendar className="w-3.5 h-3.5 text-[#C87D55]" />
                بک‌آپ گیری روزانه دیتابیس
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[#FDFBF7] pt-1">
                آیا می‌خواهید از داده‌های امروز بک‌آپ بگیرید؟
              </h3>
              <p className="text-xs text-[#A8988C] leading-relaxed">
                نسخه پشتیبان شامل سفارش‌های امروز، کلیه کاربران و موجودی اعتباری، آیتم‌های منو و تاریخ دقیق جهت بازیابی مطمئن است.
              </p>
            </div>

            {/* Date and Daily Activity Summary Box */}
            <div className="p-4 rounded-2xl bg-[#1F1815] border border-[#C87D55]/25 text-right space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#C87D55]/20">
                <div className="flex items-center gap-1.5 text-[#C4B3A5]">
                  <Calendar className="w-4 h-4 text-[#C87D55]" />
                  <span>تاریخ امروز (شمسی):</span>
                </div>
                <strong className="text-[#FDFBF7] font-mono text-sm" dir="ltr">
                  {todayBackupStats?.dateInfo.shamsiDate}
                </strong>
              </div>

              <div className="flex items-center justify-between text-[#A8988C] text-[11px]">
                <span>تاریخ میلادی:</span>
                <span className="font-mono text-[#D8C7B8]" dir="ltr">
                  {todayBackupStats?.dateInfo.gregorianDate}
                </span>
              </div>

              {todayBackupStats?.dateInfo.shamsiFull && (
                <div className="text-[11px] text-[#C87D55] font-semibold text-center bg-[#2A201A] py-1.5 px-2.5 rounded-lg border border-[#C87D55]/20">
                  {todayBackupStats.dateInfo.shamsiFull}
                </div>
              )}

              <div className="pt-2 border-t border-[#C87D55]/15 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/30 border border-[#C87D55]/10">
                  <span className="text-[10px] text-[#8F7E73] block mb-0.5">سفارش‌های امروز</span>
                  <span className="text-xs sm:text-sm font-black text-[#FDFBF7]">
                    {todayBackupStats?.ordersCount ?? 0} سفارش
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-[#C87D55]/10">
                  <span className="text-[10px] text-[#8F7E73] block mb-0.5">کاربران و اعتبارات</span>
                  <span className="text-xs sm:text-sm font-black text-amber-300">
                    {todayBackupStats?.totalUsersInDb ?? 0} کاربر
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-[#C87D55]/10">
                  <span className="text-[10px] text-[#8F7E73] block mb-0.5">فروش کل امروز</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-400">
                    {(todayBackupStats?.salesToday ?? 0).toLocaleString('fa-IR')} <span className="text-[9px] font-normal text-[#A8988C]">تومان</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Download Status Notice */}
            {backupDownloadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">فایل با موفقیت دانلود شد. در حال خروج از پنل...</span>
              </div>
            )}

            {/* Action Buttons: YES (بله) and NO (خیر) */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-3">
                {/* YES (بله) */}
                <button
                  type="button"
                  onClick={handleConfirmExitWithBackup}
                  disabled={backupDownloadSuccess}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-70"
                >
                  <Download className="w-4 h-4" />
                  <span>بله (دانلود و خروج)</span>
                </button>

                {/* NO (خیر) */}
                <button
                  type="button"
                  onClick={handleConfirmExitWithoutBackup}
                  disabled={backupDownloadSuccess}
                  className="py-3 px-4 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-70"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خیر (فقط خروج)</span>
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setShowExitBackupConfirm(false)}
                disabled={backupDownloadSuccess}
                className="w-full py-2 text-xs text-[#A8988C] hover:text-[#FDFBF7] font-medium transition-colors cursor-pointer"
              >
                انصراف و ماندن در پنل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preparation Time Selection Modal */}
      {orderToPrepare && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#1C1613] border border-[#C87D55]/40 shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 text-right">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#C87D55]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#FDFBF7]">تعیین زمان آماده‌سازی</h4>
                  <p className="text-xs text-[#A8988C]">سفارش {orderToPrepare.orderNumber} ({orderToPrepare.userName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToPrepare(null)}
                className="w-8 h-8 rounded-full bg-[#251D19] border border-[#C87D55]/20 text-[#A8988C] hover:text-[#FDFBF7] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-[#D8C7B8] leading-relaxed">
              مدت زمان تخمینی برای دم‌آوری و آماده شدن سفارش را انتخاب کنید. یک تایمر روزشمار در بخش پیگیری سفارش مشتری فعال خواهد شد و پس از پایان زمان، وضعیت به صورت خودکار به پیک در مسیر تغییر می‌کند.
            </p>

            {/* Preset Time Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#FDFBF7] block">زمان‌های پیشنهادی (دقیقه):</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20, 25, 30, 45, 60].map((mins) => {
                  const isSelected = !customPrepMinutes && selectedPrepMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSelectedPrepMinutes(mins);
                        setCustomPrepMinutes('');
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-950/50'
                          : 'bg-[#251D19] text-[#D8C7B8] border-[#C87D55]/20 hover:border-sky-500/40 hover:text-white'
                      }`}
                    >
                      {mins} دقیقه
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-[#A8988C] block">یا وارد کردن زمان دلخواه (دقیقه):</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="مثلاً ۱۲"
                  value={customPrepMinutes}
                  onChange={(e) => setCustomPrepMinutes(e.target.value)}
                  className="w-full bg-[#251D19] border border-[#C87D55]/30 rounded-xl px-3 py-2 text-sm text-[#FDFBF7] focus:outline-none focus:border-sky-500 transition-colors placeholder:text-[#A8988C]/40 text-left"
                  dir="ltr"
                />
                <span className="absolute right-3 top-2 text-xs text-[#A8988C] pointer-events-none">دقیقه</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmOrderPreparation}
                className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-lg shadow-sky-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>شروع آماده‌سازی ({customPrepMinutes || selectedPrepMinutes} دقیقه)</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderToPrepare(null)}
                className="py-2.5 px-4 rounded-xl bg-[#251D19] hover:bg-[#2F2420] text-[#D8C7B8] text-xs font-bold transition-all border border-[#C87D55]/20 cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#1C1613] border border-amber-500/40 shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 text-right">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#C87D55]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#FDFBF7]">بازنشانی رمز عبور مشتری</h3>
                  <p className="text-xs text-[#A8988C]">
                    {passwordResetUser.name} ({passwordResetUser.phone})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="p-1.5 rounded-xl hover:bg-[#251D19] text-[#A8988C] hover:text-[#FDFBF7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/30 text-xs text-amber-200/90 leading-relaxed">
              با تایید این فرم، رمز عبور جدید روی حساب مشتری اعمال خواهد شد و وی می‌تواند با این رمز و شماره موبایل خود وارد سیستم شود. پس از ورود، مشتری قادر است از بخش پروفایل رمز خود را تغییر دهد.
            </div>

            {/* Password input / presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#D8C7B8] block">
                تعیین رمز عبور جدید:
              </label>

              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={customPasswordInput}
                  onChange={(e) => setCustomPasswordInput(e.target.value)}
                  placeholder="مثلاً 1234"
                  className="w-full bg-[#251D19] border border-[#C87D55]/40 focus:border-amber-400 rounded-xl px-3 py-2.5 text-sm text-[#FDFBF7] focus:outline-none font-mono tracking-wider text-center"
                />
              </div>

              {/* Fast Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] text-[#A8988C]">پیشنهاد سریع:</span>
                <button
                  type="button"
                  onClick={() => setCustomPasswordInput('1234')}
                  className="px-2.5 py-1 rounded-lg bg-[#251D19] hover:bg-[#342823] border border-[#C87D55]/20 text-[11px] text-[#E0946B] font-mono"
                >
                  1234
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPasswordInput(passwordResetUser.phone.slice(-4) || '1234')}
                  className="px-2.5 py-1 rounded-lg bg-[#251D19] hover:bg-[#342823] border border-[#C87D55]/20 text-[11px] text-[#E0946B] font-mono"
                >
                  ۴ رقم آخر شماره ({passwordResetUser.phone.slice(-4)})
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResetPassword(passwordResetUser.id, customPasswordInput)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-black shadow-lg shadow-amber-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>ثبت و تنظیم رمز ({customPasswordInput})</span>
              </button>

              <button
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="py-2.5 px-4 rounded-xl bg-[#251D19] hover:bg-[#2F2420] text-[#D8C7B8] text-xs font-bold transition-all border border-[#C87D55]/20 cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
