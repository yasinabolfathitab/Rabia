import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'rabia_supabase_url';
const STORAGE_KEY_KEY = 'rabia_supabase_key';

export const DEFAULT_SUPABASE_URL = '/api';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_dQl9IpKLLuxRvpt_CXEsEw_kM3j8X7z';

export function resolveSupabaseUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_SUPABASE_URL;
  const trimmed = url.trim();
  if (trimmed === '/api' || trimmed.startsWith('/api/') || trimmed.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    }
    return `http://localhost:3000${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }
  return trimmed;
}

export function isValidSupabaseUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('YOUR_') || trimmed === 'MY_APP_URL') return false;
  if (trimmed === '/api' || trimmed.startsWith('/api/') || trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): { url: string; key: string } {
  let envUrl = '';
  let envKey = '';
  try {
    envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  } catch {
    // ignore
  }
  
  let savedUrl = '';
  let savedKey = '';
  try {
    savedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl || DEFAULT_SUPABASE_URL;
    savedKey = localStorage.getItem(STORAGE_KEY_KEY) || envKey || DEFAULT_SUPABASE_KEY;
  } catch {
    savedUrl = envUrl || DEFAULT_SUPABASE_URL;
    savedKey = envKey || DEFAULT_SUPABASE_KEY;
  }

  savedUrl = (savedUrl || '').trim();
  savedKey = (savedKey || '').trim();

  // مسیردهی ترافیک از طریق پروکسی اختصاصی جدید
  if (savedUrl.includes('csoqhdjlnpxlhejfbcai.supabase.co') || savedUrl.includes('supabase-proxy.yasinabolfathi.workers.dev')) {
    savedUrl = DEFAULT_SUPABASE_URL;
  }

  // If saved URL is invalid or malformed, purge it from storage safely and fall back to default
  if (!savedUrl || !isValidSupabaseUrl(savedUrl)) {
    try {
      localStorage.removeItem(STORAGE_KEY_URL);
    } catch {
      // ignore
    }
    savedUrl = DEFAULT_SUPABASE_URL;
  }

  if (!savedKey) {
    savedKey = DEFAULT_SUPABASE_KEY;
  }

  return {
    url: savedUrl,
    key: savedKey,
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  try {
    let trimmedUrl = (url || '').trim();
    const trimmedKey = (key || '').trim();

    // مسیردهی ترافیک از طریق پروکسی اختصاصی جدید
    if (trimmedUrl.includes('csoqhdjlnpxlhejfbcai.supabase.co') || trimmedUrl.includes('supabase-proxy.yasinabolfathi.workers.dev')) {
      trimmedUrl = DEFAULT_SUPABASE_URL;
    }

    if (trimmedUrl && isValidSupabaseUrl(trimmedUrl)) {
      localStorage.setItem(STORAGE_KEY_URL, trimmedUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
    }

    if (trimmedKey) {
      localStorage.setItem(STORAGE_KEY_KEY, trimmedKey);
    } else {
      localStorage.removeItem(STORAGE_KEY_KEY);
    }
  } catch {
    // ignore
  }

  _cachedClient = null;
}

let _cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_cachedClient) return _cachedClient;

  const { url, key } = getSupabaseConfig();
  if (!url || !key || !isValidSupabaseUrl(url)) return null;

  try {
    const fullUrl = resolveSupabaseUrl(url);
    _cachedClient = createClient(fullUrl, key);
    return _cachedClient;
  } catch {
    return null;
  }
}

export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string; tablesFound?: boolean }> {
  try {
    let testUrl = (url || getSupabaseConfig().url || '').trim();
    const testKey = (key || getSupabaseConfig().key || '').trim();

    // مسیردهی ترافیک از طریق پروکسی اختصاصی جدید
    if (testUrl.includes('csoqhdjlnpxlhejfbcai.supabase.co') || testUrl.includes('supabase-proxy.yasinabolfathi.workers.dev')) {
      testUrl = DEFAULT_SUPABASE_URL;
    }

    if (!testUrl || !testKey) {
      return { success: false, message: 'آدرس پروژه یا کلید Anon وارد نشده است.' };
    }

    if (!isValidSupabaseUrl(testUrl)) {
      return {
        success: false,
        message: 'آدرس پروژه وارد شده معتبر نیست. آدرس باید با /api یا https:// شروع شود.',
      };
    }

    let client: SupabaseClient;
    try {
      const fullUrl = resolveSupabaseUrl(testUrl);
      client = createClient(fullUrl, testKey);
    } catch (initErr: any) {
      return {
        success: false,
        message: `خطا در پارامترهای اتصال: ${initErr?.message || initErr}`,
      };
    }

    // Try to query orders
    const { data, error } = await client.from('orders').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        // relation does not exist
        return {
          success: true,
          tablesFound: false,
          message: 'اتصال به سوپابیس برقرار شد، اما جداول هنوز ساخته نشده‌اند. لطفاً کدهای SQL را در بخش SQL Editor سوپابیس اجرا فرمایید.',
        };
      }
      return {
        success: false,
        message: `خطا در ارتباط با سوپابیس: ${error.message} (${error.code || ''})`,
      };
    }

    return {
      success: true,
      tablesFound: true,
      message: 'ارتباط با دیتابیس سوپابیس و جداول با موفقیت برقرار است و سفارشات آنلاین به صورت زنده هماهنگ می‌شوند.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطای غیرمنتظره در اتصال: ${err?.message || err}`,
    };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- 1. جدول کاربران (مشتریان کافه)
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

-- 2. جدول آیتم‌های منوی کافه رابیا
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

-- 3. جدول سفارش‌ها (ثبت از تلفن همراه و دریافت در پنل مدیریت)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  user_id TEXT,
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
  notes TEXT,
  estimated_prep_minutes INTEGER,
  prep_started_at TIMESTAMPTZ,
  estimated_ready_at TIMESTAMPTZ
);

-- ستون‌های تکمیلی زمان‌بندی سفارش (در صورتی که جدول قبلاً در دیتابیس ساخته شده باشد)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_prep_minutes INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;

-- 4. جدول تراکنش‌های اعتبار حساب رابیا
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

-- غیرفعال کردن موقت RLS یا تنظیم دسترسی باز برای عملیات مشتریان
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access orders" ON orders;
CREATE POLICY "Allow public full access orders" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access users" ON users;
CREATE POLICY "Allow public full access users" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access menu_items" ON menu_items;
CREATE POLICY "Allow public full access menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access credit_transactions" ON credit_transactions;
CREATE POLICY "Allow public full access credit_transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);

-- فعال‌سازی انتشار بلادرنگ (Realtime Replication برای دریافت آنی سفارشات روی سیستم مدیریت)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['orders', 'users', 'menu_items', 'credit_transactions'])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        END IF;
    END LOOP;
END;
$$;
`;
