import { useState, useEffect } from 'react';
import { Briefcase, Calendar, CheckCircle2, Clock, FileText, MapPin, Phone, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { addAgencyNotification, addFamilyNotification, getApplicationsForNanny, getFamilyProfile, getJobById, respondToApplicationCall, updateApplicationStatus } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatJobSchedule } from '../../lib/utils';

const STATUS_CONFIG = {
  applied: { color: 'bg-stone-100 text-stone-700', icon: Clock, label: 'Applied' },
  reviewing: { color: 'bg-blue-100 text-blue-700', icon: FileText, label: 'In Review' },
  interviewing: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Interviewing' },
  interview_invited: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Interview Invited' },
  accepted: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Offer Ready' },
  hired: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Offer Ready' },
  active: { color: 'bg-teal-100 text-teal-700', icon: Briefcase, label: 'Placement Active' },
  pending_family_approval: { color: 'bg-indigo-100 text-indigo-700', icon: Clock, label: 'Pending Family Approval' },
  completed: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Completed' },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Not Selected' },
  withdrawn: { color: 'bg-stone-200 text-stone-500', icon: XCircle, label: 'Withdrawn' }
};

const STATUS_TIMELINE_LABELS: Record<string, string> = {
  applied: 'Applied',
  reviewing: 'Under Review',
  interviewing: 'Interviewing',
  interview_invited: 'Interview Invited',
  accepted: 'Offer Ready',
  hired: 'Offer Ready',
  active: 'Placement Active',
  pending_family_approval: 'Awaiting Family Approval',
  completed: 'Completed',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn'
};

