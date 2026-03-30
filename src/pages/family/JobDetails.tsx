import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Briefcase, Clock, DollarSign, Heart, Baby, Calendar, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { getJobById, saveJob, unsaveJob, getSavedJobs, applyToJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatJobSchedule, toDate } from '../../lib/utils';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [message, setMessage] = useState('');
  
  const familyId = user?.uid || '';

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view job details and apply.</div>;
  }

  useEffect(() => {
    const loadData = async () => {
      if (id) {
        try {
          const foundJob = await getJobById(id);
          setJob(foundJob);
          
          const saved = await getSavedJobs(familyId);
          setIsSaved(saved.some((s: any) => s.job_id === id));
        } catch (error) {
          console.error('Error loading job details:', error);
        }
      }
    };
    loadData();
  }, [id]);

  const handleSaveToggle = async () => {
    try {
      if (isSaved) {
        await unsaveJob(familyId, id!);
        setIsSaved(false);
      } else {
        await saveJob(familyId, id!);
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsApplying(true);
    
    try {
      await applyToJob(familyId, id!, job.agency_id);
      setIsApplying(false);
      setHasApplied(true);
    } catch (error) {
      console.error('Error applying to job:', error);
      setIsApplying(false);
    }
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-stone-100">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                  {job.status === 'published' ? 'Active' : job.status}
                </span>
                <span className="text-sm font-medium text-stone-500">
                  Posted {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">{job.title}</h1>
              <p className="text-lg font-medium text-emerald-600 flex items-center gap-2">
                {job.agency_profiles?.company_name || 'Agency'}
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={handleSaveToggle}
                className={`p-3 rounded-xl border transition-colors flex items-center justify-center ${
                  isSaved 
                    ? 'bg-rose-50 border-rose-200 text-rose-500' 
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Heart className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
              </button>
              
              {!hasApplied && (
                <button 
                  onClick={() => document.getElementById('apply-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-colors"
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-100">
          <div className="p-6 md:p-8 space-y-6 col-span-2">
            <div>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Job Description</h2>
              <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Special Requirements</h2>
              <div className="flex flex-wrap gap-2">
                {job.special_requirements?.split(',').map((req: string, i: number) => (
                  <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-700">
                    {req.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-stone-50/50 space-y-6">
            <h3 className="font-bold text-stone-900 uppercase tracking-wider text-sm mb-4">Job Details</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Location</p>
                  <p className="text-sm text-stone-600">{job.location_neighborhood}, {job.location_borough}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Job Type</p>
                  <p className="text-sm text-stone-600">{job.job_type}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Compensation</p>
                  <p className="text-sm text-stone-600">${job.pay_min} - ${job.pay_max} / hour</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Baby className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Children</p>
                  <p className="text-sm text-stone-600">{job.child_count} ({job.age_group})</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Schedule</p>
                  <p className="text-sm text-stone-600">{formatJobSchedule(job)}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Start Date</p>
                  <p className="text-sm text-stone-600">{job.schedule_type === 'weekly_days' ? 'Recurring weekly schedule' : (toDate(job.start_date)?.toLocaleDateString() || 'TBD')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Application Section */}
      <div id="apply-section" className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-stone-100 bg-emerald-50/50">
          <h2 className="text-xl font-bold text-stone-900">Apply for this Position</h2>
          <p className="text-stone-600 text-sm mt-1">
            Your application will be sent directly to {job.agency_profiles?.company_name || 'the agency'}. They will review your profile and contact you if it's a match.
          </p>
        </div>
        
        <div className="p-6 md:p-8">
          {hasApplied ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Application Submitted!</h3>
              <p className="text-stone-600 max-w-md mx-auto">
                We've sent your profile to {job.agency_profiles?.company_name || 'the agency'}. You can track the status of your application in your dashboard.
              </p>
              <button 
                onClick={() => navigate('/family/dashboard')}
                className="mt-6 bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">
                  Message to Agency (Optional)
                </label>
                <textarea 
                  rows={4}
                  placeholder="Introduce your family and explain why you're a great fit for this position..."
                  value={message}
                  onChange={(e) => setMessage((e.target as HTMLInputElement).value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none bg-stone-50"
                ></textarea>
              </div>
              
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-stone-600">
                  By applying, you agree to share your family profile with {job.agency_profiles?.company_name || 'the agency'}. Your exact address and contact information will remain hidden until you approve a connection.
                </p>
              </div>
              
              <div className="flex justify-end">
                <button 
                  type="submit"
                  disabled={isApplying}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {isApplying ? (
                    'Sending Application...'
                  ) : (
                    <>Submit Application <Send className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
