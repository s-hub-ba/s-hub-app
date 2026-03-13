import { useState, useEffect } from 'react';
import { Search, Filter, Plus, MoreHorizontal, MapPin, Users, Clock, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { getJobs, deleteJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AgencyJobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const { user } = useAuth();
  const agencyId = user?.id || 'a1b2c3d4-e5f6-7890-1234-56789abcdef0';

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const fetchedJobs = await getJobs(agencyId);
      setJobs(fetchedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(id);
        await loadJobs();
      } catch (error) {
        console.error('Error deleting job:', error);
      }
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location_neighborhood?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location_borough?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Manage Jobs</h1>
          <p className="text-stone-500 mt-1">Create and manage your agency's job postings.</p>
        </div>
        <Link to="/agency/jobs/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" />
          Post New Job
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search jobs..." 
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
                <th className="p-4 pl-6">Job Title</th>
                <th className="p-4">Status</th>
                <th className="p-4">Posted Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-500">
                    No jobs found.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={job.id} 
                    className="hover:bg-stone-50/50 transition-colors group"
                  >
                    <td className="p-4 pl-6">
                      <div>
                        <div className="font-bold text-stone-900">{job.title}</div>
                        <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {job.location_neighborhood}, {job.location_borough}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                        job.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-700'
                      }`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-stone-600 text-sm">
                        <Clock className="h-4 w-4 text-stone-400" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button 
                        onClick={() => handleDelete(job.id)}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete Job"
                      >
                        <Trash2 className="h-5 w-5" />
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
