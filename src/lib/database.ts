import { User, MenuItem, Order, CreditTransaction, OrderStatus, CafeStats } from '../types';
import { INITIAL_MENU_ITEMS } from '../data/initialMenu';
import { getSupabaseClient } from './supabase';
import { signAndProtectUser, verifyUserCreditIntegrity, banUserForTampering } from './security';

export const USERS_KEY = 'rabia_users_data';
const MENU_KEY = 'rabia_menu_data';
const DELETED_MENU_KEY = 'rabia_deleted_menu_ids';
const ORDERS_KEY = 'rabia_orders_data';
const TRANSACTIONS_KEY = 'rabia_transactions_data';
const BROADCAST_CHANNEL_NAME = 'rabia_cafe_realtime_bus';

export function getDeletedMenuItemIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_MENU_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

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
const DEPLOY_INIT_RESET_KEY = 'rabia_deploy_clean_v6';
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

// Stable menu order mapping based on initial items
const INITIAL_ORDER_MAP = new Map<string, number>();
INITIAL_MENU_ITEMS.forEach((item, index) => {
  INITIAL_ORDER_MAP.set(item.id, index);
});

export function sortMenuItemsStably(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const orderA = INITIAL_ORDER_MAP.has(a.id)
      ? INITIAL_ORDER_MAP.get(a.id)!
      : 10000 + (parseInt(a.id.replace(/\D/g, ''), 10) || 0);
    const orderB = INITIAL_ORDER_MAP.has(b.id)
      ? INITIAL_ORDER_MAP.get(b.id)!
      : 10000 + (parseInt(b.id.replace(/\D/g, ''), 10) || 0);
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });
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

export async function syncOrdersAndUsersWithSupabase() {
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
        estimatedPrepMinutes: raw.estimated_prep_minutes ? Number(raw.estimated_prep_minutes) : undefined,
        prepStartedAt: raw.prep_started_at || undefined,
        estimatedReadyAt: raw.estimated_ready_at || undefined,
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
      const mappedUsers: User[] = dbUsers.map((raw: any) => {
        const u: User = {
          id: raw.id,
          name: raw.name,
          phone: raw.phone,
          password: raw.password,
          address: raw.address || '',
          rabiaCredit: Number(raw.rabia_credit || 0),
          status: raw.status || 'pending',
          banReason: raw.ban_reason || undefined,
          bannedAt: raw.banned_at || undefined,
          securityAlert: raw.security_alert || undefined,
          createdAt: raw.created_at,
        };
        return signAndProtectUser(u);
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(mappedUsers));
      emitRealtimeEvent('user_updated');
    }
  } catch (err) {
    console.warn('Sync orders/users with Supabase failed:', err);
  }
}

