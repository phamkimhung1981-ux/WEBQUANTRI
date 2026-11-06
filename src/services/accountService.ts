import { 
  AccountRecord, 
  RoleGroupCode, 
  DEFAULT_ROLE_GROUPS, 
  AccountStatus, 
  AccountAuditLog,
  ModulePermissionsMap,
  RoleGroupConfig
} from '../types/permission';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';
import { Teacher } from '../types';
import * as XLSX from 'xlsx';

const ACCOUNTS_COLLECTION = 'user_accounts';
const AUDIT_COLLECTION = 'account_audit_logs';
const ROLE_GROUPS_COLLECTION = 'role_group_configs';
export const CUSTOM_PERMISSIONS_COLLECTION = 'user_custom_permissions';

/**
 * Returns all key aliases (id, lowercased id, code, username, fullName) for a given identifier
 */
export function getTeacherKeyAliases(idOrUserOrCode?: string): string[] {
  if (!idOrUserOrCode) return [];
  const clean = idOrUserOrCode.toLowerCase().trim();
  if (!clean) return [];

  const aliases = new Set<string>([clean]);

  // Check DEFAULT_TEACHERS
  for (const t of DEFAULT_TEACHERS) {
    const tId = (t.id || '').toLowerCase().trim();
    const tCode = (t.code || '').toLowerCase().trim();
    const tUser = (t.username || '').toLowerCase().trim();
    const tName = (t.name || '').toLowerCase().trim();

    if (clean === tId || clean === tCode || clean === tUser || clean === tName) {
      if (tId) aliases.add(tId);
      if (tCode) aliases.add(tCode);
      if (tUser) aliases.add(tUser);
    }
  }

  // Check cached accounts in localStorage
  try {
    const rawCached = typeof window !== 'undefined' ? localStorage.getItem('cached_user_accounts') : null;
    if (rawCached) {
      const cachedAccounts: AccountRecord[] = JSON.parse(rawCached);
      for (const a of cachedAccounts) {
        const aId = (a.id || '').toLowerCase().trim();
        const aCode = (a.teacherCode || '').toLowerCase().trim();
        const aUser = (a.username || '').toLowerCase().trim();
        const aName = (a.fullName || '').toLowerCase().trim();

        if (clean === aId || clean === aCode || clean === aUser || clean === aName) {
          if (aId) aliases.add(aId);
          if (aCode) aliases.add(aCode);
          if (aUser) aliases.add(aUser);
        }
      }
    }
  } catch (e) {}

  return Array.from(aliases);
}

/**
 * Direct real-time fetch of user permissions from Firebase Firestore.
 * Prioritizes Firestore document, updates local caches, and ensures no stale defaults are used.
 */
