import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role, Teacher } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { isAdminUser } from '../lib/moduleData';
import { AccountRecord, RoleGroupCode } from '../types/permission';
import { 
  detectRoleGroupByPosition, 
  hashPassword, 
  accountService, 
  getStoredUserPassword, 
  setStoredUserPassword,
  getStoredUserCustomPermissions,
  setStoredUserCustomPermissions,
  syncPermissionsFromServer,
  getLiveUserPermissionsFromFirestore,
  getTeacherKeyAliases
} from '../services/accountService';
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

        // Synchronize canonical & customized permissions from server (ensures web export consistency)
        await syncPermissionsFromServer();

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
        
        // Ensure initialUser has custom permissions from custom_user_permissions_map if missing
        if (!initialUser.hasCustomPermissions || !initialUser.customPermissions) {
          const customMap = getStoredUserCustomPermissions();
          const uId = (initialUser.id || '').toLowerCase().trim();
          const uName = (initialUser.username || '').toLowerCase().trim();
          const uCode = (initialUser.teacherCode || '').toLowerCase().trim();
          
          const aliases = new Set<string>([uId, uName, uCode].filter(Boolean));
          [uId, uName, uCode].filter(Boolean).forEach(k => getTeacherKeyAliases(k).forEach(a => aliases.add(a)));

          let p: any = null;
          for (const alias of Array.from(aliases)) {
            if (customMap[alias] && Object.keys(customMap[alias]).length > 0) {
              p = customMap[alias];
              break;
            }
          }

          if (p && Object.keys(p).length > 0) {
            initialUser.hasCustomPermissions = true;
            initialUser.customPermissions = p;
          }
        }
        setUser(initialUser);

        // Preload any custom role group configurations into memory
        accountService.loadRoleGroupConfigs().catch(() => {});

        // Live refresh from Firestore in background (so F5 never uses stale status or permissions)
        if (initialUser && initialUser.id) {
          try {
            // First check live permissions directly
            const livePerms = await getLiveUserPermissionsFromFirestore(
              initialUser.id,
              initialUser.username,
              initialUser.teacherCode
            );

            let d: any = null;
            const accDoc = await getDoc(doc(db, 'user_accounts', initialUser.id));
            if (accDoc.exists()) {
              d = accDoc.data();
            } else if (initialUser.username) {
              const qAcc = query(collection(db, 'user_accounts'), where('username', '==', initialUser.username.toLowerCase()));
              const snap = await getDocs(qAcc);
              if (!snap.empty) {
                d = snap.docs[0].data();
              }
            }

            if (d) {
              // Check if account has been locked or deactivated
              if (d.status === 'Đã khóa' || d.status === 'Vô hiệu hóa') {
                console.warn(`Tài khoản ${d.username} đang ở trạng thái ${d.status}. Chấm dứt phiên.`);
                setUser(null);
                sessionStorage.removeItem('authUser');
                sessionStorage.removeItem('authSessionExpiry');
                setError(`Tài khoản "${d.username}" đã bị ${d.status.toLowerCase()}. Vui lòng liên hệ Quản trị viên.`);
                return;
              }
            }

            const hasCust = livePerms.hasCustom || !!(d?.hasCustomPermissions || (d?.customPermissions && Object.keys(d.customPermissions).length > 0));
            const custPerm = livePerms.permissions || d?.customPermissions || initialUser.customPermissions || null;

            const freshUser: AppUser = {
              ...initialUser,
              name: d?.fullName || initialUser.name,
              roleGroup: d?.roleGroup || initialUser.roleGroup,
              accountStatus: d?.status || initialUser.accountStatus,
              hasCustomPermissions: hasCust,
              customPermissions: hasCust ? custPerm : undefined,
              position: d?.position || initialUser.position,
              departmentName: d?.departmentName || initialUser.departmentName
            };
            setUser(freshUser);
            sessionStorage.setItem('authUser', JSON.stringify(freshUser));
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

  const doSuccessfulLogin = async (cleanUsername: string, extraDocData?: any): Promise<boolean> => {
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
    const foundByName = !foundDefaultTeacher ? DEFAULT_TEACHERS.find(t => 
      (t.code && t.code.toLowerCase() === cleanUsername) ||
      (t.name && t.name.toLowerCase().includes(cleanUsername))
    ) : null;

    const teacher = foundDefaultTeacher || foundByName;

    if (teacher) {
      if (teacher.accountStatus === 'Đã khóa') {
        setError('Tài khoản của thầy/cô đã bị khóa. Vui lòng liên hệ Ban Giám hiệu.');
        return false;
      }
      const roleGroup = detectRoleGroupByPosition(teacher.position, teacher.departmentId);
      
      const tId = teacher.id;
      const tUser = (teacher.username || cleanUsername).toLowerCase().trim();
      const tCode = teacher.code ? teacher.code.toLowerCase().trim() : '';

      // Direct Firestore fetch of user permissions
      const livePerms = await getLiveUserPermissionsFromFirestore(tId, tUser, tCode);
      const customPermsFromDoc = extraDocData?.customPermissions || null;
      const finalCustomPerms = livePerms.permissions || customPermsFromDoc || null;
      const hasCustom = livePerms.hasCustom || !!(extraDocData?.hasCustomPermissions || (finalCustomPerms && Object.keys(finalCustomPerms).length > 0));

      const appUser: AppUser = {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username || cleanUsername,
        role: teacher.role || 'GIAO_VIEN',
        roleGroup,
        position: teacher.position || 'Giáo viên',
        departmentId: teacher.departmentId,
        departmentName: teacher.departmentName,
        accountStatus: teacher.accountStatus || 'Đang hoạt động',
        teacherCode: teacher.code,
        email: teacher.email,
        phone: teacher.phone,
        hasCustomPermissions: hasCustom,
        customPermissions: hasCustom ? finalCustomPerms : undefined
      };
      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      setUser(appUser);
      sessionStorage.setItem('authUser', JSON.stringify(appUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      return true;
    }

    if (extraDocData) {
      const eId = extraDocData.id || cleanUsername;
      const livePerms = await getLiveUserPermissionsFromFirestore(eId, cleanUsername, extraDocData.teacherCode);
      const finalCustomPerms = livePerms.permissions || extraDocData.customPermissions || null;
      const hasCustom = livePerms.hasCustom || !!(extraDocData.hasCustomPermissions || (finalCustomPerms && Object.keys(finalCustomPerms).length > 0));

      const appUser: AppUser = {
        id: eId,
        name: extraDocData.fullName || extraDocData.name || cleanUsername,
        username: cleanUsername,
        role: extraDocData.role || 'GIAO_VIEN',
        roleGroup: extraDocData.roleGroup || detectRoleGroupByPosition(extraDocData.position, extraDocData.departmentId),
        position: extraDocData.position || 'Giáo viên',
        departmentId: extraDocData.departmentId,
        departmentName: extraDocData.departmentName,
        accountStatus: extraDocData.status || extraDocData.accountStatus || 'Đang hoạt động',
        teacherCode: extraDocData.teacherCode,
        hasCustomPermissions: hasCustom,
        customPermissions: hasCustom ? finalCustomPerms : undefined
      };
      const expiryTime = Date.now() + SESSION_MAX_AGE_MS;
      setUser(appUser);
      sessionStorage.setItem('authUser', JSON.stringify(appUser));
      sessionStorage.setItem('authSessionExpiry', String(expiryTime));
      return true;
    }

    setError('Tài khoản không tồn tại. Vui lòng liên hệ Ban Giám hiệu.');
    return false;
  };

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

    // Sync latest matrix permissions so login immediately receives customized permissions
    await syncPermissionsFromServer();

    let matchedDocData: any = null;

    // 1. Check custom changed password in localStorage cache (0ms instant)
    const customPass = getStoredUserPassword(cleanUsername);
    if (customPass) {
      const isCustomMatch = (
        inputPasswordTrim === customPass.plain ||
        inputPasswordTrim === customPass.hash ||
        hashedInput === customPass.hash
      );

      if (isCustomMatch) {
        return await doSuccessfulLogin(cleanUsername);
      }
    }

    // 2. Query Firestore user_accounts & teachers to check if password was updated on Firestore
    try {
      const checkFirestoreAuthPromise = async (): Promise<boolean> => {
        if (cleanUsername === 'admin') {
          const accAdminDoc = await getDoc(doc(db, 'user_accounts', 'admin'));
          if (accAdminDoc.exists()) {
            matchedDocData = accAdminDoc.data();
          }
        } else {
          const qAcc = query(collection(db, 'user_accounts'), where('username', '==', cleanUsername));
          const snapAcc = await getDocs(qAcc);
          if (!snapAcc.empty) {
            matchedDocData = snapAcc.docs[0].data();
          } else {
            const accDirect = await getDoc(doc(db, 'user_accounts', cleanUsername));
            if (accDirect.exists()) {
              matchedDocData = accDirect.data();
            } else {
              const qTea = query(collection(db, 'teachers'), where('username', '==', cleanUsername));
              const snapTea = await getDocs(qTea);
              if (!snapTea.empty) {
                matchedDocData = snapTea.docs[0].data();
              }
            }
          }
        }

        if (matchedDocData) {
          const storedPass = matchedDocData.password || matchedDocData.accountPassword || matchedDocData.plainPassword;
          const storedPlain = matchedDocData.plainPassword;
          if (storedPass || storedPlain) {
            const isMatch = (
              inputPasswordTrim === storedPass ||
              hashedInput === storedPass ||
              (storedPlain && inputPasswordTrim === storedPlain)
            );
            if (isMatch) {
              // Store locally so subsequent logins are 0ms instant
              setStoredUserPassword(cleanUsername, inputPasswordTrim, hashedInput);
              return true;
            }
          }
        }
        return false;
      };

      const timeoutP = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200));
      const isFirestoreMatched = await Promise.race([checkFirestoreAuthPromise(), timeoutP]);
      if (isFirestoreMatched) {
        return await doSuccessfulLogin(cleanUsername, matchedDocData);
      }
    } catch (e) {
      console.warn('Firestore password check warning:', e);
    }

    // 3. Check default passwords (if password has NOT been changed)
    let isDefaultMatch = false;
    if (cleanUsername === 'admin') {
      if (inputPasswordTrim === 'admin' || inputPasswordTrim === '123456') {
        isDefaultMatch = true;
      }
    } else {
      const foundDefaultTeacher = DEFAULT_TEACHERS.find(t => 
        t.username && String(t.username).trim().toLowerCase() === cleanUsername
      );
      if (foundDefaultTeacher) {
        const storedPass = foundDefaultTeacher.accountPassword || foundDefaultTeacher.password || '123456';
        if (storedPass === inputPasswordTrim || inputPasswordTrim === '123456' || inputPasswordTrim === 'admin') {
          isDefaultMatch = true;
        }
      } else {
        const foundByName = DEFAULT_TEACHERS.find(t => 
          (t.code && t.code.toLowerCase() === cleanUsername) ||
          (t.name && t.name.toLowerCase().includes(cleanUsername))
        );
        if (foundByName) {
          isDefaultMatch = true;
        }
      }
    }

    if (isDefaultMatch) {
      // If user had changed password previously, don't allow default password anymore
      if (customPass) {
        setError('Mật khẩu không chính xác. Thầy/Cô đã thay đổi mật khẩu, vui lòng nhập mật khẩu mới.');
        return false;
      }
      return await doSuccessfulLogin(cleanUsername, matchedDocData);
    }

    // 4. If nothing matched
    if (customPass) {
      setError('Mật khẩu không chính xác. Thầy/Cô đã thay đổi mật khẩu, vui lòng nhập mật khẩu mới.');
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.');
    }
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
    sessionStorage.clear();
    localStorage.removeItem('authUser');
    localStorage.removeItem('authSessionExpiry');
    localStorage.removeItem('custom_user_permissions_map');
    localStorage.removeItem('cached_user_accounts');
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
