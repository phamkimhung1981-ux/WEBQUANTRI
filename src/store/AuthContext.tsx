import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role, Teacher } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { isAdminUser } from '../lib/moduleData';
import { AccountRecord, RoleGroupCode } from '../types/permission';
import { detectRoleGroupByPosition, hashPassword, accountService } from '../services/accountService';

export interface AppUser extends User {
  roleGroup?: RoleGroupCode;
  accountStatus?: 'Đang hoạt động' | 'Đã khóa' | 'Vô hiệu hóa' | 'Chưa có tài khoản';
  hasCustomPermissions?: boolean;
  customPermissions?: any;
  teacherCode?: string;
  departmentName?: string;
  lastLoginAt?: string;
  email?: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  switchRoleForDemo?: (role: Role | RoleGroupCode) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session lifetime: 8 hours of active work
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Restore user from localStorage if exists, enforce session expiration, and refresh live permissions
  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = localStorage.getItem('authUser');
        const sessionExpiryStr = localStorage.getItem('authSessionExpiry');
        
        if (!stored) {
          // Mandatory login: User is null when not authenticated
          setUser(null);
          return;
        }

        // Check session expiration
        if (sessionExpiryStr) {
          const expiry = parseInt(sessionExpiryStr, 10);
          if (Date.now() > expiry) {
            console.warn('User session expired. Logging out.');
            localStorage.removeItem('authUser');
            localStorage.removeItem('authSessionExpiry');
            setUser(null);
            setError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
            return;
          }
        }

        const initialUser: AppUser = JSON.parse(stored);
        setUser(initialUser);

