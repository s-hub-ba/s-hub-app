import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Heart, MessageSquare, Clock, MapPin, DollarSign, CheckCircle2, XCircle, AlertCircle, Baby } from 'lucide-react';
import { getFamilyProfile, getSavedJobs, getFamilyApplications, getConversations } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        const [prof, saved, apps, convos] = await Promise.all([
          getFamilyProfile(familyId),
          getSavedJobs(familyId),
          getFamilyApplications(familyId),
          getConversations(familyId)
        ]);
        setProfile(prof);
        setSavedJobs(saved);
        setApplications(apps);
        setConversations(convos);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };
    loadData();
  }, []);

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Welcome back, {profile.name}</h1>
          <p className="text-stone-500 mt-1">Manage your childcare search and agency connections.</p>
        </div>
        <Link 
          to="/family/jobs"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Briefcase className="h-4 w-4" />
          Find a Nanny
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Active Applications</p>
            <p className="text-3xl font-black text-stone-900">{applications.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Saved Jobs</p>
            <p className="text-3xl font-black text-stone-900">{savedJobs.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Agency Messages</p>
            <p className="text-3xl font-black text-stone-900">{conversations.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Recent Applications */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">Recent Applications</h2>
              <Link to="/family/applications" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </Link>
            </div>
            
            <div className="divide-y divide-stone-100">
              {applications.length === 0 ? (
                <div className="p-8 text-center">
                  <Briefcase className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-900">No applications yet</h3>
                  <p className="text-stone-500 mt-1 mb-6">Start applying to jobs to connect with agencies.</p>
                  <Link 
                    to="/family/jobs"
                    className="inline-flex bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
                  >
                    Browse Jobs
                  </Link>
                </div>
              ) : (
                applications.slice(0, 3).map(app => (
                  <div key={app.id} className="p-6 hover:bg-stone-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-stone-900 mb-1">{app.job.title}</h3>
                      <p className="text-sm text-stone-500 flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {app.job.location_neighborhood}, {app.job.location_borough}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        app.status === 'interviewing' ? 'bg-blue-100 text-blue-700' :
                        app.status === 'hired' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-stone-100 text-stone-700'
                      }`}>
                        {app.status === 'pending' && <Clock className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'interviewing' && <MessageSquare className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'hired' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                      <Link 
                        to={`/family/jobs/${app.job.id}`}
                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        View Job
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Saved Jobs */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">Saved Jobs</h2>
              <Link to="/family/saved" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </Link>
            </div>
            
            <div className="divide-y divide-stone-100">
              {savedJobs.length === 0 ? (
                <div className="p-8 text-center">
                  <Heart className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-900">No saved jobs</h3>
                  <p className="text-stone-500 mt-1">Jobs you save will appear here for easy access.</p>
                </div>
              ) : (
                savedJobs.slice(0, 3).map(saved => (
                  <div key={saved.id} className="p-6 hover:bg-stone-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-stone-900 mb-1">{saved.job.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-stone-500">
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {saved.job.location_neighborhood}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> ${saved.job.pay_min}-${saved.job.pay_max}/hr</span>
                      </div>
                    </div>
                    <Link 
                      to={`/family/jobs/${saved.job.id}`}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-900 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                      Apply Now
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Profile Snapshot */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <h3 className="font-bold text-stone-900 mb-4">Family Profile</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Location</p>
                  <p className="text-sm text-stone-600">{profile.location_neighborhood}, {profile.location_borough}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Baby className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Children</p>
                  <p className="text-sm text-stone-600">{profile.children_count} ({profile.children_ages?.join(', ')})</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-stone-900">Care Needed</p>
                  <p className="text-sm text-stone-600">{profile.care_type}</p>
                </div>
              </div>
            </div>
            <Link 
              to="/family/profile"
              className="mt-6 block w-full py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 text-center hover:bg-stone-50 transition-colors"
            >
              Edit Profile
            </Link>
          </div>

          {/* Privacy Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-bold text-emerald-900">Privacy First</h3>
                <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
                  Your exact address and contact information are hidden from nannies. Agencies will only share this information with your approval after a successful match.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
