import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: 'nanny' | 'agency_admin' | 'agency_recruiter' | 'superadmin' | 'family' | null;
  loading: boolean;
  loginMock: (role: 'nanny' | 'agency_admin' | 'superadmin' | 'family') => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  loginMock: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthContextType['role']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        // Don't clear role if we are using mock login
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (!error && data) {
        setRole(data.role as AuthContextType['role']);
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
    
    setUser({ id: mockId, email: 'mock@example.com' } as User);
    setRole(mockRole);
    setLoading(false);
  };

  const logout = async () => {
    if (user?.email === 'mock@example.com') {
      setUser(null);
      setRole(null);
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, loginMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
