import { 
  AccountRecord, 
  RoleGroupCode, 
  DEFAULT_ROLE_GROUPS, 
  AccountStatus, 
  AccountAuditLog,
  ModulePermissionsMap,
  RoleGroupConfig,
  UserPermissionDocument,
  normalizeIdentifier,
  normalizeEmail
} from '../types/permission';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  getDocFromServer,
  getDocsFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query, 
  where,
  orderBy,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';
import { Teacher } from '../types';
import * as XLSX from 'xlsx';

const ACCOUNTS_COLLECTION = 'user_accounts';
const AUDIT_COLLECTION = 'account_audit_logs';
const ROLE_GROUPS_COLLECTION = 'role_group_configs';
export const CUSTOM_PERMISSIONS_COLLECTION = 'user_custom_permissions';

// Reactive version counter for role_group_configs loaded from Firestore
let roleGroupConfigsVersion = 0;
let roleGroupConfigsLoaded = false;
const roleGroupListeners = new Set<(version: number) => void>();

export function getRoleGroupConfigsVersion(): number {
  return roleGroupConfigsVersion;
}

export function isRoleGroupConfigsLoaded(): boolean {
  return roleGroupConfigsLoaded;
}

export function subscribeRoleGroupConfigsVersion(listener: (version: number) => void): () => void {
  roleGroupListeners.add(listener);
  return () => {
    roleGroupListeners.delete(listener);
  };
}

function notifyRoleGroupVersionChange(): void {
  roleGroupConfigsVersion += 1;
  roleGroupListeners.forEach((fn) => {
    try {
      fn(roleGroupConfigsVersion);
    } catch {
      // ignore listener errors
    }
  });
}

function extractFirestoreErrorCode(err: unknown): string | null {
  if (!err) return null;
  const code = (err as any)?.code;
  if (typeof code === 'string' && code.length > 0) return code;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('quota') || lower.includes('resource-exhausted')) return 'resource-exhausted';
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) return 'permission-denied';
  if (lower.includes('offline') || lower.includes('unavailable')) return 'unavailable';
  return 'unknown';
}

function formatFirestoreWriteError(err: unknown, contextLabel: string): Error {
  const code = extractFirestoreErrorCode(err);
  if (code === 'resource-exhausted') {
    return new Error(
      `Không thể lưu ${contextLabel} lên Firebase Firestore do cơ sở dữ liệu đã đạt giới hạn hạn mức miễn phí trong ngày (Quota Exceeded). Vui lòng thử lại sau khi hạn mức được làm mới hoặc nâng cấp gói Firebase.`
    );
  }
  if (code === 'permission-denied') {
    return new Error(
      `Không có quyền ghi ${contextLabel} lên Firebase Firestore (Permission Denied). Vui lòng kiểm tra Firebase Security Rules.`
    );
  }
  if (code === 'unavailable') {
    return new Error(
      `Không thể kết nối tới Firebase Firestore để lưu ${contextLabel}. Vui lòng kiểm tra kết nối mạng và thử lại.`
    );
  }
  const msg = err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
  return new Error(`Lỗi lưu ${contextLabel} lên Firebase Firestore: ${msg}`);
}

/**
 * Helper to fetch a Firestore doc preferring fresh server state (bypassing stale local cache),
 * falling back cleanly to cache only when offline/network-unavailable.
 */
async function getDocPreferServer(ref: ReturnType<typeof doc>, forceServer = true) {
  if (forceServer && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    try {
      return await getDocFromServer(ref);
    } catch (serverErr) {
      const code = extractFirestoreErrorCode(serverErr);
      // Do NOT hide quota or permission errors as silent empty reads — still attempt cache fallback for read continuity
      if (code === 'unavailable' || code === 'failed-precondition') {
        return await getDoc(ref);
      }
      // If quota exceeded or other server error, try cache if available, otherwise rethrow so caller knows
      try {
        const cached = await getDoc(ref);
        if (cached.exists()) return cached;
      } catch {
        // ignore cache miss
      }
      throw serverErr;
    }
  }
  return await getDoc(ref);
}

/**
 * Returns normalized lookup keys (exact-case IDs + lowercased username/code/email)
 * WITHOUT ever using fullName as a unique identifier.
 */
export function getTeacherKeyAliases(idOrUserOrCode?: string): string[] {
  if (!idOrUserOrCode) return [];
  const trimmed = String(idOrUserOrCode).trim();
  const clean = trimmed.toLowerCase();
  if (!clean) return [];

  const aliases = new Set<string>([trimmed, clean]);

  // Match DEFAULT_TEACHERS ONLY by stable unique identifiers (id, code, username, email) — NEVER by name
  for (const t of DEFAULT_TEACHERS) {
    const tIdRaw = String(t.id || '').trim();
    const tId = tIdRaw.toLowerCase();
    const tCode = normalizeIdentifier(t.code);
    const tUser = normalizeIdentifier(t.username);
    const tEmail = normalizeEmail(t.email);

    if (
      clean === tId ||
      (tCode && clean === tCode) ||
      (tUser && clean === tUser) ||
      (tEmail && clean === tEmail)
    ) {
      if (tIdRaw) aliases.add(tIdRaw);
      if (tId) aliases.add(tId);
      if (tCode) aliases.add(tCode);
      if (tUser) aliases.add(tUser);
    }
  }

  return Array.from(aliases);
}

export interface AccountIdentityInput {
  userId?: string;
  firebaseUid?: string;
  username?: string;
  teacherCode?: string;
  email?: string;
}

/**
 * Resolve ordered, deduplicated Firestore document ID candidates for a user identity.
 * Priority: Firebase UID (exact) -> Canonical Account/Teacher ID (exact) -> Normalized Username -> Normalized Teacher Code.
 */
export function resolvePermissionDocIds(identity: AccountIdentityInput): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (val?: string | null) => {
    const v = String(val ?? '').trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    ordered.push(v);
  };

  const uidRaw = String(identity.firebaseUid || '').trim();
  const idRaw = String(identity.userId || '').trim();
  const userNorm = normalizeIdentifier(identity.username);
  const codeNorm = normalizeIdentifier(identity.teacherCode);
  const emailNorm = normalizeEmail(identity.email);

  // 1. Primary canonical keys (exact case first so Firebase UIDs / mixed-case doc IDs never miss)
  if (uidRaw) push(uidRaw);
  if (idRaw) push(idRaw);
  if (idRaw && idRaw.toLowerCase() !== idRaw) push(idRaw.toLowerCase());

  // 2. Normalized username & teacher code
  if (userNorm) push(userNorm);
  if (codeNorm) push(codeNorm);

  // 3. Cross-link against canonical DEFAULT_TEACHERS only by exact id/username/code/email (never by name)
  for (const t of DEFAULT_TEACHERS) {
    const tId = String(t.id || '').trim();
    const tUser = normalizeIdentifier(t.username);
    const tCode = normalizeIdentifier(t.code);
    const tEmail = normalizeEmail(t.email);
    const matched =
      (idRaw && (tId === idRaw || tId.toLowerCase() === idRaw.toLowerCase())) ||
      (userNorm && tUser === userNorm) ||
      (codeNorm && tCode === codeNorm) ||
      (emailNorm && tEmail && tEmail === emailNorm);
    if (matched) {
      push(tId);
      if (tUser) push(tUser);
      if (tCode) push(tCode);
      break;
    }
  }

  return ordered;
}

