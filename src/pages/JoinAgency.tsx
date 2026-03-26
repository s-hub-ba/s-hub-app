import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Baby, ArrowRight, Mail, Lock, Building2, User } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isValidEmail } from '../lib/validation';

export default function JoinAgency() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const agencyName = (formData.get('agencyName') as string).trim();
    const contactName = (formData.get('name') as string).trim();
    const email = (formData.get('email') as string).trim();
    const password = formData.get('password') as string;

    if (!agencyName || !contactName || !email || !password) {
      setError('All fields are required.');
      setIsSubmitting(false);
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid work email address.');
      setIsSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('[JoinAgency] creating account', { email });
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user?.uid) {
        throw new Error('Firebase did not return a user UID.');
      }

      await setDoc(doc(db, 'users', user.uid), {
        email,
        role: 'agency_admin',
        agency_id: user.uid,
        created_at: serverTimestamp()
      });

      await setDoc(doc(db, 'agency_profiles', user.uid), {
        company_name: agencyName,
        contact_person: contactName,
        owner_uid: user.uid,
        created_at: serverTimestamp()
      });

      console.log('[JoinAgency] created Firestore docs for', user.uid);
      window.localStorage.setItem('userRole', 'agency_admin');
      navigate('/agency/dashboard', { replace: true });
    } catch (err: any) {
      console.error('[JoinAgency] signup error', err);
      const code = err.code || '';
      const message = err.message || 'Failed to create account';
      setError(code ? `${code}: ${message}` : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Baby className="h-8 w-8 text-white" />
            </div>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-stone-900">
          Create Agency Account
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
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
              <label htmlFor="agencyName" className="block text-sm font-medium text-stone-700">
                Agency Name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-stone-400" />
                </div>
                  <input
                    id="agencyName"
                    name="agencyName"
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Your agency name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700">
                Your Name
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Work Email
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="jane@agency.com"
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-stone-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-stone-900">
                I agree to the{' '}
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Agency Account'}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
