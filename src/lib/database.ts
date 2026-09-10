import { User, MenuItem, Order, CreditTransaction, OrderStatus, CafeStats } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import { getSupabaseClient } from './supabase';

const USERS_KEY = 'rabia_users_data';
const MENU_KEY = 'rabia_menu_data';
const ORDERS_KEY = 'rabia_orders_data';
const TRANSACTIONS_KEY = 'rabia_transactions_data';
const BROADCAST_CHANNEL_NAME = 'rabia_cafe_realtime_bus';

// BroadcastChannel for cross-tab realtime sync
let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported', e);
}

// Initial demo users to test out of the box
const INITIAL_USERS: User[] = [
  {
    id: 'user-approved-1',
    name: 'علی رضایی',
    phone: '09120001122',
    password: '123456',
    address: 'تهران، خیابان ولیعصر، فرشته، خیابان مریم، برج رز، طبقه ۴',
    rabiaCredit: 350000,
    status: 'approved',
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
  {
    id: 'user-pending-1',
    name: 'سارا محمدی',
    phone: '09121112233',
    password: '123456',
    address: 'تهران، سعادت آباد، میدان کاج، پلاک ۱۸',
    rabiaCredit: 0,
    status: 'pending',
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: '#RAB-1001',
    userId: 'user-approved-1',
    userName: 'علی رضایی',
    userPhone: '09120001122',
    orderType: 'takeaway',
    address: 'تهران، خیابان ولیعصر، فرشته، خیابان مریم، برج رز، طبقه ۴',
    items: [
      { itemId: 'item-1', name: 'اسپرسو دبل رابیا', price: 68000, quantity: 2 },
      { itemId: 'item-9', name: 'چیزکیک سن‌سباستین با سس بلژیکی', price: 155000, quantity: 1 }
    ],
    totalAmount: 291000,
    paymentMethod: 'rabia_credit',
    status: 'delivered',
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  },
  {
    id: 'ord-102',
    orderNumber: '#RAB-1002',
    userName: 'مهمان سالن (امیرحسین)',
    userPhone: '09355556677',
    orderType: 'dine_in',
    tableNumber: 'میز ۷',
    items: [
      { itemId: 'item-5', name: 'آیس لاته پسته زعفرانی', price: 145000, quantity: 1 },
      { itemId: 'item-10', name: 'تیرامیسو اصل ایتالیایی', price: 140000, quantity: 1 }
    ],
    totalAmount: 285000,
    paymentMethod: 'counter_pos',
    status: 'preparing',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  }
];

// Helper to notify listeners
export function emitRealtimeEvent(type: string, payload?: any) {
  try {
    if (channel) {
      channel.postMessage({ type, payload, timestamp: Date.now() });
    }
    // Also dispatch custom DOM event in same window
    window.dispatchEvent(new CustomEvent('rabia_realtime', { detail: { type, payload } }));
  } catch (err) {
    console.warn('Realtime event error:', err);
  }
}

export function subscribeRealtime(callback: (event: { type: string; payload?: any }) => void) {
  const handler = (e: any) => {
    callback(e.detail);
  };
  window.addEventListener('rabia_realtime', handler);

  const bcHandler = (e: MessageEvent) => {
    callback(e.data);
  };
  if (channel) {
    channel.addEventListener('message', bcHandler);
  }

  return () => {
    window.removeEventListener('rabia_realtime', handler);
    if (channel) {
      channel.removeEventListener('message', bcHandler);
    }
  };
}

// ---------------- MENU ITEMS ----------------
export function getMenuItems(): MenuItem[] {
  try {
    const data = localStorage.getItem(MENU_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(MENU_KEY, JSON.stringify(INITIAL_MENU_ITEMS));
    return INITIAL_MENU_ITEMS;
  } catch {
    return INITIAL_MENU_ITEMS;
  }
}

export function saveMenuItem(item: MenuItem): MenuItem {
  const items = getMenuItems();
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.unshift(item);
  }
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
  emitRealtimeEvent('menu_updated', item);
  return item;
}

export function toggleMenuItemStock(itemId: string): boolean {
  const items = getMenuItems();
  const item = items.find((i) => i.id === itemId);
  if (item) {
    item.isAvailable = !item.isAvailable;
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
    emitRealtimeEvent('menu_updated', item);
    return item.isAvailable;
  }
  return false;
}

export function deleteMenuItem(itemId: string) {
  const items = getMenuItems().filter((i) => i.id !== itemId);
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
  emitRealtimeEvent('menu_updated', { id: itemId, deleted: true });
}

// ---------------- USERS ----------------
export function getUsers(): User[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  } catch {
    return INITIAL_USERS;
  }
}

