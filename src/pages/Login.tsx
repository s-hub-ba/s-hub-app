import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Baby, Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { loginMock } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Try real Supabase Auth first
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (!authError && data.user) {
        // Real auth succeeded, AuthContext will handle the redirect via onAuthStateChange
        // But we can also force a redirect here if we know the role
        const { data: userData } = await supabase.from('users').select('role').eq('id', data.user.id).single();
        if (userData) {
          if (userData.role === 'family') navigate('/family/dashboard');
          else if (userData.role === 'nanny') navigate('/nanny/dashboard');
          else if (userData.role === 'agency_admin' || userData.role === 'agency_recruiter') navigate('/agency/dashboard');
          else if (userData.role === 'superadmin') navigate('/admin/dashboard');
        }
        setIsLoading(false);
        return;
      }

      // Fallback to mock login for demo accounts
      setTimeout(() => {
        setIsLoading(false);
        if (email.includes('admin@manhattanelite.com') || email.includes('agency')) {
          loginMock('agency_admin');
          navigate('/agency/dashboard');
        } else if (email.includes('admin')) {
          loginMock('superadmin');
          navigate('/admin/dashboard');
        } else if (email.includes('sarah@example.com') || email.includes('nanny')) {
          loginMock('nanny');
          navigate('/nanny/dashboard');
        } else if (email.includes('family')) {
          loginMock('family');
          navigate('/family/dashboard');
        } else {
          setError(authError?.message || 'Invalid login credentials');
        }
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl">
              <Baby className="h-8 w-8 text-white" />
            </div>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-stone-900">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600">
          Or{' '}
          <Link to="/join" className="font-medium text-emerald-600 hover:text-emerald-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-stone-200 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-stone-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-stone-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-emerald-600 hover:text-emerald-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-500">Demo Credentials</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-center">
              <div 
                className="p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors"
                onClick={() => { setEmail('sarah@example.com'); setPassword('password123'); }}
              >
                <span className="block font-semibold text-stone-900 mb-1">Nanny</span>
                <span className="text-stone-500">sarah@example.com</span>
              </div>
              <div 
                className="p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors"
                onClick={() => { setEmail('admin@manhattanelite.com'); setPassword('password123'); }}
              >
                <span className="block font-semibold text-stone-900 mb-1">Agency</span>
                <span className="text-stone-500">admin@manhattanelite.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
