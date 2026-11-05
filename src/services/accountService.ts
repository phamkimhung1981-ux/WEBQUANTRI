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
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_thpt_son_luong_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return 'h_' + btoa(unescape(encodeURIComponent(password)));
  }
}

export const accountService = {
  /**
   * Fetch all accounts. If the accounts collection is empty in Firestore,
   * it seeds the canonical accounts from DEFAULT_TEACHERS and admin.
   */
  async getAccounts(): Promise<AccountRecord[]> {
    try {
      const snap = await getDocs(collection(db, ACCOUNTS_COLLECTION));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountRecord));
      }

      // Check if teachers collection has data
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      let teachersList: Teacher[] = [];
      if (!teachersSnap.empty) {
        teachersList = teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
      } else {
        teachersList = DEFAULT_TEACHERS;
      }

      // Initialize default accounts list
      const initialAccounts: AccountRecord[] = [];

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
        const username = t.username || t.code?.toLowerCase() || `gv_${t.id.slice(0, 6)}`;
        const roleGroup = detectRoleGroupByPosition(t.position, t.departmentId);
        const status: AccountStatus = t.accountStatus === 'Đã khóa' ? 'Đã khóa' : 'Đang hoạt động';
        
        const account: AccountRecord = {
          id: t.id,
          teacherId: t.id,
          teacherCode: t.code,
          fullName: t.name,
          username: username.toLowerCase().trim(),
          password: t.accountPassword || t.password || '123456',
          position: t.position || 'Giáo viên',
          departmentId: t.departmentId,
          departmentName: t.departmentName,
          roleGroup: roleGroup,
          status: status,
          hasCustomPermissions: false,
          createdAt: t.joinDate || '2026-10-16T00:00:00.000Z',
          updatedAt: new Date().toISOString(),
          email: t.email,
          phone: t.phone
        };
        initialAccounts.push(account);
      }

      // Persist in background (batch/parallel sets)
      try {
        await Promise.all(
          initialAccounts.map(acc => setDoc(doc(db, ACCOUNTS_COLLECTION, acc.id), acc, { merge: true }))
        );
      } catch (err) {
        console.warn('Could not persist all accounts to Firestore directly, returning seeded list:', err);
      }

      return initialAccounts;
    } catch (e) {
      console.error('Error fetching accounts, fallback to generated defaults:', e);
      // Fallback in-memory
      const fallbackList: AccountRecord[] = [
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
      return fallbackList;
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

    // 1. Find account in user_accounts
    let targetAccId = '';
    let targetTeacherId = '';
    let targetFullName = username;
    let storedPassword = '';

    const qAcc = query(collection(db, ACCOUNTS_COLLECTION), where('username', '==', username));
    const snapAcc = await getDocs(qAcc);
    if (!snapAcc.empty) {
      const d = snapAcc.docs[0].data();
      targetAccId = snapAcc.docs[0].id;
      targetTeacherId = d.teacherId || snapAcc.docs[0].id;
      targetFullName = d.fullName || username;
      storedPassword = d.password || '';
    } else {
      // Check teachers collection
      const qTea = query(collection(db, 'teachers'), where('username', '==', username));
      const snapTea = await getDocs(qTea);
      if (!snapTea.empty) {
        const d = snapTea.docs[0].data();
        targetTeacherId = snapTea.docs[0].id;
        targetAccId = targetTeacherId;
        targetFullName = d.name || username;
        storedPassword = d.accountPassword || d.password || '';
      }
    }

    if (!targetAccId && username === 'admin') {
      targetAccId = 'admin';
      targetFullName = 'Quản trị viên Hệ thống';
      storedPassword = 'admin';
    }

    if (!targetAccId) {
      throw new Error('Không tìm thấy tài khoản với tên đăng nhập này.');
    }

    // Verify current password
    const hashedCurrent = await hashPassword(currentPasswordInput.trim());
    const isCurrentValid = (
      storedPassword === currentPasswordInput.trim() ||
      storedPassword === hashedCurrent ||
      (targetAccId === 'admin' && (currentPasswordInput.trim() === 'admin' || storedPassword === hashedCurrent))
    );

    if (!isCurrentValid) {
      throw new Error('Mật khẩu hiện tại không chính xác.');
    }

    const hashedNew = await hashPassword(newPasswordInput.trim());
    const now = new Date().toISOString();

    // Update in user_accounts
    await setDoc(doc(db, ACCOUNTS_COLLECTION, targetAccId), {
      password: hashedNew,
      updatedAt: now
    }, { merge: true });

    // Update in teachers
    if (targetTeacherId) {
      try {
        await setDoc(doc(db, 'teachers', targetTeacherId), {
          accountPassword: hashedNew,
          password: hashedNew,
          accountUpdatedAt: now
        }, { merge: true });
      } catch (e) {}
    }

    // Update localStorage if currently logged in
    try {
      const stored = localStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === targetAccId || parsed.username === username) {
          parsed.password = hashedNew;
          localStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    await this.addAuditLog({
      action: 'RESET_PASSWORD',
      targetUsername: username,
      targetFullName,
      performedBy: performedBy || targetFullName,
      details: `Đổi mật khẩu người dùng thành công`
    });

    return { success: true, message: 'Đổi mật khẩu thành công!' };
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
    performedBy: string
  ): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID tài khoản không hợp lệ.');
    }
    const now = new Date().toISOString();

    // 1. Fetch current account info for logging and sync
    let targetName = id;
    let targetUser = id;
    let teacherId = id;
    try {
      const accDoc = await getDoc(doc(db, ACCOUNTS_COLLECTION, id));
      if (accDoc.exists()) {
        const d = accDoc.data();
        if (d.fullName) targetName = d.fullName;
        if (d.username) targetUser = d.username;
        if (d.teacherId) teacherId = d.teacherId;
      }
    } catch (e) {
      console.warn('Could not read existing account doc:', e);
    }

    // 2. Persist to user_accounts using setDoc with merge: true (never fails on missing doc)
    await setDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      hasCustomPermissions: true,
      customPermissions: permissions,
      updatedAt: now
    }, { merge: true });

    // 3. Sync to teachers collection if document exists
    try {
      const tId = teacherId || id;
      const tDoc = await getDoc(doc(db, 'teachers', tId));
      if (tDoc.exists()) {
        await setDoc(doc(db, 'teachers', tId), {
          hasCustomPermissions: true,
          customPermissions: permissions,
          accountUpdatedAt: now
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Teacher collection permission sync error:', e);
    }

    // 4. Update localStorage if the active logged-in user is this account
    try {
      const stored = localStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === id || parsed.username === targetUser || parsed.id === teacherId) {
          parsed.hasCustomPermissions = true;
          parsed.customPermissions = permissions;
          localStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch (e) {
      // ignore
    }

    // 5. Add audit log
    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: targetUser,
      targetFullName: targetName,
      performedBy,
      details: `Thiết lập ma trận phân quyền tùy biến riêng (18 modules)`
    });
  },

  /**
   * Reset user's custom permissions back to standard role group defaults
   */
  async resetUserPermissionsToRoleGroup(id: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('ID tài khoản không hợp lệ.');
    const now = new Date().toISOString();

    let targetName = id;
    let targetUser = id;
    let teacherId = id;
    try {
      const accDoc = await getDoc(doc(db, ACCOUNTS_COLLECTION, id));
      if (accDoc.exists()) {
        const d = accDoc.data();
        if (d.fullName) targetName = d.fullName;
        if (d.username) targetUser = d.username;
        if (d.teacherId) teacherId = d.teacherId;
      }
    } catch (e) {}

    await setDoc(doc(db, ACCOUNTS_COLLECTION, id), {
      hasCustomPermissions: false,
      customPermissions: null,
      updatedAt: now
    }, { merge: true });

    try {
      const tId = teacherId || id;
      const tDoc = await getDoc(doc(db, 'teachers', tId));
      if (tDoc.exists()) {
        await setDoc(doc(db, 'teachers', tId), {
          hasCustomPermissions: false,
          customPermissions: null,
          accountUpdatedAt: now
        }, { merge: true });
      }
    } catch (e) {}

    try {
      const stored = localStorage.getItem('authUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === id || parsed.username === targetUser || parsed.id === teacherId) {
          parsed.hasCustomPermissions = false;
          parsed.customPermissions = null;
          localStorage.setItem('authUser', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: targetUser,
      targetFullName: targetName,
      performedBy,
      details: `Khôi phục phân quyền về mặc định theo nhóm quyền`
    });
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
    await setDoc(doc(db, ROLE_GROUPS_COLLECTION, roleGroup), {
      code: roleGroup,
      permissions,
      updatedAt: now,
      updatedBy: performedBy
    }, { merge: true });

    if (DEFAULT_ROLE_GROUPS[roleGroup]) {
      DEFAULT_ROLE_GROUPS[roleGroup].permissions = permissions;
    }

    await this.addAuditLog({
      action: 'UPDATE_PERMISSIONS',
      targetUsername: roleGroup,
      targetFullName: `Nhóm quyền ${roleGroup}`,
      performedBy,
      details: `Cập nhật cấu hình phân quyền mẫu cho nhóm ${DEFAULT_ROLE_GROUPS[roleGroup]?.name || roleGroup}`
    });
  },

  /**
   * Load customized role group configurations from Firestore
   */
  async loadRoleGroupConfigs(): Promise<void> {
    try {
      const snap = await getDocs(collection(db, ROLE_GROUPS_COLLECTION));
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const data = d.data();
          const code = (data.code || d.id) as RoleGroupCode;
          if (DEFAULT_ROLE_GROUPS[code] && data.permissions) {
            DEFAULT_ROLE_GROUPS[code].permissions = data.permissions;
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
