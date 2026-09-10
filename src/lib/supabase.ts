import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'rabia_supabase_url';
const STORAGE_KEY_KEY = 'rabia_supabase_key';

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const savedKey = localStorage.getItem(STORAGE_KEY_KEY) || envKey;

  return {
    url: savedUrl.trim(),
    key: savedKey.trim(),
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEY_URL);

  if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY_KEY);

  _cachedClient = null;
}

let _cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_cachedClient) return _cachedClient;

  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  try {
    _cachedClient = createClient(url, key);
    return _cachedClient;
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

export const SUPABASE_SQL_SCHEMA = `-- کدهای SQL برای ساخت جداول در Supabase SQL Editor
-- کافه رابیا (Rabia Café Database)

-- 1. جدول کاربران
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password TEXT,
  address TEXT,
  rabia_credit BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول آیتم‌های منو
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,
  price BIGINT NOT NULL,
  description TEXT,
  ingredients TEXT[],
  image TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول سفارش‌ها
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  order_type TEXT NOT NULL, -- takeaway, dine_in
  address TEXT,
  table_number TEXT,
  items JSONB NOT NULL,
  total_amount BIGINT NOT NULL,
  payment_method TEXT NOT NULL, -- rabia_credit, counter_pos
  status TEXT DEFAULT 'pending', -- pending, preparing, ready, delivered, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 4. جدول تراکنش‌های اعتبار رابیا
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  user_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL, -- admin_charge, order_payment, in_person_order
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  admin_note TEXT
);

-- فعال‌سازی دسترسی بلادرنگ (Realtime Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE credit_transactions;
`;
