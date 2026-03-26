import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type AuthContextType = {
  user: User | null;
  role: 'nanny' | 'agency' | 'agency_admin' | 'agency_recruiter' | 'superadmin' | 'family' | null;
  status: 'active' | 'inactive' | null;
  loading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  status: null,
  loading: true,
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AuthContextType['role']>(null);
  const [status, setStatus] = useState<AuthContextType['status']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserRole(firebaseUser.uid);
      } else {
        setRole(null);
        setStatus(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const rawRole = userDoc.data().role as string | undefined;
        const rawStatus = userDoc.data().status as string | undefined;
        // Backward compatibility: legacy accounts may still store role as "agency".
        const resolvedRole = (rawRole === 'agency' ? 'agency_admin' : rawRole) as AuthContextType['role'];
        const resolvedStatus = (rawStatus === 'inactive' ? 'inactive' : 'active') as AuthContextType['status'];

        if (resolvedStatus === 'inactive') {
          window.localStorage.removeItem('userRole');
          setRole(null);
          setStatus('inactive');
          await signOut(auth);
          return;
        }

        setRole(resolvedRole);
        setStatus(resolvedStatus);
        if (resolvedRole) window.localStorage.setItem('userRole', resolvedRole);
        return;
      }
      console.warn('[AuthContext] user record not found for', userId);
      // Assume user is a family if no role is set (for real Firebase auth users)
      setRole('family');
      setStatus('active');
      window.localStorage.setItem('userRole', 'family');
    } catch (err: any) {
      console.error('[AuthContext] Error fetching role:', err);
      const cachedRole = window.localStorage.getItem('userRole');
      if (cachedRole === 'nanny' || cachedRole === 'family' || cachedRole === 'agency' || cachedRole === 'agency_admin' || cachedRole === 'agency_recruiter' || cachedRole === 'superadmin') {
        setRole(cachedRole);
        setStatus('active');
      } else {
        // Default to family for real Firebase users
        setRole('family');
        setStatus('active');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, status, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
