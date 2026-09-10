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

// Initial users and orders are cleared to empty arrays for production deployment
const INITIAL_USERS: User[] = [];
const INITIAL_ORDERS: Order[] = [];

// Clean state for production deployment - wipe any test/demo data from previous dev sessions
const DEPLOY_INIT_RESET_KEY = 'rabia_deploy_clean_v3';
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(DEPLOY_INIT_RESET_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify([]));
      localStorage.setItem(ORDERS_KEY, JSON.stringify([]));
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
      localStorage.setItem(DEPLOY_INIT_RESET_KEY, 'true');
    }
  } catch (e) {
    console.warn('Init deploy clean error:', e);
  }
}

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

// Helper to parse availability boolean strictly
export function parseIsAvailable(val: any): boolean {
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  return true;
}

// ---------------- SUPABASE REALTIME & SYNC ----------------
let isRealtimeSubscribed = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

export async function initSupabaseRealtimeSync() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Set up 4-second backup polling loop so even without websockets or on network sleep, orders refresh
  if (!pollIntervalId && typeof window !== 'undefined') {
    pollIntervalId = setInterval(() => {
      syncAllWithSupabase();
    }, 4000);
  }

  if (isRealtimeSubscribed) return;
  isRealtimeSubscribed = true;

  try {
    // Initial fetch to sync remote data into local state
    await syncAllWithSupabase();

    // 1. Subscribe to Orders changes across all devices/computers
    supabase
      .channel('rabia_orders_realtime_ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          const orders = getOrders();
          if (payload.eventType === 'INSERT') {
            const raw = payload.new;
            const newOrd: Order = {
              id: raw.id,
              orderNumber: raw.order_number,
              userId: raw.user_id || undefined,
              userName: raw.user_name,
              userPhone: raw.user_phone,
              orderType: raw.order_type,
              address: raw.address || undefined,
              tableNumber: raw.table_number || undefined,
              items: typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items,
              totalAmount: Number(raw.total_amount),
              paymentMethod: raw.payment_method,
              status: raw.status,
              createdAt: raw.created_at,
              notes: raw.notes || undefined,
            };
            if (!orders.some((o) => o.id === newOrd.id)) {
              orders.unshift(newOrd);
              localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
              emitRealtimeEvent('order_created', newOrd);
            }
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new;
            const idx = orders.findIndex((o) => o.id === raw.id);
            if (idx >= 0) {
              orders[idx].status = raw.status;
              orders[idx].totalAmount = Number(raw.total_amount);
              localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
              emitRealtimeEvent('order_status_updated', orders[idx]);
            }
          } else if (payload.eventType === 'DELETE') {
            const updated = orders.filter((o) => o.id !== payload.old.id);
            localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
            emitRealtimeEvent('order_status_updated', { id: payload.old.id, deleted: true });
          }
        }
      )
      .subscribe();

    // 2. Subscribe to Users changes (registrations, approvals, credits)
    supabase
      .channel('rabia_users_realtime_ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload: any) => {
          const users = getUsers();
          if (payload.eventType === 'INSERT') {
            const raw = payload.new;
            const newU: User = {
              id: raw.id,
              name: raw.name,
              phone: raw.phone,
              password: raw.password,
              address: raw.address || '',
              rabiaCredit: Number(raw.rabia_credit || 0),
              status: raw.status || 'pending',
              createdAt: raw.created_at,
            };
            if (!users.some((u) => u.id === newU.id)) {
              users.unshift(newU);
              localStorage.setItem(USERS_KEY, JSON.stringify(users));
              emitRealtimeEvent('user_registered', newU);
            }
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new;
            const idx = users.findIndex((u) => u.id === raw.id);
            if (idx >= 0) {
              users[idx].status = raw.status;
              users[idx].rabiaCredit = Number(raw.rabia_credit || 0);
              users[idx].name = raw.name;
              users[idx].address = raw.address || '';
              localStorage.setItem(USERS_KEY, JSON.stringify(users));
              emitRealtimeEvent('user_status_changed', users[idx]);
              emitRealtimeEvent('credit_updated', { userId: raw.id, newCredit: users[idx].rabiaCredit });
            }
          }
        }
      )
      .subscribe();

    // 3. Subscribe to Menu changes
    supabase
      .channel('rabia_menu_realtime_ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload: any) => {
          const items = getMenuItems();
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const raw = payload.new;
            const item: MenuItem = {
              id: raw.id,
              name: raw.name,
              nameEn: raw.name_en || '',
              category: raw.category,
              price: Number(raw.price),
              description: raw.description || '',
              ingredients: raw.ingredients || [],
              image: raw.image || '',
              isAvailable: parseIsAvailable(raw.is_available),
              isFeatured: raw.is_featured,
            };
            const idx = items.findIndex((i) => i.id === item.id);
            if (idx >= 0) items[idx] = item;
            else items.unshift(item);
            localStorage.setItem(MENU_KEY, JSON.stringify(items));
            emitRealtimeEvent('menu_updated', item);
          } else if (payload.eventType === 'DELETE') {
            const updated = items.filter((i) => i.id !== payload.old.id);
            localStorage.setItem(MENU_KEY, JSON.stringify(updated));
            emitRealtimeEvent('menu_updated', { id: payload.old.id, deleted: true });
          }
        }
      )
      .subscribe();

  } catch (err) {
    console.warn('Error setting up Supabase realtime sync:', err);
  }
}

