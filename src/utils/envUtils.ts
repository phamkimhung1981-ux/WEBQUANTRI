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

  // 2. Allow in DEV / Development mode (Google AI Studio dev server)
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    return true;
  }

  // 3. Hide in Production / Published website
  return false;
}
