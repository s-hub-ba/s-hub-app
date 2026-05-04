import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { Briefcase, Calendar, CheckCircle2, Clock, FileText, MapPin, Phone, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { addAgencyNotification, addFamilyNotification, getApplicationsForNanny, getFamilyProfile, getJobById, respondToApplicationCall, updateApplicationCareSession, updateApplicationStatus } from '../../lib/api';
import PlacementHandshakeModal from '../../components/PlacementHandshakeModal';
import { getApiBaseUrl } from '../../lib/apiBase';
import { formatJobTypeLabel } from '../../lib/jobTypes';
import { buildPlacementCelebrationKey, consumePlacementCelebrationKey, hasSeenPlacementCelebration, toPlacementCelebrationMillis } from '../../lib/placementCelebration';
import { useAuth } from '../../contexts/AuthContext';
import { formatJobSchedule } from '../../lib/utils';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const API_BASE = getApiBaseUrl();

const STATUS_CONFIG = {
  applied: { color: 'bg-stone-100 text-stone-700', icon: Clock, label: 'Applied' },
  reviewing: { color: 'bg-blue-100 text-blue-700', icon: FileText, label: 'In Review' },
  interviewing: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Interviewing' },
  interview_invited: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Interview Invited' },
  accepted: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Assigned' },
  hired: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Assigned' },
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
  accepted: 'Assigned',
  hired: 'Assigned',
  active: 'Placement Active',
  pending_family_approval: 'Awaiting Family Approval',
  completed: 'Completed',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn'
};

export default function NannyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [shiftOffers, setShiftOffers] = useState<any[]>([]);
  const [commitments, setCommitments] = useState<Record<string, { confirm24h?: boolean; confirm3h?: boolean }>>({});
  const [placementActionError, setPlacementActionError] = useState<string | null>(null);
  const [celebrationApp, setCelebrationApp] = useState<any>(null);
  const [celebrationCompact, setCelebrationCompact] = useState(false);

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

      const candidate = [...enrichedApps]
        .filter((app) => app.status === 'active' && toPlacementCelebrationMillis(app.active_at || app.updated_at) > 0)
        .sort((a, b) => toPlacementCelebrationMillis(b.active_at || b.updated_at) - toPlacementCelebrationMillis(a.active_at || a.updated_at))[0];

      if (candidate) {
        const key = buildPlacementCelebrationKey('nanny', nannyId, candidate.id, candidate.active_at || candidate.updated_at);
        if (consumePlacementCelebrationKey(key)) {
          setCelebrationCompact(false);
          setCelebrationApp(candidate);
        }
      }

      const auth = getAuth();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        (headers as Record<string, string>).Authorization = `Bearer ${token}`;
      } else if (import.meta.env.DEV) {
        (headers as Record<string, string>)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
      }

      const now = new Date();
      const rangeStart = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString();
      const rangeEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();

      const eventRes = await fetch(`${API_BASE}/api/scheduling/events?rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`, {
        headers,
      });
      const payload = await eventRes.json().catch(() => ({}));
      const events = Array.isArray(payload?.events) ? payload.events : [];
      const offers = events.filter((event: any) => event.type === 'shift_offer' && ['offered', 'accepted', 'confirmed'].includes(event.status));
      setShiftOffers(offers);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  useBackgroundRefresh(
    () => {
      if (!nannyId) return;
      return loadData();
    },
    { enabled: !!nannyId, intervalMs: 30_000 }
  );

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
        return 'The agency assigned you to this job. Review the placement packet and confirm your start.';
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
      if (app.family_start_approved === false) {
        setPlacementActionError('This placement is awaiting family approval before it can be started.');
        return;
      }

      const careType = String(app?.jobs?.job_type || '').trim().toLowerCase();
      const isOccasional = careType.includes('occasional') || careType.includes('last');

      if (isOccasional) {
        const currentStart = app?.care_started_at ? new Date(app.care_started_at) : null;
        const currentEnd = app?.care_expected_end_at
          ? new Date(app.care_expected_end_at)
          : app?.care_extended_to
            ? new Date(app.care_extended_to)
            : null;

        const startDefault = currentStart && !Number.isNaN(currentStart.getTime())
          ? currentStart.toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16);
        const endDefault = currentEnd && !Number.isNaN(currentEnd.getTime())
          ? currentEnd.toISOString().slice(0, 16)
          : '';

        const startInput = window.prompt('Occasional care requires exact start date and time (YYYY-MM-DDTHH:mm).', startDefault);
        if (!startInput) return;
        const endInput = window.prompt('Occasional care requires exact end date and time (YYYY-MM-DDTHH:mm).', endDefault);
        if (!endInput) return;

        const startAt = new Date(startInput);
        const endAt = new Date(endInput);
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
          setPlacementActionError('Please enter valid start and end date-time values for occasional care.');
          return;
        }
        if (endAt.getTime() <= startAt.getTime()) {
          setPlacementActionError('End date-time must be after start date-time for occasional care.');
          return;
        }

        await updateApplicationCareSession(app.id, {
          care_started_at: startAt.toISOString(),
          care_expected_end_at: endAt.toISOString(),
        });
      }

      await updateApplicationStatus(app.id, 'active', { actorRole: 'nanny' });
      setPlacementActionError(null);
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
          '/family/placements'
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
      setPlacementActionError(null);
      const familyId = app.family_id || app.jobs?.family_id;
      if (familyId) {
        await addFamilyNotification(
          familyId,
          'Work marked done',
          `Nanny ${app.nanny_profiles?.first_name || 'Nanny'} marked ${app.job_title || 'this placement'} as done. Please review and confirm.`,
          '/family/placements'
        );
      }
      await loadData();
    } catch (error) {
      console.error('Error marking work done:', error);
    }
  };

  const updateShiftOfferStatus = async (eventId: string, status: 'accepted' | 'declined' | 'cancelled') => {
    try {
      const auth = getAuth();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        (headers as Record<string, string>).Authorization = `Bearer ${token}`;
      } else if (import.meta.env.DEV) {
        (headers as Record<string, string>)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
      }

      await fetch(`${API_BASE}/api/scheduling/events/${eventId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, reason: status === 'declined' || status === 'cancelled' ? 'Nanny cancelled commitment' : 'Nanny accepted offer' }),
      });

      await loadData();
    } catch (error) {
      console.error('Error updating shift offer status:', error);
    }
  };

  const markPreShiftConfirmation = (eventId: string, checkpoint: 'confirm24h' | 'confirm3h') => {
    const storageKey = `nanny-shift-checkpoints-${nannyId}`;
    const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const next = {
      ...existing,
      [eventId]: {
        ...(existing[eventId] || {}),
        [checkpoint]: true,
      },
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setCommitments(next);
  };

  useEffect(() => {
    const storageKey = `nanny-shift-checkpoints-${nannyId}`;
    setCommitments(JSON.parse(localStorage.getItem(storageKey) || '{}'));
  }, [nannyId]);

  return (
    <div className="space-y-8 pb-12">
      <PlacementHandshakeModal
        open={!!celebrationApp}
        onClose={() => {
          setCelebrationApp(null);
          setCelebrationCompact(false);
        }}
        jobTitle={celebrationApp?.job_title}
        agencyName={celebrationApp?.agency_name}
        familyName={celebrationApp?.family_name || celebrationApp?.family_profile?.family_name || celebrationApp?.family_profile?.name || 'Family'}
        nannyName={user?.email || 'Nanny'}
        compact={celebrationCompact}
      />

      {placementActionError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {placementActionError}
        </div>
      ) : null}

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

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">Shift Offers</h2>
        <p className="mt-1 text-sm text-stone-500">Accepting and confirming offers impacts your reliability score.</p>

        <div className="mt-4 space-y-3">
          {shiftOffers.length === 0 ? (
            <p className="text-sm text-stone-500">No active shift offers right now.</p>
          ) : (
            shiftOffers.map((offer) => {
              const startsAt = new Date(offer.start || Date.now());
              const hoursUntilShift = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
              const checkpoints = commitments[offer.id] || {};

              return (
                <div key={offer.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-stone-900">{offer.title || 'Shift Offer'}</p>
                      <p className="text-xs text-stone-500">{startsAt.toLocaleString()} • Status: {offer.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offer.status === 'offered' && (
                        <>
                          <button
                            onClick={() => updateShiftOfferStatus(offer.id, 'accepted')}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Accept Offer
                          </button>
                          <button
                            onClick={() => updateShiftOfferStatus(offer.id, 'declined')}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            Decline (Penalty Risk)
                          </button>
                        </>
                      )}

                      {['accepted', 'confirmed'].includes(offer.status) && (
                        <>
                          {hoursUntilShift <= 24 && hoursUntilShift > 2 && (
                            <button
                              onClick={() => markPreShiftConfirmation(offer.id, 'confirm24h')}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                            >
                              {checkpoints.confirm24h ? '24h Confirmed' : 'Confirm 24h Prior'}
                            </button>
                          )}
                          {hoursUntilShift <= 3 && hoursUntilShift > 0 && (
                            <button
                              onClick={() => markPreShiftConfirmation(offer.id, 'confirm3h')}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                            >
                              {checkpoints.confirm3h ? '3h Confirmed' : 'Confirm 3h Prior'}
                            </button>
                          )}
                          <button
                            onClick={() => updateShiftOfferStatus(offer.id, 'cancelled')}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            Cancel Commitment
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-amber-700">Warning: last-minute cancellations can reduce reliability score.</p>
                </div>
              );
            })
          )}
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
                      {app.status === 'active' && hasSeenPlacementCelebration(buildPlacementCelebrationKey('nanny', nannyId, app.id, app.active_at || app.updated_at)) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCelebrationCompact(true);
                            setCelebrationApp(app);
                          }}
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          Placement sealed
                        </button>
                      ) : null}
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
                        <p className="mt-2 text-sm font-semibold text-stone-900">{app.family_name || app.family_profile?.family_name || app.family_profile?.name || 'Family details shared through agency'}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Pay Range</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">${app.jobs?.pay_min ?? '—'}-${app.jobs?.pay_max ?? '—'}/hr</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 border border-stone-200">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Job Type</p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">{formatJobTypeLabel(app.jobs?.job_type || 'Care role')}</p>
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