export async function initSupabaseRealtimeSync() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Set up 4-second backup polling loop strictly for orders & users so orders refresh without touching menu positions
  if (!pollIntervalId && typeof window !== 'undefined') {
    pollIntervalId = setInterval(() => {
      syncOrdersAndUsersWithSupabase();
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
              estimatedPrepMinutes: raw.estimated_prep_minutes ? Number(raw.estimated_prep_minutes) : undefined,
              prepStartedAt: raw.prep_started_at || undefined,
              estimatedReadyAt: raw.estimated_ready_at || undefined,
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
              if (raw.estimated_prep_minutes !== undefined) orders[idx].estimatedPrepMinutes = Number(raw.estimated_prep_minutes);
              if (raw.prep_started_at !== undefined) orders[idx].prepStartedAt = raw.prep_started_at;
              if (raw.estimated_ready_at !== undefined) orders[idx].estimatedReadyAt = raw.estimated_ready_at;
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
              banReason: raw.ban_reason || undefined,
              bannedAt: raw.banned_at || undefined,
              securityAlert: raw.security_alert || undefined,
              createdAt: raw.created_at,
            };
            signAndProtectUser(newU);
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
              if (raw.ban_reason !== undefined) users[idx].banReason = raw.ban_reason;
              if (raw.banned_at !== undefined) users[idx].bannedAt = raw.banned_at;
              if (raw.security_alert !== undefined) users[idx].securityAlert = raw.security_alert;
              signAndProtectUser(users[idx]);
              localStorage.setItem(USERS_KEY, JSON.stringify(users));
              emitRealtimeEvent('user_status_changed', users[idx]);
              emitRealtimeEvent('credit_updated', { userId: raw.id, newCredit: users[idx].rabiaCredit });
            }
          }
        }
      )
      .subscribe();

    // 3. Subscribe to Menu changes (Realtime, with guaranteed stable ordering)
    supabase
      .channel('rabia_menu_realtime_ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload: any) => {
          const items = getMenuItems();
          const deletedIds = getDeletedMenuItemIds();
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const raw = payload.new;
            if (deletedIds.includes(raw.id)) return;
            const incomingPrice = Number(raw.price);
            const idx = items.findIndex((i) => i.id === raw.id);
            
            // Never overwrite non-zero local price with 0
            const existingLocalPrice = idx >= 0 ? items[idx].price : 0;
            const finalPrice = incomingPrice > 0 ? incomingPrice : (existingLocalPrice > 0 ? existingLocalPrice : 0);

            const item: MenuItem = {
              id: raw.id,
              name: raw.name,
              nameEn: raw.name_en || '',
              category: raw.category,
              price: finalPrice,
              description: raw.description || '',
              ingredients: raw.ingredients || [],
              image: raw.image || '',
              isAvailable: parseIsAvailable(raw.is_available),
              isFeatured: raw.is_featured,
            };

            if (idx >= 0) {
              items[idx] = item;
            } else {
              items.push(item);
            }
            const sorted = sortMenuItemsStably(items);
            localStorage.setItem(MENU_KEY, JSON.stringify(sorted));
            emitRealtimeEvent('menu_updated', item);
          } else if (payload.eventType === 'DELETE') {
            if (payload.old?.id) {
              if (!deletedIds.includes(payload.old.id)) {
                deletedIds.push(payload.old.id);
                localStorage.setItem(DELETED_MENU_KEY, JSON.stringify(deletedIds));
              }
              const updated = items.filter((i) => i.id !== payload.old.id);
              const sorted = sortMenuItemsStably(updated);
              localStorage.setItem(MENU_KEY, JSON.stringify(sorted));
              emitRealtimeEvent('menu_updated', { id: payload.old.id, deleted: true });
            }
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
    await syncOrdersAndUsersWithSupabase();

    // 3. Menu items (Stably merged to prevent price wipes and position jumping)
    const { data: dbMenu, error: mErr } = await supabase
      .from('menu_items')
      .select('*');

    if (!mErr && dbMenu) {
      if (dbMenu.length > 0) {
        const localMenu = getMenuItems();
        const dbMap = new Map<string, any>();
        dbMenu.forEach((raw: any) => {
          dbMap.set(raw.id, raw);
        });

        // Merge Supabase data into local stably-ordered items without overwriting non-zero prices with 0
        const merged: MenuItem[] = localMenu.map((localItem) => {
          const remote = dbMap.get(localItem.id);
          if (!remote) return localItem;
          const remotePrice = Number(remote.price);
          return {
            ...localItem,
            name: remote.name || localItem.name,
            nameEn: (remote.name_en && remote.name_en.trim()) ? remote.name_en : (localItem.nameEn || ''),
            category: remote.category || localItem.category,
            // Keep existing non-zero price if remote is 0 (from old seed)
            price: remotePrice > 0 ? remotePrice : (localItem.price > 0 ? localItem.price : 0),
            description: (remote.description && remote.description.trim()) ? remote.description : (localItem.description || ''),
            ingredients: (remote.ingredients && Array.isArray(remote.ingredients) && remote.ingredients.length > 0) ? remote.ingredients : (localItem.ingredients || []),
            image: remote.image || localItem.image,
            isAvailable: parseIsAvailable(remote.is_available),
            isFeatured: remote.is_featured !== undefined ? remote.is_featured : localItem.isFeatured,
          };
        });

        const deletedIds = getDeletedMenuItemIds();

        // Add any newly created items that exist in DB but not in localMenu (excluding deleted items)
        dbMenu.forEach((remote: any) => {
          if (!deletedIds.includes(remote.id) && !localMenu.some((l) => l.id === remote.id)) {
            merged.push({
              id: remote.id,
              name: remote.name,
              nameEn: remote.name_en || '',
              category: remote.category,
              price: Number(remote.price) || 0,
              description: remote.description || '',
              ingredients: remote.ingredients || [],
              image: remote.image || '',
              isAvailable: parseIsAvailable(remote.is_available),
              isFeatured: remote.is_featured,
            });
          }
        });

        // Also clean up any lingering deleted items from remote Supabase
        const lingeringDeletedInDb = dbMenu.filter((r: any) => deletedIds.includes(r.id)).map((r: any) => r.id);
        if (lingeringDeletedInDb.length > 0) {
          supabase.from('menu_items').delete().in('id', lingeringDeletedInDb).then(() => {});
        }

        const filteredMerged = merged.filter((item) => !deletedIds.includes(item.id));
        const stablySorted = sortMenuItemsStably(filteredMerged);
        localStorage.setItem(MENU_KEY, JSON.stringify(stablySorted));
        emitRealtimeEvent('menu_updated');
      } else {
        // Table exists in Supabase but is empty: seed current menu
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
    const deletedIds = getDeletedMenuItemIds();
    const initialMap = new Map(INITIAL_MENU_ITEMS.map((init) => [init.id, init]));
    const data = localStorage.getItem(MENU_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        let hasEnriched = false;
        const cleaned = parsed
          .filter((item: MenuItem) => !deletedIds.includes(item.id))
          .map((item: MenuItem) => {
            const initial = initialMap.get(item.id);
            const enrichedNameEn = (item.nameEn && item.nameEn.trim()) ? item.nameEn : (initial?.nameEn || '');
            const enrichedDesc = (item.description && item.description.trim()) ? item.description : (initial?.description || '');
            const enrichedIng = (item.ingredients && Array.isArray(item.ingredients) && item.ingredients.length > 0)
              ? item.ingredients
              : (initial?.ingredients || []);
            
            if (enrichedNameEn !== item.nameEn || enrichedDesc !== item.description || enrichedIng.length !== (item.ingredients?.length || 0)) {
              hasEnriched = true;
            }

            return {
              ...item,
              nameEn: enrichedNameEn,
              description: enrichedDesc,
              ingredients: enrichedIng,
              isAvailable: parseIsAvailable(item.isAvailable),
            };
          });
        const sorted = sortMenuItemsStably(cleaned);
        if (hasEnriched) {
          localStorage.setItem(MENU_KEY, JSON.stringify(sorted));
        }
        return sorted;
      }
    }
    const cleanInitial = INITIAL_MENU_ITEMS
      .filter((item) => !deletedIds.includes(item.id))
      .map((item) => ({
        ...item,
        isAvailable: parseIsAvailable(item.isAvailable),
      }));
    const sorted = sortMenuItemsStably(cleanInitial);
    localStorage.setItem(MENU_KEY, JSON.stringify(sorted));
    return sorted;
  } catch {
    const deletedIds = getDeletedMenuItemIds();
    return sortMenuItemsStably(INITIAL_MENU_ITEMS.filter((item) => !deletedIds.includes(item.id)));
  }
}