export async function syncAllWithSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Orders
    const { data: dbOrders, error: ordErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ordErr && dbOrders && dbOrders.length > 0) {
      const mappedOrders: Order[] = dbOrders.map((raw: any) => ({
        id: raw.id,
        orderNumber: raw.order_number,
        userId: raw.user_id || undefined,
        userName: raw.user_name,
        userPhone: raw.user_phone,
        orderType: raw.order_type,
        address: raw.address || undefined,
        tableNumber: raw.table_number || undefined,
        items: typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items,
        totalAmount: Number(raw.total_amount),
        paymentMethod: raw.payment_method,
        status: raw.status,
        createdAt: raw.created_at,
        notes: raw.notes || undefined,
      }));
      localStorage.setItem(ORDERS_KEY, JSON.stringify(mappedOrders));
      emitRealtimeEvent('order_status_updated');
    }

    // 2. Users
    const { data: dbUsers, error: uErr } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!uErr && dbUsers && dbUsers.length > 0) {
      const mappedUsers: User[] = dbUsers.map((raw: any) => ({
        id: raw.id,
        name: raw.name,
        phone: raw.phone,
        password: raw.password,
        address: raw.address || '',
        rabiaCredit: Number(raw.rabia_credit || 0),
        status: raw.status,
        createdAt: raw.created_at,
      }));
      localStorage.setItem(USERS_KEY, JSON.stringify(mappedUsers));
      emitRealtimeEvent('user_updated');
    }

    // 3. Menu items
    const { data: dbMenu, error: mErr } = await supabase
      .from('menu_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (!mErr && dbMenu) {
      if (dbMenu.length > 0) {
        const mappedMenu: MenuItem[] = dbMenu.map((raw: any) => ({
          id: raw.id,
          name: raw.name,
          nameEn: raw.name_en || '',
          category: raw.category,
          price: Number(raw.price),
          description: raw.description || '',
          ingredients: raw.ingredients || [],
          image: raw.image || '',
          isAvailable: parseIsAvailable(raw.is_available),
          isFeatured: raw.is_featured,
        }));
        localStorage.setItem(MENU_KEY, JSON.stringify(mappedMenu));
        emitRealtimeEvent('menu_updated');
      } else {
        // Table exists in Supabase but is empty: automatically seed current menu so all devices have it!
        const localMenu = getMenuItems();
        if (localMenu && localMenu.length > 0) {
          const payload = localMenu.map((m) => ({
            id: m.id,
            name: m.name,
            name_en: m.nameEn || null,
            category: m.category,
            price: m.price,
            description: m.description,
            ingredients: m.ingredients || [],
            image: m.image || null,
            is_available: parseIsAvailable(m.isAvailable),
            is_featured: m.isFeatured || false,
          }));
          await supabase.from('menu_items').upsert(payload);
        }
      }
    }
  } catch (e) {
    console.warn('Sync with Supabase failed:', e);
  }
}

// ---------------- MENU ITEMS ----------------
export function getMenuItems(): MenuItem[] {
  try {
    const data = localStorage.getItem(MENU_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: MenuItem) => ({
          ...item,
          isAvailable: parseIsAvailable(item.isAvailable),
        }));
      }
    }
    const cleanInitial = INITIAL_MENU_ITEMS.map((item) => ({
      ...item,
      isAvailable: parseIsAvailable(item.isAvailable),
    }));
    localStorage.setItem(MENU_KEY, JSON.stringify(cleanInitial));
    return cleanInitial;
  } catch {
    return INITIAL_MENU_ITEMS;
  }
}