        // Live refresh from Firestore in background (so F5 never uses stale status or permissions)
        if (initialUser && initialUser.id) {
          try {
            const accDoc = await getDoc(doc(db, 'user_accounts', initialUser.id));
            if (accDoc.exists()) {
              const d = accDoc.data();
              // Check if account has been locked or deactivated
              if (d.status === 'Đã khóa' || d.status === 'Vô hiệu hóa') {
                console.warn(`Tài khoản ${d.username} đang ở trạng thái ${d.status}. Chấm dứt phiên.`);
                setUser(null);
                localStorage.removeItem('authUser');
                localStorage.removeItem('authSessionExpiry');
                setError(`Tài khoản "${d.username}" đã bị ${d.status.toLowerCase()}. Vui lòng liên hệ Quản trị viên.`);
                return;
              }

              const freshUser: AppUser = {
                ...initialUser,
                name: d.fullName || initialUser.name,
                roleGroup: d.roleGroup || initialUser.roleGroup,
                accountStatus: d.status || initialUser.accountStatus,
                hasCustomPermissions: !!d.hasCustomPermissions,
                customPermissions: d.customPermissions || null,
                position: d.position || initialUser.position,
                departmentName: d.departmentName || initialUser.departmentName
              };
              setUser(freshUser);
              localStorage.setItem('authUser', JSON.stringify(freshUser));
            }
          } catch (fetchErr) {
            console.warn('Could not refresh user permissions from Firestore:', fetchErr);
          }
        }
      } catch (e) {
        console.error('Error initializing auth:', e);
        setUser(null);
      }
    };

    initAuth();
  }, []);

  const login = async (usernameInput: string, passwordInput?: string): Promise<boolean> => {
    setError(null);
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setError('Vui lòng nhập tên đăng nhập.');
      return false;
    }

    try {
      // 1. First, search in user_accounts collection
      let accountDoc: AccountRecord | null = null;
      try {
        const qAcc = query(collection(db, 'user_accounts'), where('username', '==', cleanUsername.toLowerCase()));
        const snapAcc = await getDocs(qAcc);
        if (!snapAcc.empty) {
          accountDoc = { id: snapAcc.docs[0].id, ...snapAcc.docs[0].data() } as AccountRecord;
        } else {
          // Case-insensitive fallback
          const allAccSnap = await getDocs(collection(db, 'user_accounts'));
          const matched = allAccSnap.docs.find(d => {
            const u = d.data().username;
            return u && String(u).trim().toLowerCase() === cleanUsername.toLowerCase();
          });
          if (matched) {
            accountDoc = { id: matched.id, ...matched.data() } as AccountRecord;
          }
        }
      } catch (err) {
        console.warn('user_accounts query warning:', err);
      }

      // Check account status if found in user_accounts
      if (accountDoc) {
        if (accountDoc.status === 'Đã khóa') {
          setError(`Tài khoản "${accountDoc.username}" đã bị khóa. Lý do: ${accountDoc.lockReason || 'Liên hệ Ban Giám hiệu'}.`);
          return false;
        }
        if (accountDoc.status === 'Vô hiệu hóa') {
          setError(`Tài khoản "${accountDoc.username}" đã bị vô hiệu hóa (chuyển công tác hoặc nghỉ việc).`);
          return false;
        }

        // Verify password if user specified password in account and password was inputted
        if (!passwordInput || !passwordInput.trim()) {
          setError('Vui lòng nhập mật khẩu đăng nhập.');
          return false;
        }

        const hashedInput = await hashPassword(passwordInput.trim());
        const storedPass = accountDoc.password || '123456';
        const isPasswordCorrect = (storedPass === passwordInput.trim() || storedPass === hashedInput);

        if (!isPasswordCorrect) {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.');
          return false;
        }

        // Update last login
        const now = new Date().toISOString();
        try {
          await updateDoc(doc(db, 'user_accounts', accountDoc.id), { lastLoginAt: now });
        } catch (e) {
          // ignore
        }

        const appUser: AppUser = {
          id: accountDoc.id,
          name: accountDoc.fullName,
          username: accountDoc.username,
          role: (accountDoc.roleGroup === 'ADMIN' ? 'admin' : accountDoc.roleGroup) as Role,
          roleGroup: accountDoc.roleGroup,
          position: accountDoc.position,
          departmentId: accountDoc.departmentId,
          departmentName: accountDoc.departmentName,
          accountStatus: accountDoc.status,
          hasCustomPermissions: accountDoc.hasCustomPermissions,
          customPermissions: accountDoc.customPermissions,
          teacherCode: accountDoc.teacherCode,
          lastLoginAt: now,
          email: accountDoc.email,
          phone: accountDoc.phone
        };

        const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser));
        localStorage.setItem('authSessionExpiry', String(expiryTime));
        return true;
      }

      // 2. If not found in user_accounts, fallback to teachers collection
      const qTeacher = query(collection(db, 'teachers'), where('username', '==', cleanUsername));
      let querySnapshot = await getDocs(qTeacher);
      
      if (querySnapshot.empty) {
        const allTeachersSnap = await getDocs(collection(db, 'teachers'));
        const matchedDoc = allTeachersSnap.docs.find(d => {
          const u = d.data().username;
          return u && String(u).trim().toLowerCase() === cleanUsername.toLowerCase();
        });
        if (matchedDoc) {
          querySnapshot = { empty: false, docs: [matchedDoc] } as any;
        }
      }

      if (!querySnapshot.empty) {
        const foundTeacher = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Teacher;
        if (foundTeacher.accountStatus === 'Đã khóa') {
          setError('Tài khoản của thầy/cô đã bị khóa. Vui lòng liên hệ Ban Giám hiệu hoặc Quản trị viên hệ thống.');
          return false;
        }
        if (foundTeacher.accountStatus === 'Chưa có tài khoản' || (!foundTeacher.username && !foundTeacher.hasAccount)) {
          setError('Tài khoản này chưa được kích hoạt. Vui lòng liên hệ Ban Giám hiệu để được cấp tài khoản.');
          return false;
        }

        if (!passwordInput || !passwordInput.trim()) {
          setError('Vui lòng nhập mật khẩu đăng nhập.');
          return false;
        }

        // Check password
        const storedPass = foundTeacher.accountPassword || foundTeacher.password || '123456';
        const hashedInput = await hashPassword(passwordInput.trim());
        const isPasswordCorrect = (storedPass === passwordInput.trim() || storedPass === hashedInput);

        if (!isPasswordCorrect) {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.');
          return false;
        }

        const roleGroup = detectRoleGroupByPosition(foundTeacher.position, foundTeacher.departmentId);
        const appUser: AppUser = {
          id: foundTeacher.id,
          name: foundTeacher.name,
          username: foundTeacher.username || cleanUsername,
          role: foundTeacher.role || 'GIAO_VIEN',
          roleGroup,
          position: foundTeacher.position || 'Giáo viên',
          departmentId: foundTeacher.departmentId,
          departmentName: foundTeacher.departmentName,
          accountStatus: foundTeacher.accountStatus || 'Đang hoạt động',
          hasCustomPermissions: !!(foundTeacher as any).hasCustomPermissions,
          customPermissions: (foundTeacher as any).customPermissions || null,
          teacherCode: foundTeacher.code,
          email: foundTeacher.email,
          phone: foundTeacher.phone
        };

        const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
        setUser(appUser);
        localStorage.setItem('authUser', JSON.stringify(appUser));
        localStorage.setItem('authSessionExpiry', String(expiryTime));
        return true;
      }

      // 3. Admin fallback if cleanUsername is 'admin'
      if (cleanUsername.toLowerCase() === 'admin') {
        if (!passwordInput || !passwordInput.trim()) {
          setError('Vui lòng nhập mật khẩu quản trị.');
          return false;
        }

        let adminAvatar = '';
        let adminName = 'Quản trị viên Hệ thống';
        let adminStoredPass = 'admin';

        try {
          const accAdminDoc = await getDoc(doc(db, 'user_accounts', 'admin'));
          if (accAdminDoc.exists()) {
            const data = accAdminDoc.data();
            if (data.password) adminStoredPass = data.password;
            if (data.fullName) adminName = data.fullName;
          }

          const adminDoc = await getDoc(doc(db, 'settings', 'admin_profile'));
          if (adminDoc.exists()) {
            adminAvatar = adminDoc.data().avatar || '';
            if (adminDoc.data().name) adminName = adminDoc.data().name;
          }
        } catch (err) {
          console.warn("Could not fetch admin profile doc:", err);
        }

        const hashedInput = await hashPassword(passwordInput.trim());
        const isMatch = (adminStoredPass === passwordInput.trim() || adminStoredPass === hashedInput);
        if (!isMatch) {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.');
          return false;
        }

        const adminUser: AppUser = {
          id: 'admin',
          name: adminName,
          role: 'admin',
          roleGroup: 'ADMIN',
          username: 'admin',
          position: 'Quản trị viên',
          departmentName: 'Ban Quản trị',
          accountStatus: 'Đang hoạt động',
          avatar: adminAvatar || undefined
        };

        const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
        setUser(adminUser);
        localStorage.setItem('authUser', JSON.stringify(adminUser));
        localStorage.setItem('authSessionExpiry', String(expiryTime));
        return true;
      }

      setError('Tài khoản không tồn tại. Vui lòng kiểm tra lại tên đăng nhập hoặc liên hệ Ban Giám hiệu.');
      return false;
    } catch (e: any) {
      console.error(e);
      setError('Lỗi kết nối cơ sở dữ liệu: ' + (e?.message || 'Vui lòng thử lại.'));
      return false;
    }
  };

  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('authUser', JSON.stringify(updatedUser));

    try {
      if (user.id === 'admin') {
        const adminRef = doc(db, 'settings', 'admin_profile');
        await setDoc(adminRef, {
          name: updatedUser.name,
          avatar: updatedUser.avatar || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (user.id) {
        const teacherRef = doc(db, 'teachers', user.id);
        const updatePayload: Record<string, any> = {};
        if (data.avatar !== undefined) updatePayload.avatar = data.avatar;
        if (data.name !== undefined) updatePayload.name = data.name;
        if (Object.keys(updatePayload).length > 0) {
          await updateDoc(teacherRef, updatePayload);
        }
      }
    } catch (err) {
      console.warn("Could not sync user profile update to Firestore:", err);
    }
  };

  const changePassword = async (oldPass: string, newPass: string) => {
    if (!user) throw new Error('Vui lòng đăng nhập để đổi mật khẩu.');
    return await accountService.changePassword(user.username, oldPass, newPass, user.name);
  };

  const switchRoleForDemo = (newRole: Role | RoleGroupCode) => {
    if (!user) return;
    const rg = (newRole === 'admin' ? 'ADMIN' : newRole) as RoleGroupCode;
    const updated = {
      ...user,
      role: (newRole === 'admin' ? 'admin' : newRole) as Role,
      roleGroup: rg
    };
    setUser(updated);
    localStorage.setItem('authUser', JSON.stringify(updated));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authUser');
    localStorage.removeItem('authSessionExpiry');
    sessionStorage.clear();
  };

  const isAdmin = Boolean(
    user?.id === 'admin' || 
    user?.username === 'admin' || 
    user?.role === 'admin' || 
    user?.role === 'ADMIN' || 
    user?.roleGroup === 'ADMIN'
  );

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout, updateUser, changePassword, switchRoleForDemo, error, clearError }}>
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