export function registerUser(user: Omit<User, 'id' | 'rabiaCredit' | 'status' | 'createdAt'>): { success: boolean; message: string; user?: User } {
  const users = getUsers();
  const cleanPhone = user.phone.trim().replace(/^(\+98|0098)/, '0');
  
  if (users.some((u) => u.phone.trim() === cleanPhone)) {
    return { success: false, message: 'این شماره تلفن قبلاً در سیستم ثبت نام کرده است.' };
  }

  const newUser: User = {
    id: 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: user.name.trim(),
    phone: cleanPhone,
    password: user.password,
    address: user.address || '',
    rabiaCredit: 0,
    status: 'pending', // Requires admin approval
    createdAt: new Date().toISOString(),
  };

  users.unshift(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  emitRealtimeEvent('user_registered', newUser);

  return {
    success: true,
    message: 'ثبت‌نام شما با موفقیت انجام شد. پس از تایید مدیریت کافه رابیا، حساب کاربری شما فعال خواهد شد.',
    user: newUser,
  };
}

export function loginUser(phone: string, password: string): { success: boolean; message: string; user?: User } {
  const users = getUsers();
  const cleanPhone = phone.trim().replace(/^(\+98|0098)/, '0');
  const user = users.find((u) => u.phone === cleanPhone);

  if (!user) {
    return { success: false, message: 'کاربری با این شماره تلفن یافت نشد. لطفاً ابتدا ثبت نام کنید.' };
  }

  if (user.password && user.password !== password) {
    return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
  }

  if (user.status === 'pending') {
    return {
      success: false,
      message: 'حساب کاربری شما هنوز توسط مدیریت کافه رابیا تایید نشده است. به محض تایید مدیریت می‌توانید وارد شوید.',
    };
  }

  if (user.status === 'rejected') {
    return { success: false, message: 'متاسفانه درخواست عضویت این شماره تلفن تایید نشده است.' };
  }

  return { success: true, message: 'خوش آمدید!', user };
}

export function updateUserProfile(userId: string, updates: Partial<User>): User | null {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  Object.assign(user, updates);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  emitRealtimeEvent('user_updated', user);
  return user;
}

export function approveUser(userId: string, approve: boolean = true) {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.status = approve ? 'approved' : 'rejected';
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    emitRealtimeEvent('user_status_changed', user);
  }
}

export function findUserByPhone(phone: string): User | null {
  const users = getUsers();
  const clean = phone.trim().replace(/^(\+98|0098)/, '0');
  return users.find((u) => u.phone.includes(clean) || clean.includes(u.phone)) || null;
}

// ---------------- RABIA CREDIT SYSTEM ----------------
export function getTransactions(): CreditTransaction[] {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    if (data) return JSON.parse(data);
    return [];
  } catch {
    return [];
  }
}

export function adjustUserCredit(
  userId: string,
  amount: number,
  type: 'admin_charge' | 'order_payment' | 'in_person_order',
  description: string,
  adminNote?: string
): { success: boolean; newCredit: number; message: string } {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return { success: false, newCredit: 0, message: 'کاربر مورد نظر یافت نشد.' };
  }

  if (amount < 0 && user.rabiaCredit < Math.abs(amount)) {
    return { success: false, newCredit: user.rabiaCredit, message: 'موجودی اعتبار کاربر کمتر از مبلغ درخواستی است.' };
  }

  user.rabiaCredit = Math.max(0, user.rabiaCredit + amount);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const transaction: CreditTransaction = {
    id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    userId: user.id,
    userPhone: user.phone,
    userName: user.name,
    amount,
    type,
    description,
    createdAt: new Date().toISOString(),
    adminNote,
  };

  const transactions = getTransactions();
  transactions.unshift(transaction);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

  emitRealtimeEvent('credit_updated', { userId: user.id, newCredit: user.rabiaCredit, transaction });
  return { success: true, newCredit: user.rabiaCredit, message: 'اعتبار با موفقیت به‌روزرسانی شد.' };
}