export function saveMenuItem(item: MenuItem): MenuItem {
  const cleanItem: MenuItem = {
    ...item,
    isAvailable: parseIsAvailable(item.isAvailable),
  };
  const items = getMenuItems();
  const index = items.findIndex((i) => i.id === cleanItem.id);
  if (index >= 0) {
    items[index] = cleanItem;
  } else {
    items.unshift(cleanItem);
  }
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
  emitRealtimeEvent('menu_updated', cleanItem);

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('menu_items')
      .upsert({
        id: cleanItem.id,
        name: cleanItem.name,
        name_en: cleanItem.nameEn || null,
        category: cleanItem.category,
        price: cleanItem.price,
        description: cleanItem.description,
        ingredients: cleanItem.ingredients || [],
        image: cleanItem.image || null,
        is_available: cleanItem.isAvailable,
        is_featured: cleanItem.isFeatured || false,
      })
      .then(({ error }) => {
        if (error) console.error('Supabase menu upsert error:', error);
      });
  }

  return cleanItem;
}

export async function toggleMenuItemStock(itemId: string): Promise<boolean> {
  const items = getMenuItems();
  const item = items.find((i) => i.id === itemId);
  if (item) {
    const currentVal = parseIsAvailable(item.isAvailable);
    const newStatus = !currentVal;
    item.isAvailable = newStatus;
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
    emitRealtimeEvent('menu_updated', item);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('menu_items')
          .upsert({
            id: item.id,
            name: item.name,
            name_en: item.nameEn || null,
            category: item.category,
            price: item.price,
            description: item.description,
            ingredients: item.ingredients || [],
            image: item.image || null,
            is_available: newStatus,
            is_featured: item.isFeatured || false,
          });

        if (error) {
          console.warn('Supabase upsert menu stock error, trying update fallback:', error);
          await supabase
            .from('menu_items')
            .update({ is_available: newStatus })
            .eq('id', itemId);
        }
      } catch (err) {
        console.error('Supabase toggle stock error:', err);
      }
    }

    return newStatus;
  }
  return false;
}

export function deleteMenuItem(itemId: string) {
  const items = getMenuItems().filter((i) => i.id !== itemId);
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
  emitRealtimeEvent('menu_updated', { id: itemId, deleted: true });

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId)
      .then(({ error }) => {
        if (error) console.error('Supabase delete item error:', error);
      });
  }
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

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('users')
      .insert({
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        password: newUser.password,
        address: newUser.address,
        rabia_credit: newUser.rabiaCredit,
        status: newUser.status,
        created_at: newUser.createdAt,
      })
      .then(({ error }) => {
        if (error) console.error('Supabase user insert error:', error);
      });
  }

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

  const supabase = getSupabaseClient();
  if (supabase) {
    const supabaseUpdates: any = {};
    if (updates.name !== undefined) supabaseUpdates.name = updates.name;
    if (updates.address !== undefined) supabaseUpdates.address = updates.address;
    if (updates.password !== undefined) supabaseUpdates.password = updates.password;
    if (updates.rabiaCredit !== undefined) supabaseUpdates.rabia_credit = updates.rabiaCredit;
    if (updates.status !== undefined) supabaseUpdates.status = updates.status;

    supabase
      .from('users')
      .update(supabaseUpdates)
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Supabase user update error:', error);
      });
  }

  return user;
}

export function approveUser(userId: string, approve: boolean = true) {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.status = approve ? 'approved' : 'rejected';
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    emitRealtimeEvent('user_status_changed', user);

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('users')
        .update({ status: user.status })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.error('Supabase user approval error:', error);
        });
    }
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
export const getCreditTransactions = getTransactions;

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

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('users')
      .update({ rabia_credit: user.rabiaCredit })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Supabase credit user update error:', error);
      });

    supabase
      .from('credit_transactions')
      .insert({
        id: transaction.id,
        user_id: transaction.userId,
        user_phone: transaction.userPhone,
        user_name: transaction.userName,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        created_at: transaction.createdAt,
        admin_note: transaction.adminNote || null,
      })
      .then(({ error }) => {
        if (error) console.error('Supabase transaction insert error:', error);
      });
  }

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

export async function createOrder(orderInput: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'status'>): Promise<{
  success: boolean;
  order?: Order;
  message: string;
}> {
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

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('orders')
        .insert({
          id: newOrder.id,
          order_number: newOrder.orderNumber,
          user_id: newOrder.userId || null,
          user_name: newOrder.userName,
          user_phone: newOrder.userPhone,
          order_type: newOrder.orderType,
          address: newOrder.address || null,
          table_number: newOrder.tableNumber || null,
          items: newOrder.items,
          total_amount: newOrder.totalAmount,
          payment_method: newOrder.paymentMethod,
          status: newOrder.status,
          created_at: newOrder.createdAt,
          notes: newOrder.notes || null,
        });
      if (error) {
        console.error('Supabase order insert error:', error);
      }
    } catch (err) {
      console.error('Supabase order insert exception:', err);
    }
  }

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

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .then(({ error }) => {
          if (error) console.error('Supabase order status update error:', error);
        });
    }
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