export async function saveMenuItem(item: MenuItem): Promise<MenuItem> {
  const cleanItem: MenuItem = {
    ...item,
    price: Number(item.price) >= 0 ? Number(item.price) : 0,
    isAvailable: parseIsAvailable(item.isAvailable),
  };

  // Remove from deleted list if re-adding/saving
  const deletedIds = getDeletedMenuItemIds().filter((id) => id !== cleanItem.id);
  localStorage.setItem(DELETED_MENU_KEY, JSON.stringify(deletedIds));

  const items = getMenuItems();
  const index = items.findIndex((i) => i.id === cleanItem.id);
  if (index >= 0) {
    items[index] = cleanItem;
  } else {
    items.push(cleanItem);
  }
  const stablySorted = sortMenuItemsStably(items);
  localStorage.setItem(MENU_KEY, JSON.stringify(stablySorted));
  emitRealtimeEvent('menu_updated', cleanItem);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
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
        });
      if (error) console.error('Supabase menu upsert error:', error);
    } catch (err) {
      console.error('Supabase saveMenuItem error:', err);
    }
  }

  return cleanItem;
}

export async function toggleMenuItemStock(itemId: string): Promise<boolean> {
  const items = getMenuItems();
  const itemIndex = items.findIndex((i) => i.id === itemId);
  if (itemIndex >= 0) {
    const item = items[itemIndex];
    const currentVal = parseIsAvailable(item.isAvailable);
    const newStatus = !currentVal;
    item.isAvailable = newStatus;
    items[itemIndex] = item;
    
    // Stably preserve menu order without jumping
    const stablySorted = sortMenuItemsStably(items);
    localStorage.setItem(MENU_KEY, JSON.stringify(stablySorted));
    emitRealtimeEvent('menu_updated', item);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // First try targeted column update to avoid touching other properties
        const { error } = await supabase
          .from('menu_items')
          .update({ is_available: newStatus })
          .eq('id', itemId);

        if (error) {
          console.warn('Supabase update menu stock error, trying upsert fallback:', error);
          await supabase
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
        }
      } catch (err) {
        console.error('Supabase toggle stock error:', err);
      }
    }

    return newStatus;
  }
  return false;
}

