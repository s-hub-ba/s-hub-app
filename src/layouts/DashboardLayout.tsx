import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Baby, Briefcase, Calendar, User, Bell, LogOut, Search, Users, FileText, CreditCard, LayoutDashboard, Heart, MessageSquare, ShieldAlert, ChevronRight, ChevronDown, AlertTriangle, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import NotificationsDropdown from '../components/NotificationsDropdown';

type AgencyNavItem = {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
};

type AgencyNavGroup = {
  label: string | null;
  items: AgencyNavItem[];
};

export default function DashboardLayout({ role = 'nanny' }: { role?: 'nanny' | 'agency' | 'admin' | 'family' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, role: authRole } = useAuth();
  const [collapsedAgencyGroups, setCollapsedAgencyGroups] = useState<Record<string, boolean>>({
    Recruiting: false,
    Talent: false,
    Account: false,
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuCollapsed, setMobileMenuCollapsed] = useState<Record<string, boolean>>({});

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const nannyNav = [
    { name: 'Dashboard', href: '/nanny/dashboard', icon: LayoutDashboard },
    { name: 'Calendar', href: '/nanny/calendar', icon: Calendar },
    { name: 'Jobs', href: '/nanny/jobs', icon: Briefcase },
    { name: 'Applications', href: '/nanny/applications', icon: FileText },
    { name: 'Talent Pools', href: '/nanny/talent-pools', icon: Users },
    { name: 'Development', href: '/nanny/development', icon: ShieldAlert },
    { name: 'Profile', href: '/nanny/profile', icon: User },
  ];

  const allAgencyNavGroups: AgencyNavGroup[] = [
    {
      label: null,
      items: [
        { name: 'Home', href: '/agency/dashboard', icon: LayoutDashboard },
        { name: 'Calendar', href: '/agency/calendar', icon: Calendar },
      ],
    },
    {
      label: 'Recruiting',
      items: [
        { name: 'Jobs', href: '/agency/jobs', icon: Briefcase },
        { name: 'Applications', href: '/agency/applications', icon: FileText },
        { name: 'Emergency Mode', href: '/agency/emergency', icon: AlertTriangle },
        { name: 'Family Requests', href: '/agency/family-requests', icon: MessageSquare, adminOnly: true },
      ],
    },
    {
      label: 'Talent',
      items: [
        { name: 'Nannies', href: '/agency/search', icon: Search },
        { name: 'Talent Pool', href: '/agency/talent', icon: Users },
        { name: 'Messages', href: '/agency/messages', icon: MessageSquare },
      ],
    },
    {
      label: 'Account',
      items: [
        { name: 'Request Settings', href: '/agency/request-settings', icon: ShieldAlert, adminOnly: true },
        { name: 'Profile', href: '/agency/profile', icon: User, adminOnly: true },
        { name: 'Team Seats', href: '/agency/team', icon: Users, adminOnly: true },
        { name: 'Billing', href: '/agency/billing', icon: CreditCard, adminOnly: true },
        { name: 'Plans & Add-Ons', href: '/agency/subscription', icon: CreditCard, adminOnly: true },
      ],
    },
  ];
  const isAgencyAdmin = authRole === 'agency_admin' || authRole === 'agency';
  const agencyNavGroups = allAgencyNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isAgencyAdmin || !item.adminOnly),
    }))
    .filter((group) => group.items.length > 0);
  const agencyNav = agencyNavGroups.flatMap((g) => g.items);

  const adminNav = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Verification', href: '/admin/verification', icon: ShieldAlert },
    { name: 'BG Audit', href: '/admin/bg-audit', icon: FileText },
    { name: 'Agencies', href: '/admin/agencies', icon: Briefcase },
    { name: 'Users', href: '/admin/users', icon: Users },
  ];

  const familyNav = [
    { name: 'Dashboard', href: '/family/dashboard', icon: LayoutDashboard },
    { name: 'Calendar', href: '/family/calendar', icon: Calendar },
    { name: 'Request Care', href: '/family/request-care', icon: FileText },
    { name: 'Find an Agency', href: '/family/agencies', icon: Search },
    { name: 'Placements', href: '/family/placements', icon: FileText },
    { name: 'Past Care', href: '/family/saved', icon: Heart },
    { name: 'Messages', href: '/family/messages', icon: MessageSquare },
    { name: 'Profile', href: '/family/profile', icon: User },
  ];

  const nav = role === 'agency' ? agencyNav : role === 'admin' ? adminNav : role === 'family' ? familyNav : nannyNav;

  const toggleAgencyGroup = (label: string) => {
    setCollapsedAgencyGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const agencyRoleBadge = role === 'agency'
    ? (authRole === 'agency_recruiter'
      ? { label: 'Recruiter', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
      : { label: 'Admin', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' })
    : null;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row font-sans overflow-x-hidden">
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
        
        <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col">
          {role === 'agency' ? (
            agencyNavGroups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                {group.label && (
                  <button
                    type="button"
                    onClick={() => toggleAgencyGroup(group.label as string)}
                    className="w-full px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400 hover:text-stone-600 flex items-center justify-between"
                    aria-expanded={!(collapsedAgencyGroups[group.label as string] && !group.items.some((item) => location.pathname.startsWith(item.href)))}
                  >
                    <span>{group.label}</span>
                    {collapsedAgencyGroups[group.label as string] && !group.items.some((item) => location.pathname.startsWith(item.href)) ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {(!group.label || !collapsedAgencyGroups[group.label] || group.items.some((item) => location.pathname.startsWith(item.href))) && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
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
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-1">
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
          )}
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
        <header className="md:hidden h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sticky top-0 z-30 safe-area-inset-top">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -ml-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Baby className="h-5 w-5 text-white" />
            </div>
            <span className="hidden sm:inline text-lg font-bold tracking-tight text-stone-900">Shift Me Up</span>
          </Link>
          <NotificationsDropdown />
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/20 z-20 top-16"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Slide-out Menu */}
        <nav 
          className={cn(
            "md:hidden fixed left-0 top-16 bottom-16 w-72 bg-white border-r border-stone-200 overflow-y-auto transition-transform duration-300 z-25 transform",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex flex-col h-full p-4">
            {/* Mobile Menu Items */}
            {role === 'agency' ? (
              <div className="space-y-2 flex-1">
                {agencyNavGroups.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuCollapsed(prev => ({
                            ...prev,
                            [group.label as string]: !prev[group.label as string]
                          }));
                        }}
                        className="w-full px-3 py-2 mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400 hover:text-stone-600 flex items-center justify-between"
                      >
                        <span>{group.label}</span>
                        {mobileMenuCollapsed[group.label as string] ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {!mobileMenuCollapsed[group.label as string] && (
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const isActive = location.pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 flex-1">
                {nav.map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
            )}
            <div className="border-t border-stone-200 pt-4">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 w-full transition-colors"
              >
                <LogOut className="h-5 w-5 text-stone-400" />
                Log Out
              </button>
            </div>
          </div>
        </nav>

        {/* Desktop Topbar */}
        <header className="hidden md:flex h-16 bg-white border-b border-stone-200 items-center justify-end px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {agencyRoleBadge && (
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', agencyRoleBadge.cls)}>
                {agencyRoleBadge.label}
              </span>
            )}
            <NotificationsDropdown />
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">
              {role === 'agency' ? 'A' : role === 'family' ? 'F' : 'N'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-6xl mx-auto w-full safe-area-inset-bottom">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav - Only when menu closed */}
        {!isMobileMenuOpen && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-20 safe-area-inset-bottom">
          <div className="flex justify-around items-center h-16">
            {nav.slice(0, 4).map((item) => {
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
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center w-full h-full gap-1 text-stone-500 hover:text-emerald-600 transition-colors"
              title="More options"
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </div>
        </nav>
        )}
      </div>
    </div>
  );
}
