/**
 * Centralized Firestore Quota Circuit Breaker, Exponential Backoff,
 * Sync Timestamp Tracker, and TTL Request Cache with In-Flight Deduplication.
 *
 * Designed to eliminate redundant Firestore reads across module switches,
 * prevent infinite retry storms on `resource-exhausted`, preserve active user
 * sessions cleanly, and never escalate privileges.
 */

const LAST_SYNCED_STORAGE_KEY = 'thpt_sl_firestore_last_synced_at_v1';
const QUOTA_BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000]; // 30s -> 1m -> 2m -> 5m
const MAX_AUTO_RETRIES = 3;

export interface FirestoreQuotaState {
  quotaExceeded: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: number | null;
  lastSyncedAt: number | null;
  retryCount: number;
  nextRetryAt: number | null;
  isRetrying: boolean;
  epoch: number; // Increments on manual retry reset so subscribers can re-sync once
}

type QuotaListener = (state: FirestoreQuotaState) => void;

function loadStoredLastSyncedAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.sessionStorage.getItem(LAST_SYNCED_STORAGE_KEY) ||
      window.localStorage.getItem(LAST_SYNCED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persistLastSyncedAt(ts: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(ts));
    window.localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(ts));
  } catch {
    // ignore storage quota errors
  }
}

let state: FirestoreQuotaState = {
  quotaExceeded: false,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  lastSyncedAt: loadStoredLastSyncedAt(),
  retryCount: 0,
  nextRetryAt: null,
  isRetrying: false,
  epoch: 0,
};

const listeners = new Set<QuotaListener>();

function emitState(): void {
  const snapshot: FirestoreQuotaState = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // isolate subscriber errors
    }
  });
}

export function getQuotaManagerState(): FirestoreQuotaState {
  return { ...state };
}

export function subscribeQuotaManager(listener: QuotaListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Accurately detects Firestore Quota Exceeded (`resource-exhausted`) errors
 * across Firebase JS SDK error shapes and wrapped messages.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: unknown; message?: unknown; name?: unknown };
  const code = String(e?.code || '').toLowerCase();
  const message = String(e?.message || err || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    message.includes('resource-exhausted') ||
    message.includes('quota exceeded') ||
    message.includes('free daily read units') ||
    message.includes('quota metric')
  );
}

export function isNetworkUnavailableError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: unknown; message?: unknown };
  const code = String(e?.code || '').toLowerCase();
  const message = String(e?.message || err || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    message.includes('client is offline') ||
    message.includes('failed to get document because the client is offline') ||
    message.includes('network error')
  );
}

/**
 * Records a Firestore error. When `resource-exhausted` is detected, activates
 * the circuit breaker with exponential backoff so background listeners and
 * module navigation stop hammering Firestore.
 */
export function reportFirestoreError(err: unknown, context?: string): boolean {
  const isQuota = isQuotaExceededError(err);
  if (!isQuota) return false;

  const now = Date.now();
  const nextCount = Math.min(state.retryCount + 1, MAX_AUTO_RETRIES + 1);
  const backoffIdx = Math.min(nextCount - 1, QUOTA_BACKOFF_SCHEDULE_MS.length - 1);
  const backoffMs = QUOTA_BACKOFF_SCHEDULE_MS[backoffIdx];

  // After MAX_AUTO_RETRIES, stop automatic retries entirely (nextRetryAt = null)
  // so only an explicit user click on "Thử đồng bộ lại" triggers a new attempt.
  const nextRetryAt = nextCount <= MAX_AUTO_RETRIES ? now + backoffMs : null;

  const rawMsg =
    (err as { message?: string })?.message ||
    (typeof err === 'string' ? err : 'Firestore Quota Exceeded');

  state = {
    ...state,
    quotaExceeded: true,
    lastErrorCode: 'resource-exhausted',
    lastErrorMessage: context ? `[${context}] ${rawMsg}` : rawMsg,
    lastErrorAt: now,
    retryCount: nextCount,
    nextRetryAt,
    isRetrying: false,
  };
  emitState();
  return true;
}

/**
 * Records a successful Firestore read/sync. Automatically clears any active
 * quota warning and records the latest successful sync timestamp.
 */
export function reportFirestoreSuccess(): void {
  const now = Date.now();
  persistLastSyncedAt(now);
  const wasQuotaExceeded = state.quotaExceeded;
  const shouldEmit =
    wasQuotaExceeded ||
    state.isRetrying ||
    state.lastSyncedAt === null ||
    now - state.lastSyncedAt >= 5_000;

  state = {
    ...state,
    quotaExceeded: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    lastSyncedAt: now,
    retryCount: 0,
    nextRetryAt: null,
    isRetrying: false,
  };
  if (shouldEmit) {
    emitState();
  }
}