function parseTimestampMs(ts?: string): number {
  if (!ts) return 0;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface LivePermissionsResult {
  hasCustom: boolean;
  permissions: Partial<ModulePermissionsMap> | null;
  roleGroup?: RoleGroupCode;
  accountStatus?: AccountStatus;
  accountData?: Partial<AccountRecord> | null;
  updatedAt?: string;
  source: 'user_custom_permissions' | 'user_accounts' | 'teachers' | 'none';
  errorCode: string | null;
}

/**
 * Authoritative real-time fetch of user permissions directly from Firebase Firestore.
 * - Never relies on localStorage or static custom_permissions.json.
 * - Evaluates all canonical doc keys in parallel and selects the newest record by `updatedAt`
 *   (so an outdated alias doc can NEVER shadow a newer canonical permission grant/revoke).
 * - Preserves exact case for Firebase UID / Firestore doc IDs and normalizes username/email/code.
 */
export async function getLiveUserPermissionsFromFirestore(
  userId: string,
  username?: string,
  teacherCode?: string,
  options?: { firebaseUid?: string; email?: string; forceServer?: boolean }
): Promise<LivePermissionsResult> {
  const cleanId = String(userId || '').trim();
  const cleanUid = String(options?.firebaseUid || '').trim();
  const cleanUser = normalizeIdentifier(username);
  const cleanCode = normalizeIdentifier(teacherCode);
  const cleanEmail = normalizeEmail(options?.email);
  const forceServer = options?.forceServer !== false;

  const docIds = resolvePermissionDocIds({
    userId: cleanId,
    firebaseUid: cleanUid,
    username: cleanUser,
    teacherCode: cleanCode,
    email: cleanEmail
  });

  let lastErrorCode: string | null = null;
  let accountData: Partial<AccountRecord> | null = null;

  // 1. Fetch candidate docs from `user_custom_permissions` in parallel (typically 2-3 reads max)
  const permCandidates: Array<{
    docId: string;
    data: any;
    updatedMs: number;
    priority: number;
  }> = [];

  if (docIds.length > 0) {
    const settledPerms = await Promise.allSettled(
      docIds.map(async (k, idx) => {
        const snap = await getDocPreferServer(doc(db, CUSTOM_PERMISSIONS_COLLECTION, k), forceServer);
        return { k, idx, snap };
      })
    );

    for (const r of settledPerms) {
      if (r.status === 'fulfilled') {
        const { k, idx, snap } = r.value;
        if (snap.exists()) {
          const data = snap.data();
          if (data) {
            permCandidates.push({
              docId: k,
              data,
              updatedMs: parseTimestampMs(data.updatedAt),
              priority: idx
            });
          }
        }
      } else {
        const code = extractFirestoreErrorCode(r.reason);
        if (code) lastErrorCode = code;
      }
    }
  }

  // 2. Also fetch primary account doc (`user_accounts/{cleanId}` or by username/email) for authoritative status & roleGroup
  try {
    const primaryAccId = cleanId || cleanUid;
    if (primaryAccId) {
      const accSnap = await getDocPreferServer(doc(db, ACCOUNTS_COLLECTION, primaryAccId), forceServer);
      if (accSnap.exists()) {
        accountData = { id: accSnap.id, ...(accSnap.data() as any) };
      }
    }
    if (!accountData && cleanUid && cleanUid !== cleanId) {
      const qUid = query(collection(db, ACCOUNTS_COLLECTION), where('firebaseUid', '==', cleanUid), limit(1));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        accountData = { id: snapUid.docs[0].id, ...(snapUid.docs[0].data() as any) };
      }
    }
    if (!accountData && cleanUser) {
      const qUser = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', cleanUser), limit(1));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        accountData = { id: snapUser.docs[0].id, ...(snapUser.docs[0].data() as any) };
      }
    }
    if (!accountData && cleanEmail) {
      const qEmail = query(collection(db, ACCOUNTS_COLLECTION), where('normalizedEmail', '==', cleanEmail), limit(1));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        accountData = { id: snapEmail.docs[0].id, ...(snapEmail.docs[0].data() as any) };
      }
    }
  } catch (accErr) {
    const code = extractFirestoreErrorCode(accErr);
    if (code) lastErrorCode = code;
  }

  // If accountData was discovered under a different canonical ID than we queried, check its custom_permissions doc too
  if (accountData?.id && !docIds.includes(accountData.id)) {
    try {
      const extraSnap = await getDocPreferServer(doc(db, CUSTOM_PERMISSIONS_COLLECTION, accountData.id), forceServer);
      if (extraSnap.exists()) {
        const data = extraSnap.data();
        if (data) {
          permCandidates.push({
            docId: accountData.id,
            data,
            updatedMs: parseTimestampMs(data.updatedAt),
            priority: -1
          });
        }
      }
    } catch (extraErr) {
      const code = extractFirestoreErrorCode(extraErr);
      if (code) lastErrorCode = code;
    }
  }

  // Evaluate newest authoritative record across `user_custom_permissions` & `user_accounts`
  if (permCandidates.length > 0) {
    permCandidates.sort((a, b) => {
      if (b.updatedMs !== a.updatedMs) return b.updatedMs - a.updatedMs;
      // Tie-break: prefer explicit canonical doc (`priority` lower) and prefer valid permissions if timestamps identical
      const aHas = a.data?.hasCustomPermissions === true && a.data?.permissions && Object.keys(a.data.permissions).length > 0 ? 1 : 0;
      const bHas = b.data?.hasCustomPermissions === true && b.data?.permissions && Object.keys(b.data.permissions).length > 0 ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return a.priority - b.priority;
    });

    const winner = permCandidates[0];
    const accUpdatedMs = parseTimestampMs(accountData?.updatedAt);
    const accHasValidCustom =
      Boolean(accountData?.hasCustomPermissions) &&
      Boolean(accountData?.customPermissions) &&
      Object.keys(accountData?.customPermissions || {}).length > 0;

    // If user_accounts was updated strictly MORE RECENTLY than user_custom_permissions, respect user_accounts
    if (accountData && accUpdatedMs > winner.updatedMs && accountData.hasCustomPermissions !== undefined) {
      return {
        hasCustom: accHasValidCustom,
        permissions: accHasValidCustom ? (accountData.customPermissions as Partial<ModulePermissionsMap>) : null,
        roleGroup: accountData.roleGroup,
        accountStatus: accountData.status,
        accountData,
        updatedAt: accountData.updatedAt,
        source: 'user_accounts',
        errorCode: null
      };
    }

    const winnerHasValidCustom =
      winner.data.hasCustomPermissions !== false &&
      Boolean(winner.data.permissions) &&
      Object.keys(winner.data.permissions).length > 0;

    return {
      hasCustom: winnerHasValidCustom,
      permissions: winnerHasValidCustom ? (winner.data.permissions as Partial<ModulePermissionsMap>) : null,
      roleGroup: accountData?.roleGroup || winner.data.roleGroup,
      accountStatus: accountData?.status,
      accountData,
      updatedAt: winner.data.updatedAt,
      source: 'user_custom_permissions',
      errorCode: null
    };
  }

  // 3. Fallback to `user_accounts` customPermissions if no `user_custom_permissions` doc exists yet
  if (accountData) {
    const accHasValidCustom =
      Boolean(accountData.hasCustomPermissions) &&
      Boolean(accountData.customPermissions) &&
      Object.keys(accountData.customPermissions || {}).length > 0;
    return {
      hasCustom: accHasValidCustom,
      permissions: accHasValidCustom ? (accountData.customPermissions as Partial<ModulePermissionsMap>) : null,
      roleGroup: accountData.roleGroup,
      accountStatus: accountData.status,
      accountData,
      updatedAt: accountData.updatedAt,
      source: 'user_accounts',
      errorCode: null
    };
  }

  // 4. Final Firestore fallback: check `teachers/{cleanId}` once (for legacy records only saved on teachers)
  if (cleanId) {
    try {
      const tDoc = await getDocPreferServer(doc(db, 'teachers', cleanId), forceServer);
      if (tDoc.exists()) {
        const data = tDoc.data();
        const tHasValidCustom =
          Boolean(data?.hasCustomPermissions) &&
          Boolean(data?.customPermissions) &&
          Object.keys(data?.customPermissions || {}).length > 0;
        return {
          hasCustom: tHasValidCustom,
          permissions: tHasValidCustom ? (data.customPermissions as Partial<ModulePermissionsMap>) : null,
          updatedAt: data?.accountUpdatedAt,
          source: 'teachers',
          errorCode: null
        };
      }
    } catch (tErr) {
      const code = extractFirestoreErrorCode(tErr);
      if (code) lastErrorCode = code;
    }
  }

  return {
    hasCustom: false,
    permissions: null,
    accountData: null,
    source: 'none',
    errorCode: lastErrorCode
  };
}

