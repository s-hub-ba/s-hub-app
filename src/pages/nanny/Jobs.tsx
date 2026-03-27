import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, Briefcase, Clock, DollarSign, BookmarkPlus, CheckCircle2, Star, AlertCircle, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { getJobs, createApplication, getApplicationsForNanny, getNannyApplicationQuota } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatJobSchedule, toDate } from '../../lib/utils';

export default function NannyJobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<{ isPremium: boolean; monthlyLimit: number | null; used: number; remaining: number | null } | null>(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  
  const nannyId = user?.uid || '';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fetchedJobs, applications, applicationQuota] = await Promise.all([
        getJobs(),
        getApplicationsForNanny(nannyId),
        getNannyApplicationQuota(nannyId),
      ]);

      setJobs(fetchedJobs);
      setAppliedJobIds(new Set(applications.map(a => a.job_id)));
      setQuota(applicationQuota);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const handleApply = async (jobId: string, jobTitle: string) => {
    if (!nannyId) {
      return;
    }

    try {
      setError('');
      await createApplication(jobId, nannyId, 'Applied from job marketplace');
      await loadData();
      console.log('Application submitted successfully!');
    } catch (err: any) {
      setError(err?.message || 'Unable to submit application right now.');
      console.error(err.message);
    }
  };

  const applicationLimitReached = quota?.monthlyLimit !== null && (quota?.remaining ?? 0) <= 0;

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.agency_profiles?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location_neighborhood?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatJobStart = (job: any) => {
    if (job.schedule_type === 'weekly_days') return 'Recurring weekly';
    const startDate = toDate(job.start_date);
    return startDate
      ? `Starts ${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      : 'Start date TBD';
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Job Marketplace</h1>
          <p className="text-stone-500 mt-1">Find premium childcare opportunities across NYC.</p>
        </div>
      </div>

      {quota && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${quota.isPremium ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {quota.isPremium ? <Zap className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
          <div>
            <div className="font-semibold">{quota.isPremium ? 'Premium applications unlocked' : 'Free application quota'}</div>
            <div className="text-sm mt-1">
              {quota.isPremium
                ? 'You can apply to as many jobs as you want while premium is active.'
                : `${quota.used}/${quota.monthlyLimit} free applications used in the last 30 days. ${quota.remaining} remaining before premium is required.`}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          {error}
        </div>
      )}

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
            const isSponsored = job.agency_profiles?.company_name?.toLowerCase().includes('elite') || 
                                job.agency_profiles?.company_name?.toLowerCase().includes('premium') ||
                                job.agency_profiles?.company_name?.toLowerCase().includes('star');
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                key={job.id} 
                className={`bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isSponsored ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-stone-200'}`}
              >
                {isSponsored && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Sponsored
                  </div>
                )}
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

                <div className="mb-6">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-50 border border-stone-200 text-stone-600">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {formatJobSchedule(job)}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-stone-100">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-50 border border-stone-200 text-stone-600">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      {formatJobStart(job)}
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => console.log('Saved job', job.id)}
                      className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center"
                      title="Save Job"
                    >
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
                        disabled={!!applicationLimitReached}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed"
                      >
                        {applicationLimitReached ? 'Upgrade for More Applications' : 'Apply Now'}
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
