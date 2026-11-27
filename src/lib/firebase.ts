import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  doc,
  getDocFromServer,
  type Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigFile from '../../firebase-applet-config.json';
import { probeLocalStorageHeadroom, isStorageQuotaError } from '../utils/envUtils';
import { reportFirestoreError, reportFirestoreSuccess } from '../utils/firestoreQuotaManager';

// Cấu hình Firebase thống nhất hỗ trợ đồng bộ giữa Google AI Studio, Localhost và Vercel
const activeConfig = {
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId || 'windy-system-q9v0l',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || firebaseConfigFile.appId || '1:321892479741:web:505faffb1d2617c4518494',
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseConfigFile.apiKey || 'AIzaSyDCgc-PUxKCviTEI1DVAb5ozBTzGy7qHnQ',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain || 'windy-system-q9v0l.firebaseapp.com',
  firestoreDatabaseId: (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || (firebaseConfigFile as any).firestoreDatabaseId || 'ai-studio-hthngqunlgiovint-0d69b880-7502-4902-b08f-94cb8fcead53',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket || 'windy-system-q9v0l.firebasestorage.app',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId || '321892479741'
};

// Initialize Firebase as singleton
const app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
const firestoreDbId = activeConfig.firestoreDatabaseId;

const MEMORY_FALLBACK_SESSION_KEY = 'firestore_use_memory_cache_fallback';
const MEMORY_FALLBACK_REASON_KEY = 'firestore_memory_cache_reason';

export interface FirestoreRuntimeState {
  cacheMode: 'persistent' | 'memory';
  isStorageConstrained: boolean;
  warningMessage: string | null;
}

export const firestoreRuntimeState: FirestoreRuntimeState = {
  cacheMode: 'memory',
  isStorageConstrained: false,
  warningMessage: null
};

/**
 * Safely record in sessionStorage that this browser tab/profile should use memoryLocalCache()
 * on next load. NEVER deletes localStorage, auth data, user data, or pending mutations.
 */
export function enableFirestoreMemoryFallback(reason?: string): void {
  firestoreRuntimeState.isStorageConstrained = true;
  if (reason) {
    firestoreRuntimeState.warningMessage = reason;
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(MEMORY_FALLBACK_SESSION_KEY, '1');
      if (reason) {
        sessionStorage.setItem(MEMORY_FALLBACK_REASON_KEY, reason);
      }
    }
  } catch {
    // ignore if sessionStorage itself is restricted
  }
}

export function isFirestoreRuntimeStorageError(err: unknown): boolean {
  if (isStorageQuotaError(err)) return true;
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes('internal assertion failed') ||
    lower.includes('unexpected state (id: b815)') ||
    lower.includes('unexpected state (id: ca9)') ||
    lower.includes('unexpected state (id: c050)') ||
    lower.includes('firestore_mutations_') ||
    lower.includes('firestore_clients_') ||
    lower.includes('failed to obtain exclusive access')
  );
}

/**
 * Determine whether browser storage (IndexedDB + LocalStorage headroom) can safely support
 * Firestore persistentLocalCache with persistentMultipleTabManager.
 *
 * Firebase SDK v12's persistentMultipleTabManager writes multi-tab client & mutation metadata
 * (`firestore_mutations_...`, `firestore_clients_...`) to window.localStorage.
 * If localStorage has insufficient free space (< 384 KB), persistentMultipleTabManager can
 * throw QuotaExceededError -> INTERNAL ASSERTION FAILED (ID: b815).
 * When headroom is low or IndexedDB is unavailable, we cleanly select memoryLocalCache()
 * without deleting any existing user or pending data.
 */
function canSafelyUsePersistentMultiTabCache(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'Môi trường không hỗ trợ trình duyệt.' };
  }

  try {
    if (window.sessionStorage && sessionStorage.getItem(MEMORY_FALLBACK_SESSION_KEY) === '1') {
      const savedReason =
        sessionStorage.getItem(MEMORY_FALLBACK_REASON_KEY) ||
        'Bộ nhớ lưu trữ trình duyệt bị hạn chế. Hệ thống đã chuyển sang chế độ bộ nhớ tạm an toàn (dữ liệu vẫn đồng bộ trực tuyến bình thường).';
      return { ok: false, reason: savedReason };
    }
  } catch {
    // sessionStorage blocked -> safer to use memory cache
    return {
      ok: false,
      reason: 'Trình duyệt đang hạn chế quyền lưu trữ cục bộ. Hệ thống đang chạy ở chế độ bộ nhớ tạm an toàn.'
    };
  }

  if (typeof indexedDB === 'undefined') {
    return {
      ok: false,
      reason: 'Trình duyệt không hỗ trợ IndexedDB. Hệ thống đang chạy ở chế độ bộ nhớ tạm an toàn.'
    };
  }

  // Non-destructive probe: verify at least 384 KB free in localStorage for Firestore multi-tab state
  const hasHeadroom = probeLocalStorageHeadroom(384 * 1024);
  if (!hasHeadroom) {
    return {
      ok: false,
      reason:
        'Bộ nhớ cục bộ (Local Storage) trên máy tính này đã gần đầy. Hệ thống tự động chuyển sang chế độ bộ nhớ tạm an toàn để tránh lỗi gián đoạn mà không xóa dữ liệu hiện có.'
    };
  }

  return { ok: true };
}

