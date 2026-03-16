import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Baby, ArrowRight, Mail, Lock, User } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function JoinNanny() {
  const navigate = useNavigate();
  const { loginMock } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    try {
      // 1. Sign up the user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // 2. Create the user record
        await setDoc(doc(db, 'users', user.uid), {
          email: email,
          role: 'nanny',
          created_at: serverTimestamp()
        });

        // 3. Create the nanny profile
        await setDoc(doc(db, 'nanny_profiles', user.uid), {
          first_name: firstName,
          last_name: lastName,
          created_at: serverTimestamp()
        });

        // Navigate to nanny onboarding
        navigate('/nanny/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
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
          Create Nanny Account
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500">
            Log in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-stone-200 sm:rounded-3xl sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700">
                Full Name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="Sarah Jenkins"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-stone-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-stone-900">
                I agree to the{' '}
                <a href="#" className="font-medium text-emerald-600 hover:text-emerald-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="font-medium text-emerald-600 hover:text-emerald-500">
                  Privacy Policy
                </a>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-400">For Testing</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                loginMock('nanny');
                navigate('/nanny/onboarding');
              }}
              className="w-full py-3 px-4 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              Skip to Onboarding (Demo Mode)
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="w-full inline-flex justify-center py-2.5 px-4 border border-stone-200 rounded-xl shadow-sm bg-white text-sm font-medium text-stone-500 hover:bg-stone-50">
                <span className="sr-only">Sign in with Google</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
              </button>
              <button className="w-full inline-flex justify-center py-2.5 px-4 border border-stone-200 rounded-xl shadow-sm bg-white text-sm font-medium text-stone-500 hover:bg-stone-50">
                <span className="sr-only">Sign in with Apple</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.43.987 3.96.948 1.565-.025 2.613-1.506 3.6-2.955 1.14-1.676 1.61-3.305 1.63-3.387-.024-.012-3.16-1.213-3.181-4.825-.02-3.025 2.47-4.48 2.58-4.54-1.42-2.073-3.62-2.324-4.41-2.368-2.06-.11-4.08 1.31-4.905 1.31zM11.946 5.86c.83-1.006 1.39-2.405 1.23-3.805-1.19.048-2.68.795-3.54 1.81-.76.885-1.43 2.32-1.25 3.69 1.34.104 2.73-.68 3.56-1.695z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
