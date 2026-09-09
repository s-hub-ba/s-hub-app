import { Outlet, Link } from 'react-router-dom';
import { Baby, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50 safe-area-inset-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <div className="bg-emerald-600 p-2 rounded-xl flex-shrink-0">
                  <Baby className="h-6 w-6 text-white" />
                </div>
                <span className="hidden sm:inline text-lg sm:text-xl font-bold tracking-tight text-stone-900">Shift Me Up</span>
              </Link>
            </div>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              <Link to="/for-nannies" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors whitespace-nowrap">For Nannies</Link>
              <Link to="/for-agencies" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors whitespace-nowrap">For Agencies</Link>
              <div className="flex items-center gap-3 lg:gap-4 ml-2 lg:ml-4">
                <Link to="/login" className="text-sm font-medium text-stone-900 hover:text-emerald-700 transition-colors">Log In</Link>
                <Link to="/join" className="text-sm font-medium bg-emerald-600 text-white px-3 lg:px-4 py-2 rounded-full hover:bg-emerald-700 transition-colors shadow-sm">
                  Join Free
                </Link>
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center -mr-2">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-stone-500 hover:text-stone-900 focus:outline-none p-2"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-stone-200 safe-area-inset-bottom">
            <div className="px-4 pt-2 pb-4 space-y-2">
              <Link to="/for-nannies" className="block px-4 py-3 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors">For Nannies</Link>
              <Link to="/for-agencies" className="block px-4 py-3 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors">For Agencies</Link>
              <Link to="/login" className="block px-4 py-3 text-base font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors">Log In</Link>
              <Link to="/join" className="block px-4 py-3 text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors font-semibold text-center">Join Free</Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow safe-area-inset-bottom">
        <Outlet />
      </main>

      <footer className="bg-stone-900 text-stone-500 py-8 sm:py-12 border-t border-stone-800/70 safe-area-inset-bottom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Baby className="h-6 w-6 text-emerald-500" />
              <span className="text-lg sm:text-xl font-bold text-white tracking-tight">Shift Me Up</span>
            </div>
            <p className="text-xs sm:text-sm max-w-xs text-stone-500/90">
              The operating system for NYC childcare agencies.
            </p>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-3">Platform</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><Link to="/for-nannies" className="hover:text-white transition-colors">For Nannies</Link></li>
              <li><Link to="/for-agencies" className="hover:text-white transition-colors">For Agencies</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-3">Legal</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-stone-800 text-xs sm:text-sm text-center lg:text-left flex flex-col lg:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Shift Me Up. All rights reserved.</p>
          <p>Made for NYC.</p>
        </div>
      </footer>
    </div>
  );
}
