/**
 * Environment & Safe Storage Utilities for THPT Sơn Lương Teacher Management System
 */

export function isProductionWeb(): boolean {
  if (import.meta.env.PROD) {
    return true;
  }

  if (typeof import.meta.env.VITE_IS_PRODUCTION !== 'undefined') {
    return import.meta.env.VITE_IS_PRODUCTION === 'true';
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    if (hostname.includes('ais-dev-') || hostname === 'localhost' || hostname === '127.0.0.1') {
      return false;
    }
    if (hostname.includes('ais-pre-')) {
      return true;
    }
    if (hostname && !hostname.includes('ais-dev-')) {
      return true;
    }
  }

  return false;
}

export function canEditOrDelete(): boolean {
  if (typeof import.meta.env.VITE_ALLOW_EDIT_DELETE !== 'undefined') {
    return import.meta.env.VITE_ALLOW_EDIT_DELETE === 'true';
  }
  return true;
}

/**
 * Estimate current localStorage usage in UTF-16 bytes (safe, read-only).
 */
export function getLocalStorageUsageBytes(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  try {
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || '';
        totalChars += k.length + v.length;
      }
    }
    return totalChars * 2;
  } catch {
    return 0;
  }
}

/**
 * Non-destructive check to verify whether window.localStorage can safely accept
 * at least `requiredBytes` of free headroom without throwing QuotaExceededError.
 * NEVER deletes or alters any existing keys (login, user data, or firestore_* keys).
 */
export function probeLocalStorageHeadroom(requiredBytes: number = 256 * 1024): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const probeKey = '__thpt_sl_storage_probe__';
  try {
    // 1 UTF-16 char = 2 bytes; test with half the byte count in ASCII chars
    const charCount = Math.max(1024, Math.floor(requiredBytes / 2));
    const payload = 'x'.repeat(charCount);
    localStorage.setItem(probeKey, payload);
    localStorage.removeItem(probeKey);
    return true;
  } catch {
    try {
      localStorage.removeItem(probeKey);
    } catch {
      // ignore cleanup error
    }
    return false;
  }
}

/**
 * Detect whether an error is a browser storage quota error (QuotaExceededError)
 * or a Firestore internal state failure caused by WebStorage / IndexedDB quota exhaustion.
 */
export function isStorageQuotaError(err: unknown): boolean {
  if (!err) return false;
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as any).name) : '';
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as any).message)
        : String(err);
  const lower = `${name} ${message}`.toLowerCase();
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    lower.includes('quotaexceedederror') ||
    lower.includes('exceeded the quota') ||
    lower.includes('firestore_mutations_') ||
    lower.includes('firestore_clients_') ||
    (lower.includes('internal assertion failed') && (lower.includes('b815') || lower.includes('storage') || lower.includes('quota')))
  );
}

/**
 * Safe localStorage writer with strict size budget & non-destructive behavior.
 *
 * Guarantees:
 * - NEVER clears all localStorage.
 * - NEVER deletes login data, user preferences, custom permissions, or Firestore pending mutations (`firestore_*`).
 * - Refuses to write oversized optional cache payloads (> maxItemChars) so localStorage
 *   always retains ample headroom for Firebase/Firestore and authentication.
 */
const MAX_DEFAULT_CACHE_ITEM_CHARS = 180_000; // ~360 KB UTF-16 max per cache item
const MAX_TOTAL_LOCALSTORAGE_BYTES = 2_400_000; // ~2.4 MB ceiling so >= 2.5 MB remains free

export function safeLocalStorageSet(
  key: string,
  value: string,
  options?: { allowLarge?: boolean; maxItemChars?: number }
): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  // Never allow oversized optional cache blobs to exhaust the 5MB localStorage quota
  const maxChars = options?.maxItemChars ?? MAX_DEFAULT_CACHE_ITEM_CHARS;
  if (!options?.allowLarge && value.length > maxChars) {
    return false;
  }

  try {
    // Check total budget before writing optional cache keys (skip for small preference/auth keys < 16KB)
    if (value.length > 8_000) {
      const currentBytes = getLocalStorageUsageBytes();
      const existingItem = localStorage.getItem(key);
      const existingBytes = existingItem ? existingItem.length * 2 : 0;
      const projectedBytes = currentBytes - existingBytes + value.length * 2;
      if (projectedBytes > MAX_TOTAL_LOCALSTORAGE_BYTES) {
        return false;
      }
    }

    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // Non-destructive: DO NOT wipe localStorage, user data, auth data, or firestore_* keys.
    console.warn(`LocalStorage quota protection skipped optional write for "${key}":`, e);
    if (typeof window !== 'undefined' && isStorageQuotaError(e)) {
      window.dispatchEvent(
        new CustomEvent('app_storage_warning', {
          detail: {
            key,
            message: 'Bộ nhớ cục bộ trình duyệt đã gần đầy. Hệ thống tự động bỏ qua lưu đệm cục bộ và tiếp tục đồng bộ trực tuyến an toàn.'
          }
        })
      );
    }
    return false;
  }
}
