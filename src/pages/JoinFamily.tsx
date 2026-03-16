import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Baby, ArrowRight, Mail, Lock, User, Users } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function JoinFamily() {
  const navigate = useNavigate();
  const { loginMock } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    location_borough: 'Manhattan',
    location_neighborhood: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Sign up with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      if (user) {
        // 2. Create the user record in the users collection
        await setDoc(doc(db, 'users', user.uid), {
          email: formData.email,
          role: 'family',
          created_at: serverTimestamp()
        });

        // 3. Create the family record
        await setDoc(doc(db, 'families', user.uid), {
          name: formData.name,
          email: formData.email,
          location_borough: formData.location_borough,
          location_neighborhood: formData.location_neighborhood,
          created_at: serverTimestamp()
        });

        // Navigate to family onboarding
        navigate('/family/onboarding');
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
            <div className="bg-purple-600 p-2 rounded-xl">
              <Users className="h-8 w-8 text-white" />
            </div>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-stone-900">
          Create Family Account
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500">
            Log in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-stone-200 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700">
                Family Name / Full Name
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
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                  placeholder="The Smith Family"
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
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
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
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location_borough" className="block text-sm font-medium text-stone-700">
                Borough
              </label>
              <div className="mt-1">
                <select
                  id="location_borough"
                  name="location_borough"
                  required
                  value={formData.location_borough}
                  onChange={handleChange as any}
                  className="block w-full pl-3 pr-10 py-2.5 border border-stone-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                >
                  <option value="Manhattan">Manhattan</option>
                  <option value="Brooklyn">Brooklyn</option>
                  <option value="Queens">Queens</option>
                  <option value="Bronx">The Bronx</option>
                  <option value="Staten Island">Staten Island</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="location_neighborhood" className="block text-sm font-medium text-stone-700">
                Neighborhood
              </label>
              <div className="mt-1">
                <input
                  id="location_neighborhood"
                  name="location_neighborhood"
                  type="text"
                  required
                  value={formData.location_neighborhood}
                  onChange={handleChange}
                  className="block w-full pl-3 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                  placeholder="e.g. Upper East Side"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
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
                loginMock('family');
                navigate('/family/onboarding');
              }}
              className="w-full py-3 px-4 border border-purple-200 rounded-xl text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              Skip to Onboarding (Demo Mode)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
