import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, Briefcase, Clock, DollarSign, BookmarkPlus, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getJobs, createApplication, getApplicationsForNanny } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function NannyJobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  
  const nannyId = user?.id || 'f0e9d8c7-b6a5-4321-0987-654321fedcba';
  const nannyName = 'Sarah Jenkins';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fetchedJobs = await getJobs();
      setJobs(fetchedJobs);
      
      const applications = await getApplicationsForNanny(nannyId);
      setAppliedJobIds(new Set(applications.map(a => a.job_id)));
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const handleApply = async (jobId: string, jobTitle: string) => {
    try {
      await createApplication(jobId, nannyId, 'Cover letter placeholder');
      await loadData();
      alert('Application submitted successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.agency_profiles?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location_neighborhood?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Job Marketplace</h1>
          <p className="text-stone-500 mt-1">Find premium childcare opportunities across NYC.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search jobs by title, agency, or keyword..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center text-stone-500">
            No jobs found matching your search.
          </div>
        ) : (
          filteredJobs.map((job, index) => {
            const hasApplied = appliedJobIds.has(job.id);
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                key={job.id} 
                className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 mt-1.5">
                      <span className="font-bold text-stone-700">{job.agency_profiles?.company_name || 'Agency'}</span>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location_neighborhood}, {job.location_borough}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-1">
                    <div className="flex items-center gap-1 text-lg font-bold text-emerald-600">
                      <DollarSign className="h-5 w-5" />
                      {job.pay_min} - ${job.pay_max}/hr
                    </div>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-600 uppercase tracking-wider">
                        {job.job_type}
                      </span>
                      {job.work_type && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-600 uppercase tracking-wider">
                          {job.work_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-stone-600 text-sm mb-6 line-clamp-2 md:line-clamp-none">
                  {job.description}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-stone-100">
                  <div className="flex flex-wrap gap-2">
                    {job.start_date && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-50 border border-stone-200 text-stone-600">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Starts {new Date(job.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center">
                      <BookmarkPlus className="h-5 w-5" />
                    </button>
                    {hasApplied ? (
                      <button disabled className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Applied
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleApply(job.id, job.title)}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
                      >
                        Apply Now
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
