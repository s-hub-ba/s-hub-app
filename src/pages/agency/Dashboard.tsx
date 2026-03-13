import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Briefcase, Users, MessageSquare, Star, ArrowRight, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getJobs, getApplicationsForAgency, getNannies, getAgencyById } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AgencyDashboard() {
  const { user } = useAuth();
  const [agency, setAgency] = useState<any>(null);
  const [stats, setStats] = useState({
    activeJobs: 0,
    newApps: 0,
    talentPool: 0,
    inquiries: 3 // Mock static value for now
  });

  const agencyId = user?.id || 'a1b2c3d4-e5f6-7890-1234-56789abcdef0';

  useEffect(() => {
    const loadData = async () => {
      try {
        const agencyData = await getAgencyById(agencyId);
        setAgency(agencyData);
        
        const jobs = await getJobs();
        const agencyJobs = jobs.filter(j => j.agency_id === agencyId);
        
        const apps = await getApplicationsForAgency(agencyId);
        const newApps = apps.filter(a => a.status === 'applied');
        
        const nannies = await getNannies();

        setStats({
          activeJobs: agencyJobs.length,
          newApps: newApps.length,
          talentPool: nannies.length,
          inquiries: 3
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{agency?.company_name || 'Agency Dashboard'}</h1>
          <p className="text-stone-500 mt-1">Here's an overview of your agency's activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/agency/jobs/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Post Job
          </Link>
        </div>
      </div>

      {/* Subscription Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900">Starter Plan Active</h3>
            <p className="text-xs text-blue-700">Your subscription renews on Apr 15, 2026. 1 Recruiter Seat.</p>
          </div>
        </div>
        <Link to="/agency/billing" className="text-sm font-medium text-blue-700 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
          Manage
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Active Jobs</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{stats.activeJobs}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">New Apps</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{stats.newApps}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
              <Star className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Talent Pool</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{stats.talentPool}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Inquiries</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{stats.inquiries}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/agency/search" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 mb-3 transition-colors">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Search Nannies</h3>
              <p className="text-xs text-stone-500">Find talent in the global NYC pool.</p>
            </Link>
            <Link to="/agency/talent/invite" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-blue-100 group-hover:text-blue-600 mb-3 transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Invite Nannies</h3>
              <p className="text-xs text-stone-500">Add your existing roster to Shift Me Up.</p>
            </Link>
          </div>
        </div>

        {/* Recent Parent Inquiries */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">Recent Inquiries</h2>
            <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</button>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">The Johnson Family</h4>
                    <p className="text-xs text-stone-500 mt-0.5">Looking for full-time nanny in Brooklyn</p>
                  </div>
                  <button className="text-stone-400 hover:text-stone-600">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