let db: Firestore;

const persistenceCheck = canSafelyUsePersistentMultiTabCache();

if (persistenceCheck.ok) {
  try {
    // Giới hạn dung lượng cache IndexedDB (40MB) để tránh phình bộ nhớ trên máy cấu hình thấp
    db = initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          cacheSizeBytes: 40 * 1024 * 1024,
          tabManager: persistentMultipleTabManager()
        }),
        experimentalAutoDetectLongPolling: true
      },
      firestoreDbId
    );
    firestoreRuntimeState.cacheMode = 'persistent';
    firestoreRuntimeState.isStorageConstrained = false;
    firestoreRuntimeState.warningMessage = null;
  } catch (initErr) {
    console.warn('Firestore persistentLocalCache unavailable, falling back to memoryLocalCache:', initErr);
    try {
      db = getFirestore(app, firestoreDbId);
      firestoreRuntimeState.cacheMode = 'persistent';
    } catch {
      try {
        db = initializeFirestore(
          app,
          {
            localCache: memoryLocalCache(),
            experimentalAutoDetectLongPolling: true
          },
          firestoreDbId
        );
        firestoreRuntimeState.cacheMode = 'memory';
        firestoreRuntimeState.isStorageConstrained = true;
        firestoreRuntimeState.warningMessage =
          'Không thể khởi tạo bộ nhớ ngoại tuyến trình duyệt. Hệ thống đã chuyển sang chế độ bộ nhớ tạm an toàn.';
      } catch {
        db = getFirestore(app);
      }
    }
  }
} else {
  // Bộ nhớ cục bộ đầy hoặc hạn chế -> dùng memoryLocalCache() để không bao giờ gây QuotaExceededError / b815
  try {
    db = initializeFirestore(
      app,
      {
        localCache: memoryLocalCache(),
        experimentalAutoDetectLongPolling: true
      },
      firestoreDbId
    );
  } catch {
    db = getFirestore(app, firestoreDbId);
  }
  firestoreRuntimeState.cacheMode = 'memory';
  firestoreRuntimeState.isStorageConstrained = true;
  firestoreRuntimeState.warningMessage =
    persistenceCheck.reason ||
    'Bộ nhớ cục bộ trình duyệt bị hạn chế. Hệ thống đang hoạt động an toàn ở chế độ bộ nhớ tạm trực tuyến.';
}

// Global non-destructive guard for asynchronous Firestore storage / assertion errors (e.g., b815 / QuotaExceededError)
if (typeof window !== 'undefined' && !(window as any).__thptSlFirestoreGuardAttached) {
  (window as any).__thptSlFirestoreGuardAttached = true;

  const notifyFirestoreStorageIssue = (err: unknown) => {
    if (!isFirestoreRuntimeStorageError(err)) return;
    const userMsg =
      'Bộ nhớ cục bộ trên trình duyệt máy tính này đã đạt giới hạn (QuotaExceededError). Dữ liệu trên máy chủ vẫn an toàn tuyệt đối. Vui lòng bấm "Chuyển sang chế độ bộ nhớ tạm an toàn" để tiếp tục làm việc ổn định.';
    enableFirestoreMemoryFallback(userMsg);
    window.dispatchEvent(
      new CustomEvent('firestore_storage_error', {
        detail: {
          message: userMsg,
          rawError: err instanceof Error ? err.message : String(err)
        }
      })
    );
  };

  window.addEventListener('error', (event) => {
    if (event.error && isFirestoreRuntimeStorageError(event.error)) {
      notifyFirestoreStorageIssue(event.error);
      event.preventDefault();
      event.stopImmediatePropagation?.();
    } else if (event.message && isFirestoreRuntimeStorageError(event.message)) {
      notifyFirestoreStorageIssue(event.message);
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isFirestoreRuntimeStorageError(event.reason)) {
      notifyFirestoreStorageIssue(event.reason);
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });
}

// Non-blocking startup connectivity check (at most once per browser session to avoid wasting Firestore reads)
const CONNECTION_CHECKED_SESSION_KEY = 'thpt_sl_firestore_conn_checked_v1';
async function testConnection() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    if (window.sessionStorage.getItem(CONNECTION_CHECKED_SESSION_KEY) === '1') {
      return;
    }
    window.sessionStorage.setItem(CONNECTION_CHECKED_SESSION_KEY, '1');
  } catch {
    // ignore storage errors
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    reportFirestoreSuccess();
  } catch (error) {
    reportFirestoreError(error, 'firebase.testConnection');
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connectivity check: client appears offline or network restricted.');
    }
  }
}
testConnection();

// Initialize Auth
const auth = getAuth(app);

export const getFirebaseConfigDetails = () => ({
  projectId: activeConfig.projectId,
  firestoreDatabaseId: firestoreDbId,
  authDomain: activeConfig.authDomain,
  cacheMode: firestoreRuntimeState.cacheMode,
  isStorageConstrained: firestoreRuntimeState.isStorageConstrained,
  isProduction: Boolean((import.meta as any).env?.PROD)
});

export { app, db, auth };
