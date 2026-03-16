import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Star, ShieldCheck, Calendar, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { getJobs, getApplicationsForNanny } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function NannyDashboard() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState('seeking');
  const [stats, setStats] = useState({
    activeApps: 0,
    shiftScore: 85,
    profileCompletion: 90
  });
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  const nannyId = user?.id || 'f0e9d8c7-b6a5-4321-0987-654321fedcba';

  useEffect(() => {
    const loadData = async () => {
      try {
        const apps = await getApplicationsForNanny(nannyId);
        const activeApps = apps.filter(a => ['applied', 'interview_invited', 'interview_scheduled'].includes(a.status));
        
        setStats(prev => ({
          ...prev,
          activeApps: activeApps.length
        }));

        const jobs = await getJobs();
        // Simple recommendation mock: just take the first two jobs
        setRecommendedJobs(jobs.slice(0, 2));
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Welcome back, Sarah</h1>
          <p className="text-stone-500 mt-1">Here's what's happening with your profile today.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="bg-white border border-stone-200 text-stone-700 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none font-medium shadow-sm"
          >
            <option value="seeking">Actively Seeking</option>
            <option value="open">Open to Offers</option>
            <option value="not_seeking">Not Seeking</option>
          </select>
          <Link to="/nanny/profile" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
            Update Profile
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Star className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">ShiftScore</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.shiftScore}</h2>
              <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Professional</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Profile Completion</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.profileCompletion}%</h2>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
            <Calendar className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Active Apps</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.activeApps}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommended Jobs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">Recommended Jobs</h2>
            <Link to="/nanny/jobs" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</Link>
          </div>

          <div className="space-y-4">
            {recommendedJobs.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center text-stone-500">
                No recommended jobs at the moment.
              </div>
            ) : (
              recommendedJobs.map((job, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={job.id} 
                  className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{job.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-stone-500 mt-1">
                        <span className="font-medium text-stone-700">{job.agency_profiles?.company_name || 'Agency'}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location_neighborhood}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-600">${job.pay_min} - ${job.pay_max}/hr</div>
                      <div className="text-xs font-medium text-stone-400 uppercase tracking-wider mt-1">{job.job_type}</div>
                    </div>
                  </div>
                  
                  <p className="text-stone-600 text-sm mb-4 line-clamp-2">
                    {job.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {job.special_requirements?.split(',').slice(0, 2).map((req: string) => (
                        <span key={req} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-600">
                          {req.trim()}
                        </span>
                      ))}
                    </div>
                    <Link to="/nanny/jobs" className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors">
                      Apply Now
                    </Link>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Followed Agencies */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Followed Agencies</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=100&h=100" alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-900">Manhattan Elite</p>
                    <p className="text-xs text-stone-500">2 new jobs</p>
                  </div>
                </div>
                <button className="text-stone-400 hover:text-stone-600">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=100&h=100" alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-900">Brooklyn Baby Co.</p>
                    <p className="text-xs text-stone-500">No new jobs</p>
                  </div>
                </div>
                <button className="text-stone-400 hover:text-stone-600">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Link 
              to="/agencies"
              className="block w-full mt-6 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors text-center"
            >
              Find More Agencies
            </Link>
          </div>

          {/* Recent Reviews */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              <div className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-stone-600 italic line-clamp-2">
                  "Sarah was absolutely wonderful with our twins. Always punctual, professional, and so engaging."
                </p>
                <p className="text-xs text-stone-400 mt-2">— The Smith Family (via Manhattan Elite)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
