import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Briefcase, Clock, DollarSign, Heart, Baby, Filter, Star } from 'lucide-react';
import { getJobs, saveJob, unsaveJob, getSavedJobs } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function JobDiscovery() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBorough, setSelectedBorough] = useState('All');
  const [selectedSchedule, setSelectedSchedule] = useState('All');
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch all published jobs
        const allJobs = await getJobs();
        setJobs(allJobs.filter(j => j.status === 'published'));
        
        // Fetch saved jobs for this family
        const saved = await getSavedJobs(familyId);
        setSavedJobIds(saved.map(s => s.job_id));
      } catch (error) {
        console.error('Error loading jobs:', error);
      }
    };
    loadData();
  }, []);

  const handleSaveToggle = async (jobId: string) => {
    try {
      if (savedJobIds.includes(jobId)) {
        await unsaveJob(familyId, jobId);
        setSavedJobIds(prev => prev.filter(id => id !== jobId));
      } else {
        await saveJob(familyId, jobId);
        setSavedJobIds(prev => [...prev, jobId]);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBorough = selectedBorough === 'All' || job.location_borough === selectedBorough;
    const matchesSchedule = selectedSchedule === 'All' || job.job_type === selectedSchedule;
    
    return matchesSearch && matchesBorough && matchesSchedule;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Find a Nanny</h1>
          <p className="text-stone-500 mt-1">Browse open positions from trusted agencies across NYC.</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text"
            placeholder="Search by keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <select 
              value={selectedBorough}
              onChange={(e) => setSelectedBorough(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all appearance-none bg-white font-medium text-stone-700"
            >
              <option value="All">All Boroughs</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Brooklyn">Brooklyn</option>
              <option value="Queens">Queens</option>
              <option value="Bronx">The Bronx</option>
              <option value="Staten Island">Staten Island</option>
            </select>
          </div>
          
          <select 
            value={selectedSchedule}
            onChange={(e) => setSelectedSchedule(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white font-medium text-stone-700"
          >
            <option value="All">All Schedules</option>
            <option value="Full-Time">Full-Time</option>
            <option value="Part-Time">Part-Time</option>
            <option value="Temporary">Temporary</option>
            <option value="Live-In">Live-In</option>
          </select>
        </div>

        {(selectedBorough !== 'All' || selectedSchedule !== 'All' || searchTerm !== '') && (
          <button 
            onClick={() => {
              setSelectedBorough('All');
              setSelectedSchedule('All');
              setSearchTerm('');
            }}
            className="text-sm font-medium text-red-500 hover:text-red-600 px-2"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Job Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredJobs.map(job => {
          const isSponsored = job.agency_profiles?.company_name?.toLowerCase().includes('elite') || 
                              job.agency_profiles?.company_name?.toLowerCase().includes('premium') ||
                              job.agency_profiles?.company_name?.toLowerCase().includes('star');
                              
          return (
            <div key={job.id} className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative ${isSponsored ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-stone-200'}`}>
              {isSponsored && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Sponsored
                </div>
              )}
              <div className="p-6 md:p-8 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900 mb-1">{job.title}</h3>
                    <p className="text-sm font-medium text-emerald-600">{job.agency_profiles?.company_name || 'Agency'}</p>
                  </div>
                  <button 
                    onClick={() => handleSaveToggle(job.id)}
                    className={`p-2 rounded-full transition-colors ${
                      savedJobIds.includes(job.id) 
                        ? 'bg-rose-50 text-rose-500' 
                        : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${savedJobIds.includes(job.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  {job.location_neighborhood}, {job.location_borough}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
                  <Briefcase className="h-3.5 w-3.5 mr-1" />
                  {job.job_type}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
                  <DollarSign className="h-3.5 w-3.5 mr-1" />
                  ${job.pay_min}-${job.pay_max}/hr
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-stone-600">
                <div className="flex items-start gap-2">
                  <Baby className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-bold text-stone-900">{job.child_count} Child{job.child_count > 1 ? 'ren' : ''}</span>
                    <span className="text-xs">{job.age_group}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-bold text-stone-900">Schedule</span>
                    <span className="text-xs">{job.schedule}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-stone-600 text-sm line-clamp-3 mb-6">
                {job.description}
              </p>
            </div>
            
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center justify-between mt-auto">
              <div className="text-xs font-medium text-stone-500">
                Starts: {job.start_date}
              </div>
              <Link 
                to={`/family/jobs/${job.id}`}
                className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
          );
        })}
        
        {filteredJobs.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-stone-200 border-dashed">
            <Search className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-stone-900">No jobs found</h3>
            <p className="text-stone-500 mt-1">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
}