export function deleteMenuItem(itemId: string): boolean {
  // Track permanently in deletedIds so remote sync does not resurrect it
  const deletedIds = getDeletedMenuItemIds();
  if (!deletedIds.includes(itemId)) {
    deletedIds.push(itemId);
    localStorage.setItem(DELETED_MENU_KEY, JSON.stringify(deletedIds));
  }

  const items = getMenuItems().filter((i) => i.id !== itemId);
  const stablySorted = sortMenuItemsStably(items);
  localStorage.setItem(MENU_KEY, JSON.stringify(stablySorted));
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

  return true;
}

// ---------------- USERS ----------------
export function getUsers(): User[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    let list: User[] = data ? JSON.parse(data) : INITIAL_USERS;
    let modified = false;

    // Ensure no user remains banned
    list = list.map((u) => {
      if (u.status === 'banned') {
        modified = true;
        return {
          ...u,
          status: 'approved',
          banReason: undefined,
          bannedAt: undefined,
          securityAlert: undefined,
        };
      }
      return u;
    });

    if (modified) {
      localStorage.setItem(USERS_KEY, JSON.stringify(list));
    }
    return list;
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
  signAndProtectUser(newUser);

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

  // Verify and re-sign user
  signAndProtectUser(user);

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
    signAndProtectUser(user);
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

export function unbanUser(userId: string): { success: boolean; message: string } {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return { success: false, message: 'کاربر مورد نظر یافت نشد.' };
  }

  user.status = 'approved';
  user.banReason = undefined;
  user.bannedAt = undefined;
  user.securityAlert = undefined;
  user.rabiaCredit = 0; // Fresh secure start
  signAndProtectUser(user);

  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('users')
      .update({
        status: 'approved',
        rabia_credit: 0,
      })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Supabase unban error:', error);
      });
  }

  emitRealtimeEvent('user_status_changed', user);
  emitRealtimeEvent('credit_updated', { userId: user.id, newCredit: 0 });

  return { success: true, message: `مسدودی کاربر ${user.name} با موفقیت لغو شد و حساب او مجدداً فعال گردید.` };
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
  signAndProtectUser(user);
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
    if (!user) {
      return {
        success: false,
        message: 'کاربر مورد نظر یافت نشد.',
      };
    }

    // Database check against Supabase if available
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: remoteUser, error: remoteErr } = await supabase
          .from('users')
          .select('id, rabia_credit')
          .eq('id', user.id)
          .single();

        if (!remoteErr && remoteUser) {
          const serverCredit = Number(remoteUser.rabia_credit || 0);
          if (serverCredit < orderInput.totalAmount) {
            return {
              success: false,
              message: 'موجودی اعتبار حساب رابیا شما برای پرداخت این سفارش کافی نیست.',
            };
          }
        }
      } catch (err) {
        console.warn('Authoritative Supabase check error:', err);
      }
    }

    if (user.rabiaCredit < orderInput.totalAmount) {
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
      `پرداخت سفارش آنلاین رابیا (${orderInput.totalAmount.toLocaleString('en-US')} تومان)`
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

  // Save to customer recent orders list
  saveRecentCustomerOrderNumber(newOrder.orderNumber);

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
          estimated_prep_minutes: newOrder.estimatedPrepMinutes || null,
          prep_started_at: newOrder.prepStartedAt || null,
          estimated_ready_at: newOrder.estimatedReadyAt || null,
        });
      if (error) {
        // If the table was created before timing columns were added, retry without optional columns
        if (error.code === 'PGRST204' || error.message?.includes('estimated_prep_minutes')) {
          const { error: retryErr } = await supabase
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
          if (retryErr) {
            console.warn('Supabase fallback order insert error:', retryErr);
          }
        } else {
          console.error('Supabase order insert error:', error);
        }
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

export interface UpdateOrderStatusOptions {
  estimatedPrepMinutes?: number;
}

export function updateOrderStatus(orderId: string, status: OrderStatus, options?: UpdateOrderStatusOptions) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    if (status === 'cancelled' && order.status !== 'cancelled') {
      if (order.paymentMethod === 'rabia_credit' && order.userId) {
        adjustUserCredit(
          order.userId,
          order.totalAmount,
          'admin_charge',
          `برگشت وجه سفارش لغو شده #${order.orderNumber}`
        );
      }
    }

    order.status = status;
    
    if (status === 'preparing') {
      const prepMinutes = options?.estimatedPrepMinutes ?? order.estimatedPrepMinutes ?? 15;
      const now = new Date();
      const readyTime = new Date(now.getTime() + prepMinutes * 60 * 1000);
      order.estimatedPrepMinutes = prepMinutes;
      order.prepStartedAt = now.toISOString();
      order.estimatedReadyAt = readyTime.toISOString();
    }

    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    emitRealtimeEvent('order_status_updated', order);

    const supabase = getSupabaseClient();
    if (supabase) {
      const updatePayload: any = { status };
      if (order.estimatedPrepMinutes !== undefined) {
        updatePayload.estimated_prep_minutes = order.estimatedPrepMinutes;
      }
      if (order.prepStartedAt !== undefined) {
        updatePayload.prep_started_at = order.prepStartedAt;
      }
      if (order.estimatedReadyAt !== undefined) {
        updatePayload.estimated_ready_at = order.estimatedReadyAt;
      }

      supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .then(({ error }) => {
          if (error) {
            // If the Supabase table doesn't have the timing columns yet (code PGRST204),
            // gracefully fallback to updating only the status so remote state still synchronizes cleanly.
            if (error.code === 'PGRST204' || error.message?.includes('estimated_prep_minutes')) {
              supabase
                .from('orders')
                .update({ status })
                .eq('id', orderId)
                .then(({ error: retryErr }) => {
                  if (retryErr) {
                    console.warn('Supabase fallback order status update error:', retryErr);
                  }
                });
            } else {
              console.error('Supabase order status update error:', error);
            }
          }
        });
    }
  }
}

