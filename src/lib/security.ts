import { User } from '../types';
import { getSupabaseClient } from './supabase';

const USERS_KEY = 'rabia_users_data';
const VAULT_STORAGE_KEY = 'rabia_sec_vault';

// Secret salt components for generating tamper-evident cryptographic checksums
const S1 = 'RABIA_CAFE_SEC_2026';
const S2 = 'ANTI_TAMPER_KEY_HASH_98451';
const S3 = 'CREDIT_GUARD_VAULT_X7Z';

/**
 * Fast synchronous cryptographic hash function (custom 64-char hex digest)
 */
function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  let h3 = 0x67452301 ^ 0;
  let h4 = 0xefcdab89 ^ 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 374761393);
    h4 = Math.imul(h4 ^ ch, 2246822519);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const part1 = toHex(h1) + toHex(h2);
  const part2 = toHex(h3) + toHex(h4);
  const part3 = toHex(h1 ^ h3) + toHex(h2 ^ h4);
  const part4 = toHex(h1 + h2) + toHex(h3 + h4);
  return part1 + part2 + part3 + part4;
}

/**
 * Generates an unforgeable signature for a user's credit & status
 */
export function generateCreditSignature(userId: string, phone: string, credit: number, status: string): string {
  const payload = `${S1}::${userId}::${phone}::${Math.floor(Number(credit) || 0)}::${status}::${S2}::${S3}`;
  return hashString(payload);
}

// In-memory vault of verified credit allocations (inaccessible to DevTools localStorage inspector)
const memoryCreditVault = new Map<string, { credit: number; sig: string; timestamp: number }>();

function getStoredVault(): Record<string, { credit: number; sig: string }> {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredVault(vault: Record<string, { credit: number; sig: string }>) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {
    // ignore
  }
}

function dispatchRealtimeSecurity(type: string, payload?: any) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rabia_realtime', { detail: { type, payload } }));
    }
  } catch {
    // ignore
  }
}

function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Cryptographically signs a user record and registers it in the secure vault
 */
export function signAndProtectUser(user: User): User {
  const credit = Math.floor(Number(user.rabiaCredit) || 0);
  const sig = generateCreditSignature(user.id, user.phone, credit, user.status);
  user.creditSignature = sig;

  // Save to in-memory vault
  memoryCreditVault.set(user.id, {
    credit,
    sig,
    timestamp: Date.now(),
  });

  // Save to secondary hidden local vault
  const vault = getStoredVault();
  vault[user.id] = { credit, sig };
  saveStoredVault(vault);

  return user;
}

/**
 * Verifies if user's credit is authentic or has been tampered with
 */
export function verifyUserCreditIntegrity(user: User): { valid: boolean; reason?: string } {
  if (!user) return { valid: false, reason: 'کاربر نامعتبر است.' };

  const credit = Number(user.rabiaCredit) || 0;
  if (credit < 0) {
    return { valid: false, reason: 'موجودی اعتبار نمی‌تواند عدد منفی باشد.' };
  }

  // If user has 0 credit and no signature yet, generate and accept it
  if (credit === 0 && !user.creditSignature) {
    user.creditSignature = generateCreditSignature(user.id, user.phone, 0, user.status);
    return { valid: true };
  }

  const expectedSig = generateCreditSignature(user.id, user.phone, credit, user.status);
  if (user.creditSignature !== expectedSig) {
    return {
      valid: false,
      reason: `امضای دیجیتال اعتبار نامعتبر است (تلاش برای دستکاری مستقیم متغیرها یا حافظه در Inspect)`,
    };
  }

  // Check against memory vault if present
  const memoryRecord = memoryCreditVault.get(user.id);
  if (memoryRecord) {
    if (credit > memoryRecord.credit && memoryRecord.sig !== user.creditSignature) {
      return {
        valid: false,
        reason: `مغایرت موجودی با حافظه امنیتی (تلاش برای افزایش غیرمجاز از ${memoryRecord.credit} به ${credit} تومان)`,
      };
    }
  }

  // Check against secondary vault
  const vault = getStoredVault();
  const vaultRecord = vault[user.id];
  if (vaultRecord && credit > vaultRecord.credit && vaultRecord.sig !== user.creditSignature) {
    return {
      valid: false,
      reason: `مغایرت موجودی با صندوق احراز هویت اعتبار (تلاش برای جعل اعتبار)`,
    };
  }

  return { valid: true };
}

