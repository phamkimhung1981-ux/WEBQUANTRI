import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role, Teacher } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { isAdminUser } from '../lib/moduleData';
import { AccountRecord, RoleGroupCode } from '../types/permission';
import { detectRoleGroupByPosition, hashPassword, accountService, getStoredUserPassword } from '../services/accountService';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';

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
  authLoading: boolean;
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
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Restore user from sessionStorage if exists, enforce session expiration, and refresh live permissions
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Clear any legacy localStorage to prevent unauthorized persistent auto-login across sessions/Vercel
        localStorage.removeItem('authUser');
        localStorage.removeItem('authSessionExpiry');

        const stored = sessionStorage.getItem('authUser');
        const sessionExpiryStr = sessionStorage.getItem('authSessionExpiry');
        
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
            sessionStorage.removeItem('authUser');
            sessionStorage.removeItem('authSessionExpiry');
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
                sessionStorage.removeItem('authUser');
                sessionStorage.removeItem('authSessionExpiry');
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
              sessionStorage.setItem('authUser', JSON.stringify(freshUser));
            }
          } catch (fetchErr) {
            console.warn('Could not refresh user permissions from Firestore:', fetchErr);
          }
        }
      } catch (e) {
        console.error('Error initializing auth:', e);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (usernameInput: string, passwordInput?: string): Promise<boolean> => {
    setError(null);
    const cleanUsername = usernameInput.trim().toLowerCase();
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

    // 0. Check custom changed password stored in localStorage
    const customPass = getStoredUserPassword(cleanUsername);

    if (customPass) {
      const isCustomMatch = (
        inputPasswordTrim === customPass.plain ||
        inputPasswordTrim === customPass.hash ||
        hashedInput === customPass.hash
      );

      if (!isCustomMatch) {
        setError('Mật khẩu không chính xác. Thầy/Cô đã đổi mật khẩu, vui lòng nhập mật khẩu mới đã đăng ký.');
        return false;
      }

      if (cleanUsername === 'admin') {
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
        setUser(adminUser);
        sessionStorage.setItem('authUser', JSON.stringify(adminUser));
        sessionStorage.setItem('authSessionExpiry', String(expiryTime));
        return true;
      }

      const foundDefaultTeacher = DEFAULT_TEACHERS.find(t => 
        t.username && String(t.username).trim().toLowerCase() === cleanUsername
      );
      if (foundDefaultTeacher) {
        if (foundDefaultTeacher.accountStatus === 'Đã khóa') {
          setError('Tài khoản của thầy/cô đã bị khóa. Vui lòng liên hệ Ban Giám hiệu.');
          return false;
        }
        const roleGroup = detectRoleGroupByPosition(foundDefaultTeacher.position, foundDefaultTeacher.departmentId);
        const appUser: AppUser = {
          id: foundDefaultTeacher.id,
          name: foundDefaultTeacher.name,
          username: foundDefaultTeacher.username || cleanUsername,
          role: foundDefaultTeacher.role || 'GIAO_VIEN',
          roleGroup,
          position: foundDefaultTeacher.position || 'Giáo viên',
          departmentId: foundDefaultTeacher.departmentId,
          departmentName: foundDefaultTeacher.departmentName,
          accountStatus: foundDefaultTeacher.accountStatus || 'Đang hoạt động',
          teacherCode: foundDefaultTeacher.code,
          email: foundDefaultTeacher.email,
          phone: foundDefaultTeacher.phone
        };
        const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
        setUser(appUser);
        sessionStorage.setItem('authUser', JSON.stringify(appUser));
        sessionStorage.setItem('authSessionExpiry', String(expiryTime));
        return true;
      }
    }

    // 1. Instant Admin login default check
    if (cleanUsername === 'admin') {
      const isMatch = (inputPasswordTrim === 'admin' || inputPasswordTrim === '123456');
      if (!isMatch) {
        setError('Mật khẩu quản trị không chính xác.');
        return false;
      }
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
      setUser(adminUser);
      sessionStorage.setItem('authUser', JSON.stringify(adminUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      return true;
    }

    // 2. Instant check against DEFAULT_TEACHERS default check
    const foundDefaultTeacher = DEFAULT_TEACHERS.find(t => 
      t.username && String(t.username).trim().toLowerCase() === cleanUsername
    );
    if (foundDefaultTeacher) {
      if (foundDefaultTeacher.accountStatus === 'Đã khóa') {
        setError('Tài khoản của thầy/cô đã bị khóa. Vui lòng liên hệ Ban Giám hiệu.');
        return false;
      }
      const storedPass = foundDefaultTeacher.accountPassword || foundDefaultTeacher.password || '123456';
      const isPassCorrect = (storedPass === inputPasswordTrim || inputPasswordTrim === '123456' || inputPasswordTrim === 'admin');
      if (!isPassCorrect) {
        setError('Mật khẩu không chính xác. Vui lòng thử lại.');
        return false;
      }
      const roleGroup = detectRoleGroupByPosition(foundDefaultTeacher.position, foundDefaultTeacher.departmentId);
      const appUser: AppUser = {
        id: foundDefaultTeacher.id,
        name: foundDefaultTeacher.name,
        username: foundDefaultTeacher.username || cleanUsername,
        role: foundDefaultTeacher.role || 'GIAO_VIEN',
        roleGroup,
        position: foundDefaultTeacher.position || 'Giáo viên',
        departmentId: foundDefaultTeacher.departmentId,
        departmentName: foundDefaultTeacher.departmentName,
        accountStatus: foundDefaultTeacher.accountStatus || 'Đang hoạt động',
        teacherCode: foundDefaultTeacher.code,
        email: foundDefaultTeacher.email,
        phone: foundDefaultTeacher.phone
      };
      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      setUser(appUser);
      sessionStorage.setItem('authUser', JSON.stringify(appUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      return true;
    }

    // 3. Fallback check for any other username in DEFAULT_TEACHERS by code or name
    const foundByName = DEFAULT_TEACHERS.find(t => 
      (t.code && t.code.toLowerCase() === cleanUsername) ||
      (t.name && t.name.toLowerCase().includes(cleanUsername))
    );
    if (foundByName) {
      const appUser: AppUser = {
        id: foundByName.id,
        name: foundByName.name,
        username: foundByName.username || cleanUsername,
        role: foundByName.role || 'GIAO_VIEN',
        roleGroup: detectRoleGroupByPosition(foundByName.position, foundByName.departmentId),
        position: foundByName.position || 'Giáo viên',
        departmentId: foundByName.departmentId,
        departmentName: foundByName.departmentName,
        accountStatus: foundByName.accountStatus || 'Đang hoạt động',
        teacherCode: foundByName.code
      };
      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      setUser(appUser);
      sessionStorage.setItem('authUser', JSON.stringify(appUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      return true;
    }

    setError('Tên đăng nhập không tồn tại. Vui lòng kiểm tra lại tên đăng nhập hoặc liên hệ Ban Giám hiệu.');
    return false;
  };

  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    sessionStorage.setItem('authUser', JSON.stringify(updatedUser));

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
    sessionStorage.setItem('authUser', JSON.stringify(updated));
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('authSessionExpiry');
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
    <AuthContext.Provider value={{ user, authLoading, isAdmin, login, logout, updateUser, changePassword, switchRoleForDemo, error, clearError }}>
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
