import { useState, useEffect } from 'react';
import { Search, Filter, ShieldCheck, MoreHorizontal, User, Building2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { getUsers } from '../../lib/api';

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadData();
  }, []);

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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Role
        </button>
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
              {users.map((user, index) => (
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
                    {user.role === 'nanny' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700">
                        <User className="h-3.5 w-3.5 mr-1" /> Nanny
                      </span>
                    )}
                    {user.role === 'agency_admin' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                        <Building2 className="h-3.5 w-3.5 mr-1" /> Agency Admin
                      </span>
                    )}
                    {user.role === 'agency_recruiter' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">
                        <Building2 className="h-3.5 w-3.5 mr-1" /> Recruiter
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Active
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{new Date(user.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button 
                      onClick={() => console.log('User actions clicked for', user.id)}
                      className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