/**
 * Returns whether a Firestore read should proceed.
 * - While quotaExceeded is false: always true.
 * - While quotaExceeded is true:
 *   - If forceManual is true (user clicked "Thử đồng bộ lại"): returns true.
 *   - Otherwise blocks reads while within backoff window or after MAX_AUTO_RETRIES.
 */
export function canAttemptFirestoreRead(options?: { forceManual?: boolean }): boolean {
  if (options?.forceManual) return true;
  if (!state.quotaExceeded) return true;
  if (state.nextRetryAt === null) {
    // Exhausted automatic backoff retries -> wait for manual retry button
    return false;
  }
  return Date.now() >= state.nextRetryAt;
}

export function setQuotaRetrying(retrying: boolean): void {
  if (state.isRetrying === retrying) return;
  state = { ...state, isRetrying: retrying };
  emitState();
}

/**
 * Resets circuit breaker backoff for an explicit manual retry ("Thử đồng bộ lại")
 * without clearing cached data or dropping the user session.
 */
export function triggerManualSyncReset(): void {
  state = {
    ...state,
    retryCount: 0,
    nextRetryAt: Date.now(),
    isRetrying: true,
    epoch: state.epoch + 1,
  };
  emitState();
}

/**
 * Resets internal manager state (primarily for automated tests).
 */
export function resetQuotaManagerForTest(): void {
  state = {
    quotaExceeded: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    lastSyncedAt: null,
    retryCount: 0,
    nextRetryAt: null,
    isRetrying: false,
    epoch: 0,
  };
  clearAllFirestoreCaches();
  emitState();
}

// ---------------------------------------------------------------------------
// Centralized TTL Request Cache & In-Flight Promise Deduplication
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export interface CachedFetchOptions<T> {
  /** Bypass TTL and force a fresh Firestore read (still deduplicated in-flight). */
  force?: boolean;
  /** Allow manual retry even when circuit breaker is open. */
  forceManual?: boolean;
  /** Optional fallback value when circuit breaker blocks the read and no cached entry exists. */
  fallback?: () => T;
  /** When true (default), return stale cached value instead of throwing on quota error. */
  staleOnQuota?: boolean;
}

export function getCachedFirestoreValue<T>(cacheKey: string, allowStale = false): T | undefined {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return undefined;
  if (allowStale || Date.now() - entry.fetchedAt < entry.ttlMs) {
    return entry.data as T;
  }
  return undefined;
}

export function setCachedFirestoreValue<T>(cacheKey: string, data: T, ttlMs = 5 * 60 * 1000): void {
  memoryCache.set(cacheKey, {
    data,
    fetchedAt: Date.now(),
    ttlMs,
  });
}

export function invalidateFirestoreCache(keyOrPrefix: string): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`) || key.startsWith(keyOrPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function clearAllFirestoreCaches(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

/**
 * Fetches data from Firestore with:
 * 1. Fresh TTL cache hit -> 0 Firestore reads.
 * 2. In-flight promise deduplication -> concurrent callers share 1 Firestore read.
 * 3. Circuit breaker check -> avoids read storms during `resource-exhausted`,
 *    returning stale cache or fallback smoothly without breaking UI or session.
 * 4. Automatic success/error reporting to the centralized quota manager.
 */
export async function cachedFirestoreFetch<T>(
  cacheKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: CachedFetchOptions<T>
): Promise<T> {
  const now = Date.now();
  const existing = memoryCache.get(cacheKey);
  const staleOnQuota = options?.staleOnQuota !== false;

  // 1. Fresh cache hit
  if (!options?.force && existing && now - existing.fetchedAt < existing.ttlMs) {
    return existing.data as T;
  }

  // 2. Circuit breaker check (skip live fetch during quota backoff)
  if (!canAttemptFirestoreRead({ forceManual: options?.forceManual })) {
    if (existing && staleOnQuota) {
      return existing.data as T;
    }
    if (options?.fallback) {
      return options.fallback();
    }
    const err = new Error('Firestore quota circuit breaker active (resource-exhausted)');
    (err as { code?: string }).code = 'resource-exhausted';
    throw err;
  }

  // 3. In-flight deduplication
  const inflight = inFlightRequests.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      memoryCache.set(cacheKey, {
        data: result,
        fetchedAt: Date.now(),
        ttlMs,
      });
      reportFirestoreSuccess();
      return result;
    } catch (err) {
      const isQuota = reportFirestoreError(err, cacheKey);
      if (isQuota && staleOnQuota) {
        if (existing) {
          return existing.data as T;
        }
        if (options?.fallback) {
          return options.fallback();
        }
      }
      throw err;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Formats a sync timestamp into Vietnamese readable string (HH:mm:ss DD/MM/YYYY).
 */
export function formatSyncTimestamp(ts: number | null): string {
  if (!ts) return 'Chưa đồng bộ trong phiên này';
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm}:${ss} ${dd}/${mo}/${yyyy}`;
  } catch {
    return 'Không xác định';
  }
}