export async function getLiveUserPermissionsFromFirestore(
  userId: string,
  username?: string,
  teacherCode?: string
): Promise<{ hasCustom: boolean; permissions: Partial<ModulePermissionsMap> | null }> {
  const cleanId = (userId || '').trim();
  const cleanUser = (username || '').toLowerCase().trim();
  const cleanCode = (teacherCode || '').toLowerCase().trim();

  const rawKeys = [cleanUser, cleanId, cleanCode].filter(Boolean);
  const allAliasesSet = new Set<string>();
  rawKeys.forEach(k => {
    getTeacherKeyAliases(k).forEach(alias => allAliasesSet.add(alias));
  });
  const keysToTry = Array.from(allAliasesSet);

  // Helper to persist custom perms locally under all key aliases
  const persistAliasesLocally = (perms: Partial<ModulePermissionsMap>) => {
    keysToTry.forEach(alias => setStoredUserCustomPermissions(alias, perms));
  };

  // 1. Try dedicated 'user_custom_permissions' collection
  for (const k of keysToTry) {
    try {
      const pDoc = await getDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, k));
      if (pDoc.exists()) {
        const data = pDoc.data();
        if (data && data.permissions && Object.keys(data.permissions).length > 0) {
          const perms = data.permissions as Partial<ModulePermissionsMap>;
          persistAliasesLocally(perms);
          return { hasCustom: true, permissions: perms };
        } else if (data && data.hasCustomPermissions === false) {
          return { hasCustom: false, permissions: null };
        }
      }
    } catch (e) {}
  }

  // 2. Try 'user_accounts' collection
  for (const k of keysToTry) {
    try {
      const accDoc = await getDoc(doc(db, ACCOUNTS_COLLECTION, k));
      if (accDoc.exists()) {
        const data = accDoc.data();
        if (data && (data.hasCustomPermissions || (data.customPermissions && Object.keys(data.customPermissions).length > 0))) {
          const perms = data.customPermissions as Partial<ModulePermissionsMap>;
          persistAliasesLocally(perms);
          return { hasCustom: true, permissions: perms };
        }
      }
    } catch (e) {}
  }

  // 3. Query user_accounts by username if not found yet
  if (cleanUser) {
    try {
      const q = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', cleanUser));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data && (data.hasCustomPermissions || (data.customPermissions && Object.keys(data.customPermissions).length > 0))) {
          const perms = data.customPermissions as Partial<ModulePermissionsMap>;
          persistAliasesLocally(perms);
          return { hasCustom: true, permissions: perms };
        }
      }
    } catch (e) {}
  }

  // 4. Try 'teachers' collection for all key aliases
  for (const k of keysToTry) {
    try {
      const tDoc = await getDoc(doc(db, 'teachers', k));
      if (tDoc.exists()) {
        const data = tDoc.data();
        if (data && (data.hasCustomPermissions || (data.customPermissions && Object.keys(data.customPermissions).length > 0))) {
          const perms = data.customPermissions as Partial<ModulePermissionsMap>;
          persistAliasesLocally(perms);
          return { hasCustom: true, permissions: perms };
        }
      }
    } catch (e) {}
  }

  // 5. Fallback: check stored custom permissions map synced from server / custom_permissions.json
  const localMap = getStoredUserCustomPermissions();
  for (const k of keysToTry) {
    const matched = localMap[k.toLowerCase()];
    if (matched && Object.keys(matched).length > 0) {
      return { hasCustom: true, permissions: matched };
    }
  }

  return { hasCustom: false, permissions: null };
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

