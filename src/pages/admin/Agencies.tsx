import { useState, useEffect } from 'react';
import { Search, Filter, ShieldCheck, ShieldAlert, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { getAgencies } from '../../lib/api';

export default function AdminAgencies() {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencies, setAgencies] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAgencies();
        setAgencies(data);
      } catch (error) {
        console.error('Error loading agencies:', error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Agency Verification</h1>
          <p className="text-stone-500 mt-1">Review and manage agency access to the platform.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search agencies..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Status
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Agency Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Applied Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {agencies.map((agency, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  key={agency.id} 
                  className="hover:bg-stone-50/50 transition-colors group"
                >
                  <td className="p-4 pl-6">
                    <div className="font-bold text-stone-900">{agency.company_name}</div>
                    <div className="text-xs text-stone-500 mt-1">{agency.website || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                    {agency.is_verified ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700">
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{agency.users?.email || 'N/A'}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{agency.users?.created_at ? new Date(agency.users.created_at).toLocaleDateString() : 'N/A'}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {!agency.is_verified ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => console.log('Approved agency', agency.id)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" 
                          title="Approve"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => console.log('Rejected agency', agency.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Reject"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    )}
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
