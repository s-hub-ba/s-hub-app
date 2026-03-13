import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Baby, Building2, User, ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Join() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') as 'nanny' | 'agency' | 'family' | null;
  const [role, setRole] = useState<'nanny' | 'agency' | 'family' | null>(initialRole);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (role === 'nanny') {
      navigate('/join/nanny');
    } else if (role === 'agency') {
      navigate('/join/agency');
    } else if (role === 'family') {
      navigate('/join/family');
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
          Join Shift Me Up
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
          <div className="space-y-4">
            <button
              onClick={() => setRole('nanny')}
              className={cn(
                "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                role === 'nanny' 
                  ? "border-emerald-500 bg-emerald-50" 
                  : "border-stone-200 hover:border-emerald-200 hover:bg-stone-50"
              )}
            >
              <div className={cn(
                "p-3 rounded-xl",
                role === 'nanny' ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-500"
              )}>
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className={cn("font-bold text-lg", role === 'nanny' ? "text-emerald-900" : "text-stone-900")}>
                  I'm a Nanny
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  Find premium jobs, build your profile, and connect with top NYC agencies.
                </p>
              </div>
            </button>

            <button
              onClick={() => setRole('agency')}
              className={cn(
                "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                role === 'agency' 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-stone-200 hover:border-blue-200 hover:bg-stone-50"
              )}
            >
              <div className={cn(
                "p-3 rounded-xl",
                role === 'agency' ? "bg-blue-100 text-blue-600" : "bg-stone-100 text-stone-500"
              )}>
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className={cn("font-bold text-lg", role === 'agency' ? "text-blue-900" : "text-stone-900")}>
                  I'm an Agency
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  Manage your talent pool, post jobs, and discover verified NYC nannies.
                </p>
              </div>
            </button>
            <button
              onClick={() => setRole('family')}
              className={cn(
                "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                role === 'family' 
                  ? "border-purple-500 bg-purple-50" 
                  : "border-stone-200 hover:border-purple-200 hover:bg-stone-50"
              )}
            >
              <div className={cn(
                "p-3 rounded-xl",
                role === 'family' ? "bg-purple-100 text-purple-600" : "bg-stone-100 text-stone-500"
              )}>
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className={cn("font-bold text-lg", role === 'family' ? "text-purple-900" : "text-stone-900")}>
                  I'm a Family
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  Find the perfect nanny for your family through our network of top NYC agencies.
                </p>
              </div>
            </button>
          </div>

          <div className="mt-8">
            <button
              onClick={handleContinue}
              disabled={!role}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-stone-900 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-stone-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Secure, verified network for NYC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