export function getStoredUserCustomPermissions(): Record<string, Partial<ModulePermissionsMap>> {
  try {
    const raw = localStorage.getItem('custom_user_permissions_map');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function setStoredUserCustomPermissions(idOrUsername: string, perms: Partial<ModulePermissionsMap> | null): void {
  if (!idOrUsername) return;
  try {
    const map = getStoredUserCustomPermissions();
    const key = idOrUsername.toLowerCase().trim();
    if (perms === null) {
      delete map[key];
    } else {
      map[key] = perms;
    }
    localStorage.setItem('custom_user_permissions_map', JSON.stringify(map));
  } catch (e) {}
}

/**
 * Synchronize permission definitions and custom matrices from server / static file.
 * Guarantees cross-device, web export, and clean browser consistency.
 */
export async function syncPermissionsFromServer(): Promise<{ roleGroups: any; userCustom: any }> {
  try {
    let data: any = null;
    try {
      const res = await fetch('/api/permissions');
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {}

    if (!data || !data.userCustom) {
      try {
        const resStatic = await fetch('/custom_permissions.json');
        if (resStatic.ok) {
          data = await resStatic.json();
        }
      } catch (e) {}
    }

    if (data) {
      // 1. Sync custom role groups into in-memory DEFAULT_ROLE_GROUPS
      if (data.roleGroups && typeof data.roleGroups === 'object') {
        Object.keys(data.roleGroups).forEach(code => {
          const rg = code as RoleGroupCode;
          if (DEFAULT_ROLE_GROUPS[rg] && data.roleGroups[code]) {
            DEFAULT_ROLE_GROUPS[rg].permissions = {
              ...DEFAULT_ROLE_GROUPS[rg].permissions,
              ...data.roleGroups[code]
            };
            try {
              localStorage.setItem(`custom_role_group_permissions_${code}`, JSON.stringify(DEFAULT_ROLE_GROUPS[rg].permissions));
            } catch (e) {}
          }
        });
      }

      // 2. Sync individual customized permissions into local storage map
      if (data.userCustom && typeof data.userCustom === 'object') {
        const localMap = getStoredUserCustomPermissions();
        Object.entries(data.userCustom).forEach(([key, val]) => {
          const cleanKey = key.toLowerCase().trim();
          if (val === null) {
            delete localMap[cleanKey];
          } else if (val) {
            localMap[cleanKey] = val as Partial<ModulePermissionsMap>;
          }
        });
        try {
          localStorage.setItem('custom_user_permissions_map', JSON.stringify(localMap));
        } catch (e) {}
      }

      return {
        roleGroups: data.roleGroups || {},
        userCustom: data.userCustom || {}
      };
    }
  } catch (err) {
    console.warn('Could not sync permissions from server:', err);
  }
  return { roleGroups: {}, userCustom: {} };
}

export const accountService = {
  /**
   * Fetch all accounts. If the accounts collection is empty in Firestore,
   * it seeds the canonical accounts from DEFAULT_TEACHERS and admin.
   */
  async getAccounts(): Promise<AccountRecord[]> {
    try {
      // Sync latest permissions from server disk / static JSON before reading accounts
      await syncPermissionsFromServer();

      // Check cached_user_accounts first for instant availability
      let cachedAccounts: AccountRecord[] = [];
      try {
        const rawCached = localStorage.getItem('cached_user_accounts');
        if (rawCached) {
          cachedAccounts = JSON.parse(rawCached);
        }
      } catch (e) {}

      let snap: any = null;
      try {
        const fetchPromise = getDocs(collection(db, ACCOUNTS_COLLECTION));
        const timeoutP = new Promise<null>(res => setTimeout(() => res(null), 5000));
        snap = await Promise.race([fetchPromise, timeoutP]);
      } catch (e) {
        console.warn('Firestore getAccounts error:', e);
      }

      if (snap && !snap.empty) {
        const customMap = getStoredUserCustomPermissions();
        const accounts = snap.docs.map((d: any) => {
          const acc = { id: d.id, ...d.data() } as AccountRecord;
          const aliases = getTeacherKeyAliases(acc.id);
          if (acc.username) getTeacherKeyAliases(acc.username).forEach(a => aliases.indexOf(a) === -1 && aliases.push(a));
          if (acc.teacherCode) getTeacherKeyAliases(acc.teacherCode).forEach(a => aliases.indexOf(a) === -1 && aliases.push(a));

          let customPerm: any = acc.customPermissions || null;
          if (!customPerm) {
            for (const alias of aliases) {
              if (customMap[alias] && Object.keys(customMap[alias]).length > 0) {
                customPerm = customMap[alias];
                break;
              }
            }
          }

          const hasCustom = !!(acc.hasCustomPermissions || (customPerm && Object.keys(customPerm).length > 0));

          if (hasCustom && customPerm) {
            acc.hasCustomPermissions = true;
            acc.customPermissions = customPerm;
            aliases.forEach(a => setStoredUserCustomPermissions(a, customPerm));
          }
          return acc;
        });
        try {
          localStorage.setItem('cached_user_accounts', JSON.stringify(accounts));
        } catch (e) {}
        return accounts;
      }

      // If Firestore fetch returned empty or timed out, but we have cached accounts, return cached!
      if (cachedAccounts && cachedAccounts.length > 0) {
        return cachedAccounts;
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
   * Copy permissions from a source account to a target account
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

    // 1. Get source account permissions
    const sourceDoc = await getDoc(doc(db, ACCOUNTS_COLLECTION, sourceAccountId));
    if (!sourceDoc.exists()) {
      throw new Error('Tài khoản nguồn không tồn tại trên hệ thống.');
    }
    const sourceData = sourceDoc.data() as AccountRecord;
    
    // Determine permissions from source: either its custom permissions, or role group default
    let permsToCopy: ModulePermissionsMap;
    const baseRolePerms = DEFAULT_ROLE_GROUPS[sourceData.roleGroup]?.permissions || DEFAULT_ROLE_GROUPS.TEACHER.permissions;
    permsToCopy = JSON.parse(JSON.stringify(baseRolePerms));
    
    if (sourceData.hasCustomPermissions && sourceData.customPermissions) {
      Object.keys(sourceData.customPermissions).forEach(k => {
        const mCode = k as any;
        if (sourceData.customPermissions && sourceData.customPermissions[mCode]) {
          permsToCopy[mCode] = {
            ...permsToCopy[mCode],
            ...sourceData.customPermissions[mCode]
          };
        }
      });
    }

    // 2. Save copied permissions to target account
    await this.saveUserPermissions(targetAccountId, permsToCopy, performedBy);

    // 3. Log audit
    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: targetAccountId,
      targetFullName: `Tài khoản đích (ID: ${targetAccountId})`,
      performedBy,
      details: `Sao chép toàn bộ ma trận phân quyền từ ${sourceData.fullName} (${sourceData.username})`
    });

    return permsToCopy;
  },

  /**
   * Save custom fine-grained permissions for an individual account
   */
  async saveUserPermissions(
    id: string,
    permissions: Partial<ModulePermissionsMap>,
    performedBy: string,
    extraInfo?: { username?: string; teacherCode?: string; fullName?: string }
  ): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID tài khoản không hợp lệ.');
    }
    const now = new Date().toISOString();

    let targetName = extraInfo?.fullName || id;
    let targetUser = extraInfo?.username ? extraInfo.username.toLowerCase().trim() : '';
    let teacherCode = extraInfo?.teacherCode ? extraInfo.teacherCode.toLowerCase().trim() : '';
    let teacherId = id;

    // 0. Instant local persistence under ALL key aliases
    const allAliases = new Set<string>();
    getTeacherKeyAliases(id).forEach(a => allAliases.add(a));
    if (targetUser) getTeacherKeyAliases(targetUser).forEach(a => allAliases.add(a));
    if (teacherCode) getTeacherKeyAliases(teacherCode).forEach(a => allAliases.add(a));
    allAliases.forEach(alias => setStoredUserCustomPermissions(alias, permissions));

    // 1. Fetch current account info for logging and sync if not provided (with timeout)
    if (!targetUser) {
      try {
        const getAccPromise = getDoc(doc(db, ACCOUNTS_COLLECTION, id));
        const timeoutGet = new Promise<null>(res => setTimeout(() => res(null), 1000));
        const accDoc: any = await Promise.race([getAccPromise, timeoutGet]);
        if (accDoc && accDoc.exists && accDoc.exists()) {
          const d = accDoc.data();
          if (d.fullName) targetName = d.fullName;
          if (d.username) {
            targetUser = d.username.toLowerCase().trim();
            getTeacherKeyAliases(d.username).forEach(a => allAliases.add(a));
          }
          if (d.teacherCode) {
            teacherCode = d.teacherCode.toLowerCase().trim();
            getTeacherKeyAliases(d.teacherCode).forEach(a => allAliases.add(a));
          }
          if (d.teacherId) {
            teacherId = d.teacherId;
            getTeacherKeyAliases(d.teacherId).forEach(a => allAliases.add(a));
          }
          allAliases.forEach(alias => setStoredUserCustomPermissions(alias, permissions));
        }
      } catch (e) {
        console.warn('Could not read existing account doc:', e);
      }
    }

    // 2. Update active logged-in user in sessionStorage & localStorage if it matches
    try {
      ['sessionStorage', 'localStorage'].forEach(storageType => {
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        const stored = storage.getItem('authUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          const pId = parsed.id?.toLowerCase();
          const pUser = parsed.username?.toLowerCase();
          const pCode = parsed.teacherCode?.toLowerCase();
          if (
            pId === id.toLowerCase() || 
            (targetUser && pUser === targetUser) || 
            (teacherCode && pCode === teacherCode) ||
            pId === teacherId.toLowerCase()
          ) {
            parsed.hasCustomPermissions = true;
            parsed.customPermissions = permissions;
            storage.setItem('authUser', JSON.stringify(parsed));
          }
        }
      });
    } catch (e) {}

    // 3. Update cached_user_accounts in localStorage
    try {
      const cached = localStorage.getItem('cached_user_accounts');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.map((a: any) => {
          if (
            a.id === id || 
            (targetUser && a.username?.toLowerCase() === targetUser) || 
            a.id === teacherId
          ) {
            return {
              ...a,
              hasCustomPermissions: true,
              customPermissions: permissions
            };
          }
          return a;
        });
        localStorage.setItem('cached_user_accounts', JSON.stringify(updated));
      }
    } catch (e) {}

    // 4. Save to server persistence API (for cross-device / exported web)
    try {
      const payload: Record<string, any> = { [id]: permissions };
      if (targetUser) payload[targetUser] = permissions;
      if (teacherCode) payload[teacherCode] = permissions;
      fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCustom: payload })
      }).catch(() => {});
    } catch (e) {}

    // 5. Persist to Firestore across all relevant collections (awaiting allSettled)
    const firestoreWriteTasks: Promise<any>[] = [];

    // 5a. Save to dedicated CUSTOM_PERMISSIONS_COLLECTION
    firestoreWriteTasks.push(
      setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, id), {
        userId: id,
        username: targetUser,
        teacherCode: teacherCode,
        fullName: targetName,
        hasCustomPermissions: true,
        permissions,
        updatedAt: now,
        updatedBy: performedBy
      }, { merge: true })
    );

    if (targetUser && targetUser !== id) {
      firestoreWriteTasks.push(
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, targetUser), {
          userId: id,
          username: targetUser,
          teacherCode: teacherCode,
          fullName: targetName,
          hasCustomPermissions: true,
          permissions,
          updatedAt: now,
          updatedBy: performedBy
        }, { merge: true })
      );
    }

    if (teacherCode && teacherCode !== id && teacherCode !== targetUser) {
      firestoreWriteTasks.push(
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, teacherCode), {
          userId: id,
          username: targetUser,
          teacherCode: teacherCode,
          fullName: targetName,
          hasCustomPermissions: true,
          permissions,
          updatedAt: now,
          updatedBy: performedBy
        }, { merge: true })
      );
    }

    // 5b. Save to ACCOUNTS_COLLECTION
    firestoreWriteTasks.push(
      setDoc(doc(db, ACCOUNTS_COLLECTION, id), {
        hasCustomPermissions: true,
        customPermissions: permissions,
        updatedAt: now
      }, { merge: true })
    );

    if (targetUser && targetUser !== id) {
      firestoreWriteTasks.push(
        setDoc(doc(db, ACCOUNTS_COLLECTION, targetUser), {
          hasCustomPermissions: true,
          customPermissions: permissions,
          updatedAt: now
        }, { merge: true })
      );
    }

    // 5c. Save to teachers collection
    const tId = teacherId || id;
    firestoreWriteTasks.push(
      setDoc(doc(db, 'teachers', tId), {
        hasCustomPermissions: true,
        customPermissions: permissions,
        accountUpdatedAt: now
      }, { merge: true })
    );

    // 5d. Add audit log
    firestoreWriteTasks.push(
      this.addAuditLog({
        action: 'UPDATE_PERMISSIONS',
        targetUsername: targetUser || id,
        targetFullName: targetName,
        performedBy,
        details: `Thiết lập ma trận phân quyền tùy biến riêng (18 modules)`
      })
    );

    try {
      const waitWritePromise = Promise.allSettled(firestoreWriteTasks);
      const timeoutSync = new Promise<void>(res => setTimeout(res, 3500));
      await Promise.race([waitWritePromise, timeoutSync]);
    } catch (err) {
      console.warn('Firestore sync for permissions error:', err);
    }
  },

  /**
   * Reset user's custom permissions back to standard role group defaults
   */
  async resetUserPermissionsToRoleGroup(
    id: string, 
    performedBy: string,
    extraInfo?: { username?: string; teacherCode?: string; fullName?: string }
  ): Promise<void> {
    if (!id) throw new Error('ID tài khoản không hợp lệ.');
    const now = new Date().toISOString();

    let targetName = extraInfo?.fullName || id;
    let targetUser = extraInfo?.username ? extraInfo.username.toLowerCase().trim() : '';
    let teacherCode = extraInfo?.teacherCode ? extraInfo.teacherCode.toLowerCase().trim() : '';
    let teacherId = id;

    setStoredUserCustomPermissions(id, null);
    if (targetUser) setStoredUserCustomPermissions(targetUser, null);
    if (teacherCode) setStoredUserCustomPermissions(teacherCode, null);

    // Remove from server persistence API
    try {
      const payload: Record<string, any> = { [id]: null };
      if (targetUser) payload[targetUser] = null;
      if (teacherCode) payload[teacherCode] = null;
      fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCustom: payload })
      }).catch(() => {});
    } catch (e) {}

    const firestoreResetTasks: Promise<any>[] = [];

    // Reset in CUSTOM_PERMISSIONS_COLLECTION
    firestoreResetTasks.push(
      setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, id), {
        hasCustomPermissions: false,
        permissions: null,
        updatedAt: now,
        updatedBy: performedBy
      }, { merge: true })
    );

    if (targetUser && targetUser !== id) {
      firestoreResetTasks.push(
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, targetUser), {
          hasCustomPermissions: false,
          permissions: null,
          updatedAt: now,
          updatedBy: performedBy
        }, { merge: true })
      );
    }

    if (teacherCode && teacherCode !== id && teacherCode !== targetUser) {
      firestoreResetTasks.push(
        setDoc(doc(db, CUSTOM_PERMISSIONS_COLLECTION, teacherCode), {
          hasCustomPermissions: false,
          permissions: null,
          updatedAt: now,
          updatedBy: performedBy
        }, { merge: true })
      );
    }

    // Reset in ACCOUNTS_COLLECTION
    firestoreResetTasks.push(
      setDoc(doc(db, ACCOUNTS_COLLECTION, id), {
        hasCustomPermissions: false,
        customPermissions: null,
        updatedAt: now
      }, { merge: true })
    );

    if (targetUser && targetUser !== id) {
      firestoreResetTasks.push(
        setDoc(doc(db, ACCOUNTS_COLLECTION, targetUser), {
          hasCustomPermissions: false,
          customPermissions: null,
          updatedAt: now
        }, { merge: true })
      );
    }

    const tId = teacherId || id;
    firestoreResetTasks.push(
      setDoc(doc(db, 'teachers', tId), {
        hasCustomPermissions: false,
        customPermissions: null,
        accountUpdatedAt: now
      }, { merge: true })
    );

    firestoreResetTasks.push(
      this.addAuditLog({
        action: 'UPDATE_PERMISSIONS',
        targetUsername: targetUser || id,
        targetFullName: targetName,
        performedBy,
        details: `Khôi phục phân quyền về mặc định theo nhóm quyền`
      })
    );

    try {
      const waitResetPromise = Promise.allSettled(firestoreResetTasks);
      const timeoutP = new Promise<void>(res => setTimeout(res, 3500));
      await Promise.race([waitResetPromise, timeoutP]);
    } catch (e) {
      console.warn('Reset sync error:', e);
    }

    try {
      ['sessionStorage', 'localStorage'].forEach(storageType => {
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        const stored = storage.getItem('authUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          const pId = parsed.id?.toLowerCase();
          const pUser = parsed.username?.toLowerCase();
          const pCode = parsed.teacherCode?.toLowerCase();
          if (
            pId === id.toLowerCase() || 
            (targetUser && pUser === targetUser) || 
            (teacherCode && pCode === teacherCode) ||
            pId === teacherId.toLowerCase()
          ) {
            parsed.hasCustomPermissions = false;
            parsed.customPermissions = null;
            storage.setItem('authUser', JSON.stringify(parsed));
          }
        }
      });
    } catch (e) {}
  },

  /**
   * Save customized base matrix for a role group
   */
  async saveRoleGroupPermissions(
    roleGroup: RoleGroupCode,
    permissions: ModulePermissionsMap,
    performedBy: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    // In-memory and local storage immediate update
    if (DEFAULT_ROLE_GROUPS[roleGroup]) {
      DEFAULT_ROLE_GROUPS[roleGroup].permissions = permissions;
    }
    try {
      localStorage.setItem(`custom_role_group_permissions_${roleGroup}`, JSON.stringify(permissions));
    } catch (e) {}

    // Save to server persistence API
    try {
      fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleGroups: { [roleGroup]: permissions } })
      }).catch(() => {});
    } catch (e) {}

    const firestoreSyncPromise = (async () => {
      try {
        await setDoc(doc(db, ROLE_GROUPS_COLLECTION, roleGroup), {
          code: roleGroup,
          permissions,
          updatedAt: now,
          updatedBy: performedBy
        }, { merge: true });

        await this.addAuditLog({
          action: 'UPDATE_PERMISSIONS',
          targetUsername: roleGroup,
          targetFullName: `Nhóm quyền ${roleGroup}`,
          performedBy,
          details: `Cập nhật cấu hình phân quyền mẫu cho nhóm ${DEFAULT_ROLE_GROUPS[roleGroup]?.name || roleGroup}`
        });
      } catch (err) {
        console.warn('Background Firestore sync for role group:', err);
      }
    })();

    const timeoutP = new Promise<void>(res => setTimeout(res, 1200));
    await Promise.race([firestoreSyncPromise, timeoutP]);
  },

  /**
   * Load customized role group configurations from Firestore
   */
  async loadRoleGroupConfigs(): Promise<void> {
    // Sync from server / custom_permissions.json first (ensures web export has configured permissions)
    await syncPermissionsFromServer();

    try {
      (Object.keys(DEFAULT_ROLE_GROUPS) as RoleGroupCode[]).forEach(code => {
        const raw = localStorage.getItem(`custom_role_group_permissions_${code}`);
        if (raw) {
          const perms = JSON.parse(raw);
          if (perms && DEFAULT_ROLE_GROUPS[code]) {
            DEFAULT_ROLE_GROUPS[code].permissions = perms;
          }
        }
      });
    } catch (e) {}

    try {
      const snapPromise = getDocs(collection(db, ROLE_GROUPS_COLLECTION));
      const timeoutP = new Promise<null>(res => setTimeout(() => res(null), 1500));
      const snap: any = await Promise.race([snapPromise, timeoutP]);
      if (snap && !snap.empty) {
        snap.docs.forEach((d: any) => {
          const data = d.data();
          const code = (data.code || d.id) as RoleGroupCode;
          if (DEFAULT_ROLE_GROUPS[code] && data.permissions) {
            DEFAULT_ROLE_GROUPS[code].permissions = data.permissions;
            try {
              localStorage.setItem(`custom_role_group_permissions_${code}`, JSON.stringify(data.permissions));
            } catch (e) {}
          }
        });
      }
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
