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
/**
 * Phân biệt môi trường phát triển Google AI Studio và website đã xuất bản (Production / Xuất web / Shared Web).
 * 
 * - Google AI Studio Development Environment:
 *   + Chạy trong môi trường dev của AI Studio (hostname chứa 'ais-dev-') hoặc localhost.
 *   + Trả về false -> Giữ nguyên chức năng xóa cho quản trị viên và người có quyền theo phân quyền hiện có.
 * 
 * - Website đã xuất bản / Xuất web / Production:
 *   + import.meta.env.PROD === true (Bản build production, Vercel, Netlify, Docker...)
 *   + Hoặc URL là Shared App URL 'ais-pre-' (Link web xuất bản được chia sẻ cho người dùng ngoài Google AI Studio)
 *   + Hoặc tên miền triển khai chính thức khác ngoài môi trường dev của AI Studio.
 *   + Trả về true -> Ẩn hoàn toàn các chức năng xóa khỏi giao diện người dùng.
 */
export function isProductionWeb(): boolean {
  // 1. Kiểm tra build production chuẩn của Vite (Vercel, Netlify, npm run build)
  if (import.meta.env.PROD) {
    return true;
  }

  // 2. Kiểm tra biến môi trường override nếu có
  if (typeof import.meta.env.VITE_IS_PRODUCTION !== 'undefined') {
    return import.meta.env.VITE_IS_PRODUCTION === 'true';
  }

  // 3. Kiểm tra môi trường runtime trong trình duyệt
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    
    // Nếu đang chạy trong môi trường phát triển của Google AI Studio (ais-dev-) hoặc localhost dev
    if (hostname.includes('ais-dev-') || hostname === 'localhost' || hostname === '127.0.0.1') {
      return false;
    }

    // Nếu đang chạy trên URL xuất bản chia sẻ của Google AI Studio (ais-pre-...)
    if (hostname.includes('ais-pre-')) {
      return true;
    }

    // Nếu chạy trên bất kỳ domain nào khác ngoài ais-dev-
    if (hostname && !hostname.includes('ais-dev-')) {
      return true;
    }
  }

  return false;
}

export function canEditOrDelete(): boolean {
  // 1. Explicit environment variable override if defined
  if (typeof import.meta.env.VITE_ALLOW_EDIT_DELETE !== 'undefined') {
    return import.meta.env.VITE_ALLOW_EDIT_DELETE === 'true';
  }

  // 2. Default to true so authorized users can edit and delete individual records across environments
  return true;
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage setItem quota exceeded, clearing old non-essential cache items:', e);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k !== key && (
          k.startsWith('app_cache_') || 
          k.startsWith('app_cached_') || 
          k.startsWith('sws_') || 
          k.startsWith('kpi_vc_forms_cache') ||
          k.startsWith('kpi_cbql_forms_cache')
        )) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn('LocalStorage full, skipped local cache write safely:', err);
    }
  }
}

