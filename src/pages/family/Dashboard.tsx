import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Heart, MessageSquare, Clock, MapPin, DollarSign, CheckCircle2, XCircle, AlertCircle, Baby } from 'lucide-react';
import { getFamilyProfile, getFamilyCareHistory, getSavedJobs, getConversations, getFamilyFollowedAgencies } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [careHistory, setCareHistory] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [followedAgencyIds, setFollowedAgencyIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const familyId = user?.uid || '';

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view your dashboard.</div>;
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const results = await Promise.allSettled([
          getFamilyProfile(familyId),
          getSavedJobs(familyId),
          getFamilyCareHistory(familyId),
          getConversations(familyId, 'family'),
          getFamilyFollowedAgencies(familyId)
        ]);

        const [prof, saved, history, convos, follows] = results.map(result =>
          result.status === 'fulfilled' ? result.value : null
        );

        if (prof) setProfile(prof as any);
        setSavedJobs((saved as any[]) || []);
        setCareHistory((history as any[]) || []);
        setConversations((convos as any[]) || []);
        setFollowedAgencyIds((follows as string[]) || []);

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`Dashboard item ${index} failed`, result.reason);
          }
        });
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [familyId]);

  if (isLoading) {
    return <div className="p-12 text-center text-stone-500">Loading your dashboard...</div>;
  }

  if (!profile) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-2xl font-bold text-stone-900">Welcome!</h2>
        <p className="mt-2 text-stone-500">We couldn’t find your family profile yet.</p>
        <Link to="/family/onboarding" className="mt-4 inline-flex bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl">
          Complete Onboarding
        </Link>
      </div>
    );
  }

  const isOnboardingComplete = profile.onboarding_complete || (!!profile.name && !!profile.location_neighborhood && Array.isArray(profile.children) && profile.children.length > 0);

  const getOnboardingProgress = (profile: any) => {
    const checklist = [
      !!(profile.family_name || profile.name),
      !!profile.email,
      !!profile.phone,
      !!profile.location_borough,
      !!profile.location_neighborhood,
      Array.isArray(profile.children) && profile.children.length > 0,
      !!profile.care_needs,
      !!profile.languages && profile.languages.length > 0,
      !!profile.special_skills && profile.special_skills.length > 0,
      !!profile.parenting_style,
      !!profile.dietary_preferences,
      !!profile.cultural_values
    ];
    const done = checklist.filter(Boolean).length;
    const total = checklist.length;
    return Math.round((done / total) * 100);
  };

  const progress = getOnboardingProgress(profile);

  return (
    <div className="space-y-8 pb-12">
      {!isOnboardingComplete && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xl font-bold text-amber-900">Onboarding {progress}% complete</h2>
          <p className="mt-1 text-sm text-amber-700">Great work—your account is active. Finish the remaining steps to unlock better matches.</p>
          <div className="mt-3 h-2 w-full rounded-full bg-amber-100 overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <Link to="/family/onboarding" className="mt-4 inline-flex bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold">
            Continue Onboarding
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Welcome back, {profile.family_name || profile.name || 'Family'}</h1>
          <p className="text-stone-500 mt-1">Manage your childcare search and agency connections.</p>
        </div>
        <Link 
          to="/family/agencies"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Briefcase className="h-4 w-4" />
          Find an Agency
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Past Care</p>
            <p className="text-3xl font-black text-stone-900">{careHistory.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-500 uppercase tracking-wider">Following Agencies</p>
            <p className="text-3xl font-black text-stone-900">{followedAgencyIds.length}</p>
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


          {/* Past Care */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">Past Care</h2>
              <Link to="/family/saved" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </Link>
            </div>
            
            <div className="divide-y divide-stone-100">
              {careHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <Heart className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-900">No past care history</h3>
                  <p className="text-stone-500 mt-1">Once care is completed, you’ll see past agencies/nannies here and can leave reviews.</p>
                </div>
              ) : (
                careHistory.slice(0, 3).map((history) => (
                  <div key={history.id} className="p-6 hover:bg-stone-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-stone-900 mb-1">{history.job_title || 'Past Care Role'}</h3>
                      <div className="flex items-center gap-3 text-sm text-stone-500">
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {history.location_neighborhood || 'NYC'}{history.location_borough ? `, ${history.location_borough}` : ''}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Completed</span>
                      </div>
                    </div>
                    <Link
                      to="/family/saved"
                      className="bg-stone-100 hover:bg-stone-200 text-stone-900 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                      Leave Review
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
