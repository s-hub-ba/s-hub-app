import { useEffect, useRef, useState } from 'react';
import { Search, Filter, ShieldCheck, MoreHorizontal, User, Building2, Copy, Check, Eye, UserX, UserCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { getUsers, updateAdminUser, type AppUserRole, type AppUserStatus } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatJoinedDate(value: any): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : 'Unknown';
}

function roleBadge(user: any) {
  if (user.role === 'nanny') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700">
        <User className="h-3.5 w-3.5 mr-1" /> Nanny
      </span>
    );
  }

  if (user.role === 'agency_admin') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
        <Building2 className="h-3.5 w-3.5 mr-1" /> Agency Admin
      </span>
    );
  }

  if (user.role === 'agency_recruiter') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">
        <Building2 className="h-3.5 w-3.5 mr-1" /> Recruiter
      </span>
    );
  }

  if (user.role === 'family') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">
        <User className="h-3.5 w-3.5 mr-1" /> Family
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700">
      {String(user.role || 'Unknown')}
    </span>
  );
}

function statusBadge(status: AppUserStatus | string | undefined) {
  const resolvedStatus = status === 'inactive' ? 'inactive' : 'active';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${resolvedStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> {resolvedStatus === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: 'family', label: 'Family' },
  { value: 'nanny', label: 'Nanny' },
  { value: 'agency_admin', label: 'Agency Admin' },
  { value: 'agency_recruiter', label: 'Agency Recruiter' },
  { value: 'superadmin', label: 'Superadmin' },
];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppUserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AppUserStatus>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppUserRole>('family');
  const [selectedStatus, setSelectedStatus] = useState<AppUserStatus>('active');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    try {
      const userData = await getUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuUserId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    const roleMatches = roleFilter === 'all' || user.role === roleFilter;
    const resolvedStatus = (user.status === 'inactive' ? 'inactive' : 'active') as AppUserStatus;
    const statusMatches = statusFilter === 'all' || resolvedStatus === statusFilter;
    if (!query) return roleMatches && statusMatches;

    const searchMatches = [user.email, user.role, user.id]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
      .includes(query);

    return roleMatches && statusMatches && searchMatches;
  });

  const handleCopy = async (label: string, value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 1500);
      setActiveMenuUserId(null);
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error);
    }
  };

  const openUserModal = (user: any) => {
    setSelectedUser(user);
    setSelectedRole((user.role || 'family') as AppUserRole);
    setSelectedStatus((user.status || 'active') as AppUserStatus);
    setUserActionError(null);
    setActiveMenuUserId(null);
  };

  const handleQuickStatusToggle = async (userRecord: any) => {
    if (!userRecord?.id || isSavingUser) return;
    if (currentUser?.uid === userRecord.id) {
      setUserActionError('You cannot deactivate your own admin account from this screen.');
      setActiveMenuUserId(null);
      return;
    }

    const nextStatus: AppUserStatus = (userRecord.status || 'active') === 'active' ? 'inactive' : 'active';
    if (nextStatus === 'inactive') {
      const confirmed = window.confirm(`Deactivate ${userRecord.email || 'this user'}? They will no longer be able to sign in through the app.`);
      if (!confirmed) {
        setActiveMenuUserId(null);
        return;
      }
    }

    setIsSavingUser(true);
    setUserActionError(null);
    try {
      const updated = await updateAdminUser(userRecord.id, { status: nextStatus });
      if (!updated) {
        setUserActionError('Unable to update user status right now.');
        return;
      }

      setUsers((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry));
      if (selectedUser?.id === updated.id) {
        setSelectedUser(updated);
        setSelectedStatus((updated.status || 'active') as AppUserStatus);
      }
      setActiveMenuUserId(null);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser?.id || isSavingUser) return;
    if (currentUser?.uid === selectedUser.id && selectedStatus === 'inactive') {
      setUserActionError('You cannot deactivate your own admin account from this screen.');
      return;
    }

    const currentStatus = (selectedUser.status || 'active') as AppUserStatus;
    if (currentStatus !== 'inactive' && selectedStatus === 'inactive') {
      const confirmed = window.confirm(`Deactivate ${selectedUser.email || 'this user'}? They will no longer be able to sign in through the app.`);
      if (!confirmed) return;
    }

    setIsSavingUser(true);
    setUserActionError(null);
    try {
      const updated = await updateAdminUser(selectedUser.id, {
        role: selectedRole,
        status: selectedStatus,
      });

      if (!updated) {
        setUserActionError('Unable to save user changes right now.');
        return;
      }

      setUsers((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry));
      setSelectedUser(updated);
      setSelectedRole(updated.role);
      setSelectedStatus((updated.status || 'active') as AppUserStatus);
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">User Management</h1>
          <p className="text-stone-500 mt-1">Manage global platform users and roles.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search users by name or email..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium bg-white">
          <Filter className="h-4 w-4" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter((e.target as HTMLInputElement).value as 'all' | AppUserRole)}
            className="bg-transparent outline-none cursor-pointer"
          >
            <option value="all">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium bg-white">
          <ShieldCheck className="h-4 w-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target as HTMLInputElement).value as 'all' | AppUserStatus)}
            className="bg-transparent outline-none cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredUsers.map((user, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  key={user.id} 
                  className="hover:bg-stone-50/50 transition-colors group"
                >
                  <td className="p-4 pl-6">
                    <div className="font-bold text-stone-900">{user.email}</div>
                  </td>
                  <td className="p-4">
                    {roleBadge(user)}
                  </td>
                  <td className="p-4">
                    {statusBadge(user.status)}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{formatJoinedDate(user.created_at)}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="relative inline-flex" ref={activeMenuUserId === user.id ? menuRef : null}>
                      <button 
                        type="button"
                        onClick={() => setActiveMenuUserId((current) => current === user.id ? null : user.id)}
                        className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>

                      {activeMenuUserId === user.id ? (
                        <div className="absolute right-0 top-11 z-20 w-48 rounded-2xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => openUserModal(user)}
                            className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between"
                          >
                            <span>Open details</span>
                            <Eye className="h-4 w-4 text-stone-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy('email', String(user.email || ''))}
                            className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between border-t border-stone-100"
                          >
                            <span>Copy email</span>
                            {copiedField === 'email' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-stone-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy('user-id', String(user.id || ''))}
                            className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between border-t border-stone-100"
                          >
                            <span>Copy user ID</span>
                            {copiedField === 'user-id' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-stone-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusToggle(user)}
                            className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between border-t border-stone-100"
                          >
                            <span>{(user.status || 'active') === 'active' ? 'Deactivate user' : 'Reactivate user'}</span>
                            {(user.status || 'active') === 'active' ? <UserX className="h-4 w-4 text-stone-400" /> : <UserCheck className="h-4 w-4 text-stone-400" />}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl overflow-hidden"
          >
            {/* Dark admin header */}
            <div className="relative bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900 px-6 pt-8 pb-10 overflow-hidden">
              <button
                type="button"
                onClick={() => { setSelectedUser(null); setUserActionError(null); }}
                className="absolute top-4 right-4 p-2 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Admin — User Details</p>
                  <h2 className="text-xl font-bold text-white leading-tight break-all">{selectedUser.email || 'Unknown'}</h2>
                  <div className="mt-1">{roleBadge(selectedUser)}</div>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[65vh] overflow-y-auto">
              {userActionError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{userActionError}</div>
              ) : null}

              {/* Info tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">User ID</div>
                  <div className="mt-1.5 text-sm font-semibold text-stone-900 break-all">{selectedUser.id}</div>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Joined</div>
                  <div className="mt-1.5 text-sm font-semibold text-stone-900">{formatJoinedDate(selectedUser.created_at)}</div>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Status</div>
                  <div className="mt-1.5">{statusBadge(selectedUser.status)}</div>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Role</div>
                  <div className="mt-1.5">{roleBadge(selectedUser)}</div>
                </div>
              </div>
              {/* Edit controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Change Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole((e.target as HTMLInputElement).value as AppUserRole)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Account Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus((e.target as HTMLInputElement).value as AppUserStatus)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setSelectedUser(null); setUserActionError(null); }}
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={isSavingUser}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-stone-800 to-stone-700 text-white font-bold shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isSavingUser ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
