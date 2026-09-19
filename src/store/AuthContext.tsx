import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore user from localStorage if exists, or set default admin
  useEffect(() => {
    try {
      const stored = localStorage.getItem('authUser');
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        // Default to admin user for direct instant access
        const defaultAdmin: User = {
          id: 'admin',
          name: 'Ban Giám Hiệu',
          role: 'BGH',
          username: 'admin',
          position: 'Hiệu trưởng'
        };
        setUser(defaultAdmin);
        localStorage.setItem('authUser', JSON.stringify(defaultAdmin));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const login = async (username: string) => {
    setError(null);
    try {
      const q = query(collection(db, 'teachers'), where('username', '==', username));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const foundUser = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as User;
        setUser(foundUser);
        localStorage.setItem('authUser', JSON.stringify(foundUser));
      } else {
        // Since we removed mock data, if DB is empty we allow a backdoor for testing setup
        if (username === 'admin') {
          let adminAvatar = '';
          try {
            const adminDoc = await getDoc(doc(db, 'settings', 'admin_profile'));
            if (adminDoc.exists()) {
              adminAvatar = adminDoc.data().avatar || '';
            }
          } catch (err) {
            console.warn("Could not fetch admin profile doc:", err);
          }

          const adminUser = {
            id: 'admin',
            name: 'System Admin',
            role: 'BGH',
            username: 'admin',
            avatar: adminAvatar || undefined
          } as User;
          setUser(adminUser);
          localStorage.setItem('authUser', JSON.stringify(adminUser));
        } else {
          setError('Tài khoản không tồn tại. Vui lòng kiểm tra lại. (Mẹo: Nếu database mới tinh, hãy dùng "admin")');
        }
      }
    } catch (e) {
      console.error(e);
      setError('Không thể kết nối cơ sở dữ liệu.');
    }
  };

  const updateUser = async (data: Partial<User>) => {
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, error }}>
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
