import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, MapPin, RotateCcw } from 'lucide-react';
import { addAgencyNotification, addNannyNotification, getFamilyPlacementApplications, recordCareHistoryFromApplication, updateApplicationCareSession, updateApplicationStatus } from '../../lib/api';
import PlacementHandshakeModal from '../../components/PlacementHandshakeModal';
import { buildPlacementCelebrationKey, consumePlacementCelebrationKey, hasSeenPlacementCelebration, toPlacementCelebrationMillis } from '../../lib/placementCelebration';
import { useAuth } from '../../contexts/AuthContext';
import { formatJobSchedule } from '../../lib/utils';

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Assigned - Awaiting Start Approval',
  hired: 'Assigned - Awaiting Start Approval',
  active: 'Active',
  pending_family_approval: 'Awaiting Completion Approval',
  completed: 'Completed'
};

export default function FamilyPlacements() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [celebrationApp, setCelebrationApp] = useState<any>(null);
  const [celebrationCompact, setCelebrationCompact] = useState(false);

  const familyId = user?.uid || '';

  const loadData = async () => {
    if (!familyId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const apps = await getFamilyPlacementApplications(familyId);
      setApplications(apps);

      const candidate = [...apps]
        .filter((app) => app.status === 'active' && toPlacementCelebrationMillis(app.active_at || app.updated_at) > 0)
        .sort((a, b) => toPlacementCelebrationMillis(b.active_at || b.updated_at) - toPlacementCelebrationMillis(a.active_at || a.updated_at))[0];

      if (candidate) {
        const key = buildPlacementCelebrationKey('family', familyId, candidate.id, candidate.active_at || candidate.updated_at);
        if (consumePlacementCelebrationKey(key)) {
          setCelebrationCompact(false);
          setCelebrationApp(candidate);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [familyId]);

  const isAwaitingStartApproval = (app: any) => {
    return ['accepted', 'hired'].includes(app.status) && app.family_start_approved === false;
  };

  const awaitingApproval = useMemo(
    () => applications.filter((app) => isAwaitingStartApproval(app) || app.status === 'pending_family_approval'),
    [applications]
  );
  const activePlacements = useMemo(
    () => applications.filter((app) => {
      if (app.status === 'active') return true;
      if (['accepted', 'hired'].includes(app.status)) {
        return app.family_start_approved !== false;
      }
      return false;
    }),
    [applications]
  );
  const completedPlacements = useMemo(
    () => applications.filter((app) => app.status === 'completed'),
    [applications]
  );

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatTimestamp = (value: any) => {
    const date = toDate(value);
    return date ? date.toLocaleDateString() : 'Unknown';
  };

  const handleApproveCompletion = async (app: any) => {
    if (updatingId) return;
    setUpdatingId(app.id);
    try {
      await updateApplicationStatus(app.id, 'completed', { actorRole: 'family' });
      await recordCareHistoryFromApplication(app.id);

      if (app.nanny_id) {
        await addNannyNotification(
          app.nanny_id,
          'Family approved completion',
          `The family approved completion for ${app.jobs?.title || 'your placement'}.`,
          '/nanny/applications'
        );
      }

      if (app.agency_id) {
        await addAgencyNotification(
          app.agency_id,
          'Family approved completion',
          `The family approved completion for ${app.jobs?.title || 'a placement'}.`,
          '/agency/applications'
        );
      }

      await loadData();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApproveStart = async (app: any) => {
    if (updatingId) return;
    setUpdatingId(app.id);
    try {
      await updateApplicationCareSession(app.id, {
        family_start_approved: true,
        family_start_approved_at: new Date().toISOString(),
      });

      if (app.nanny_id) {
        await addNannyNotification(
          app.nanny_id,
          'Family approved placement start',
          `The family approved start for ${app.jobs?.title || 'your placement'}. You can start when ready.`,
          '/nanny/applications'
        );
      }

      if (app.agency_id) {
        await addAgencyNotification(
          app.agency_id,
          'Family approved placement start',
          `The family approved start for ${app.jobs?.title || 'the placement'}.`,
          '/agency/applications'
        );
      }

      await loadData();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestChanges = async (app: any) => {
    if (updatingId) return;
    setUpdatingId(app.id);
    try {
      await updateApplicationStatus(app.id, 'active', { actorRole: 'family', note: 'Family requested follow-up before completion approval.' });

      if (app.nanny_id) {
        await addNannyNotification(
          app.nanny_id,
          'Family requested follow-up',
          `The family requested follow-up before approving completion for ${app.jobs?.title || 'your placement'}.`,
          '/nanny/applications'
        );
      }

      if (app.agency_id) {
        await addAgencyNotification(
          app.agency_id,
          'Family requested follow-up',
          `The family requested follow-up before approving completion for ${app.jobs?.title || 'a placement'}.`,
          '/agency/applications'
        );
      }

      await loadData();
    } finally {
      setUpdatingId(null);
    }
  };

  const renderPlacementCard = (app: any, actionMode: 'none' | 'start' | 'completion' = 'none') => (
    <div key={app.id} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">{STATUS_LABELS[app.status] || app.status}</p>
            {app.status === 'active' && hasSeenPlacementCelebration(buildPlacementCelebrationKey('family', familyId, app.id, app.active_at || app.updated_at)) ? (
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
          <h3 className="mt-1 text-xl font-bold text-stone-900">{app.jobs?.title || 'Placement'}</h3>
          <p className="text-sm text-stone-600 mt-1">{app.jobs?.agency_profiles?.company_name || 'Agency partner'}</p>
          <div className="mt-3 space-y-1 text-sm text-stone-600">
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-stone-400" />{app.jobs?.location_neighborhood || 'N/A'}, {app.jobs?.location_borough || 'N/A'}</p>
            <p>Schedule: {app.jobs ? formatJobSchedule(app.jobs) : 'TBD'}</p>
            <p>Nanny: {app.nanny_profiles?.first_name || ''} {app.nanny_profiles?.last_name || ''}</p>
            <p>Updated: {formatTimestamp(app.updated_at)}</p>
          </div>
        </div>

        {actionMode !== 'none' ? (
          <div className="flex flex-col gap-2 md:min-w-[220px]">
            <button
              type="button"
              onClick={() => actionMode === 'start' ? handleApproveStart(app) : handleApproveCompletion(app)}
              disabled={updatingId === app.id}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {actionMode === 'start' ? 'Approve Placement Start' : 'Approve Completion'}
            </button>
            {actionMode === 'completion' ? (
              <button
                type="button"
                onClick={() => handleRequestChanges(app)}
                disabled={updatingId === app.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                Request Follow-up
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to review placements.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <PlacementHandshakeModal
        open={!!celebrationApp}
        onClose={() => {
          setCelebrationApp(null);
          setCelebrationCompact(false);
        }}
        jobTitle={celebrationApp?.jobs?.title}
        agencyName={celebrationApp?.jobs?.agency_profiles?.company_name || celebrationApp?.agency_name}
        familyName={user?.email || 'Family'}
        nannyName={celebrationApp?.nanny_profiles?.first_name ? `${celebrationApp.nanny_profiles.first_name} ${celebrationApp.nanny_profiles?.last_name || ''}`.trim() : 'Nanny'}
        compact={celebrationCompact}
      />

      <div>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Placement Approvals</h1>
        <p className="mt-1 text-stone-500">Review nanny completion requests and manage active placements on the shared lifecycle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Awaiting Approval</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{awaitingApproval.length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Active</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{activePlacements.length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Completed</p>
          <p className="mt-3 text-3xl font-bold text-stone-900">{completedPlacements.length}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-stone-900 inline-flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          Awaiting Your Approval
        </h2>
        {loading ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading placements...</div>
        ) : awaitingApproval.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">No placements are waiting for your sign-off.</div>
        ) : (
          <div className="space-y-4">
            {awaitingApproval.map((app) => renderPlacementCard(app, isAwaitingStartApproval(app) ? 'start' : 'completion'))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Active Placements</h2>
        {activePlacements.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">No active placements right now.</div>
        ) : (
          <div className="space-y-4">{activePlacements.map((app) => renderPlacementCard(app, 'none'))}</div>
        )}
      </section>
    </div>
  );
}