export interface CachedSubscriptionChannel<T> {
  subscribe: (callback: (data: T) => void, onError?: (err: Error) => void) => () => void;
  refresh: (force?: boolean, forceManual?: boolean) => Promise<T | undefined>;
  publish: (data: T) => void;
  invalidate: (autoRefreshIfSubscribed?: boolean) => void;
  getSnapshot: () => T | undefined;
}

/**
 * Creates a shared TTL-cached subscription channel to replace permanent
 * `onSnapshot` listeners that cause Firestore read storms across module switches.
 *
 * - Revisiting a module within `ttlMs` triggers 0 Firestore reads.
 * - Concurrent subscribers share 1 in-flight Firestore read.
 * - Local writes update subscribers immediately via `publish()` or `invalidate()`.
 * - Clicking "Thử đồng bộ lại" (`epoch` increment) re-syncs active subscribers once.
 */
export function createCachedSubscriptionChannel<T>(options: {
  cacheKey: string;
  ttlMs: number;
  fetcher: () => Promise<T>;
  getFallback?: () => T | undefined;
  onData?: (data: T) => void;
  onError?: (err: unknown) => void;
}): CachedSubscriptionChannel<T> {
  const subscribers = new Set<(data: T) => void>();
  const errorHandlers = new Set<(err: Error) => void>();
  let unsubQuotaEpoch: (() => void) | null = null;
  let lastSeenEpoch = state.epoch;

  const notifySubscribers = (data: T) => {
    subscribers.forEach((cb) => {
      try {
        cb(data);
      } catch {
        // isolate subscriber UI errors
      }
    });
  };

  const refresh = async (force = false, forceManual = false): Promise<T | undefined> => {
    try {
      const data = await cachedFirestoreFetch<T>(
        options.cacheKey,
        options.ttlMs,
        options.fetcher,
        {
          force,
          forceManual,
          fallback: options.getFallback
            ? () => {
                const fb = options.getFallback?.();
                if (fb !== undefined) return fb;
                throw new Error('No fallback available');
              }
            : undefined,
        }
      );
      options.onData?.(data);
      notifySubscribers(data);
      return data;
    } catch (err) {
      options.onError?.(err);
      const fallback = getCachedFirestoreValue<T>(options.cacheKey, true) ?? options.getFallback?.();
      if (fallback !== undefined) {
        notifySubscribers(fallback);
        return fallback;
      }
      const asError = err instanceof Error ? err : new Error(String(err));
      errorHandlers.forEach((eh) => {
        try {
          eh(asError);
        } catch {
          // ignore
        }
      });
      return undefined;
    }
  };

  const ensureQuotaEpochListener = () => {
    if (unsubQuotaEpoch) return;
    lastSeenEpoch = state.epoch;
    unsubQuotaEpoch = subscribeQuotaManager((qs) => {
      if (qs.epoch > lastSeenEpoch) {
        lastSeenEpoch = qs.epoch;
        if (subscribers.size > 0) {
          void refresh(true, true);
        }
      }
    });
  };

  const maybeReleaseQuotaEpochListener = () => {
    if (subscribers.size === 0 && unsubQuotaEpoch) {
      unsubQuotaEpoch();
      unsubQuotaEpoch = null;
    }
  };

  return {
    subscribe(callback, onError) {
      subscribers.add(callback);
      if (onError) errorHandlers.add(onError);
      ensureQuotaEpochListener();

      // Emit cached or fallback value immediately for 0ms render
      const immediate = getCachedFirestoreValue<T>(options.cacheKey, true) ?? options.getFallback?.();
      if (immediate !== undefined) {
        try {
          callback(immediate);
        } catch {
          // ignore
        }
      }

      // Only hits Firestore if TTL expired and circuit breaker allows it
      void refresh(false, false);

      return () => {
        subscribers.delete(callback);
        if (onError) errorHandlers.delete(onError);
        maybeReleaseQuotaEpochListener();
      };
    },
    refresh,
    publish(data: T) {
      setCachedFirestoreValue(options.cacheKey, data, options.ttlMs);
      options.onData?.(data);
      notifySubscribers(data);
    },
    invalidate(autoRefreshIfSubscribed = true) {
      invalidateFirestoreCache(options.cacheKey);
      if (autoRefreshIfSubscribed && subscribers.size > 0) {
        void refresh(true, false);
      }
    },
    getSnapshot() {
      return getCachedFirestoreValue<T>(options.cacheKey, true) ?? options.getFallback?.();
    },
  };
}