// ---------------- ORDERS ----------------
export function getOrders(): Order[] {
  try {
    const data = localStorage.getItem(ORDERS_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  } catch {
    return INITIAL_ORDERS;
  }
}

export function createOrder(orderInput: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'status'>): {
  success: boolean;
  order?: Order;
  message: string;
} {
  // If payment method is rabia_credit and user is provided, deduct credit
  if (orderInput.paymentMethod === 'rabia_credit' && orderInput.userId) {
    const user = getUsers().find((u) => u.id === orderInput.userId);
    if (!user || user.rabiaCredit < orderInput.totalAmount) {
      return {
        success: false,
        message: 'موجودی اعتبار حساب رابیا شما برای پرداخت این سفارش کافی نیست.',
      };
    }

    // Deduct credit
    adjustUserCredit(
      user.id,
      -orderInput.totalAmount,
      'order_payment',
      `پرداخت سفارش آنلاین رابیا (${orderInput.totalAmount.toLocaleString('fa-IR')} تومان)`
    );
  }

  const orderNumber = '#RAB-' + Math.floor(1000 + Math.random() * 9000);
  const newOrder: Order = {
    ...orderInput,
    id: 'ord-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    orderNumber,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const orders = getOrders();
  orders.unshift(newOrder);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

  emitRealtimeEvent('order_created', newOrder);

  return {
    success: true,
    order: newOrder,
    message: 'سفارش شما با موفقیت ثبت شد و به صورت آنی برای باریستای رابیا ارسال گردید.',
  };
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    order.status = status;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    emitRealtimeEvent('order_status_updated', order);
  }
}

// ---------------- STATS & REPORTS ----------------
export function getCafeStats(): CafeStats {
  const orders = getOrders().filter((o) => o.status !== 'cancelled');
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 3600 * 1000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  let todayRevenue = 0;
  let todayOrdersCount = 0;
  let weeklyRevenue = 0;
  let monthlyRevenue = 0;
  let yearlyRevenue = 0;

  for (const order of orders) {
    const time = new Date(order.createdAt).getTime();
    if (time >= startOfDay) {
      todayRevenue += order.totalAmount;
      todayOrdersCount += 1;
    }
    if (time >= startOfWeek) {
      weeklyRevenue += order.totalAmount;
    }
    if (time >= startOfMonth) {
      monthlyRevenue += order.totalAmount;
    }
    if (time >= startOfYear) {
      yearlyRevenue += order.totalAmount;
    }
  }

  const users = getUsers().filter((u) => u.status === 'approved');

  return {
    todayRevenue,
    todayOrdersCount,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalCustomers: users.length,
  };
}

export function getChartData(period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const orders = getOrders().filter((o) => o.status !== 'cancelled');

  if (period === 'daily') {
    // Last 7 days
    const days: { label: string; revenue: number; ordersCount: number }[] = [];
    const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 3600 * 1000;
      
      const dayOrders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      });

      const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      days.push({
        label: dayNames[d.getDay()],
        revenue,
        ordersCount: dayOrders.length,
      });
    }
    return days;
  } else if (period === 'weekly') {
    // 4 Weeks
    const weeks: { label: string; revenue: number; ordersCount: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekOrders = orders.filter((o) => {
        const ageDays = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 3600 * 24);
        return ageDays >= i * 7 && ageDays < (i + 1) * 7;
      });
      weeks.push({
        label: `هفته ${4 - i}`,
        revenue: weekOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        ordersCount: weekOrders.length,
      });
    }
    return weeks;
  } else if (period === 'monthly') {
    // 6 Months
    const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const months: { label: string; revenue: number; ordersCount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mOrders = orders.filter((o) => {
        const od = new Date(o.createdAt);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      });
      months.push({
        label: persianMonths[d.getMonth() % 12],
        revenue: mOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        ordersCount: mOrders.length,
      });
    }
    return months;
  } else {
    // Yearly
    const years: { label: string; revenue: number; ordersCount: number }[] = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear; y++) {
      const yOrders = orders.filter((o) => new Date(o.createdAt).getFullYear() === y);
      years.push({
        label: `${1402 + (y - (currentYear - 2))}`,
        revenue: yOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        ordersCount: yOrders.length,
      });
    }
    return years;
  }
}

// ---------------- EXCEL EXPORT (CSV with UTF-8 BOM) ----------------
export function exportOrdersToExcelCSV() {
  const orders = getOrders();
  
  const headers = [
    'شماره سفارش',
    'نام مشتری',
    'شماره تلفن',
    'نوع سفارش',
    'آدرس / شماره میز',
    'اقلام سفارش',
    'مبلغ کل (تومان)',
    'نحوه پرداخت',
    'وضعیت سفارش',
    'تاریخ و زمان ثبت'
  ];

  const rows = orders.map((o) => {
    const itemsSummary = o.items.map((it) => `${it.name} (${it.quantity} عدد)`).join(' + ');
    const orderType = o.orderType === 'takeaway' ? 'بیرون‌بر' : 'سرو در سالن';
    const location = o.orderType === 'takeaway' ? (o.address || 'بدون آدرس') : (o.tableNumber || 'میز سالن');
    const payment = o.paymentMethod === 'rabia_credit' ? 'اعتبار حساب رابیا' : 'کارت‌خوان حضوری صندوق';
    
    let statusText = 'در انتظار';
    if (o.status === 'preparing') statusText = 'در حال آماده‌سازی';
    if (o.status === 'ready') statusText = 'آماده تحویل/سرو';
    if (o.status === 'delivered') statusText = 'تحویل داده شده';
    if (o.status === 'cancelled') statusText = 'لغو شده';

    const dateStr = new Date(o.createdAt).toLocaleString('fa-IR');

    return [
      `"${o.orderNumber}"`,
      `"${o.userName}"`,
      `"${o.userPhone}"`,
      `"${orderType}"`,
      `"${location.replace(/"/g, '""')}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      o.totalAmount,
      `"${payment}"`,
      `"${statusText}"`,
      `"${dateStr}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Rabia_Cafe_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