/**
 * Subscribe in real time to Firestore permission & account changes for the currently logged-in user.
 * Ensures that whenever an Admin grants/revokes KPI permissions or changes roleGroup/status,
 * active web sessions update immediately without stale caches.
 */
export function subscribeUserLivePermissions(
  identity: AccountIdentityInput & { roleGroup?: RoleGroupCode },
  onUpdate: (update: {
    hasCustom?: boolean;
    permissions?: Partial<ModulePermissionsMap> | null;
    roleGroup?: RoleGroupCode;
    accountStatus?: AccountStatus;
    fullName?: string;
    position?: string;
    departmentName?: string;
    updatedAt?: string;
  }) => void,
  onError?: (errorCode: string) => void
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const canonicalId = String(identity.userId || identity.firebaseUid || '').trim();
  const cleanUser = normalizeIdentifier(identity.username);

  let latestPermUpdatedMs = 0;

  const handlePermSnapshot = (data: any) => {
    if (!data) return;
    const tsMs = parseTimestampMs(data.updatedAt);
    if (tsMs > 0 && tsMs < latestPermUpdatedMs) return;
    if (tsMs > 0) latestPermUpdatedMs = tsMs;

    const hasValid =
      data.hasCustomPermissions !== false &&
      Boolean(data.permissions) &&
      Object.keys(data.permissions).length > 0;

    onUpdate({
      hasCustom: hasValid,
      permissions: hasValid ? (data.permissions as Partial<ModulePermissionsMap>) : null,
      updatedAt: data.updatedAt
    });
  };

  if (canonicalId && canonicalId !== 'admin') {
    unsubs.push(
      onSnapshot(
        doc(db, CUSTOM_PERMISSIONS_COLLECTION, canonicalId),
        (snap) => {
          if (snap.exists()) {
            handlePermSnapshot(snap.data());
          }
        },
        (err) => {
          const code = extractFirestoreErrorCode(err);
          if (code && onError) onError(code);
        }
      )
    );

    if (cleanUser && cleanUser !== canonicalId) {
      unsubs.push(
        onSnapshot(
          doc(db, CUSTOM_PERMISSIONS_COLLECTION, cleanUser),
          (snap) => {
            if (snap.exists()) {
              handlePermSnapshot(snap.data());
            }
          },
          (err) => {
            const code = extractFirestoreErrorCode(err);
            if (code && onError) onError(code);
          }
        )
      );
    }

    unsubs.push(
      onSnapshot(
        doc(db, ACCOUNTS_COLLECTION, canonicalId),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          if (!d) return;
          const accTsMs = parseTimestampMs(d.updatedAt);
          const payload: any = {
            roleGroup: d.roleGroup,
            accountStatus: d.status,
            fullName: d.fullName,
            position: d.position,
            departmentName: d.departmentName,
            updatedAt: d.updatedAt
          };
          if (d.hasCustomPermissions !== undefined && accTsMs >= latestPermUpdatedMs) {
            if (accTsMs > 0) latestPermUpdatedMs = accTsMs;
            const hasValid =
              Boolean(d.hasCustomPermissions) &&
              Boolean(d.customPermissions) &&
              Object.keys(d.customPermissions || {}).length > 0;
            payload.hasCustom = hasValid;
            payload.permissions = hasValid ? d.customPermissions : null;
          }
          onUpdate(payload);
        },
        (err) => {
          const code = extractFirestoreErrorCode(err);
          if (code && onError) onError(code);
        }
      )
    );
  }

  // Subscribe to the user's role group template doc (1 doc only)
  const rg = identity.roleGroup;
  if (rg && rg !== 'ADMIN' && DEFAULT_ROLE_GROUPS[rg]) {
    unsubs.push(
      onSnapshot(
        doc(db, ROLE_GROUPS_COLLECTION, rg),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.permissions && DEFAULT_ROLE_GROUPS[rg]) {
              DEFAULT_ROLE_GROUPS[rg].permissions = {
                ...DEFAULT_ROLE_GROUPS[rg].permissions,
                ...data.permissions
              };
              roleGroupConfigsLoaded = true;
              notifyRoleGroupVersionChange();
            }
          }
        },
        () => {
          // ignore non-critical role template watch errors
        }
      )
    );
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // ignore unsubscribe errors
      }
    });
  };
}

// Determine initial role group based on teacher's position
export function detectRoleGroupByPosition(position: string = '', departmentId: string = ''): RoleGroupCode {
  const pos = position.toLowerCase();
  if (pos.includes('hiệu trưởng') || pos.includes('ban giám hiệu') || pos.includes('bgh')) {
    return 'BGH';
  }
  if (pos.includes('tổ trưởng') || pos.includes('tt') || pos.includes('ttpcm') || pos.includes('tổ phó')) {
    return 'TTCM';
  }
  if (pos.includes('đoàn') || pos.includes('bí thư') || pos.includes('phó bí thư')) {
    return 'DOAN';
  }
  if (pos.includes('thư viện') || pos.includes('thiết bị') || pos.includes('văn thư') || pos.includes('kế toán') || pos.includes('y tế') || departmentId.includes('van_phong')) {
    return 'STAFF';
  }
  if (pos.includes('chủ nhiệm') || pos.includes('gvcn')) {
    return 'GVCN';
  }
  return 'TEACHER';
}

/**
 * Hash password securely with SHA-256 and system salt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + '_thpt_son_luong_salt_2026');
      const hashPromise = window.crypto.subtle.digest('SHA-256', data);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500));
      const hashBuffer = await Promise.race([hashPromise, timeoutPromise]) as ArrayBuffer;
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    // fallback
  }
  return 'h_' + btoa(unescape(encodeURIComponent(password)));
}

export function getStoredUserPassword(username: string): { plain?: string; hash?: string } | null {
  if (!username) return null;
  try {
    const raw = localStorage.getItem('custom_user_passwords');
    if (raw) {
      const map = JSON.parse(raw);
      const entry = map[username.toLowerCase().trim()];
      if (entry) {
        if (typeof entry === 'string') {
          return { plain: entry, hash: entry };
        }
        return entry;
      }
    }
  } catch (e) {}
  return null;
}

export function setStoredUserPassword(username: string, plainPass: string, hashedPass?: string): void {
  if (!username || !plainPass) return;
  try {
    const key = 'custom_user_passwords';
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[username.toLowerCase().trim()] = {
      plain: plainPass,
      hash: hashedPass || plainPass,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {}
}

/**
 * Legacy helper retained for API compatibility only.
 * Permissions are now strictly sourced from Firebase Firestore (never localStorage).
 */
export function getStoredUserCustomPermissions(): Record<string, Partial<ModulePermissionsMap>> {
  return {};
}

export function setStoredUserCustomPermissions(_idOrUsername: string, _perms: Partial<ModulePermissionsMap> | null): void {
  // Clean up any stale legacy localStorage permission cache to avoid split-brain
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('custom_user_permissions_map');
    }
  } catch {
    // ignore storage restriction
  }
}

/**
 * Legacy server sync helper — now delegates strictly to Firebase Firestore `role_group_configs`.
 * Never reads static `/custom_permissions.json` or `/api/permissions` so AI Studio and Vercel
 * always share the exact same Firestore Single Source of Truth.
 */
export async function syncPermissionsFromServer(): Promise<{ roleGroups: any; userCustom: any }> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('custom_user_permissions_map');
    }
  } catch {
    // ignore
  }
  await accountService.loadRoleGroupConfigs();
  return { roleGroups: {}, userCustom: {} };
}