// ---------------- FULL DATABASE BACKUP & RESTORE (JSON IMPORT / EXPORT) ----------------
export interface FullDatabaseBackup {
  version: string;
  exportedAt: string;
  app: string;
  orders: Order[];
  users: User[];
  menuItems: MenuItem[];
  transactions: CreditTransaction[];
}

export function exportFullDatabaseBackup() {
  const orders = getOrders();
  const users = getUsers();
  const menuItems = getMenuItems();
  const transactions = getCreditTransactions();

  const backupData: FullDatabaseBackup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'Rabia Cafe',
    orders,
    users,
    menuItems,
    transactions,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `Rabia_Cafe_Database_Backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importFullDatabaseBackup(
  jsonData: string,
  mode: 'replace' | 'merge' = 'merge'
): Promise<{ success: boolean; message: string; counts?: { orders: number; users: number; menu: number } }> {
  try {
    const data = JSON.parse(jsonData) as Partial<FullDatabaseBackup>;
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'فایل پشتیبان معتبر نیست یا قالب JSON صحیح ندارد.' };
    }

    const currentOrders = mode === 'replace' ? [] : getOrders();
    const currentUsers = mode === 'replace' ? [] : getUsers();
    const currentMenu = mode === 'replace' ? [] : getMenuItems();
    const currentTrans = mode === 'replace' ? [] : getCreditTransactions();

    let importedOrdersCount = 0;
    let importedUsersCount = 0;
    let importedMenuCount = 0;

    // 1. Orders
    if (Array.isArray(data.orders)) {
      data.orders.forEach((newOrd) => {
        if (!newOrd.id || !newOrd.orderNumber) return;
        const exists = currentOrders.some((o) => o.id === newOrd.id || o.orderNumber === newOrd.orderNumber);
        if (!exists || mode === 'replace') {
          if (!exists) currentOrders.push(newOrd);
          importedOrdersCount++;
        }
      });
      localStorage.setItem(ORDERS_KEY, JSON.stringify(currentOrders));
    }

    // 2. Users
    if (Array.isArray(data.users)) {
      data.users.forEach((newU) => {
        if (!newU.id || !newU.phone) return;
        const idx = currentUsers.findIndex((u) => u.id === newU.id || u.phone === newU.phone);
        if (idx < 0) {
          currentUsers.push(newU);
          importedUsersCount++;
        } else if (mode === 'replace') {
          currentUsers[idx] = newU;
          importedUsersCount++;
        }
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(currentUsers));
    }

    // 3. Menu items
    if (Array.isArray(data.menuItems)) {
      data.menuItems.forEach((newM) => {
        if (!newM.id || !newM.name) return;
        const idx = currentMenu.findIndex((m) => m.id === newM.id);
        if (idx < 0) {
          currentMenu.push(newM);
          importedMenuCount++;
        } else if (mode === 'replace') {
          currentMenu[idx] = newM;
          importedMenuCount++;
        }
      });
      localStorage.setItem(MENU_KEY, JSON.stringify(currentMenu));
    }

    // 4. Transactions
    if (Array.isArray(data.transactions)) {
      data.transactions.forEach((tx) => {
        if (!tx.id) return;
        if (!currentTrans.some((t) => t.id === tx.id)) {
          currentTrans.push(tx);
        }
      });
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(currentTrans));
    }

    emitRealtimeEvent('order_status_updated');
    emitRealtimeEvent('user_updated');
    emitRealtimeEvent('menu_updated');

    // If Supabase is connected, optionally sync data to remote tables
    const supabase = getSupabaseClient();
    if (supabase) {
      if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
        const mapped = data.menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          name_en: m.nameEn || null,
          category: m.category,
          price: m.price,
          description: m.description,
          ingredients: m.ingredients || [],
          image: m.image || null,
          is_available: m.isAvailable,
          is_featured: m.isFeatured || false,
        }));
        await supabase.from('menu_items').upsert(mapped);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        const mappedU = data.users.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          password: u.password,
          address: u.address || '',
          rabia_credit: u.rabiaCredit || 0,
          status: u.status,
          created_at: u.createdAt,
        }));
        await supabase.from('users').upsert(mappedU);
      }
    }

    return {
      success: true,
      message: `اطلاعات با موفقیت درون‌ریزی شد (${importedOrdersCount} سفارش، ${importedUsersCount} کاربر، ${importedMenuCount} آیتم منو).`,
      counts: { orders: importedOrdersCount, users: importedUsersCount, menu: importedMenuCount },
    };
  } catch (err: any) {
    return { success: false, message: `خطا در خواندن فایل پشتیبان: ${err?.message || err}` };
  }
}