export default function NannyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);

  const nannyId = user?.uid || '';

  useEffect(() => {
    if (!nannyId) {
      setApplications([]);
      return;
    }
    loadData();
  }, [nannyId]);

  const loadData = async () => {
    if (!nannyId) {
      return;
    }

    try {
      const fetchedApps = await getApplicationsForNanny(nannyId);
      const enrichedApps = await Promise.all(
        fetchedApps.map(async (app) => {
          const job = app.jobs || await getJobById(app.job_id);
          const familyProfile = job?.family_id ? await getFamilyProfile(job.family_id) : null;
          return {
            ...app,
            family_profile: familyProfile,
            agency_name: job?.agency_profiles?.company_name || 'Unknown Agency',
            location: job ? `${job.location_neighborhood}, ${job.location_borough}` : 'Unknown Location',
            job_title: job?.title || 'Unknown Job'
          };
        })
      );

      setApplications(enrichedApps);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatCallDate = (value?: string | null) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Not scheduled';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatHistoryDate = (value: any) => {
    const date = toDate(value);
    if (!date) return 'Unknown time';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getStatusHistoryEntries = (app: any) => {
    const history = Array.isArray(app.status_history) ? app.status_history : [];
    const normalized = history
      .filter((entry) => entry?.status)
      .map((entry) => ({
        status: entry.status,
        at: entry.at,
        actor_role: entry.actor_role || 'system',
        note: entry.note || ''
      }));

    if (normalized.length === 0) {
      return [{
        status: app.status || 'applied',
        at: app.created_at,
        actor_role: 'system',
        note: ''
      }];
    }

    return normalized.sort((a, b) => toMillis(a.at) - toMillis(b.at));
  };

  const getLifecycleCaption = (app: any) => {
    switch (app.status) {
      case 'applied':
        return 'Your profile has been submitted to the agency.';
      case 'reviewing':
        return 'The agency is reviewing your fit for the role.';
      case 'interviewing':
      case 'interview_invited':
        return app.call_status === 'confirmed'
          ? `Interview confirmed for ${formatCallDate(app.call_scheduled_for)}.`
          : 'You are in the interview stage.';
      case 'accepted':
      case 'hired':
        return 'You were selected. Review the placement packet and confirm your start.';
      case 'active':
        return 'Your placement is live. Log completion when the work is finished.';
      case 'pending_family_approval':
        return 'You marked the placement complete. Waiting for family confirmation.';
      case 'completed':
        return 'This placement is complete and recorded in your work history.';
      case 'rejected':
        return 'This opportunity closed with another candidate.';
      case 'withdrawn':
        return 'You withdrew from this application.';
      default:
        return 'Track this opportunity from review to completion.';
    }
  };

  const canShowPlacementPacket = (status?: string) => ['accepted', 'hired', 'active', 'pending_family_approval', 'completed'].includes(status || '');

  const handleCallResponse = async (app: any, response: 'confirmed' | 'declined') => {
    try {
      await respondToApplicationCall({
        applicationId: app.id,
        response,
        agencyId: app.agency_id,
        nannyName: app.nanny_profiles?.first_name ? `${app.nanny_profiles.first_name} ${app.nanny_profiles?.last_name || ''}`.trim() : 'The nanny',
        jobTitle: app.job_title,
        scheduledFor: app.call_scheduled_for
      });
      await loadData();
    } catch (error) {
      console.error('Error responding to call proposal:', error);
    }
  };

  const handleStartPlacement = async (app: any) => {
    try {
      await updateApplicationStatus(app.id, 'active', { actorRole: 'nanny' });
      await addAgencyNotification(
        app.agency_id,
        'Placement started',
        `${app.nanny_profiles?.first_name || 'The nanny'} started ${app.job_title || 'the placement'}.`,
        '/agency/applications'
      );

      const familyId = app.family_id || app.jobs?.family_id;
      if (familyId) {
        await addFamilyNotification(
          familyId,
          'Placement started',
          `${app.nanny_profiles?.first_name || 'Your nanny'} started ${app.job_title || 'the placement'}.`,
          '/family/applications'
        );
      }

      await loadData();
    } catch (error) {
      console.error('Error starting placement:', error);
    }
  };

  const handleMarkWorkDone = async (app: any) => {
    try {
      await updateApplicationStatus(app.id, 'pending_family_approval', { actorRole: 'nanny' });
      const familyId = app.family_id || app.jobs?.family_id;
      if (familyId) {
        await addFamilyNotification(
          familyId,
          'Work completion requested',
          `Nanny ${app.nanny_profiles?.first_name || 'Nanny'} marked the job '${app.job_title || ''}' as done. Please review and confirm.`,
          '/family/applications'
        );
      }
      await loadData();
    } catch (error) {
      console.error('Error marking work done:', error);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Job Overview</h1>
          <p className="text-stone-500 mt-1">Track every placement from application to completion, with accepted-job details in one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">In Pipeline</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{applications.filter((app) => ['applied', 'reviewing', 'interviewing', 'interview_invited'].includes(app.status)).length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Offers Ready</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{applications.filter((app) => ['accepted', 'hired'].includes(app.status)).length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Active Placements</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{applications.filter((app) => ['active', 'pending_family_approval'].includes(app.status)).length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Completed</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{applications.filter((app) => app.status === 'completed').length}</p>
        </div>
      </div>

      <div className="space-y-5">
        {applications.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-sm">
            You haven't applied to any jobs yet.
          </div>
        ) : (
          applications.map((app, index) => {
            const statusConfig = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.applied;
            const StatusIcon = statusConfig.icon;
            const statusHistory = getStatusHistoryEntries(app);

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                key={app.id}
                className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-stone-900">{app.job_title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${statusConfig.color}`}>
                        <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                      <span className="font-medium text-stone-700">{app.agency_name}</span>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {app.location}
                      </div>
                      {app.family_profile?.children?.length ? (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>{app.family_profile.children.length} child{app.family_profile.children.length === 1 ? '' : 'ren'}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-stone-600">{getLifecycleCaption(app)}</p>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Applied</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{toDate(app.created_at)?.toLocaleDateString() || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Last Update</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{toDate(app.updated_at)?.toLocaleDateString() || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Schedule</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{app.jobs ? formatJobSchedule(app.jobs) : 'TBD'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-[320px] rounded-3xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">Status History</p>
                    <div className="mt-4 space-y-3">
                      {statusHistory.map((entry, historyIndex) => {
                        const isCurrent = historyIndex === statusHistory.length - 1;
                        return (
                          <div key={`${entry.status}-${historyIndex}`} className="flex items-start gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black ${isCurrent ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-200 bg-white text-stone-500'}`}>
                              {historyIndex + 1}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${isCurrent ? 'text-stone-900' : 'text-stone-700'}`}>
                                {STATUS_TIMELINE_LABELS[entry.status] || entry.status}
                              </p>
                              <p className="text-xs text-stone-500">{formatHistoryDate(entry.at)}</p>
                              <p className="text-xs text-stone-400 capitalize">by {entry.actor_role || 'system'}</p>
                              {entry.note ? <p className="text-xs text-stone-500 mt-1">{entry.note}</p> : null}
                              {isCurrent ? <p className="text-xs text-emerald-600 mt-1 font-semibold">Current stage</p> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {app.call_status === 'pending_nanny' && (
                  <div className="mt-5 w-full rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Call Proposal</p>
                    <p className="mt-2 text-sm font-semibold text-stone-900">{formatCallDate(app.call_scheduled_for)}</p>
                    {app.call_note && <p className="mt-2 text-sm text-stone-600 whitespace-pre-wrap">{app.call_note}</p>}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCallResponse(app, 'confirmed')}
                        className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Confirm Call
                      </button>
                      <button
                        onClick={() => handleCallResponse(app, 'declined')}
                        className="px-3 py-2 bg-white border border-stone-300 text-stone-700 text-xs font-bold rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {app.call_status === 'confirmed' && (
                  <div className="mt-5 w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Call Confirmed</p>
                    <p className="mt-2 text-sm font-semibold text-stone-900">{formatCallDate(app.call_scheduled_for)}</p>
                    {app.call_note && <p className="mt-2 text-sm text-stone-600 whitespace-pre-wrap">{app.call_note}</p>}
                  </div>
                )}

                {app.call_status === 'declined' && (
                  <div className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Call Declined</p>
                    <p className="mt-2 text-sm text-stone-600">You declined the last proposed call. The agency can send a new time.</p>
                  </div>
                )}

                {canShowPlacementPacket(app.status) && (
                  <div className="mt-5 rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">Placement Packet</p>
                        <h4 className="mt-1 text-lg font-bold text-stone-900">Ready for your accepted job overview</h4>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600 border border-stone-200">
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                        Agency mediated placement
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Agency</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{app.agency_name}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Family</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{app.family_profile?.family_name || app.family_profile?.name || 'Family details shared through agency'}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Pay Range</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">${app.jobs?.pay_min ?? '—'}-${app.jobs?.pay_max ?? '—'}/hr</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Job Type</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{app.jobs?.job_type || 'Care role'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Care Summary</p>
                        <div className="mt-3 space-y-2 text-sm text-stone-600">
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-stone-400" />{app.location}</p>
                          <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-stone-400" />{app.jobs ? formatJobSchedule(app.jobs) : 'Schedule to be confirmed'}</p>
                          <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-stone-400" />{app.family_profile?.children?.length ? `${app.family_profile.children.length} child${app.family_profile.children.length === 1 ? '' : 'ren'} in care` : 'Child details shared after offer'}</p>
                        </div>
                        {app.family_profile?.care_needs ? <p className="mt-3 text-sm text-stone-600 whitespace-pre-wrap">{app.family_profile.care_needs}</p> : null}
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Coordination Details</p>
                        <div className="mt-3 space-y-2 text-sm text-stone-600">
                          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-stone-400" />{app.family_profile?.phone || 'Contact will be shared through the agency'}</p>
                          <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-stone-400" />{app.family_profile?.email || 'Agency will coordinate introductions'}</p>
                        </div>
                        {app.jobs?.description ? <p className="mt-3 text-sm text-stone-600 line-clamp-4">{app.jobs.description}</p> : null}
                      </div>
                    </div>
                  </div>
                )}

                {['accepted', 'hired'].includes(app.status) && (
                  <button
                    onClick={() => handleStartPlacement(app)}
                    className="mt-4 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors inline-flex items-center justify-center"
                  >
                    Start Placement
                  </button>
                )}

                {app.status === 'active' && (
                  <button
                    onClick={() => handleMarkWorkDone(app)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center justify-center"
                  >
                    Mark Work Done
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