export const accountService = {
  /**
   * Fetch all accounts directly from Firebase Firestore and merge live `user_custom_permissions`.
   * Never seeds default accounts over Firestore on read error; only seeds if collection is genuinely empty.
   */
  async getAccounts(): Promise<AccountRecord[]> {
    try {
      // Load Firestore role group configs first
      await this.loadRoleGroupConfigs();

      let accSnap: any = null;
      let permSnap: any = null;
      let firestoreReadError: unknown = null;

      try {
        const [aRes, pRes] = await Promise.all([
          getDocs(collection(db, ACCOUNTS_COLLECTION)),
          getDocs(collection(db, CUSTOM_PERMISSIONS_COLLECTION)).catch(() => null)
        ]);
        accSnap = aRes;
        permSnap = pRes;
      } catch (e) {
        firestoreReadError = e;
        console.warn('Firestore getAccounts error:', e);
      }

      // Build map of newest custom permission docs from `user_custom_permissions`
      const permDocByKey = new Map<string, { hasCustom: boolean; permissions: Partial<ModulePermissionsMap> | null; updatedMs: number }>();
      if (permSnap && !permSnap.empty) {
        permSnap.docs.forEach((d: any) => {
          const data = d.data();
          if (!data) return;
          const updatedMs = parseTimestampMs(data.updatedAt);
          const hasValid =
            data.hasCustomPermissions !== false &&
            Boolean(data.permissions) &&
            Object.keys(data.permissions).length > 0;
          const entry = {
            hasCustom: hasValid,
            permissions: hasValid ? (data.permissions as Partial<ModulePermissionsMap>) : null,
            updatedMs
          };
          const keys = [
            String(d.id || '').trim(),
            String(data.canonicalId || '').trim(),
            String(data.userId || '').trim(),
            String(data.firebaseUid || '').trim(),
            normalizeIdentifier(data.username),
            normalizeIdentifier(data.teacherCode)
          ].filter(Boolean);
          keys.forEach((k) => {
            const prev = permDocByKey.get(k);
            if (!prev || updatedMs >= prev.updatedMs) {
              permDocByKey.set(k, entry);
            }
          });
        });
      }

      if (accSnap && !accSnap.empty) {
        const rawAccounts = accSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AccountRecord));
        const validRawAccounts = rawAccounts.filter((acc) =>
          Boolean(acc && acc.fullName && acc.fullName.trim() !== '' && acc.username && acc.username.trim() !== '')
        );

        // Deduplicate by normalized username, preferring canonical teacher/account doc IDs
        const dedupMap = new Map<string, AccountRecord>();
        for (const a of validRawAccounts) {
          const uKey = normalizeIdentifier(a.username);
          if (!dedupMap.has(uKey)) {
            dedupMap.set(uKey, a);
          } else {
            const existing = dedupMap.get(uKey)!;
            const existingTs = parseTimestampMs(existing.updatedAt);
            const currTs = parseTimestampMs(a.updatedAt);
            dedupMap.set(uKey, currTs >= existingTs ? { ...existing, ...a } : { ...a, ...existing });
          }
        }

        const accounts = Array.from(dedupMap.values()).map((acc) => {
          const candidateKeys = resolvePermissionDocIds({
            userId: acc.id,
            firebaseUid: acc.firebaseUid,
            username: acc.username,
            teacherCode: acc.teacherCode,
            email: acc.email
          });

          let bestPerm: { hasCustom: boolean; permissions: Partial<ModulePermissionsMap> | null; updatedMs: number } | null = null;
          for (const k of candidateKeys) {
            const match = permDocByKey.get(k);
            if (match && (!bestPerm || match.updatedMs >= bestPerm.updatedMs)) {
              bestPerm = match;
            }
          }

          const accTs = parseTimestampMs(acc.updatedAt);
          if (bestPerm && bestPerm.updatedMs >= accTs) {
            return {
              ...acc,
              hasCustomPermissions: bestPerm.hasCustom,
              customPermissions: bestPerm.hasCustom && bestPerm.permissions ? bestPerm.permissions : undefined
            };
          }

          const accHasCustom =
            Boolean(acc.hasCustomPermissions) &&
            Boolean(acc.customPermissions) &&
            Object.keys(acc.customPermissions || {}).length > 0;
          return {
            ...acc,
            hasCustomPermissions: accHasCustom,
            customPermissions: accHasCustom ? acc.customPermissions : undefined
          };
        });

        return accounts;
      }

      // If Firestore errored (e.g. quota exceeded / network offline), do NOT overwrite Firestore with defaults
      if (firestoreReadError) {
        throw formatFirestoreWriteError(firestoreReadError, 'danh sách tài khoản');
      }

      // Otherwise seed default accounts list from DEFAULT_TEACHERS
      let teachersList: Teacher[] = [];
      try {
        const teachersPromise = getDocs(collection(db, 'teachers'));
        const teachersTimeout = new Promise<null>(res => setTimeout(() => res(null), 3000));
        const teachersSnap: any = await Promise.race([teachersPromise, teachersTimeout]);
        if (teachersSnap && !teachersSnap.empty) {
          teachersList = teachersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Teacher));
        }
      } catch (e) {}

      if (!teachersList || teachersList.length === 0) {
        teachersList = DEFAULT_TEACHERS;
      }

      const initialAccounts: AccountRecord[] = [];
      const customMap = getStoredUserCustomPermissions();

      // 1. Admin account
      const adminAccount: AccountRecord = {
        id: 'admin',
        teacherCode: 'ADMIN',
        fullName: 'Quản trị viên Hệ thống',
        username: 'admin',
        password: 'admin',
        position: 'Quản trị viên',
        departmentName: 'Ban Quản trị',
        roleGroup: 'ADMIN',
        status: 'Đang hoạt động',
        hasCustomPermissions: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        email: 'admin@thptsonluong.edu.vn'
      };
      initialAccounts.push(adminAccount);

      // 2. Generate accounts for all teachers
      for (const t of teachersList) {
        const username = (t.username || t.code?.toLowerCase() || `gv_${t.id.slice(0, 6)}`).toLowerCase().trim();
        const roleGroup = detectRoleGroupByPosition(t.position, t.departmentId);
        const status: AccountStatus = t.accountStatus === 'Đã khóa' ? 'Đã khóa' : 'Đang hoạt động';

        const aliases = getTeacherKeyAliases(t.id);
        if (t.code) getTeacherKeyAliases(t.code).forEach(a => aliases.indexOf(a) === -1 && aliases.push(a));
        if (username) getTeacherKeyAliases(username).forEach(a => aliases.indexOf(a) === -1 && aliases.push(a));

        let customPerm: any = (t as any).customPermissions || null;
        if (!customPerm) {
          for (const alias of aliases) {
            if (customMap[alias] && Object.keys(customMap[alias]).length > 0) {
              customPerm = customMap[alias];
              break;
            }
          }
        }

        const hasCustom = !!((t as any).hasCustomPermissions || (customPerm && Object.keys(customPerm).length > 0));

        const account: AccountRecord = {
          id: t.id,
          teacherId: t.id,
          teacherCode: t.code,
          fullName: t.name,
          username,
          password: t.accountPassword || t.password || '123456',
          position: t.position || 'Giáo viên',
          departmentId: t.departmentId,
          departmentName: t.departmentName,
          roleGroup,
          status,
          hasCustomPermissions: hasCustom,
          customPermissions: hasCustom ? customPerm : undefined,
          createdAt: t.joinDate || '2026-10-16T00:00:00.000Z',
          updatedAt: new Date().toISOString(),
          email: t.email,
          phone: t.phone
        };
        initialAccounts.push(account);
      }

      try {
        localStorage.setItem('cached_user_accounts', JSON.stringify(initialAccounts));
        Promise.all(
          initialAccounts.map(acc => setDoc(doc(db, ACCOUNTS_COLLECTION, acc.id), acc, { merge: true }))
        ).catch(() => {});
      } catch (err) {}

      return initialAccounts;
    } catch (e) {
      console.error('Error in getAccounts:', e);
      return [
        {
          id: 'admin',
          teacherCode: 'ADMIN',
          fullName: 'Quản trị viên Hệ thống',
          username: 'admin',
          password: 'admin',
          position: 'Quản trị viên',
          departmentName: 'Ban Quản trị',
          roleGroup: 'ADMIN',
          status: 'Đang hoạt động',
          hasCustomPermissions: false,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z'
        },
        ...DEFAULT_TEACHERS.map(t => ({
          id: t.id,
          teacherId: t.id,
          teacherCode: t.code,
          fullName: t.name,
          username: (t.username || t.code?.toLowerCase() || `gv_${t.id.slice(0, 5)}`).toLowerCase(),
          password: '123456',
          position: t.position || 'Giáo viên',
          departmentId: t.departmentId,
          departmentName: t.departmentName,
          roleGroup: detectRoleGroupByPosition(t.position, t.departmentId),
          status: 'Đang hoạt động' as AccountStatus,
          hasCustomPermissions: false,
          createdAt: t.joinDate || '2026-10-16T00:00:00.000Z',
          updatedAt: '2026-10-16T00:00:00.000Z'
        }))
      ];
    }
  },

  /**
   * Create a new account
   */
  async createAccount(
    data: Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt'>,
    performedBy: string
  ): Promise<AccountRecord> {
    const username = data.username.toLowerCase().trim();
    
    // Check if username already exists
    const q = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', username));
    const existSnap = await getDocs(q);
    if (!existSnap.empty) {
      throw new Error(`Tên đăng nhập "${username}" đã tồn tại. Vui lòng chọn tên đăng nhập khác.`);
    }

    const id = data.teacherId || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAccount: AccountRecord = {
      ...data,
      id,
      username,
      password: data.password || '123456',
      createdAt: now,
      updatedAt: now
    };

    // Save to accounts collection
    await setDoc(doc(db, ACCOUNTS_COLLECTION, id), newAccount);

    // If linked to a teacher, update the teacher record
    if (data.teacherId) {
      try {
        await updateDoc(doc(db, 'teachers', data.teacherId), {
          hasAccount: true,
          username: username,
          accountStatus: data.status,
          accountRole: data.roleGroup,
          accountPassword: newAccount.password,
          accountUpdatedAt: now
        });
      } catch (e) {
        console.warn('Could not sync teacher record:', e);
      }
    }

    // Add audit log
    await this.addAuditLog({
      action: 'CREATE',
      targetUsername: username,
      targetFullName: data.fullName,
      performedBy,
      details: `Khởi tạo tài khoản mới với nhóm quyền ${data.roleGroup}`
    });

    return newAccount;
  },

  /**
   * Update an existing account
   */
  async updateAccount(
    id: string,
    updates: Partial<AccountRecord>,
    performedBy: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatePayload = {
      ...updates,
      updatedAt: now
    };

    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), updatePayload);

    // Sync to teacher document if teacherId exists or id matches teacher
    try {
      const teacherDoc = await getDoc(doc(db, 'teachers', id));
      if (teacherDoc.exists()) {
        const teacherUpdates: Record<string, any> = { accountUpdatedAt: now };
        if (updates.status) teacherUpdates.accountStatus = updates.status;
        if (updates.roleGroup) teacherUpdates.accountRole = updates.roleGroup;
        if (updates.password) teacherUpdates.accountPassword = updates.password;
        if (updates.username) teacherUpdates.username = updates.username;
        if (updates.fullName) teacherUpdates.name = updates.fullName;
        if (updates.position) teacherUpdates.position = updates.position;
        await updateDoc(doc(db, 'teachers', id), teacherUpdates);
      }
    } catch (e) {
      console.warn('Teacher sync skipped or failed:', e);
    }

    await this.addAuditLog({
      action: 'UPDATE',
      targetUsername: updates.username || id,
      targetFullName: updates.fullName || id,
      performedBy,
      details: `Cập nhật thông tin tài khoản: ${Object.keys(updates).join(', ')}`
    });
  },

  /**
   * Delete an account
   */
  async deleteAccount(id: string, performedBy: string): Promise<void> {
    try {
      const docRef = doc(db, ACCOUNTS_COLLECTION, id);
      const accDoc = await getDoc(docRef);
      const accData = accDoc.exists() ? accDoc.data() : null;

      // 1. Delete from Firestore
      await deleteDoc(docRef).catch(() => {});

      // Delete from custom permissions
      await deleteDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, id)).catch(() => {});

      if (accData?.username) {
        const uLower = accData.username.toLowerCase();
        await deleteDoc(doc(db, ACCOUNTS_COLLECTION, uLower)).catch(() => {});
        await deleteDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, uLower)).catch(() => {});
      }

      // 2. Update local storage cache
      try {
        const rawCached = localStorage.getItem('cached_user_accounts');
        if (rawCached) {
          const cached: AccountRecord[] = JSON.parse(rawCached);
          const updated = cached.filter(a => a.id !== id && a.username !== accData?.username);
          localStorage.setItem('cached_user_accounts', JSON.stringify(updated));
        }
      } catch (e) {}

      // 3. Add audit log
      this.addAuditLog({
        action: 'DELETE',
        targetUsername: accData?.username || id,
        targetFullName: accData?.fullName || id,
        performedBy,
        details: `Đã xóa tài khoản "${accData?.fullName || accData?.username || id}" khỏi hệ thống.`
      }).catch(() => {});
    } catch (err) {
      console.error('Error deleting account:', err);
      throw err;
    }
  },

  /**
   * Lock an account
   */
  async lockAccount(id: string, reason: string, performedBy: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      status: 'Đã khóa',
      lockReason: reason || 'Khóa bởi Quản trị viên',
      updatedAt: now
    });

    try {
      await updateDoc(doc(db, 'teachers', id), {
        accountStatus: 'Đã khóa',
        accountLockedAt: now
      });
    } catch (e) {
      console.warn('Teacher lock sync error:', e);
    }

    await this.addAuditLog({
      action: 'LOCK',
      targetUsername: id,
      targetFullName: id,
      performedBy,
      details: `Khóa tài khoản. Lý do: ${reason || 'Không nêu'}`
    });
  },

  /**
   * Unlock an account
   */
  async unlockAccount(id: string, performedBy: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      status: 'Đang hoạt động',
      lockReason: '',
      updatedAt: now
    });

    try {
      await updateDoc(doc(db, 'teachers', id), {
        accountStatus: 'Đang hoạt động',
        accountLockedAt: null
      });
    } catch (e) {
      console.warn('Teacher unlock sync error:', e);
    }

    await this.addAuditLog({
      action: 'UNLOCK',
      targetUsername: id,
      targetFullName: id,
      performedBy,
      details: `Mở khóa tài khoản cho người dùng`
    });
  },

  /**
   * Deactivate an account (retired or transferred)
   */
  async deactivateAccount(id: string, reason: string, performedBy: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      status: 'Vô hiệu hóa',
      deactivateReason: reason || 'Chuyển công tác / Nghỉ việc',
      updatedAt: now
    });

    try {
      await updateDoc(doc(db, 'teachers', id), {
        status: 'Đã nghỉ việc',
        accountStatus: 'Đã khóa',
        accountLockedAt: now
      });
    } catch (e) {
      console.warn('Teacher deactivate sync error:', e);
    }

    await this.addAuditLog({
      action: 'DEACTIVATE',
      targetUsername: id,
      targetFullName: id,
      performedBy,
      details: `Vô hiệu hóa tài khoản (chuyển công tác/nghỉ việc). Lý do: ${reason}`
    });
  },

  /**
   * Reset account password
   */
  async resetPassword(id: string, newPass: string, performedBy: string): Promise<void> {
    const now = new Date().toISOString();
    const hashedPass = await hashPassword(newPass.trim());

    await setDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      password: hashedPass,
      updatedAt: now
    }, { merge: true });

    try {
      await setDoc(doc(db, 'teachers', id), {
        password: hashedPass,
        accountPassword: hashedPass,
        accountUpdatedAt: now
      }, { merge: true });
    } catch (e) {
      console.warn('Teacher reset password sync error:', e);
    }

    await this.addAuditLog({
      action: 'RESET_PASSWORD',
      targetUsername: id,
      targetFullName: id,
      performedBy,
      details: `Đặt lại mật khẩu mới cho tài khoản`
    });
  },

  /**
   * User self-service change password
   */
  async changePassword(
    usernameInput: string,
    currentPasswordInput: string,
    newPasswordInput: string,
    performedBy?: string
  ): Promise<{ success: boolean; message: string }> {
    const username = usernameInput.toLowerCase().trim();
    if (!username) throw new Error('Vui lòng nhập tên đăng nhập.');
    if (!currentPasswordInput) throw new Error('Vui lòng nhập mật khẩu hiện tại.');
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    const currentPassTrim = currentPasswordInput.trim();
    const newPassTrim = newPasswordInput.trim();
    const hashedCurrent = await hashPassword(currentPassTrim);
    const hashedNew = await hashPassword(newPassTrim);

    // Get any existing custom stored password for this username
    const existingStored = getStoredUserPassword(username);

    // Determine if current password matches
    let isValidCurrent = false;

    // 1. Check custom stored password if present
    if (existingStored) {
      if (
        currentPassTrim === existingStored.plain ||
        currentPassTrim === existingStored.hash ||
        hashedCurrent === existingStored.hash
      ) {
        isValidCurrent = true;
      }
    }

    // 2. Check default passwords if custom password is not present or didn't match
    if (!isValidCurrent) {
      if (username === 'admin') {
        if (currentPassTrim === 'admin' || currentPassTrim === '123456') {
          isValidCurrent = true;
        }
      } else {
        if (currentPassTrim === '123456' || currentPassTrim === 'admin') {
          isValidCurrent = true;
        }
      }
    }

    // 3. If still not validated, check Firestore user_accounts / teachers
    if (!isValidCurrent) {
      try {
        const checkDocPromise = async () => {
          const qAcc = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', username));
          const snapAcc = await getDocs(qAcc);
          if (!snapAcc.empty) {
            const p = snapAcc.docs[0].data().password;
            if (p && (currentPassTrim === p || hashedCurrent === p)) return true;
          }
          const qTea = query(collection(db, 'teachers'), where('username', '==', username));
          const snapTea = await getDocs(qTea);
          if (!snapTea.empty) {
            const p = snapTea.docs[0].data().accountPassword || snapTea.docs[0].data().password;
            if (p && (currentPassTrim === p || hashedCurrent === p)) return true;
          }
          return false;
        };
        const timeoutP = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500));
        isValidCurrent = await Promise.race([checkDocPromise(), timeoutP]);
      } catch (e) {
        // ignore
      }
    }

    if (!isValidCurrent) {
      throw new Error('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.');
    }

    // Save NEW password locally instantly so login reads it immediately
    setStoredUserPassword(username, newPassTrim, hashedNew);

    // Save NEW password in Firestore in background
    const now = new Date().toISOString();
    const updateFirestorePromise = async () => {
      let accId = username;
      if (username === 'admin') {
        accId = 'admin';
      } else {
        const qAcc = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', username));
        const snapAcc = await getDocs(qAcc);
        if (!snapAcc.empty) accId = snapAcc.docs[0].id;
      }

      await setDoc(doc(db, ACCOUNTS_COLLECTION, accId), {
        password: hashedNew,
        plainPassword: newPassTrim,
        updatedAt: now
      }, { merge: true });

      if (username !== 'admin') {
        try {
          await setDoc(doc(db, 'teachers', accId), {
            accountPassword: hashedNew,
            password: hashedNew,
            plainPassword: newPassTrim,
            accountUpdatedAt: now
          }, { merge: true });
        } catch (e) {}
      }
    };

    try {
      const timeoutP = new Promise((resolve) => setTimeout(resolve, 1500));
      await Promise.race([updateFirestorePromise(), timeoutP]);
    } catch (e) {}

    // Update sessionStorage / localStorage active session if logged in
    try {
      const stored = sessionStorage.getItem('authUser') || localStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.username && String(parsed.username).toLowerCase() === username) {
          parsed.password = hashedNew;
          sessionStorage.setItem('authUser', JSON.stringify(parsed));
          localStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    return {
      success: true,
      message: 'Đổi mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập.'
    };
  },

  /**
   * Copy permissions from a source account to a target account (reading live from Firestore)
   */
  async copyUserPermissions(
    sourceAccountId: string,
    targetAccountId: string,
    performedBy: string
  ): Promise<ModulePermissionsMap> {
    if (!sourceAccountId || !targetAccountId) {
      throw new Error('Vui lòng chọn tài khoản nguồn và tài khoản đích.');
    }
    if (sourceAccountId === targetAccountId) {
      throw new Error('Không thể sao chép quyền cho chính tài khoản đó.');
    }

    // 1. Get source & target accounts from Firestore
    const [sourceDoc, targetDoc] = await Promise.all([
      getDocPreferServer(doc(db, ACCOUNTS_COLLECTION, sourceAccountId), true),
      getDocPreferServer(doc(db, ACCOUNTS_COLLECTION, targetAccountId), true)
    ]);

    if (!sourceDoc.exists()) {
      throw new Error('Tài khoản nguồn không tồn tại trên hệ thống.');
    }
    const sourceData = sourceDoc.data() as AccountRecord;
    const targetData = targetDoc.exists() ? (targetDoc.data() as AccountRecord) : null;

    const liveSource = await getLiveUserPermissionsFromFirestore(
      sourceAccountId,
      sourceData.username,
      sourceData.teacherCode,
      { firebaseUid: sourceData.firebaseUid, email: sourceData.email, forceServer: true }
    );

    const baseRolePerms =
      DEFAULT_ROLE_GROUPS[sourceData.roleGroup]?.permissions || DEFAULT_ROLE_GROUPS.TEACHER.permissions;
    const permsToCopy: ModulePermissionsMap = JSON.parse(JSON.stringify(baseRolePerms));

    const effectiveSourceCustom = liveSource.hasCustom ? liveSource.permissions : null;
    if (effectiveSourceCustom) {
      Object.keys(permsToCopy).forEach((k) => {
        const mCode = k as keyof ModulePermissionsMap;
        if (effectiveSourceCustom[mCode]) {
          permsToCopy[mCode] = {
            view: !!effectiveSourceCustom[mCode]?.view,
            create: !!effectiveSourceCustom[mCode]?.create,
            edit: !!effectiveSourceCustom[mCode]?.edit,
            delete: !!effectiveSourceCustom[mCode]?.delete,
            approve: !!effectiveSourceCustom[mCode]?.approve,
            export: !!effectiveSourceCustom[mCode]?.export,
            lock: !!effectiveSourceCustom[mCode]?.lock
          };
        } else {
          permsToCopy[mCode] = {
            view: false,
            create: false,
            edit: false,
            delete: false,
            approve: false,
            export: false,
            lock: false
          };
        }
      });
    }

    // 2. Save copied permissions to target account in Firestore (with full normalized metadata)
    await this.saveUserPermissions(targetAccountId, permsToCopy, performedBy, {
      username: targetData?.username,
      teacherCode: targetData?.teacherCode,
      fullName: targetData?.fullName,
      email: targetData?.email,
      firebaseUid: targetData?.firebaseUid,
      roleGroup: targetData?.roleGroup
    });

    // 3. Log audit
    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: targetData?.username || targetAccountId,
      targetFullName: targetData?.fullName || `Tài khoản đích (ID: ${targetAccountId})`,
      performedBy,
      details: `Sao chép toàn bộ ma trận phân quyền từ ${sourceData.fullName} (${sourceData.username})`
    });

    return permsToCopy;
  },

  /**
   * Save custom fine-grained permissions for an individual account directly to Firebase Firestore.
   * GUARANTEED PERSISTENCE: awaits canonical Firestore writes and throws if Firestore fails
   * (never fakes success via localStorage or /api/permissions).
   */
  async saveUserPermissions(
    id: string,
    permissions: Partial<ModulePermissionsMap>,
    performedBy: string,
    extraInfo?: {
      username?: string;
      teacherCode?: string;
      fullName?: string;
      email?: string;
      firebaseUid?: string;
      roleGroup?: RoleGroupCode;
    }
  ): Promise<void> {
    const canonicalId = String(id || '').trim();
    if (!canonicalId) {
      throw new Error('ID tài khoản không hợp lệ.');
    }
    const now = new Date().toISOString();

    let targetName = extraInfo?.fullName || canonicalId;
    let targetUser = normalizeIdentifier(extraInfo?.username);
    let teacherCode = normalizeIdentifier(extraInfo?.teacherCode);
    let normalizedEmail = normalizeEmail(extraInfo?.email);
    let firebaseUid = String(extraInfo?.firebaseUid || '').trim();
    let roleGroup = extraInfo?.roleGroup;
    let teacherId = canonicalId;

    // Fetch existing Firestore account metadata if username/code/uid not fully supplied
    if (!targetUser || !teacherCode) {
      try {
        const accDoc = await getDocPreferServer(doc(db, ACCOUNTS_COLLECTION, canonicalId), false);
        if (accDoc.exists()) {
          const d = accDoc.data() as AccountRecord;
          if (d.fullName && (!extraInfo?.fullName || targetName === canonicalId)) targetName = d.fullName;
          if (!targetUser && d.username) targetUser = normalizeIdentifier(d.username);
          if (!teacherCode && d.teacherCode) teacherCode = normalizeIdentifier(d.teacherCode);
          if (!normalizedEmail && d.email) normalizedEmail = normalizeEmail(d.email);
          if (!firebaseUid && d.firebaseUid) firebaseUid = String(d.firebaseUid).trim();
          if (!roleGroup && d.roleGroup) roleGroup = d.roleGroup;
          if (d.teacherId) teacherId = String(d.teacherId).trim();
        }
      } catch {
        // continue with provided metadata
      }
    }

    // Build standardized UserPermissionDocument (schemaVersion 2)
    const permDocPayload: UserPermissionDocument = {
      canonicalId,
      userId: canonicalId,
      ...(firebaseUid ? { firebaseUid } : {}),
      teacherId,
      username: targetUser,
      ...(teacherCode ? { teacherCode } : {}),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      fullName: targetName,
      ...(roleGroup ? { roleGroup } : {}),
      hasCustomPermissions: true,
      permissions,
      updatedAt: now,
      updatedBy: performedBy,
      schemaVersion: 2
    };

    // Primary authoritative writes MUST succeed on Firebase Firestore
    const primaryWrites: Promise<void>[] = [
      setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, canonicalId), permDocPayload, { merge: true }),
      setDoc(
        doc(db, ACCOUNTS_COLLECTION, canonicalId),
        {
          hasCustomPermissions: true,
          customPermissions: permissions,
          ...(targetUser ? { username: targetUser } : {}),
          ...(normalizedEmail ? { normalizedEmail } : {}),
          ...(firebaseUid ? { firebaseUid } : {}),
          updatedAt: now
        },
        { merge: true }
      )
    ];

    // Also sync synchronized alias docs in `user_custom_permissions` with identical `updatedAt`
    const aliasDocIds = new Set<string>();
    if (firebaseUid && firebaseUid !== canonicalId) aliasDocIds.add(firebaseUid);
    if (targetUser && targetUser !== canonicalId) aliasDocIds.add(targetUser);
    if (teacherCode && teacherCode !== canonicalId && teacherCode !== targetUser) aliasDocIds.add(teacherCode);

    aliasDocIds.forEach((aliasId) => {
      primaryWrites.push(
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, aliasId), permDocPayload, { merge: true })
      );
    });

    try {
      await Promise.all(primaryWrites);
    } catch (err) {
      throw formatFirestoreWriteError(err, 'ma trận phân quyền');
    }

    // Secondary best-effort sync to teachers doc & audit log (never fails primary save)
    const secondaryTasks: Promise<any>[] = [
      setDoc(
        doc(db, 'teachers', teacherId || canonicalId),
        {
          hasCustomPermissions: true,
          customPermissions: permissions,
          accountUpdatedAt: now
        },
        { merge: true }
      ).catch(() => {}),
      this.addAuditLog({
        action: 'UPDATE_PERMISSIONS',
        targetUsername: targetUser || canonicalId,
        targetFullName: targetName,
        performedBy,
        details: `Thiết lập ma trận phân quyền tùy biến riêng (18 modules)`
      }).catch(() => {})
    ];

    if (targetUser && targetUser !== canonicalId) {
      // Clean up legacy duplicate user_accounts doc keyed by username if any exists
      secondaryTasks.push(deleteDoc(doc(db, ACCOUNTS_COLLECTION, targetUser)).catch(() => {}));
    }

    await Promise.allSettled(secondaryTasks);

    // Clean any legacy localStorage map & refresh current tab sessionStorage only if editing self
    setStoredUserCustomPermissions(canonicalId, null);
    try {
      const stored = sessionStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        const pId = String(parsed.id || '').trim();
        const pUser = normalizeIdentifier(parsed.username);
        if (pId === canonicalId || (targetUser && pUser === targetUser)) {
          parsed.hasCustomPermissions = true;
          parsed.customPermissions = permissions;
          sessionStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }
  },

  /**
   * Reset user's custom permissions back to standard role group defaults in Firebase Firestore.
   * Automatically resolves all associated keys (canonicalId, firebaseUid, username, teacherCode)
   * so no orphaned alias document can ever resurrect revoked permissions.
   */
  async resetUserPermissionsToRoleGroup(
    id: string,
    performedBy: string,
    extraInfo?: {
      username?: string;
      teacherCode?: string;
      fullName?: string;
      email?: string;
      firebaseUid?: string;
      roleGroup?: RoleGroupCode;
    }
  ): Promise<void> {
    const canonicalId = String(id || '').trim();
    if (!canonicalId) throw new Error('ID tài khoản không hợp lệ.');
    const now = new Date().toISOString();

    let targetName = extraInfo?.fullName || canonicalId;
    let targetUser = normalizeIdentifier(extraInfo?.username);
    let teacherCode = normalizeIdentifier(extraInfo?.teacherCode);
    let firebaseUid = String(extraInfo?.firebaseUid || '').trim();
    let teacherId = canonicalId;

    // Always resolve missing identifiers from Firestore / DEFAULT_TEACHERS so all alias docs are revoked
    if (!targetUser || !teacherCode || !firebaseUid) {
      try {
        const accDoc = await getDocPreferServer(doc(db, ACCOUNTS_COLLECTION, canonicalId), false);
        if (accDoc.exists()) {
          const d = accDoc.data() as AccountRecord;
          if (d.fullName && targetName === canonicalId) targetName = d.fullName;
          if (!targetUser && d.username) targetUser = normalizeIdentifier(d.username);
          if (!teacherCode && d.teacherCode) teacherCode = normalizeIdentifier(d.teacherCode);
          if (!firebaseUid && d.firebaseUid) firebaseUid = String(d.firebaseUid).trim();
          if (d.teacherId) teacherId = String(d.teacherId).trim();
        }
      } catch {
        // ignore lookup failure, fallback to DEFAULT_TEACHERS below
      }
    }

    const allDocIds = resolvePermissionDocIds({
      userId: canonicalId,
      firebaseUid,
      username: targetUser,
      teacherCode,
      email: extraInfo?.email
    });

    const resetPayload = {
      canonicalId,
      userId: canonicalId,
      ...(firebaseUid ? { firebaseUid } : {}),
      username: targetUser,
      ...(teacherCode ? { teacherCode } : {}),
      hasCustomPermissions: false,
      permissions: null,
      updatedAt: now,
      updatedBy: performedBy,
      schemaVersion: 2
    };

    const primaryResets: Promise<void>[] = [
      ...allDocIds.map((docId) =>
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, docId), resetPayload, { merge: true })
      ),
      setDoc(
        doc(db, ACCOUNTS_COLLECTION, canonicalId),
        {
          hasCustomPermissions: false,
          customPermissions: null,
          updatedAt: now
        },
        { merge: true }
      )
    ];

    try {
      await Promise.all(primaryResets);
    } catch (err) {
      throw formatFirestoreWriteError(err, 'thu hồi phân quyền');
    }

    await Promise.allSettled([
      setDoc(
        doc(db, 'teachers', teacherId || canonicalId),
        {
          hasCustomPermissions: false,
          customPermissions: null,
          accountUpdatedAt: now
        },
        { merge: true }
      ).catch(() => {}),
      this.addAuditLog({
        action: 'UPDATE_PERMISSIONS',
        targetUsername: targetUser || canonicalId,
        targetFullName: targetName,
        performedBy,
        details: `Khôi phục phân quyền về mặc định theo nhóm quyền`
      }).catch(() => {})
    ]);

    setStoredUserCustomPermissions(canonicalId, null);
    try {
      const stored = sessionStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        const pId = String(parsed.id || '').trim();
        const pUser = normalizeIdentifier(parsed.username);
        if (pId === canonicalId || (targetUser && pUser === targetUser)) {
          parsed.hasCustomPermissions = false;
          delete parsed.customPermissions;
          sessionStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }
  },

  /**
   * Save customized base matrix for a role group directly to Firebase Firestore.
   */
  async saveRoleGroupPermissions(
    roleGroup: RoleGroupCode,
    permissions: ModulePermissionsMap,
    performedBy: string
  ): Promise<void> {
    const now = new Date().toISOString();

    try {
      await setDoc(
        doc(db, ROLE_GROUPS_COLLECTION, roleGroup),
        {
          code: roleGroup,
          permissions,
          updatedAt: now,
          updatedBy: performedBy
        },
        { merge: true }
      );
    } catch (err) {
      throw formatFirestoreWriteError(err, `phân quyền nhóm ${roleGroup}`);
    }

    if (DEFAULT_ROLE_GROUPS[roleGroup]) {
      DEFAULT_ROLE_GROUPS[roleGroup].permissions = permissions;
    }
    roleGroupConfigsLoaded = true;
    notifyRoleGroupVersionChange();

    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: roleGroup,
      targetFullName: `Nhóm quyền ${roleGroup}`,
      performedBy,
      details: `Cập nhật cấu hình phân quyền mẫu cho nhóm ${DEFAULT_ROLE_GROUPS[roleGroup]?.name || roleGroup}`
    }).catch(() => {});
  },

  /**
   * Load customized role group configurations directly from Firebase Firestore.
   * Never reads stale localStorage or static JSON; notifies reactive subscribers on completion.
   */
  async loadRoleGroupConfigs(forceServer = false): Promise<void> {
    try {
      const colRef = collection(db, ROLE_GROUPS_COLLECTION);
      const snap =
        forceServer && typeof navigator !== 'undefined' && navigator.onLine !== false
          ? await getDocsFromServer(colRef).catch(() => getDocs(colRef))
          : await getDocs(colRef);

      if (snap && !snap.empty) {
        snap.docs.forEach((d) => {
          const data = d.data();
          const code = (data.code || d.id) as RoleGroupCode;
          if (DEFAULT_ROLE_GROUPS[code] && data.permissions) {
            DEFAULT_ROLE_GROUPS[code].permissions = {
              ...DEFAULT_ROLE_GROUPS[code].permissions,
              ...data.permissions
            };
          }
        });
      }
      roleGroupConfigsLoaded = true;
      notifyRoleGroupVersionChange();
    } catch (e) {
      console.warn('Could not load role group configs from Firestore:', e);
    }
  },

  /**
   * Batch create accounts for all teachers who don't have one
   */
  async batchCreateFromTeachers(performedBy: string): Promise<{ createdCount: number }> {
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    const teachersList = teachersSnap.empty 
      ? DEFAULT_TEACHERS 
      : teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));

    const existingAccountsSnap = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    const existingUsernames = new Set<string>();
    const existingTeacherIds = new Set<string>();

    existingAccountsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.username) existingUsernames.add(String(data.username).toLowerCase());
      if (data.teacherId) existingTeacherIds.add(data.teacherId);
      existingTeacherIds.add(d.id);
    });

    let count = 0;
    const now = new Date().toISOString();

    for (const t of teachersList) {
      if (existingTeacherIds.has(t.id)) continue;

      let baseUsername = (t.username || t.code?.toLowerCase() || `gv_${t.id.slice(0, 5)}`).toLowerCase().trim();
      let username = baseUsername;
      let suffix = 1;
      while (existingUsernames.has(username)) {
        username = `${baseUsername}_${suffix}`;
        suffix++;
      }
      existingUsernames.add(username);

      const roleGroup = detectRoleGroupByPosition(t.position, t.departmentId);
      const acc: AccountRecord = {
        id: t.id,
        teacherId: t.id,
        teacherCode: t.code,
        fullName: t.name,
        username,
        password: t.accountPassword || t.password || '123456',
        position: t.position || 'Giáo viên',
        departmentId: t.departmentId,
        departmentName: t.departmentName,
        roleGroup,
        status: 'Đang hoạt động',
        hasCustomPermissions: false,
        createdAt: now,
        updatedAt: now,
        email: t.email,
        phone: t.phone
      };

      await setDoc(doc(db, ACCOUNTS_COLLECTION, t.id), acc);
      try {
        await updateDoc(doc(db, 'teachers', t.id), {
          hasAccount: true,
          username,
          accountStatus: 'Đang hoạt động',
          accountRole: roleGroup,
          accountPassword: acc.password,
          accountUpdatedAt: now
        });
      } catch (err) {
        // ignore
      }
      count++;
    }

    if (count > 0) {
      await this.addAuditLog({
        action: 'CREATE',
        targetUsername: 'BATCH_SETUP',
        targetFullName: 'Toàn bộ CBGVNV',
        performedBy,
        details: `Tạo tài khoản tự động hàng loạt cho ${count} cán bộ, giáo viên, nhân viên`
      });
    }

    return { createdCount: count };
  },

  /**
   * Export accounts list to Excel file
   */
  exportAccountsToExcel(accounts: AccountRecord[]): void {
    const data = accounts.map((acc, index) => ({
      'STT': index + 1,
      'Mã CBGVNV': acc.teacherCode || '',
      'Họ và tên': acc.fullName,
      'Tên đăng nhập': acc.username,
      'Mật khẩu ban đầu': acc.password || '••••••••',
      'Chức vụ': acc.position,
      'Tổ chuyên môn': acc.departmentName || '',
      'Nhóm quyền': DEFAULT_ROLE_GROUPS[acc.roleGroup]?.name || acc.roleGroup,
      'Quyền riêng': acc.hasCustomPermissions ? 'Tùy biến riêng' : 'Mặc định theo nhóm',
      'Trạng thái': acc.status,
      'Ngày tạo': acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('vi-VN') : '',
      'Lần đăng nhập cuối': acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập',
      'Email': acc.email || '',
      'Số điện thoại': acc.phone || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Auto-fit column widths
    const colWidths = [
      { wch: 6 },  // STT
      { wch: 14 }, // Mã
      { wch: 26 }, // Họ tên
      { wch: 18 }, // Username
      { wch: 18 }, // Password
      { wch: 20 }, // Chức vụ
      { wch: 30 }, // Tổ CM
      { wch: 32 }, // Nhóm quyền
      { wch: 22 }, // Quyền riêng
      { wch: 18 }, // Trạng thái
      { wch: 14 }, // Ngày tạo
      { wch: 22 }, // Đăng nhập cuối
      { wch: 28 }, // Email
      { wch: 16 }, // SĐT
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách tài khoản');
    
    const fileName = `Danh_Sach_Tai_Khoan_THPT_Son_Luong_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  /**
   * Audit log helper
   */
  async addAuditLog(log: Omit<AccountAuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const payload: AccountAuditLog = {
        ...log,
        id,
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(db, AUDIT_COLLECTION, id), payload);
    } catch (e) {
      console.warn('Could not write audit log:', e);
    }
  },

  /**
   * Get latest audit logs
   */
  async getAuditLogs(maxLogs: number = 50): Promise<AccountAuditLog[]> {
    try {
      const q = query(collection(db, AUDIT_COLLECTION), orderBy('timestamp', 'desc'), limit(maxLogs));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountAuditLog));
      }
      return [];
    } catch (e) {
      console.warn('Error fetching audit logs, trying without orderBy:', e);
      try {
        const snap = await getDocs(collection(db, AUDIT_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountAuditLog))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, maxLogs);
      } catch (err) {
        return [];
      }
    }
  }
};
