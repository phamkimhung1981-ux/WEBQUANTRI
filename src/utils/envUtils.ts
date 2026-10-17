/**
 * Environment Utility for THPT Sơn Lương Teacher Management System
 * 
 * Determines whether Edit & Delete features should be accessible on the UI.
 * 
 * Rules:
 * 1. Google AI Studio Development Environment (DEV / development mode): Returns `true`
 *    - Admin and developers can edit and manage data.
 * 2. Published Production Environment (Vercel / npm run build / PROD mode): Returns `false`
 *    - Hides all Edit, Delete, Bulk Delete, and Reset buttons across all modules.
 * 3. Environment Variable Override: `VITE_ALLOW_EDIT_DELETE` ('true' | 'false').
 */
export function canEditOrDelete(): boolean {
  // 1. Explicit environment variable override if defined
  if (typeof import.meta.env.VITE_ALLOW_EDIT_DELETE !== 'undefined') {
    return import.meta.env.VITE_ALLOW_EDIT_DELETE === 'true';
  }

  // 2. Default to true so all authorized administrators and teachers can edit and delete KPI forms on Production Vercel
  return true;
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage setItem quota exceeded or failed:', e);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('app_cache_') || k.startsWith('app_cached_') || k.startsWith('sws_'))) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
    } catch (err) {
      console.error('Failed to save to localStorage even after clearing cache:', err);
    }
  }
}

