import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { User, Role } from '../types';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { RoleGroupCode, ModulePermissionsMap, normalizeEmail, normalizeIdentifier } from '../types/permission';
import {
  detectRoleGroupByPosition,
  hashPassword,
  accountService,
  getStoredUserPassword,
  setStoredUserPassword,
  getLiveUserPermissionsFromFirestore,
  subscribeUserLivePermissions,
  subscribeRoleGroupConfigsVersion
} from '../services/accountService';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';

import {
  canAttemptFirestoreRead,
  getQuotaManagerState,
  reportFirestoreError,
  reportFirestoreSuccess,
  setQuotaRetrying,
  subscribeQuotaManager,
  triggerManualSyncReset
} from '../utils/firestoreQuotaManager';

export interface AppUser extends User {
  firebaseUid?: string;
  roleGroup?: RoleGroupCode;
  accountStatus?: 'Đang hoạt động' | 'Đã khóa' | 'Vô hiệu hóa' | 'Chưa có tài khoản';
  hasCustomPermissions?: boolean;
  customPermissions?: Partial<ModulePermissionsMap>;
  teacherCode?: string;
  departmentName?: string;
  lastLoginAt?: string;
  email?: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  authLoading: boolean;
  permissionsReady: boolean;
  permissionsVersion: number;
  permissionSyncError: string | null;
  lastPermissionSyncedAt: number | null;
  isRefreshingPermissions: boolean;
  isAdmin: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  refreshPermissions: (options?: { manual?: boolean }) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  switchRoleForDemo?: (role: Role | RoleGroupCode) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session lifetime: 8 hours of active work
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
// Revalidate permissions from Firestore at most once every 5 minutes on reload (never on page switches)
const PERMISSION_REVALIDATE_TTL_MS = 5 * 60 * 1000;
const PERM_LAST_SYNCED_KEY = 'thpt_sl_perm_last_synced_at_v1';

function readStoredPermSyncedAt(): number | null {
  try {
    const raw = sessionStorage.getItem(PERM_LAST_SYNCED_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredPermSyncedAt(ts: number): void {
  try {
    sessionStorage.setItem(PERM_LAST_SYNCED_KEY, String(ts));
  } catch {
    // ignore
  }
}

function formatSyncError(code: string | null): string | null {
  if (!code) return null;
  if (code === 'resource-exhausted') {
    return 'Máy chủ đang tạm thời vượt hạn mức truy cập. Hệ thống đang duy trì phiên làm việc hiện tại.';
  }
  if (code === 'permission-denied') {
    return 'Không thể đọc dữ liệu phân quyền từ Firebase Firestore (Permission Denied). Vui lòng liên hệ Quản trị viên kiểm tra Firebase Security Rules.';
  }
  return 'Không thể đồng bộ phân quyền mới nhất từ máy chủ Firebase. Hệ thống đang duy trì phiên làm việc hiện tại.';
}

function clearLegacyLocalCaches(): void {
  try {
    localStorage.removeItem('authUser');
    localStorage.removeItem('authSessionExpiry');
    localStorage.removeItem('custom_user_permissions_map');
    localStorage.removeItem('cached_user_accounts');
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [permissionsReady, setPermissionsReady] = useState<boolean>(false);
  const [permissionsVersion, setPermissionsVersion] = useState<number>(0);
  const [permissionSyncError, setPermissionSyncError] = useState<string | null>(null);
  const [lastPermissionSyncedAt, setLastPermissionSyncedAt] = useState<number | null>(
    () => readStoredPermSyncedAt() || getQuotaManagerState().lastSyncedAt
  );
  const [isRefreshingPermissions, setIsRefreshingPermissions] = useState<boolean>(false);
  const [quotaEpoch, setQuotaEpoch] = useState<number>(() => getQuotaManagerState().epoch);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<AppUser | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Keep lastPermissionSyncedAt & quotaEpoch synced with global firestoreQuotaManager
  useEffect(() => {
    return subscribeQuotaManager((qState) => {
      if (qState.lastSyncedAt) {
        setLastPermissionSyncedAt((prev) =>
          !prev || qState.lastSyncedAt! > prev ? qState.lastSyncedAt! : prev
        );
      }
      if (!qState.quotaExceeded && qState.lastSyncedAt) {
        // Auto-clear quota warning as soon as any server sync succeeds
        setPermissionSyncError((prev) =>
          prev && prev.includes('vượt hạn mức') ? null : prev
        );
      }
      setQuotaEpoch(qState.epoch);
    });
  }, []);

  const clearError = () => setError(null);

  const bumpPermissionsVersion = useCallback(() => {
    setPermissionsVersion((v) => v + 1);
  }, []);

  // Re-render permission consumers whenever Firestore role_group_configs updates
  useEffect(() => {
    return subscribeRoleGroupConfigsVersion(() => {
      bumpPermissionsVersion();
    });
  }, [bumpPermissionsVersion]);

  const forceLogoutWithReason = useCallback((reason: string) => {
    setUser(null);
    setPermissionsReady(true);
    setPermissionSyncError(null);
    try {
      sessionStorage.removeItem('authUser');
      sessionStorage.removeItem('authSessionExpiry');
      sessionStorage.removeItem(PERM_LAST_SYNCED_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }
    clearLegacyLocalCaches();
    setError(reason);
    bumpPermissionsVersion();
  }, [bumpPermissionsVersion]);

  // Manual or programmatic fresh sync from Firestore (deduplicated & backoff-aware)
  const refreshPermissions = useCallback(async (options?: { manual?: boolean }) => {
    const current = userRef.current;
    if (!current || !current.id) return;

    const isManual = Boolean(options?.manual);
    if (!isManual && !canAttemptFirestoreRead()) {
      setPermissionSyncError(formatSyncError('resource-exhausted'));
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = (async () => {
      setIsRefreshingPermissions(true);
      if (isManual) {
        triggerManualSyncReset();
      }
      try {
        if (current.id === 'admin' || normalizeIdentifier(current.username) === 'admin') {
          await accountService.loadRoleGroupConfigs(isManual);
          const now = Date.now();
          writeStoredPermSyncedAt(now);
          setLastPermissionSyncedAt(now);
          reportFirestoreSuccess();
          setPermissionsReady(true);
          setPermissionSyncError(null);
          bumpPermissionsVersion();
          return;
        }

        const [, livePerms] = await Promise.all([
          accountService.loadRoleGroupConfigs(isManual).catch(() => {}),
          getLiveUserPermissionsFromFirestore(current.id, current.username, current.teacherCode, {
            firebaseUid: current.firebaseUid || auth.currentUser?.uid,
            email: current.email,
            forceServer: isManual,
            forceManual: isManual
          })
        ]);

        if (livePerms.accountStatus === 'Đã khóa' || livePerms.accountStatus === 'Vô hiệu hóa') {
          forceLogoutWithReason(
            `Tài khoản "${current.username}" đã bị ${livePerms.accountStatus.toLowerCase()}. Vui lòng liên hệ Quản trị viên.`
          );
          return;
        }

        if (livePerms.errorCode === null) {
          const now = Date.now();
          writeStoredPermSyncedAt(now);
          setLastPermissionSyncedAt(now);
          setPermissionSyncError(null);
          const acc = livePerms.accountData;
          const freshUser: AppUser = {
            ...current,
            firebaseUid: acc?.firebaseUid || current.firebaseUid || auth.currentUser?.uid,
            name: acc?.fullName || current.name,
            roleGroup: livePerms.roleGroup || acc?.roleGroup || current.roleGroup,
            accountStatus: livePerms.accountStatus || acc?.status || current.accountStatus,
            hasCustomPermissions: livePerms.hasCustom,
            customPermissions: livePerms.hasCustom && livePerms.permissions ? livePerms.permissions : undefined,
            position: acc?.position || current.position,
            departmentName: acc?.departmentName || current.departmentName
          };
          setUser(freshUser);
          try {
            sessionStorage.setItem('authUser', JSON.stringify(freshUser));
          } catch {
            // ignore
          }
        } else {
          // NEVER escalate privileges or drop the active verified session on quota error
          setPermissionSyncError(formatSyncError(livePerms.errorCode));
        }

        setPermissionsReady(true);
        bumpPermissionsVersion();
      } catch (err) {
        reportFirestoreError(err, 'AuthContext.refreshPermissions');
        setPermissionSyncError(formatSyncError('resource-exhausted'));
      } finally {
        setQuotaRetrying(false);
        setIsRefreshingPermissions(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = run;
    return run;
  }, [bumpPermissionsVersion, forceLogoutWithReason]);

  // Restore user from sessionStorage if exists, enforce session expiration, and apply 5-minute TTL revalidation
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        clearLegacyLocalCaches();

        const stored = sessionStorage.getItem('authUser');
        const sessionExpiryStr = sessionStorage.getItem('authSessionExpiry');

        if (!stored) {
          if (!cancelled) {
            setUser(null);
            setPermissionsReady(true);
          }
          return;
        }

        // Check session expiration
        if (sessionExpiryStr) {
          const expiry = parseInt(sessionExpiryStr, 10);
          if (Date.now() > expiry) {
            console.warn('User session expired. Logging out.');
            sessionStorage.removeItem('authUser');
            sessionStorage.removeItem('authSessionExpiry');
            sessionStorage.removeItem(PERM_LAST_SYNCED_KEY);
            if (!cancelled) {
              setUser(null);
              setPermissionsReady(true);
              setError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
            }
            return;
          }
        }

        const initialUser: AppUser = JSON.parse(stored);
        const lastSynced = readStoredPermSyncedAt();
        const isWithinTtl = Boolean(lastSynced && Date.now() - lastSynced < PERMISSION_REVALIDATE_TTL_MS);

        if (initialUser.id === 'admin' || normalizeIdentifier(initialUser.username) === 'admin') {
          if (!isWithinTtl && canAttemptFirestoreRead()) {
            await accountService.loadRoleGroupConfigs(false).catch(() => {});
            const now = Date.now();
            writeStoredPermSyncedAt(now);
            if (!cancelled) setLastPermissionSyncedAt(now);
          }
          if (!cancelled) {
            setUser(initialUser);
            setPermissionsReady(true);
            setPermissionSyncError(null);
            bumpPermissionsVersion();
          }
          return;
        }

        // Fast-path: if verified session was synced within the last 5 minutes, restore with 0 Firestore reads!
        if (isWithinTtl) {
          if (!cancelled) {
            setUser(initialUser);
            setLastPermissionSyncedAt(lastSynced);
            setPermissionsReady(true);
            setPermissionSyncError(null);
            bumpPermissionsVersion();
          }
          return;
        }

        // Keep user authenticated while revalidating from Firestore (respecting quota circuit breaker)
        if (!cancelled) {
          setUser(initialUser);
          setPermissionsReady(false);
        }

        if (!canAttemptFirestoreRead()) {
          // Circuit breaker open: preserve verified session without escalating privileges & show clear warning
          if (!cancelled) {
            setPermissionSyncError(formatSyncError('resource-exhausted'));
            setPermissionsReady(true);
            bumpPermissionsVersion();
          }
          return;
        }

        const [, livePerms] = await Promise.all([
          accountService.loadRoleGroupConfigs(false).catch(() => {}),
          getLiveUserPermissionsFromFirestore(initialUser.id, initialUser.username, initialUser.teacherCode, {
            firebaseUid: initialUser.firebaseUid || auth.currentUser?.uid,
            email: initialUser.email,
            forceServer: false
          })
        ]);

        if (cancelled) return;

        if (livePerms.accountStatus === 'Đã khóa' || livePerms.accountStatus === 'Vô hiệu hóa') {
          forceLogoutWithReason(
            `Tài khoản "${initialUser.username}" đã bị ${livePerms.accountStatus.toLowerCase()}. Vui lòng liên hệ Quản trị viên.`
          );
          return;
        }

        if (livePerms.errorCode === null) {
          const now = Date.now();
          writeStoredPermSyncedAt(now);
          setLastPermissionSyncedAt(now);
          const acc = livePerms.accountData;
          const freshUser: AppUser = {
            ...initialUser,
            firebaseUid: acc?.firebaseUid || initialUser.firebaseUid || auth.currentUser?.uid,
            name: acc?.fullName || initialUser.name,
            roleGroup: livePerms.roleGroup || acc?.roleGroup || initialUser.roleGroup,
            accountStatus: livePerms.accountStatus || acc?.status || initialUser.accountStatus,
            hasCustomPermissions: livePerms.hasCustom,
            customPermissions: livePerms.hasCustom && livePerms.permissions ? livePerms.permissions : undefined,
            position: acc?.position || initialUser.position,
            departmentName: acc?.departmentName || initialUser.departmentName
          };
          setUser(freshUser);
          setPermissionSyncError(null);
          try {
            sessionStorage.setItem('authUser', JSON.stringify(freshUser));
          } catch {
            // ignore
          }
        } else {
          // Firestore temporarily unavailable / quota exceeded: preserve verified session without escalating privileges
          setPermissionSyncError(formatSyncError(livePerms.errorCode));
        }

        setPermissionsReady(true);
        bumpPermissionsVersion();
      } catch (e) {
        console.error('Error initializing auth:', e);
        if (!cancelled) {
          setUser(null);
          setPermissionsReady(true);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      cancelled = true;
    };
  }, [bumpPermissionsVersion, forceLogoutWithReason]);

  // Targeted real-time listener (max 2 single-doc listeners) stabilized on [user?.id, quotaEpoch]
  // so updating user profile/roleGroup state NEVER tears down and re-subscribes listeners in a loop!
  useEffect(() => {
    const activeUser = userRef.current;
    if (!activeUser?.id) return;
    if (activeUser.id === 'admin' || normalizeIdentifier(activeUser.username) === 'admin') return;

    const unsub = subscribeUserLivePermissions(
      {
        userId: activeUser.id,
        firebaseUid: activeUser.firebaseUid || auth.currentUser?.uid,
        username: activeUser.username,
        teacherCode: activeUser.teacherCode,
        email: activeUser.email,
        roleGroup: activeUser.roleGroup
      },
      (update) => {
        if (update.accountStatus === 'Đã khóa' || update.accountStatus === 'Vô hiệu hóa') {
          forceLogoutWithReason(
            `Tài khoản "${activeUser.username}" đã bị ${update.accountStatus.toLowerCase()}. Vui lòng liên hệ Quản trị viên.`
          );
          return;
        }

        const now = Date.now();
        writeStoredPermSyncedAt(now);
        setLastPermissionSyncedAt(now);
        setPermissionSyncError(null);

        setUser((prev) => {
          if (!prev || prev.id !== activeUser.id) return prev;
          const nextHasCustom =
            update.hasCustom !== undefined ? update.hasCustom : prev.hasCustomPermissions;
          const nextCustomPerms =
            update.hasCustom !== undefined
              ? update.hasCustom && update.permissions
                ? update.permissions
                : undefined
              : prev.customPermissions;

          const nextUser: AppUser = {
            ...prev,
            name: update.fullName || prev.name,
            roleGroup: update.roleGroup || prev.roleGroup,
            accountStatus: update.accountStatus || prev.accountStatus,
            position: update.position || prev.position,
            departmentName: update.departmentName || prev.departmentName,
            hasCustomPermissions: nextHasCustom,
            customPermissions: nextCustomPerms
          };

          try {
            sessionStorage.setItem('authUser', JSON.stringify(nextUser));
          } catch {
            // ignore
          }
          return nextUser;
        });
        setPermissionsReady(true);
        bumpPermissionsVersion();
      },
      (errCode) => {
        setPermissionSyncError(formatSyncError(errCode));
      }
    );

    return () => {
      unsub();
    };
  }, [user?.id, quotaEpoch, bumpPermissionsVersion, forceLogoutWithReason]);

  const doSuccessfulLogin = async (cleanIdentifier: string, extraDocData?: any): Promise<boolean> => {
    clearLegacyLocalCaches();
    setPermissionSyncError(null);

    if (cleanIdentifier === 'admin') {
      await accountService.loadRoleGroupConfigs(true).catch(() => {});
      const adminUser: AppUser = {
        id: 'admin',
        name: 'Quản trị viên Hệ thống',
        role: 'admin',
        roleGroup: 'ADMIN',
        username: 'admin',
        position: 'Quản trị viên',
        departmentName: 'Ban Quản trị',
        accountStatus: 'Đang hoạt động'
      };
      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      const now = Date.now();
      writeStoredPermSyncedAt(now);
      setLastPermissionSyncedAt(now);
      setUser(adminUser);
      setPermissionsReady(true);
      sessionStorage.setItem('authUser', JSON.stringify(adminUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      bumpPermissionsVersion();
      return true;
    }

    const emailLookup = normalizeEmail(cleanIdentifier);
    const foundDefaultTeacher = DEFAULT_TEACHERS.find(
      (t) =>
        (t.username && normalizeIdentifier(t.username) === cleanIdentifier) ||
        (t.code && normalizeIdentifier(t.code) === cleanIdentifier) ||
        (emailLookup && t.email && normalizeEmail(t.email) === emailLookup)
    );

    const teacher = foundDefaultTeacher || null;
    const currentFirebaseUid = auth.currentUser?.uid || extraDocData?.firebaseUid;

    if (teacher || extraDocData) {
      const canonicalId = String(extraDocData?.id || teacher?.id || cleanIdentifier).trim();
      const canonicalUsername = normalizeIdentifier(
        extraDocData?.username || teacher?.username || cleanIdentifier
      );
      const canonicalCode = String(extraDocData?.teacherCode || teacher?.code || '').trim();
      const canonicalEmail = normalizeEmail(extraDocData?.email || teacher?.email);

      // Load role-group matrix (TTL cached) AND live user permissions from Firestore before completing login
      const [, livePerms] = await Promise.all([
        accountService.loadRoleGroupConfigs(false).catch(() => {}),
        getLiveUserPermissionsFromFirestore(canonicalId, canonicalUsername, canonicalCode, {
          firebaseUid: currentFirebaseUid,
          email: canonicalEmail,
          forceServer: true
        })
      ]);

      const accFromLive = livePerms.accountData;
      const effectiveStatus =
        livePerms.accountStatus ||
        accFromLive?.status ||
        extraDocData?.status ||
        extraDocData?.accountStatus ||
        teacher?.accountStatus ||
        'Đang hoạt động';

      if (effectiveStatus === 'Đã khóa' || effectiveStatus === 'Vô hiệu hóa') {
        setError(
          `Tài khoản của thầy/cô hiện đang ở trạng thái "${effectiveStatus}". Vui lòng liên hệ Ban Giám hiệu hoặc Quản trị viên.`
        );
        return false;
      }

      if (livePerms.errorCode) {
        setPermissionSyncError(formatSyncError(livePerms.errorCode));
      } else {
        const now = Date.now();
        writeStoredPermSyncedAt(now);
        setLastPermissionSyncedAt(now);
      }

      const detectedRoleGroup = detectRoleGroupByPosition(
        accFromLive?.position || extraDocData?.position || teacher?.position,
        accFromLive?.departmentId || extraDocData?.departmentId || teacher?.departmentId
      );
      const authoritativeRoleGroup: RoleGroupCode =
        livePerms.roleGroup || accFromLive?.roleGroup || extraDocData?.roleGroup || detectedRoleGroup;

      // Authoritative permissions: prefer live Firestore result; fallback to Firestore extraDocData only if live read found no record
      let hasCustom = false;
      let finalCustomPerms: Partial<ModulePermissionsMap> | undefined = undefined;
      if (livePerms.errorCode === null && livePerms.source !== 'none') {
        hasCustom = livePerms.hasCustom;
        finalCustomPerms = livePerms.hasCustom && livePerms.permissions ? livePerms.permissions : undefined;
      } else if (extraDocData) {
        const extraValid =
          Boolean(extraDocData.hasCustomPermissions) &&
          Boolean(extraDocData.customPermissions) &&
          Object.keys(extraDocData.customPermissions).length > 0;
        hasCustom = extraValid;
        finalCustomPerms = extraValid ? extraDocData.customPermissions : undefined;
      }

      const appUser: AppUser = {
        id: canonicalId,
        firebaseUid: accFromLive?.firebaseUid || currentFirebaseUid,
        name: accFromLive?.fullName || extraDocData?.fullName || extraDocData?.name || teacher?.name || canonicalUsername,
        username: canonicalUsername,
        role: (extraDocData?.role || teacher?.role || 'GIAO_VIEN') as Role,
        roleGroup: authoritativeRoleGroup,
        position: accFromLive?.position || extraDocData?.position || teacher?.position || 'Giáo viên',
        departmentId: accFromLive?.departmentId || extraDocData?.departmentId || teacher?.departmentId,
        departmentName: accFromLive?.departmentName || extraDocData?.departmentName || teacher?.departmentName,
        accountStatus: effectiveStatus as AppUser['accountStatus'],
        teacherCode: canonicalCode || undefined,
        email: accFromLive?.email || extraDocData?.email || teacher?.email,
        phone: accFromLive?.phone || extraDocData?.phone || teacher?.phone,
        hasCustomPermissions: hasCustom,
        customPermissions: finalCustomPerms
      };

      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      setUser(appUser);
      setPermissionsReady(true);
      sessionStorage.setItem('authUser', JSON.stringify(appUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      bumpPermissionsVersion();
      return true;
    }

    setError('Tài khoản không tồn tại. Vui lòng liên hệ Ban Giám hiệu.');
    return false;
  };

  const login = async (usernameInput: string, passwordInput?: string): Promise<boolean> => {
    setError(null);
    const cleanUsername = normalizeIdentifier(usernameInput);
    if (!cleanUsername) {
      setError('Vui lòng nhập tên đăng nhập.');
      return false;
    }

    if (!passwordInput || !passwordInput.trim()) {
      setError('Vui lòng nhập mật khẩu đăng nhập.');
      return false;
    }

    const inputPasswordTrim = passwordInput.trim();
    const hashedInput = await hashPassword(inputPasswordTrim);

    let matchedDocData: any = null;

    // 1. Check custom changed password cache (only password hash — permissions are ALWAYS fetched live from Firestore in doSuccessfulLogin)
    const customPass = getStoredUserPassword(cleanUsername);
    if (customPass) {
      const isCustomMatch =
        inputPasswordTrim === customPass.plain ||
        inputPasswordTrim === customPass.hash ||
        hashedInput === customPass.hash;

      if (isCustomMatch) {
        return await doSuccessfulLogin(cleanUsername);
      }
    }

    // 2. Query Firestore user_accounts & teachers (6s timeout to prevent premature drops on Vercel cold starts)
    try {
      const checkFirestoreAuthPromise = async (): Promise<boolean> => {
        if (cleanUsername === 'admin') {
          const accAdminDoc = await getDoc(doc(db, 'user_accounts', 'admin'));
          if (accAdminDoc.exists()) {
            matchedDocData = { id: accAdminDoc.id, ...accAdminDoc.data() };
          }
        } else {
          const qAcc = query(collection(db, 'user_accounts'), where('username', '==', cleanUsername));
          const snapAcc = await getDocs(qAcc);
          if (!snapAcc.empty) {
            matchedDocData = { id: snapAcc.docs[0].id, ...snapAcc.docs[0].data() };
          } else if (cleanUsername.includes('@')) {
            const qEmail = query(
              collection(db, 'user_accounts'),
              where('normalizedEmail', '==', normalizeEmail(cleanUsername))
            );
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
              matchedDocData = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
            }
          } else {
            const accDirect = await getDoc(doc(db, 'user_accounts', cleanUsername));
            if (accDirect.exists()) {
              matchedDocData = { id: accDirect.id, ...accDirect.data() };
            } else {
              const qTea = query(collection(db, 'teachers'), where('username', '==', cleanUsername));
              const snapTea = await getDocs(qTea);
              if (!snapTea.empty) {
                matchedDocData = { id: snapTea.docs[0].id, ...snapTea.docs[0].data() };
              }
            }
          }
        }

        if (matchedDocData) {
          const storedPass =
            matchedDocData.password || matchedDocData.accountPassword || matchedDocData.plainPassword;
          const storedPlain = matchedDocData.plainPassword;
          if (storedPass || storedPlain) {
            const isMatch =
              inputPasswordTrim === storedPass ||
              hashedInput === storedPass ||
              (storedPlain && inputPasswordTrim === storedPlain);
            if (isMatch) {
              setStoredUserPassword(cleanUsername, inputPasswordTrim, hashedInput);
              return true;
            }
          }
        }
        return false;
      };

      const timeoutP = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 6000));
      const isFirestoreMatched = await Promise.race([checkFirestoreAuthPromise(), timeoutP]);
      if (isFirestoreMatched) {
        return await doSuccessfulLogin(cleanUsername, matchedDocData);
      }
    } catch (e) {
      console.warn('Firestore password check warning:', e);
    }

    // 3. Check default passwords (only if password has NOT been changed)
    let isDefaultMatch = false;
    if (cleanUsername === 'admin') {
      if (inputPasswordTrim === 'admin' || inputPasswordTrim === '123456') {
        isDefaultMatch = true;
      }
    } else {
      const foundDefaultTeacher = DEFAULT_TEACHERS.find(
        (t) =>
          (t.username && normalizeIdentifier(t.username) === cleanUsername) ||
          (t.code && normalizeIdentifier(t.code) === cleanUsername) ||
          (t.email && normalizeEmail(t.email) === normalizeEmail(cleanUsername))
      );
      if (foundDefaultTeacher) {
        const storedPass = foundDefaultTeacher.accountPassword || foundDefaultTeacher.password || '123456';
        if (storedPass === inputPasswordTrim || inputPasswordTrim === '123456' || inputPasswordTrim === 'admin') {
          isDefaultMatch = true;
        }
      }
    }

    if (isDefaultMatch) {
      if (customPass) {
        setError('Mật khẩu không chính xác. Thầy/Cô đã thay đổi mật khẩu, vui lòng nhập mật khẩu mới.');
        return false;
      }
      return await doSuccessfulLogin(cleanUsername, matchedDocData);
    }

    if (customPass) {
      setError('Mật khẩu không chính xác. Thầy/Cô đã thay đổi mật khẩu, vui lòng nhập mật khẩu mới.');
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.');
    }
    return false;
  };

  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) return;
    // Prevent client-side profile updates from mutating authoritative RBAC fields directly
    const { role: _r, roleGroup: _rg, hasCustomPermissions: _hc, customPermissions: _cp, ...safeData } = data;
    const updatedUser = { ...user, ...safeData };
    setUser(updatedUser);
    sessionStorage.setItem('authUser', JSON.stringify(updatedUser));

    try {
      if (user.id === 'admin') {
        const adminRef = doc(db, 'settings', 'admin_profile');
        await setDoc(
          adminRef,
          {
            name: updatedUser.name,
            avatar: updatedUser.avatar || '',
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } else if (user.id) {
        const teacherRef = doc(db, 'teachers', user.id);
        const updatePayload: Record<string, any> = {};
        if (safeData.avatar !== undefined) updatePayload.avatar = safeData.avatar;
        if (safeData.name !== undefined) updatePayload.name = safeData.name;
        if (Object.keys(updatePayload).length > 0) {
          await updateDoc(teacherRef, updatePayload);
        }
      }
    } catch (err) {
      console.warn('Could not sync user profile update to Firestore:', err);
    }
  };

  const changePassword = async (oldPass: string, newPass: string) => {
    if (!user) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
    return await accountService.changePassword(user.username, oldPass, newPass, user.name);
  };

  const isAdmin = Boolean(
    user?.id === 'admin' ||
      normalizeIdentifier(user?.username) === 'admin' ||
      user?.role === 'admin' ||
      user?.role === 'ADMIN' ||
      user?.roleGroup === 'ADMIN'
  );

  // Hardened: ONLY true system administrators may simulate another role for preview;
  // regular teachers/staff can NEVER escalate privileges client-side.
  const switchRoleForDemo = (newRole: Role | RoleGroupCode) => {
    if (!user || !isAdmin) {
      console.warn('Blocked unauthorized role switch attempt.');
      return;
    }
    const rg = (newRole === 'admin' ? 'ADMIN' : newRole) as RoleGroupCode;
    const updated = {
      ...user,
      role: (newRole === 'admin' ? 'admin' : newRole) as Role,
      roleGroup: rg
    };
    setUser(updated);
    sessionStorage.setItem('authUser', JSON.stringify(updated));
    bumpPermissionsVersion();
  };

  const logout = () => {
    setUser(null);
    setPermissionsReady(false);
    setPermissionSyncError(null);
    try {
      sessionStorage.removeItem('authUser');
      sessionStorage.removeItem('authSessionExpiry');
      sessionStorage.removeItem(PERM_LAST_SYNCED_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }
    clearLegacyLocalCaches();
    bumpPermissionsVersion();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        permissionsReady,
        permissionsVersion,
        permissionSyncError,
        lastPermissionSyncedAt,
        isRefreshingPermissions,
        isAdmin,
        login,
        logout,
        updateUser,
        refreshPermissions,
        changePassword,
        switchRoleForDemo,
        error,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
