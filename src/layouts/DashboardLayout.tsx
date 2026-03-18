import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Baby, Briefcase, Calendar, User, Bell, LogOut, Search, Users, FileText, CreditCard, LayoutDashboard, Heart, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import NotificationsDropdown from '../components/NotificationsDropdown';

export default function DashboardLayout({ role = 'nanny' }: { role?: 'nanny' | 'agency' | 'admin' | 'family' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const nannyNav = [
    { name: 'Dashboard', href: '/nanny/dashboard', icon: LayoutDashboard },
    { name: 'Jobs', href: '/nanny/jobs', icon: Briefcase },
    { name: 'Applications', href: '/nanny/applications', icon: FileText },
    { name: 'Availability', href: '/nanny/availability', icon: Calendar },
    { name: 'Profile', href: '/nanny/profile', icon: User },
  ];

  const agencyNav = [
    { name: 'Dashboard', href: '/agency/dashboard', icon: LayoutDashboard },
    { name: 'Jobs', href: '/agency/jobs', icon: Briefcase },
    { name: 'Applications', href: '/agency/applications', icon: FileText },
    { name: 'Nannies', href: '/agency/search', icon: Search },
    { name: 'Talent Pool', href: '/agency/talent', icon: Users },
    { name: 'Messages', href: '/agency/messages', icon: MessageSquare },
    { name: 'Profile', href: '/agency/profile', icon: User },
    { name: 'Billing', href: '/agency/billing', icon: CreditCard },
  ];

  const adminNav = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Agencies', href: '/admin/agencies', icon: Briefcase },
    { name: 'Users', href: '/admin/users', icon: Users },
  ];

  const familyNav = [
    { name: 'Dashboard', href: '/family/dashboard', icon: LayoutDashboard },
    { name: 'Find an Agency', href: '/family/agencies', icon: Search },
    { name: 'Past Care', href: '/family/saved', icon: Heart },
    { name: 'Messages', href: '/family/messages', icon: MessageSquare },
    { name: 'Profile', href: '/family/profile', icon: User },
  ];

  const nav = role === 'agency' ? agencyNav : role === 'admin' ? adminNav : role === 'family' ? familyNav : nannyNav;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 fixed inset-y-0 z-10">
        <div className="h-16 flex items-center px-6 border-b border-stone-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Baby className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-900">Shift Me Up</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          {nav.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-emerald-600" : "text-stone-400")} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-stone-200">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 w-full transition-colors"
          >
            <LogOut className="h-5 w-5 text-stone-400" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sticky top-0 z-20">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Baby className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-900">Shift Me Up</span>
          </Link>
          <NotificationsDropdown />
        </header>

        {/* Desktop Topbar */}
        <header className="hidden md:flex h-16 bg-white border-b border-stone-200 items-center justify-end px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <NotificationsDropdown />
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">
              {role === 'agency' ? 'A' : role === 'family' ? 'F' : 'N'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 pb-safe z-20">
          <div className="flex justify-around items-center h-16">
            {nav.slice(0, 5).map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-full gap-1",
                    isActive ? "text-emerald-600" : "text-stone-500"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
