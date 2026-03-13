import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, DollarSign, Briefcase, Trash2 } from 'lucide-react';
import { getSavedJobs, unsaveJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SavedJobs() {
  const { user } = useAuth();
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await getSavedJobs(familyId);
        setSavedJobs(saved);
      } catch (error) {
        console.error('Error loading saved jobs:', error);
      }
    };
    loadData();
  }, []);

  const handleUnsave = async (jobId: string) => {
    try {
      await unsaveJob(familyId, jobId);
      setSavedJobs(prev => prev.filter(s => s.job_id !== jobId));
    } catch (error) {
      console.error('Error unsaving job:', error);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Saved Jobs</h1>
          <p className="text-stone-500 mt-1">Keep track of positions you're interested in.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-stone-100">
          {savedJobs.length === 0 ? (
            <div className="p-12 text-center">
              <Heart className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-900">No saved jobs</h3>
              <p className="text-stone-500 mt-1 mb-6">Jobs you save will appear here for easy access.</p>
              <Link 
                to="/family/jobs"
                className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Find Jobs
              </Link>
            </div>
          ) : (
            savedJobs.map(saved => (
              <div key={saved.id} className="p-6 md:p-8 hover:bg-stone-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        {saved.job.status === 'published' ? 'Active' : saved.job.status}
                      </span>
                      <span className="text-sm text-stone-500">
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-stone-900 mb-1">{saved.job.title}</h3>
                    <p className="text-sm font-medium text-emerald-600 mb-4">{saved.job.agency_profiles?.company_name || 'Agency'}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                      <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-stone-400" /> {saved.job.location_neighborhood}, {saved.job.location_borough}</span>
                      <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-stone-400" /> ${saved.job.pay_min}-${saved.job.pay_max}/hr</span>
                      <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-stone-400" /> {saved.job.job_type}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handleUnsave(saved.job.id)}
                      className="p-3 rounded-xl border border-stone-200 text-stone-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors flex items-center justify-center"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <Link 
                      to={`/family/jobs/${saved.job.id}`}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors text-center"
                    >
                      Apply Now
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
