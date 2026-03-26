import { useState, useEffect, useRef } from 'react';
import { Search, Filter, MoreHorizontal, FileText, Star, ShieldCheck, Eye, X, BookmarkPlus, Check, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { addFamilyNotification, addNannyNotification, getApplicationsForAgency, updateApplicationStatus, addNannyReview, recordCareHistoryFromApplication, resolveAgencyIdForUser, addNannyToAgencyTalentPool, getAgencyTalentPool, scheduleApplicationCall, computeNannyJobCompatibility, getNannyReviewStats, updateApplicationCallOutcome } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = {
  applied: 'bg-stone-100 text-stone-700',
  reviewing: 'bg-blue-100 text-blue-700',
  interviewing: 'bg-orange-100 text-orange-700',
  interview_invited: 'bg-orange-100 text-orange-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  hired: 'bg-emerald-100 text-emerald-700',
  active: 'bg-teal-100 text-teal-700',
  pending_family_approval: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-stone-200 text-stone-500'
};

const STATUS_LABELS = {
  applied: 'New',
  reviewing: 'Reviewing',
  interviewing: 'Interviewing',
  interview_invited: 'Interview Invited',
  accepted: 'Offer Extended',
  hired: 'Accepted',
  active: 'Placement Active',
  pending_family_approval: 'Awaiting Family Sign-off',
  completed: 'Completed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export default function AgencyApplications() {
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [agencyId, setAgencyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<'all' | 'followups'>('all');
  const [applications, setApplications] = useState<any[]>([]);
  const [talentPoolIds, setTalentPoolIds] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [callDateTime, setCallDateTime] = useState('');
  const [callNote, setCallNote] = useState('');
  const [reviewReliability, setReviewReliability] = useState(5);
  const [reviewCommunication, setReviewCommunication] = useState(5);
  const [reviewPunctuality, setReviewPunctuality] = useState(true);
  const [reviewRehire, setReviewRehire] = useState(true);
  const [reviewStrengths, setReviewStrengths] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewRelationshipContext, setReviewRelationshipContext] = useState<'managed' | 'applied' | 'interviewed' | 'placed' | 'trial_completed' | 'placement_completed'>('placed');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [isCallSubmitting, setIsCallSubmitting] = useState(false);
  const [overdueCallPromptOpen, setOverdueCallPromptOpen] = useState(false);
  const [overdueCallApp, setOverdueCallApp] = useState<any>(null);
  const [callOutcome, setCallOutcome] = useState<'happened' | 'no_show' | 'cancelled'>('happened');
  const [callOutcomeNotes, setCallOutcomeNotes] = useState('');
  const [isSavingCallOutcome, setIsSavingCallOutcome] = useState(false);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) return;
      const resolved = await resolveAgencyIdForUser(user.uid);
      setAgencyId(resolved || '');
    };
    resolveAgency();
  }, [user]);

  useEffect(() => {
    if (!agencyId) return;
    loadData();
  }, [agencyId]);

  const loadData = async () => {
    if (!agencyId) return;
    try {
      const [fetchedApps, poolItems] = await Promise.all([
        getApplicationsForAgency(agencyId),
        getAgencyTalentPool(agencyId)
      ]);
      const enrichedApps = await Promise.all(fetchedApps.map(async (app: any) => {
        const nannyName = app.nanny_profiles ? `${app.nanny_profiles.first_name || ''} ${app.nanny_profiles.last_name || ''}`.trim() : 'Unknown Applicant';
        const reviewStats = app.nanny_id ? await getNannyReviewStats(app.nanny_id) : { avg: 0, count: 0 };
        const compatibility = computeNannyJobCompatibility(app.jobs, app.nanny_profiles, reviewStats.avg, reviewStats.count);
        return {
          ...app,
          nanny_name: nannyName,
          job_title: app.jobs?.title || 'Unknown Job',
          compatibility
        };
      }));
      setApplications(enrichedApps);
      setTalentPoolIds(new Set(poolItems.map((p: any) => p.nanny_id)));
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!applications.length || overdueCallPromptOpen) return;

    const now = Date.now();
    const overdue = applications.find((app) => {
      const scheduled = app.call_scheduled_for ? new Date(app.call_scheduled_for).getTime() : 0;
      const hasOutcome = !!app.call_outcome_at || !!app.call_outcome;
      const hasCallScheduled = !!scheduled && !Number.isNaN(scheduled);
      const callWasAccepted = app.call_status === 'confirmed' || app.call_status === 'pending_nanny';
      return hasCallScheduled && callWasAccepted && scheduled < now && !hasOutcome;
    });

    if (overdue) {
      setOverdueCallApp(overdue);
      setCallOutcome('happened');
      setCallOutcomeNotes('');
      setOverdueCallPromptOpen(true);
    }
  }, [applications, overdueCallPromptOpen]);

  const isOverdueCallPendingFollowup = (app: any) => {
    const scheduled = app.call_scheduled_for ? new Date(app.call_scheduled_for).getTime() : 0;
    const hasOutcome = !!app.call_outcome_at || !!app.call_outcome;
    const hasCallScheduled = !!scheduled && !Number.isNaN(scheduled);
    const callWasAccepted = app.call_status === 'confirmed' || app.call_status === 'pending_nanny';
    return hasCallScheduled && callWasAccepted && scheduled < Date.now() && !hasOutcome;
  };

  const openOverdueCallPrompt = (app: any) => {
    setOverdueCallApp(app);
    setCallOutcome('happened');
    setCallOutcomeNotes('');
    setOverdueCallPromptOpen(true);
  };

  const handleAddToPool = async (nannyId: string) => {
    if (!agencyId || !nannyId || talentPoolIds.has(nannyId)) return;
    await addNannyToAgencyTalentPool(agencyId, nannyId);
    setTalentPoolIds(prev => new Set([...prev, nannyId]));
    setOpenDropdownId(null);
  };

  const openScheduleModal = (app: any) => {
    setSelectedApp(app);
    setCallDateTime(app.call_scheduled_for ? new Date(app.call_scheduled_for).toISOString().slice(0, 16) : '');
    setCallNote(app.call_note || '');
    setScheduleModalOpen(true);
    setOpenDropdownId(null);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setSelectedApp(null);
    setCallDateTime('');
    setCallNote('');
  };

  const handleScheduleCall = async () => {
    if (!selectedApp?.id || !selectedApp?.nanny_id || !agencyId || !callDateTime) return;

    setIsCallSubmitting(true);
    try {
      await scheduleApplicationCall({
        applicationId: selectedApp.id,
        nannyId: selectedApp.nanny_id,
        agencyId,
        agencyName: selectedApp.agency_name || user?.displayName || 'Agency',
        jobTitle: selectedApp.job_title,
        scheduledFor: new Date(callDateTime).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        note: callNote
      });
      await loadData();
      closeScheduleModal();
    } catch (error) {
      console.error('Error scheduling call:', error);
    } finally {
      setIsCallSubmitting(false);
    }
  };

  const closeOverduePrompt = () => {
    setOverdueCallPromptOpen(false);
    setOverdueCallApp(null);
    setCallOutcome('happened');
    setCallOutcomeNotes('');
  };

  const handleSaveOverdueCallOutcome = async () => {
    if (!overdueCallApp?.id || isSavingCallOutcome) return;
    setIsSavingCallOutcome(true);
    try {
      await updateApplicationCallOutcome({
        applicationId: overdueCallApp.id,
        outcome: callOutcome,
        notes: callOutcomeNotes,
      });

      if (callOutcome === 'happened' && overdueCallApp.nanny_id) {
        await addNannyNotification(
          overdueCallApp.nanny_id,
          'Call logged by agency',
          `The agency logged your scheduled call for ${overdueCallApp.job_title || 'the role'} as completed.`,
          '/nanny/applications'
        );
      }

      await loadData();
      closeOverduePrompt();
    } catch (error) {
      console.error('Error saving call outcome:', error);
    } finally {
      setIsSavingCallOutcome(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const app = applications.find((item) => item.id === appId);
      await updateApplicationStatus(appId, newStatus as any, { actorRole: 'agency' });

      if (app?.nanny_id) {
        const nannyNotifications: Record<string, { title: string; message: string }> = {
          reviewing: {
            title: 'Application under review',
            message: `Your application for ${app.job_title || 'this job'} is now under review.`
          },
          accepted: {
            title: 'Placement offer ready',
            message: `You were selected for ${app.job_title || 'this role'}. Review your job overview for the next steps.`
          },
          active: {
            title: 'Placement started',
            message: `Your placement for ${app.job_title || 'this role'} is now active.`
          },
          rejected: {
            title: 'Application closed',
            message: `The agency moved forward with another candidate for ${app.job_title || 'this role'}.`
          },
          completed: {
            title: 'Placement completed',
            message: `The placement for ${app.job_title || 'this role'} has been marked completed.`
          }
        };
        const nannyNotification = nannyNotifications[newStatus];
        if (nannyNotification) {
          await addNannyNotification(app.nanny_id, nannyNotification.title, nannyNotification.message, '/nanny/applications');
        }
      }

      const familyId = app?.family_id || app?.jobs?.family_id;
      if (familyId) {
        const familyNotifications: Record<string, { title: string; message: string }> = {
          active: {
            title: 'Placement started',
            message: `${app?.nanny_name || 'Your nanny'} has started ${app?.job_title || 'the placement'}.`
          },
          pending_family_approval: {
            title: 'Completion ready for review',
            message: `${app?.nanny_name || 'Your nanny'} marked ${app?.job_title || 'the placement'} as complete and is awaiting your approval.`
          },
          completed: {
            title: 'Placement completed',
            message: `${app?.job_title || 'The placement'} has been completed.`
          }
        };
        const familyNotification = familyNotifications[newStatus];
        if (familyNotification) {
          await addFamilyNotification(familyId, familyNotification.title, familyNotification.message, '/family/applications');
        }
      }

      if (newStatus === 'completed') {
        await recordCareHistoryFromApplication(appId);
      }
      await loadData();
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const openReviewModal = (app: any) => {
    setSelectedApp(app);
    setReviewReliability(5);
    setReviewCommunication(5);
    setReviewPunctuality(true);
    setReviewRehire(true);
    setReviewStrengths('');
    setReviewNotes('');
    setReviewRelationshipContext(
      app.status === 'interviewing' || app.status === 'interview_invited'
        ? 'interviewed'
        : app.status === 'completed'
          ? 'placement_completed'
          : 'placed'
    );
    setReviewSubmitSuccess(false);
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedApp(null);
  };

  const openQuickView = (app: any) => {
    setSelectedApp(app);
    setQuickViewOpen(true);
  };

  const closeQuickView = () => {
    setQuickViewOpen(false);
    setSelectedApp(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedApp || !agencyId || !selectedApp.nanny_id || !reviewStrengths.trim()) {
      return;
    }

    setIsReviewSubmitting(true);
    try {
      await addNannyReview({
        nanny_id: selectedApp.nanny_id,
        reviewer_id: agencyId,
        reviewer_type: 'agency',
        reviewer_role: 'agency',
        relationship_reference_type: 'application',
        relationship_reference_id: selectedApp.id,
        relationship_context: reviewRelationshipContext,
        reliability_rating: reviewReliability,
        communication_rating: reviewCommunication,
        punctuality: reviewPunctuality,
        rehire: reviewRehire,
        strengths: reviewStrengths,
        notes: reviewNotes
      });
      setReviewSubmitSuccess(true);
      setTimeout(() => {
        closeReviewModal();
      }, 1500);
    } catch (err) {
      console.error('Error submitting nanny review', err);
    } finally {
      setIsReviewSubmitting(false);
      loadData();
    }
  };

  const overdueFollowupsCount = applications.filter((app) => isOverdueCallPendingFollowup(app)).length;

  const filteredApps = applications.filter((app) => {
    const searchMatches =
      app.nanny_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!searchMatches) return false;
    if (queueFilter === 'followups') return isOverdueCallPendingFollowup(app);
    return true;
  });

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatCallDateTime = (value?: string | null) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Not scheduled';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Applications</h1>
          <p className="text-stone-500 mt-1">Review and manage candidates for your open jobs.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search applicants or jobs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQueueFilter('all')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${queueFilter === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
          >
            <Filter className="h-4 w-4" />
            All
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter('followups')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${queueFilter === 'followups' ? 'bg-amber-600 text-white border-amber-600' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
          >
            Call Follow-ups
            <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[11px] font-bold ${queueFilter === 'followups' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {overdueFollowupsCount}
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 shadow-sm overflow-hidden bg-gradient-to-br from-white via-stone-50/70 to-emerald-50/30">
        <div className="px-6 py-4 border-b border-stone-200/70 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">Candidate Pipeline</h2>
            <p className="text-xs text-stone-500 mt-0.5">Prioritized view with status, call signal, and next actions.</p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 border border-stone-200 text-stone-700">
            {filteredApps.length} record{filteredApps.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredApps.length === 0 ? (
          <div className="p-10 text-center text-stone-500">No applications found.</div>
        ) : (
          <div className="p-4 md:p-5 space-y-3">
            {filteredApps.map((app, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                key={app.id}
                className="rounded-2xl border border-stone-200 bg-white/95 backdrop-blur-sm shadow-sm p-4 md:p-5"
              >
                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1.2fr_1.3fr_auto] gap-4 items-start">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center text-stone-600 font-bold border border-stone-300 shrink-0">
                      {app.nanny_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 flex items-center gap-1.5 text-[1.1rem] leading-tight">
                        <span className="truncate">{app.nanny_name}</span>
                        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                        <span className="text-xs font-semibold text-stone-700">{app.nanny_profiles?.rating ? app.nanny_profiles.rating.toFixed(1) : 'N/A'}</span>
                      </div>
                      {app.compatibility && (
                        <div className="mt-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            app.compatibility.tier === 'excellent'
                              ? 'bg-emerald-100 text-emerald-700'
                              : app.compatibility.tier === 'good'
                                ? 'bg-blue-100 text-blue-700'
                                : app.compatibility.tier === 'fair'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-stone-100 text-stone-600'
                          }`}>
                            Match {app.compatibility.score}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Role</div>
                    <div className="mt-1 flex items-start gap-2">
                      <FileText className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                      <p className="text-stone-800 font-semibold leading-snug break-words">{app.job_title}</p>
                    </div>
                    <div className="text-xs text-stone-500 mt-2">Applied {toDate(app.created_at)?.toLocaleDateString() || '—'}</div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Pipeline</div>
                    <div className="mt-1.5">
                      <select
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border border-transparent hover:border-stone-200 outline-none cursor-pointer appearance-none ${STATUS_COLORS[app.status as keyof typeof STATUS_COLORS]}`}
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key} className="bg-white text-stone-900">{label}</option>
                        ))}
                      </select>
                    </div>

                    {app.call_status && (
                      <p className={`mt-2 text-xs font-semibold ${app.call_status === 'confirmed' ? 'text-emerald-700' : app.call_status === 'declined' ? 'text-red-600' : 'text-orange-700'}`}>
                        {app.call_status === 'pending_nanny' && `Call proposed for ${formatCallDateTime(app.call_scheduled_for)}`}
                        {app.call_status === 'confirmed' && `Call confirmed for ${formatCallDateTime(app.call_scheduled_for)}`}
                        {app.call_status === 'declined' && 'Previous call proposal was declined'}
                      </p>
                    )}

                    {app.call_outcome && (
                      <p className="mt-1 text-xs font-semibold text-stone-600">
                        Call outcome: {app.call_outcome === 'happened' ? 'Happened' : app.call_outcome === 'no_show' ? 'No-show' : 'Cancelled'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row xl:flex-col items-stretch gap-2 xl:items-end">
                    {isOverdueCallPendingFollowup(app) && (
                      <button
                        onClick={() => openOverdueCallPrompt(app)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        Log Follow-up
                      </button>
                    )}

                    <button
                      onClick={() => openQuickView(app)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Eye className="h-3 w-3" />
                      Quick View
                    </button>

                    {app.status === 'completed' && (
                      <button
                        onClick={() => openReviewModal(app)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        <Star className="h-3 w-3" />
                        Review
                      </button>
                    )}

                    <div ref={dropdownRef} className="relative self-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === app.id ? null : app.id); }}
                        className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openDropdownId === app.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden"
                        >
                          <button
                            onClick={() => openScheduleModal(app)}
                            className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors"
                          >
                            <Phone className="h-4 w-4 text-stone-400" />
                            {app.call_status === 'confirmed' || app.call_status === 'pending_nanny' ? 'Reschedule Call' : 'Schedule Call'}
                          </button>
                          <button
                            onClick={() => handleAddToPool(app.nanny_id)}
                            disabled={talentPoolIds.has(app.nanny_id)}
                            className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {talentPoolIds.has(app.nanny_id)
                              ? <Check className="h-4 w-4 text-emerald-500" />
                              : <BookmarkPlus className="h-4 w-4 text-stone-400" />}
                            {talentPoolIds.has(app.nanny_id) ? 'In Talent Pool' : 'Add to Talent Pool'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {quickViewOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-stone-700 via-stone-600 to-stone-800 px-6 pt-8 pb-10 overflow-hidden">
              <button onClick={closeQuickView} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedApp.nanny_name || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-stone-300 text-xs font-semibold uppercase tracking-widest mb-0.5">Applicant Quick View</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedApp.nanny_name}</h2>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Job</p>
                  <p className="font-semibold text-stone-900 mt-1.5">{selectedApp.job_title}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Status</p>
                  <p className="font-semibold text-stone-900 mt-1.5">{STATUS_LABELS[selectedApp.status as keyof typeof STATUS_LABELS] || selectedApp.status}</p>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Experience</p>
                  <p className="font-semibold text-stone-900 mt-1.5">{selectedApp.nanny_profiles?.years_experience ?? '—'} yrs</p>
                </div>
                <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Location</p>
                  <p className="font-semibold text-stone-900 mt-1.5">{selectedApp.nanny_profiles?.location_borough || '—'}</p>
                </div>
              </div>

              <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-2">Cover Letter</p>
                <p className="text-stone-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedApp.cover_letter || 'No cover letter provided.'}</p>
              </div>

              <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-2">Bio</p>
                <p className="text-stone-700 text-sm whitespace-pre-wrap leading-relaxed">{selectedApp.nanny_profiles?.bio || 'No bio available.'}</p>
              </div>

              <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-2">Call Status</p>
                <p className="text-stone-900 font-semibold text-sm">
                  {selectedApp.call_status === 'confirmed' && `Confirmed for ${formatCallDateTime(selectedApp.call_scheduled_for)}`}
                  {selectedApp.call_status === 'pending_nanny' && `Awaiting nanny confirmation for ${formatCallDateTime(selectedApp.call_scheduled_for)}`}
                  {selectedApp.call_status === 'declined' && 'Last proposed call was declined'}
                  {!selectedApp.call_status && 'No call scheduled yet.'}
                </p>
                {selectedApp.call_note && (
                  <p className="text-stone-600 mt-2 text-sm whitespace-pre-wrap">{selectedApp.call_note}</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex justify-end">
              <button onClick={closeQuickView} className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm">
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {scheduleModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 px-6 pt-8 pb-10 overflow-hidden">
              <button
                onClick={closeScheduleModal}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedApp.nanny_name || 'N').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Schedule Call</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedApp.nanny_name}</h2>
                </div>
              </div>
              <p className="text-blue-100/80 text-sm mt-3 relative z-10">Suggest a time — nanny will confirm.</p>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  value={callDateTime}
                  onChange={(e) => setCallDateTime(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Call Note</label>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  rows={4}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none transition"
                  placeholder="e.g. 15-minute intro call to discuss availability and role fit."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button
                onClick={closeScheduleModal}
                type="button"
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleCall}
                disabled={isCallSubmitting || !callDateTime}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold shadow-md shadow-blue-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isCallSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : 'Send Proposal'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {reviewModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden"
          >
            {/* Hero header */}
            <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pt-8 pb-10 overflow-hidden">
              <button
                onClick={closeReviewModal}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/25 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedApp.nanny_name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Agency Review</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedApp.nanny_name || 'Candidate'}</h2>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 relative z-10">
                <span className="text-white/70 text-xs">Overall</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`h-3.5 w-3.5 fill-current ${i <= Math.round((reviewReliability + reviewCommunication) / 2) ? 'text-amber-300' : 'text-white/30'}`} />
                  ))}
                </div>
                <span className="text-white font-bold text-sm">{((reviewReliability + reviewCommunication) / 2).toFixed(1)}</span>
              </div>
              {/* Decorative blobs */}
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            {/* Scrollable body */}
            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Ratings side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                  <RatingRow label="Reliability" value={reviewReliability} onChange={setReviewReliability} />
                </div>
                <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                  <RatingRow label="Communication" value={reviewCommunication} onChange={setReviewCommunication} />
                </div>
              </div>

              {/* Relationship context */}
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Relationship Context</label>
                <select
                  value={reviewRelationshipContext}
                  onChange={(e) => setReviewRelationshipContext(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                >
                  <option value="applied">Applied</option>
                  <option value="interviewed">Interviewed</option>
                  <option value="placed">Placed</option>
                  <option value="trial_completed">Trial Completed</option>
                  <option value="placement_completed">Placement Completed</option>
                  <option value="managed">Managed in Talent Pool</option>
                </select>
              </div>

              {/* Trait toggles */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewPunctuality(!reviewPunctuality)}
                  className={`rounded-2xl p-3.5 text-sm font-semibold border-2 flex items-center justify-between gap-2 transition-all ${reviewPunctuality ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                >
                  <span>Punctual</span>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${reviewPunctuality ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'}`}>
                    {reviewPunctuality && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewRehire(!reviewRehire)}
                  className={`rounded-2xl p-3.5 text-sm font-semibold border-2 flex items-center justify-between gap-2 transition-all ${reviewRehire ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                >
                  <span>Would Rehire</span>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${reviewRehire ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'}`}>
                    {reviewRehire && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                </button>
              </div>

              {/* Highlights */}
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Highlights</label>
                <div className="relative">
                  <textarea
                    value={reviewStrengths}
                    onChange={(e) => setReviewStrengths(e.target.value)}
                    rows={3}
                    maxLength={120}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none transition"
                    placeholder="What stood out most about this nanny?"
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-stone-400">{reviewStrengths.length}/120</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                  Internal Notes <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    maxLength={240}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none transition"
                    placeholder="Notes for future agencies and ShiftScore context."
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-stone-400">{reviewNotes.length}/240</span>
                </div>
              </div>

              {reviewSubmitSuccess && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-emerald-700 text-sm font-medium">Review submitted successfully.</p>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button
                onClick={closeReviewModal}
                type="button"
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isReviewSubmitting || !reviewStrengths.trim()}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold shadow-md shadow-emerald-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isReviewSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : 'Submit Review'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {overdueCallPromptOpen && overdueCallApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-xl relative">
            <h2 className="text-xl font-bold text-stone-900 mb-1">Scheduled Call Follow-up</h2>
            <p className="text-sm text-stone-600 mb-5">
              The scheduled call for <span className="font-semibold text-stone-900">{overdueCallApp.nanny_name || 'this nanny'}</span> passed at {formatCallDateTime(overdueCallApp.call_scheduled_for)}.
              Did it happen?
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Outcome</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value as 'happened' | 'no_show' | 'cancelled')}
                  className="w-full border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="happened">Call happened</option>
                  <option value="no_show">Nanny no-show</option>
                  <option value="cancelled">Cancelled / rescheduled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Notes about nanny (optional)</label>
                <textarea
                  value={callOutcomeNotes}
                  onChange={(e) => setCallOutcomeNotes(e.target.value)}
                  rows={4}
                  maxLength={400}
                  className="w-full border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Example: Great communication, arrived prepared, strong fit for the family."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeOverduePrompt}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleSaveOverdueCallOutcome}
                disabled={isSavingCallOutcome}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSavingCallOutcome ? 'Saving...' : 'Save Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;
  return (
    <div>
      <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">{label}</label>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            onMouseEnter={() => setHovered(option)}
            onMouseLeave={() => setHovered(null)}
            className={`transition-all duration-100 ${option <= active ? 'text-amber-400 scale-110' : 'text-stone-300 hover:text-amber-300'}`}
            type="button"
          >
            <Star className="h-6 w-6 fill-current" />
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-400 mt-1.5 font-semibold">{value}/5</p>
    </div>
  );
}
