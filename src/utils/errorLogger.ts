// Structured, PII-safe client error logger for THPT Sơn Lương Management System
// Strictly excludes passwords, auth tokens, emails, and sensitive personal data.

export type ClientErrorSource =
  | 'app_error_boundary'
  | 'module_error_boundary'
  | 'window_error'
  | 'unhandled_rejection'
  | 'dom_reconciliation_guard'
  | 'vite_preload_error';

export interface ClientErrorRecord {
  id: string;
  errorName: string;
  errorMessage: string;
  componentName: string;
  route: string;
  timestamp: string;
  appVersion: string;
  browserName: string;
  browserVersion: string;
  source: ClientErrorSource;
}

const SESSION_ERROR_LOG_KEY = 'sl_client_error_logs_v1';
const MAX_ERROR_LOG_ENTRIES = 30;

declare const __COMMIT_SHA__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export function getAppVersionLabel(): string {
  try {
    const sha = typeof __COMMIT_SHA__ !== 'undefined' && __COMMIT_SHA__ ? String(__COMMIT_SHA__).slice(0, 7) : 'dev';
    const buildTime = typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__ ? String(__BUILD_TIME__) : '';
    return buildTime ? `v1.3.5-${sha} (${buildTime.slice(0, 10)})` : `v1.3.5-${sha}`;
  } catch {
    return 'v1.3.5';
  }
}

export function detectBrowserInfo(): { browserName: string; browserVersion: string } {
  if (typeof navigator === 'undefined') {
    return { browserName: 'Unknown', browserVersion: '0' };
  }
  const ua = navigator.userAgent || '';

  // Order matters: Edge/CocCoc/Opera also include "Chrome" in UA
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'Microsoft Edge', regex: /EdgA?\/([\d.]+)/ },
    { name: 'Cốc Cốc', regex: /coc_coc_browser\/([\d.]+)/i },
    { name: 'Opera', regex: /(?:OPR|Opera)\/([\d.]+)/ },
    { name: 'Google Chrome', regex: /Chrome\/([\d.]+)/ },
    { name: 'Mozilla Firefox', regex: /Firefox\/([\d.]+)/ },
    { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ }
  ];

  for (const p of patterns) {
    const m = ua.match(p.regex);
    if (m) {
      return { browserName: p.name, browserVersion: m[1] || 'unknown' };
    }
  }
  return { browserName: 'Other Browser', browserVersion: 'unknown' };
}

function sanitizeMessage(raw: string): string {
  return String(raw || '')
    // Strip bearer tokens, JWTs, API keys, passwords, emails if accidentally present
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/(password|passwd|pwd|token|secret|apiKey|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL_REDACTED]')
    .slice(0, 400);
}

export function extractComponentName(componentStack?: string | null): string {
  if (!componentStack) return 'UnknownComponent';
  const lines = componentStack
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // React stack frame format: "at ComponentName (https://...)" or "in ComponentName"
    const match = line.match(/^(?:at|in)\s+([A-Z][A-Za-z0-9_$]*)/);
    if (match && match[1] && !['ErrorBoundary', 'ModuleErrorBoundary', 'Suspense'].includes(match[1])) {
      return match[1];
    }
  }
  return 'AppTree';
}

export function getRecordedClientErrors(): ClientErrorRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(SESSION_ERROR_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logClientError(params: {
  error?: unknown;
  errorName?: string;
  errorMessage?: string;
  componentName?: string;
  componentStack?: string | null;
  source: ClientErrorSource;
}): ClientErrorRecord {
  const errObj = params.error instanceof Error ? params.error : null;
  const errorName = sanitizeMessage(
    params.errorName ||
      errObj?.name ||
      (typeof params.error === 'object' && params.error && 'name' in params.error
        ? String((params.error as { name?: unknown }).name)
        : 'Error')
  );
  const errorMessage = sanitizeMessage(
    params.errorMessage ||
      errObj?.message ||
      (typeof params.error === 'string' ? params.error : String(params.error || 'Unknown error'))
  );
  const componentName =
    params.componentName || extractComponentName(params.componentStack);
  const route =
    typeof window !== 'undefined' && window.location
      ? window.location.pathname || '/'
      : '/';
  const { browserName, browserVersion } = detectBrowserInfo();

  const record: ClientErrorRecord = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    errorName,
    errorMessage,
    componentName,
    route,
    timestamp: new Date().toISOString(),
    appVersion: getAppVersionLabel(),
    browserName,
    browserVersion,
    source: params.source
  };

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const existing = getRecordedClientErrors();
      const updated = [record, ...existing].slice(0, MAX_ERROR_LOG_ENTRIES);
      window.sessionStorage.setItem(SESSION_ERROR_LOG_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore sessionStorage quota issues
  }

  if (params.source === 'dom_reconciliation_guard') {
    console.warn('[DOM Reconciliation Guard]', record);
  } else {
    console.error('[Client Error Monitor]', record);
  }

  return record;
}

function isHandledFirestoreStorageNoise(err: unknown, message: string): boolean {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';
  const lower = `${name} ${message}`.toLowerCase();
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    lower.includes('quotaexceedederror') ||
    lower.includes('exceeded the quota') ||
    lower.includes('firestore_mutations_') ||
    lower.includes('firestore_clients_') ||
    lower.includes('unexpected state (id: b815)') ||
    lower.includes('unexpected state (id: ca9)') ||
    lower.includes('unexpected state (id: c050)') ||
    (lower.includes('internal assertion failed') && (lower.includes('storage') || lower.includes('quota') || lower.includes('b815')))
  );
}

let globalListenersInstalled = false;

export function installGlobalErrorListeners(): void {
  if (typeof window === 'undefined' || globalListenersInstalled) return;
  globalListenersInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    const msg = event.message || event.error?.message || '';
    // Ignore benign ResizeObserver loop notices and handled Firestore storage quota errors
    if (msg.includes('ResizeObserver loop')) return;
    if (isHandledFirestoreStorageNoise(event.error, msg)) return;
    logClientError({
      error: event.error,
      errorName: event.error?.name || 'WindowError',
      errorMessage: msg || 'Unhandled window error',
      componentName: event.filename ? event.filename.split('/').pop() || 'Window' : 'Window',
      source: 'window_error'
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';
    // Ignore Vite HMR websocket noise in AI Studio iframe and handled Firestore storage errors
    if (msg.includes('WebSocket') && msg.includes('vite')) return;
    if (isHandledFirestoreStorageNoise(reason, msg)) return;
    logClientError({
      error: reason,
      errorName: reason instanceof Error ? reason.name : 'UnhandledRejection',
      errorMessage: msg,
      componentName: 'AsyncPromise',
      source: 'unhandled_rejection'
    });
  });

  // Handle stale hashed JS/CSS chunk load errors after a new Vercel deployment
  const CHUNK_RELOAD_GUARD_KEY = 'sl_vite_preload_reload_ts';
  window.addEventListener('vite:preloadError', (event: Event) => {
    logClientError({
      errorName: 'VitePreloadError',
      errorMessage: 'Phát hiện phiên bản mới trên máy chủ khi tải tài nguyên động.',
      componentName: 'ViteChunkLoader',
      source: 'vite_preload_error'
    });

    try {
      const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || '0');
      const now = Date.now();
      // Only auto-refresh once per 30 seconds to prevent infinite reload loops
      if (now - lastReload > 30000) {
        window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now));
        event.preventDefault();
        window.location.reload();
      }
    } catch {
      // Ignore storage error
    }
  });
}
