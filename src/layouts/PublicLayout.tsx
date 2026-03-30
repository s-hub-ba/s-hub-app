import { Outlet, Link } from 'react-router-dom';
import { Baby, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="bg-emerald-600 p-2 rounded-xl">
                  <Baby className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-stone-900">Shift Me Up</span>
              </Link>
            </div>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/agencies" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Find Agencies</Link>
              <Link to="/for-nannies" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">For Nannies</Link>
              <Link to="/for-agencies" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">For Agencies</Link>
              <div className="flex items-center gap-4 ml-4">
                <Link to="/login" className="text-sm font-medium text-stone-900 hover:text-emerald-700 transition-colors">Log In</Link>
                <Link to="/join" className="text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-full hover:bg-emerald-700 transition-colors shadow-sm">
                  Join Free
                </Link>
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-stone-500 hover:text-stone-900 focus:outline-none"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-stone-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link to="/agencies" className="block px-3 py-2 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-md">Find Agencies</Link>
              <Link to="/for-nannies" className="block px-3 py-2 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-md">For Nannies</Link>
              <Link to="/for-agencies" className="block px-3 py-2 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-md">For Agencies</Link>
              <Link to="/login" className="block px-3 py-2 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-md">Log In</Link>
              <Link to="/join" className="block px-3 py-2 text-base font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md">Join Free</Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      <footer className="bg-stone-900 text-stone-500 py-12 border-t border-stone-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Baby className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-white tracking-tight">Shift Me Up</span>
            </div>
            <p className="text-sm max-w-xs text-stone-500/90">
              The operating system for NYC childcare agencies.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/agencies" className="hover:text-white transition-colors">Find Agencies</Link></li>
              <li><Link to="/for-nannies" className="hover:text-white transition-colors">For Nannies</Link></li>
              <li><Link to="/for-agencies" className="hover:text-white transition-colors">For Agencies</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-stone-800 text-sm text-center md:text-left flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} Shift Me Up. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Made for NYC.</p>
        </div>
      </footer>
    </div>
  );
}
