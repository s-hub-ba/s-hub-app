import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type AuthContextType = {
  user: User | null;
  role: 'nanny' | 'agency_admin' | 'agency_recruiter' | 'superadmin' | 'family' | null;
  loading: boolean;
  loginMock: (role: 'nanny' | 'agency_admin' | 'superadmin' | 'family') => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  loginMock: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AuthContextType['role']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserRole(firebaseUser.uid);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setRole(userDoc.data().role as AuthContextType['role']);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
    } finally {
      setLoading(false);
    }
  };

  const loginMock = (mockRole: 'nanny' | 'agency_admin' | 'superadmin' | 'family') => {
    let mockId = 'mock-user-id';
    if (mockRole === 'nanny') mockId = 'f0e9d8c7-b6a5-4321-0987-654321fedcba';
    if (mockRole === 'agency_admin') mockId = 'a1b2c3d4-e5f6-7890-1234-56789abcdef0';
    if (mockRole === 'family') mockId = 'f1111111-2222-3333-4444-555555555555';
    
    setUser({ uid: mockId, email: 'mock@example.com' } as User);
    setRole(mockRole);
    setLoading(false);
  };

  const logout = async () => {
    if (user?.email === 'mock@example.com') {
      setUser(null);
      setRole(null);
    } else {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
