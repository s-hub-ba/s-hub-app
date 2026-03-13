import { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, FileText, Star, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { getApplicationsForAgency, updateApplicationStatus } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = {
  applied: 'bg-stone-100 text-stone-700',
  reviewing: 'bg-blue-100 text-blue-700',
  interview_invited: 'bg-orange-100 text-orange-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-stone-200 text-stone-500'
};

const STATUS_LABELS = {
  applied: 'New',
  reviewing: 'Reviewing',
  interview_invited: 'Interview Invited',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export default function AgencyApplications() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [applications, setApplications] = useState<any[]>([]);

  const agencyId = user?.id || 'a1b2c3d4-e5f6-7890-1234-56789abcdef0';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fetchedApps = await getApplicationsForAgency(agencyId);
      const enrichedApps = fetchedApps.map((app: any) => ({
        ...app,
        nanny_name: app.nanny_profiles ? `${app.nanny_profiles.first_name} ${app.nanny_profiles.last_name}` : 'Unknown Applicant',
        job_title: app.jobs?.title || 'Unknown Job'
      }));
      setApplications(enrichedApps);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      await updateApplicationStatus(appId, newStatus);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredApps = applications.filter(app => 
    app.nanny_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Applications</h1>
          <p className="text-stone-500 mt-1">Review and manage candidates for your open jobs.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search applicants or jobs..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Job Filter
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Applicant</th>
                <th className="p-4">Job</th>
                <th className="p-4">Status</th>
                <th className="p-4">Applied Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    No applications found.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={app.id} 
                    className="hover:bg-stone-50/50 transition-colors group"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border border-stone-300">
                          {app.nanny_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-1">
                            {app.nanny_name}
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="text-xs font-bold text-stone-700">95</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-stone-400" />
                        <span className="text-sm font-medium text-stone-700">{app.job_title}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <select 
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border border-transparent hover:border-stone-200 outline-none cursor-pointer appearance-none ${STATUS_COLORS[app.status as keyof typeof STATUS_COLORS]}`}
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key} className="bg-white text-stone-900">{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-stone-600">
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
