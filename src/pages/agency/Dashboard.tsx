import { useState, useEffect } from 'react';
import { Briefcase, Users, MessageSquare, Star, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getJobs,
  getApplicationsForAgency,
  getAgencyById,
  resolveAgencyIdForUser,
  getAgencyConversations,
  updateInquiryStage,
  getAgencyTalentPool,
  type InquiryStage
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const INQUIRY_STAGE_LABELS: Record<InquiryStage, string> = {
  new: 'New',
  communicated: 'Communicated',
  done: 'Done'
};

export default function AgencyDashboard() {
  const { user, role } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [isResolvingAgency, setIsResolvingAgency] = useState(true);
  const [agency, setAgency] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeJobs: 0,
    newApps: 0,
    talentPool: 0,
    inquiries: 0
  });

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (value: any) => {
    const date = toDate(value);
    if (!date) return 'Unknown date';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) {
        setAgencyId('');
        setIsResolvingAgency(false);
        return;
      }

      try {
        const resolved = await resolveAgencyIdForUser(user.uid);
        // Agency admins can safely fallback to their UID (legacy/profile-id pattern).
        if (!resolved && (role === 'agency_admin' || role === 'agency')) {
          setAgencyId(user.uid);
        } else {
          setAgencyId(resolved || '');
        }
      } catch (error) {
        console.error('Error resolving agency id:', error);
        if (role === 'agency_admin' || role === 'agency') {
          setAgencyId(user.uid);
        } else {
          setAgencyId('');
        }
      } finally {
        setIsResolvingAgency(false);
      }
    };
    resolveAgency();
  }, [role, user]);

  useEffect(() => {
    const loadData = async () => {
      if (!agencyId) return;
      try {
        const [agencyData, jobs, apps, conversations, talentPoolItems] = await Promise.all([
          getAgencyById(agencyId),
          getJobs(agencyId),
          getApplicationsForAgency(agencyId),
          getAgencyConversations(agencyId),
          getAgencyTalentPool(agencyId)
        ]);

        setAgency(agencyData);

        const newApps = apps.filter(a => a.status === 'applied');
        const inquiryThreads = (conversations || []).filter((c: any) => c.inquiry_type === 'agency_intro');

        setInquiries(inquiryThreads.slice(0, 5));
        setStats({
          activeJobs: jobs.length,
          newApps: newApps.length,
          talentPool: talentPoolItems.length,
          inquiries: inquiryThreads.length
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };
    loadData();
  }, [agencyId]);

  if (isResolvingAgency) {
    return <div className="p-8 text-center text-stone-500">Loading agency dashboard...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view agency dashboard.</div>;
  }

  const handleInquiryStageChange = async (conversationId: string, nextStage: InquiryStage) => {
    const ok = await updateInquiryStage(conversationId, nextStage);
    if (!ok) return;

    setInquiries(prev => prev.map((inq) => (
      inq.id === conversationId ? { ...inq, inquiry_stage: nextStage } : inq
    )));
  };

  return (
    <div className="space-y-8 pb-12">
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
            <Link to="/agency/talent" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-blue-100 group-hover:text-blue-600 mb-3 transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Talent Pool</h3>
              <p className="text-xs text-stone-500">Invite nannies from search into your private pool.</p>
            </Link>
            <Link to="/agency/family-requests" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-orange-100 group-hover:text-orange-600 mb-3 transition-colors">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Family Request Inbox</h3>
              <p className="text-xs text-stone-500">Review matched family leads and respond quickly.</p>
            </Link>
            <Link to="/agency/request-settings" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-purple-100 group-hover:text-purple-600 mb-3 transition-colors">
                <Star className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Matching Settings</h3>
              <p className="text-xs text-stone-500">Tune service areas, care types, and budget fit signals.</p>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">Recent Inquiries</h2>
            <Link to="/agency/messages" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</Link>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            {inquiries.length === 0 ? (
              <div className="p-6 text-sm text-stone-500">No recent inquiries yet. New family messages will appear here.</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {inquiries.map((inq) => {
                  const stage = (inq.inquiry_stage || 'new') as InquiryStage;
                  return (
                    <div key={inq.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{inq.family_name || 'Family'} inquiry</p>
                        <p className="text-xs text-stone-500 mt-0.5 truncate">{inq.inquiry_description_preview || inq.last_message || 'No details'}</p>
                        <p className="text-[11px] text-stone-400 mt-1">{formatDate(inq.updated_at || inq.created_at)}</p>
                      </div>
                      <select
                        value={stage}
                        onChange={(e) => handleInquiryStageChange(inq.id, e.target.value as InquiryStage)}
                        className="text-xs font-semibold rounded-lg px-2 py-1 border border-stone-200 bg-white text-stone-700"
                      >
                        {Object.entries(INQUIRY_STAGE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