// ---------------- ORDER TRACKING HELPERS ----------------
const RECENT_CUSTOMER_ORDERS_KEY = 'rabia_customer_recent_orders';

export function getRecentCustomerOrderNumbers(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CUSTOMER_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentCustomerOrderNumber(orderNumber: string) {
  try {
    const list = getRecentCustomerOrderNumbers().filter((n) => n !== orderNumber);
    list.unshift(orderNumber);
    localStorage.setItem(RECENT_CUSTOMER_ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch (e) {
    console.warn('Failed to save recent order number:', e);
  }
}

export function searchOrders(query: string): Order[] {
  const clean = query.trim().toLowerCase().replace('#', '');
  if (!clean) return [];

  const orders = getOrders();
  const digitOnly = clean.replace(/[^0-9]/g, '');

  return orders.filter((o) => {
    const ordNum = o.orderNumber.toLowerCase().replace('#', '');
    const phone = o.userPhone.replace(/[^0-9]/g, '');
    const name = o.userName.toLowerCase();

    if (ordNum.includes(clean)) return true;
    if (digitOnly && digitOnly.length >= 3 && phone.includes(digitOnly)) return true;
    if (clean.length >= 2 && name.includes(clean)) return true;
    return false;
  });
}

export async function fetchLiveOrder(query: string): Promise<Order | null> {
  const clean = query.trim().replace('#', '');
  if (!clean) return null;

  // 1. Check local memory first
  const localOrders = getOrders();
  const foundLocal = localOrders.find((o) => 
    o.id === query ||
    o.orderNumber.replace('#', '').toLowerCase() === clean.toLowerCase()
  );

  // 2. Also query Supabase if available for latest status
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${query},order_number.ilike.%${clean}%`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const liveOrder: Order = {
          id: data.id,
          orderNumber: data.order_number,
          userId: data.user_id || undefined,
          userName: data.user_name,
          userPhone: data.user_phone,
          orderType: data.order_type,
          address: data.address || undefined,
          tableNumber: data.table_number || undefined,
          items: typeof data.items === 'string' ? JSON.parse(data.items) : data.items,
          totalAmount: Number(data.total_amount),
          paymentMethod: data.payment_method,
          status: data.status,
          createdAt: data.created_at,
          notes: data.notes || undefined,
          estimatedPrepMinutes: data.estimated_prep_minutes ? Number(data.estimated_prep_minutes) : undefined,
          prepStartedAt: data.prep_started_at || undefined,
          estimatedReadyAt: data.estimated_ready_at || undefined,
        };

        // Update local storage cache
        const all = getOrders();
        const idx = all.findIndex((o) => o.id === liveOrder.id);
        if (idx >= 0) {
          all[idx] = liveOrder;
        } else {
          all.unshift(liveOrder);
        }
        localStorage.setItem(ORDERS_KEY, JSON.stringify(all));

        return liveOrder;
      }
    } catch (e) {
      console.warn('Supabase fetchLiveOrder error, using local cache:', e);
    }
  }

  return foundLocal || null;
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

    const dateStr = new Date(o.createdAt).toLocaleString('en-US');

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

export function getPersianDateInfo(d: Date = new Date()) {
  let shamsiDate = '';
  let shamsiFull = '';
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d).split('/');
    if (parts.length === 3) {
      shamsiDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
    } else {
      shamsiDate = parts.join('-');
    }
    shamsiFull = new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'full',
    }).format(d);
  } catch {
    shamsiDate = d.toISOString().slice(0, 10);
    shamsiFull = d.toLocaleDateString('fa-IR');
  }

  const gregorianDate = d.toISOString().slice(0, 10);
  const timeFormatted = d.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { shamsiDate, shamsiFull, gregorianDate, timeFormatted };
}

export function getTodayBackupStats() {
  const now = new Date();
  const dateInfo = getPersianDateInfo(now);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const allOrders = getOrders();
  const todayOrders = allOrders.filter((o) => {
    if (!o.createdAt) return false;
    const t = new Date(o.createdAt).getTime();
    return t >= startOfDay && t <= endOfDay;
  });

  const allTransactions = getCreditTransactions();
  const todayTransactions = allTransactions.filter((tr) => {
    if (!tr.createdAt) return false;
    const t = new Date(tr.createdAt).getTime();
    return t >= startOfDay && t <= endOfDay;
  });

  const salesToday = todayOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return {
    dateInfo,
    ordersCount: todayOrders.length,
    transactionsCount: todayTransactions.length,
    salesToday,
    totalOrdersInDb: allOrders.length,
    totalUsersInDb: getUsers().length,
  };
}

export function exportDailyDatabaseBackup(): {
  fileName: string;
  ordersTodayCount: number;
  salesToday: number;
  shamsiDate: string;
  gregorianDate: string;
} {
  const now = new Date();
  const dateInfo = getPersianDateInfo(now);

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const allOrders = getOrders();
  const allUsers = getUsers();
  const allMenuItems = getMenuItems();
  const allTransactions = getCreditTransactions();

  const todayOrders = allOrders.filter((o) => {
    if (!o.createdAt) return false;
    const t = new Date(o.createdAt).getTime();
    return t >= startOfDay && t <= endOfDay;
  });

  const todayTransactions = allTransactions.filter((tr) => {
    if (!tr.createdAt) return false;
    const t = new Date(tr.createdAt).getTime();
    return t >= startOfDay && t <= endOfDay;
  });

  const salesToday = todayOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const backupPayload = {
    title: 'پشتیبان روزانه پایگاه داده کافه رابیا',
    backupType: 'daily_backup',
    version: '2.0',
    app: 'Rabia Cafe',
    exportedAt: now.toISOString(),
    dates: {
      shamsi: dateInfo.shamsiDate,
      shamsiFull: dateInfo.shamsiFull,
      gregorian: dateInfo.gregorianDate,
      time: dateInfo.timeFormatted,
      timestamp: now.getTime(),
    },
    todayReport: {
      dateShamsi: dateInfo.shamsiDate,
      dateGregorian: dateInfo.gregorianDate,
      totalOrdersCount: todayOrders.length,
      totalSalesTomans: salesToday,
      completedOrdersCount: todayOrders.filter((o) => o.status === 'delivered').length,
      pendingOrdersCount: todayOrders.filter((o) => o.status === 'pending').length,
      todayTransactionsCount: todayTransactions.length,
    },
    todayOrders,
    todayTransactions,
    // Database snapshot so this file can also be restored 100% reliably
    orders: allOrders,
    users: allUsers,
    menuItems: allMenuItems,
    transactions: allTransactions,
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `RabiaCafe_Backup_${dateInfo.shamsiDate}_${dateInfo.gregorianDate}.json`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    ordersTodayCount: todayOrders.length,
    salesToday,
    shamsiDate: dateInfo.shamsiDate,
    gregorianDate: dateInfo.gregorianDate,
  };
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

// ---------------- PURGE / CLEAR DATABASE OPERATIONS ----------------
export async function clearAllOrders(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Clear local storage orders & customer recent orders tracking
    localStorage.setItem(ORDERS_KEY, JSON.stringify([]));
    localStorage.removeItem('rabia_customer_recent_orders');

    // 2. Clear from Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('orders').delete().not('id', 'is', null);
      } catch (sbErr) {
        console.warn('Supabase clearAllOrders error:', sbErr);
      }
    }

    emitRealtimeEvent('order_status_updated');
    return { success: true, message: 'تمام سفارش‌ها با موفقیت پاکسازی شدند.' };
  } catch (err: any) {
    return { success: false, message: `خطا در پاکسازی سفارش‌ها: ${err?.message || err}` };
  }
}

export async function clearAllUsers(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Clear local storage users & credit transactions
    localStorage.setItem(USERS_KEY, JSON.stringify([]));
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));

    // 2. Clear from Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('transactions').delete().not('id', 'is', null);
        await supabase.from('users').delete().not('id', 'is', null);
      } catch (sbErr) {
        console.warn('Supabase clearAllUsers error:', sbErr);
      }
    }

    emitRealtimeEvent('user_updated');
    return { success: true, message: 'تمام کاربران با موفقیت پاکسازی شدند.' };
  } catch (err: any) {
    return { success: false, message: `خطا در پاکسازی کاربران: ${err?.message || err}` };
  }
}

export async function clearAllDatabaseData(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Clear orders, users, transactions, and recent orders
    localStorage.setItem(ORDERS_KEY, JSON.stringify([]));
    localStorage.setItem(USERS_KEY, JSON.stringify([]));
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
    localStorage.removeItem('rabia_customer_recent_orders');

    // Reset menu to clean initial items
    localStorage.setItem(MENU_KEY, JSON.stringify(sortMenuItemsStably(INITIAL_MENU_ITEMS)));

    // 2. Clear from Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('orders').delete().not('id', 'is', null);
        await supabase.from('transactions').delete().not('id', 'is', null);
        await supabase.from('users').delete().not('id', 'is', null);
      } catch (sbErr) {
        console.warn('Supabase clearAllDatabaseData error:', sbErr);
      }
    }

    emitRealtimeEvent('order_status_updated');
    emitRealtimeEvent('user_updated');
    emitRealtimeEvent('menu_updated');

    return { success: true, message: 'تمام اطلاعات دیتابیس (سفارش‌ها، کاربران و تراکنش‌ها) با موفقیت پاکسازی شدند.' };
  } catch (err: any) {
    return { success: false, message: `خطا در پاکسازی کامل دیتابیس: ${err?.message || err}` };
  }
}

export async function forceUpdateSupabaseMenu() {
  // Deprecated: No-op to strictly preserve custom prices and stable ordering
  return;
}