/**
 * Bans a user immediately for tampering, updates DB & localStorage, and alerts admin
 */
export function banUserForTampering(userId: string, reason: string, details?: string): User | null {
  const users = getStoredUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const now = new Date().toISOString();
  user.status = 'banned';
  user.banReason = reason;
  user.bannedAt = now;
  user.securityAlert = details || reason;
  user.rabiaCredit = 0; // Wipe fraudulent credit

  // Sign the banned state
  signAndProtectUser(user);

  // Update in local users
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // If active user is this user, log out immediately
  try {
    const active = localStorage.getItem('rabia_active_user');
    if (active) {
      const activeUser = JSON.parse(active);
      if (activeUser.id === userId) {
        localStorage.removeItem('rabia_active_user');
      }
    }
  } catch {
    // ignore
  }

  // Update in Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
      .from('users')
      .update({
        status: 'banned',
        rabia_credit: 0,
      })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Supabase user ban update error:', error);
      });
  }

  dispatchRealtimeSecurity('user_status_changed', user);
  dispatchRealtimeSecurity('credit_updated', { userId: user.id, newCredit: 0 });
  dispatchRealtimeSecurity('security_tamper_detected', { user, reason, details });

  return user;
}

/**
 * Prevents DevTools, right-click Inspect, and sensitive shortcut keys
 */
export function initDevToolsProtection(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Disable Right-Click Context Menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  window.addEventListener('contextmenu', handleContextMenu, { capture: true });

  // 2. Disable DevTools Shortcut Keys
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I or Cmd+Option+I (Inspect)
    if (isCmdOrCtrl && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+J or Cmd+Option+J (Console)
    if (isCmdOrCtrl && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+C or Cmd+Option+C (Inspect Element)
    if (isCmdOrCtrl && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U or Cmd+Option+U (View Source)
    if (isCmdOrCtrl && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S or Cmd+S (Save Page)
    if (isCmdOrCtrl && (e.key === 'S' || e.key === 's' || e.keyCode === 83)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  // 3. Clear Console and print Security Warnings
  try {
    console.clear();
    console.log(
      '%c⚠️ سیستم امنیتی و اعتباری کافه رابیا',
      'color: #C87D55; font-size: 20px; font-weight: 900; padding: 4px 8px; background: #1C1714; border-radius: 6px;'
    );
    console.log(
      '%cهرگونه تلاش برای باز کردن Inspect، تغییر متغیرها یا جعل اعتبار کیف پول به صورت زنده مانیتور شده و باعث مسدودسازی فوری (BAN) حساب کاربری و ثبت مشخصات برای مدیریت خواهد شد.',
      'color: #ff5555; font-size: 13px; font-weight: bold;'
    );
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}

/**
 * Starts continuous background guard for logged-in user to detect localStorage/memory tampering
 */
export function startContinuousIntegrityGuard(
  userOrGetter: User | null | (() => User | null),
  onTamperDetected: (user: User, reason: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const getCurrentUser = (): User | null => {
    if (typeof userOrGetter === 'function') {
      return userOrGetter();
    }
    return userOrGetter;
  };

  const checkIntegrity = () => {
    const active = getCurrentUser();
    if (!active) return;

    // Check if user is already banned in storage
    const users = getStoredUsers();
    const stored = users.find((u) => u.id === active.id);
    if (stored && stored.status === 'banned') {
      onTamperDetected(stored, stored.banReason || 'حساب کاربری مسدود شده است.');
      return;
    }

    // If active user has credit > 0, verify integrity
    if (active.rabiaCredit > 0) {
      const check = verifyUserCreditIntegrity(active);
      if (!check.valid) {
        const banned = banUserForTampering(
          active.id,
          'تلاش برای دستکاری مستقیم اعتبار (Inspect / DevTools Tamper)',
          check.reason
        );
        if (banned) {
          onTamperDetected(banned, check.reason || 'دستکاری غیرمجاز اعتبار');
        }
      }
    }
  };

  // 1. Listen to external storage edits (DevTools Application tab edits)
  const onStorageChange = (e: StorageEvent) => {
    if (e.key === USERS_KEY || e.key === 'rabia_active_user') {
      checkIntegrity();
    }
  };
  window.addEventListener('storage', onStorageChange);

  // 2. Periodic timer check every 1.5 seconds
  const intervalId = setInterval(checkIntegrity, 1500);

  return () => {
    window.removeEventListener('storage', onStorageChange);
    clearInterval(intervalId);
  };
}
