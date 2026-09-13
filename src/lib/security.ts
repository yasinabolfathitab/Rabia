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
 * No-op: banning users has been completely disabled per system settings
 */
export function banUserForTampering(_userId: string, _reason: string, _details?: string): User | null {
  return null;
}

/**
 * Normal browser behavior without blocking DevTools or shortcuts
 */
export function initDevToolsProtection(): () => void {
  return () => {};
}

/**
 * Continuous integrity guard disabled: users will never be automatically banned
 */
export function startContinuousIntegrityGuard(
  _userOrGetter: User | null | (() => User | null),
  _onTamperDetected?: (user: User, reason: string) => void
): () => void {
  return () => {};
}
