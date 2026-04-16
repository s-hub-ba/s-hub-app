import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  getJobs,
  getApplicationsForAgency,
  getAgencyById,
  getRecruiterSeatCount,
  resolveAgencyIdForUser,
  getAgencyConversations,
  updateInquiryStage,
  getAgencyTalentPool,
  type InquiryStage
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAgencyEntitlements } from '../../lib/entitlements';
import { formatLimit } from '../../lib/plans';

const INQUIRY_STAGE_LABELS: Record<InquiryStage, string> = {
  new: 'New',
  communicated: 'Communicated',
  done: 'Done'
};

const INQUIRY_STAGE_STYLES: Record<InquiryStage, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  communicated: 'bg-sky-50 text-sky-700 border-sky-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

type ScheduleEventLite = {
  id: string;
  type: string;
  status: string;
  start: string;
  end?: string;
  title?: string;
  locationLabel?: string;
  familyId?: string;
  nannyId?: string;
  nannyName?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function getSchedulingEvents(): Promise<ScheduleEventLite[]> {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (currentUser) {
    const token = await currentUser.getIdToken();
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    (headers as Record<string, string>)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
  }

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(`${API_BASE}/api/scheduling/events?rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`, {
    headers,
  });

  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.events) ? payload.events : [];
}

export default function AgencyDashboard() {
  const { user, role } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [isResolvingAgency, setIsResolvingAgency] = useState(true);
  const [agency, setAgency] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [seatCount, setSeatCount] = useState(0);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventLite[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const { entitlements } = useAgencyEntitlements(agencyId);
  const [stats, setStats] = useState({
    activeJobs: 0,
    pendingConfirmations: 0,
    shiftsAtRisk: 0,
    talentPool: 0,
    unassignedToday: 0
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

  const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Time TBD';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTodayShiftStatus = (event: ScheduleEventLite): 'confirmed' | 'pending' | 'risk' => {
    const hasAssignedNanny = Boolean(event.nannyId || event.nannyName);
    const eventTime = new Date(event.start).getTime();
    const withinNextHours = !Number.isNaN(eventTime) && (eventTime - Date.now()) <= 3 * 60 * 60 * 1000;

    if (!hasAssignedNanny) return 'risk';
    if (['cancelled', 'declined'].includes(event.status)) return 'risk';
    if (['confirmed', 'accepted', 'completed'].includes(event.status)) return 'confirmed';
    if (['pending', 'offered', 'draft', 'available'].includes(event.status)) {
      return withinNextHours ? 'risk' : 'pending';
    }
    return 'pending';
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
        const [agencyData, jobs, apps, conversations, talentPoolItems, seats, events] = await Promise.all([
          getAgencyById(agencyId),
          getJobs(agencyId),
          getApplicationsForAgency(agencyId),
          getAgencyConversations(agencyId),
          getAgencyTalentPool(agencyId),
          getRecruiterSeatCount(agencyId),
          getSchedulingEvents(),
        ]);

        setAgency(agencyData);

        const pendingConfirmationEvents = (events || []).filter((event: ScheduleEventLite) => ['pending', 'offered'].includes(event.status));
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const weeklyEnd = new Date(now);
        weeklyEnd.setDate(weeklyEnd.getDate() + 7);

        const todayShiftEvents = (events || []).filter((event: ScheduleEventLite) => {
          const start = new Date(event.start).getTime();
          return !Number.isNaN(start)
            && start >= todayStart.getTime()
            && start <= todayEnd.getTime()
            && ['shift_offer', 'booking_request', 'booking_confirmed'].includes(event.type);
        });

        const weekShiftEvents = (events || []).filter((event: ScheduleEventLite) => {
          const start = new Date(event.start).getTime();
          return !Number.isNaN(start)
            && start >= todayStart.getTime()
            && start <= weeklyEnd.getTime()
            && ['shift_offer', 'booking_request', 'booking_confirmed'].includes(event.type);
        });

        const unassignedToday = todayShiftEvents.filter((event: ScheduleEventLite) => !event.nannyId && !event.nannyName).length;
        const shiftsAtRisk = weekShiftEvents.filter((event: ScheduleEventLite) => getTodayShiftStatus(event) === 'risk').length;
        setSeatCount(seats);
        setScheduleEvents(events || []);
        setApplications(apps || []);
        setInquiries(((conversations || []).filter((c: any) => c.inquiry_type === 'agency_intro')).slice(0, 5));
        setStats({
          activeJobs: jobs.length,
          pendingConfirmations: pendingConfirmationEvents.length,
          shiftsAtRisk,
          talentPool: talentPoolItems.length,
          unassignedToday
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };
    loadData();
  }, [agencyId]);

  const handleInquiryStageChange = async (conversationId: string, nextStage: InquiryStage) => {
    const ok = await updateInquiryStage(conversationId, nextStage);
    if (!ok) return;

    setInquiries(prev => prev.map((inq) => (
      inq.id === conversationId ? { ...inq, inquiry_stage: nextStage } : inq
    )));
  };

  const todayShiftStripe = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return scheduleEvents
      .filter((event) => {
        const start = new Date(event.start).getTime();
        return !Number.isNaN(start)
          && start >= startOfDay.getTime()
          && start <= endOfDay.getTime()
          && ['shift_offer', 'booking_request', 'booking_confirmed'].includes(event.type);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8);
  }, [scheduleEvents]);

  const firstUnassignedShift = useMemo(() => (
    todayShiftStripe.find((event) => !event.nannyId && !event.nannyName)
  ), [todayShiftStripe]);

  const decliningReliabilityNannies = useMemo(() => {
    const recentNoShow = applications.filter((app) => app.call_outcome === 'no_show');
    return new Set(recentNoShow.map((app) => app.nanny_id).filter(Boolean)).size;
  }, [applications]);

  const highRiskThisWeek = stats.shiftsAtRisk;

  const longTermPlacementSummary = useMemo(() => {
    const activePlacementStatuses = new Set(['accepted', 'hired', 'active', 'pending_family_approval']);

    const includesAny = (value: string, tokens: string[]) => tokens.some((token) => value.includes(token));

    const classifyPlacement = (app: any): 'fullTime' | 'partTime' | 'recurring' | null => {
      const scheduleType = String(app?.jobs?.schedule_type || '').toLowerCase();
      const content = `${scheduleType} ${String(app?.jobs?.title || '')} ${String(app?.jobs?.description || '')}`.toLowerCase();

      const hasFullTime = includesAny(content, ['full-time', 'full time', 'fulltime']);
      const hasPartTime = includesAny(content, ['part-time', 'part time', 'parttime']);
      const hasRecurring = includesAny(content, ['weekly_days', 'recurring', 'recurrence', 'weekly', 'repeating', 'repeat']);
      const isTemporaryOnly = includesAny(content, ['temporary', 'one-time', 'one time', 'temp']) && !hasRecurring && !hasFullTime && !hasPartTime;

      if (isTemporaryOnly) return null;
      if (hasFullTime) return 'fullTime';
      if (hasPartTime) return 'partTime';
      if (hasRecurring) return 'recurring';
      return null;
    };

    const summary = {
      total: 0,
      fullTime: 0,
      partTime: 0,
      recurring: 0,
    };

    (applications || []).forEach((app) => {
      if (!activePlacementStatuses.has(String(app?.status || ''))) return;

      const bucket = classifyPlacement(app);
      if (!bucket) return;

      summary.total += 1;
      summary[bucket] += 1;
    });

    return summary;
  }, [applications]);

  const statusPillStyles: Record<'confirmed' | 'pending' | 'risk', string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    risk: 'bg-rose-100 text-rose-700 border-rose-200'
  };

  if (isResolvingAgency) {
    return <div className="p-8 text-center text-stone-500">Loading agency dashboard...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view agency dashboard.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900 p-6 text-white shadow-lg md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-0 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Agency Home</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Today Operations</h1>
            <p className="mt-2 text-sm text-stone-200 md:text-base">Your operational heartbeat for urgent shift action. Use Calendar for full planning and weekly overview.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/agency/calendar" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-stone-900 shadow-md transition hover:bg-stone-100">
              <CalendarClock className="h-4 w-4" />
              Open Calendar
            </Link>
            <Link to="/agency/messages" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
              <ArrowRight className="h-4 w-4" />
              Team Inbox
            </Link>
          </div>
        </div>

      </section>

      <section>
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Urgent Block</p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-rose-900">
                <AlertTriangle className="h-6 w-6" />
                {stats.shiftsAtRisk} shifts at risk
              </h2>
            </div>
            <Link to="/agency/calendar" className="inline-flex items-center gap-2 self-start rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
              Resolve in Calendar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Link
              to={firstUnassignedShift
                ? `/agency/emergency?startAt=${encodeURIComponent(firstUnassignedShift.start)}&endAt=${encodeURIComponent(firstUnassignedShift.end || new Date(new Date(firstUnassignedShift.start).getTime() + 4 * 60 * 60 * 1000).toISOString())}&area=${encodeURIComponent(firstUnassignedShift.locationLabel || '')}&title=${encodeURIComponent(firstUnassignedShift.title || 'Emergency Childcare Coverage')}`
                : '/agency/emergency'
              }
              className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 hover:border-rose-300"
            >
              <p className="font-bold text-rose-700">🔴 No nanny assigned</p>
              <p className="mt-1 text-xs text-stone-500">{firstUnassignedShift ? `Today ${formatTime(firstUnassignedShift.start)}` : 'No unassigned shifts today'}</p>
              <p className="mt-1 text-xs font-semibold text-rose-600">→ Find replacement</p>
            </Link>
            <Link to="/agency/calendar" className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-stone-700 hover:border-amber-300">
              <p className="font-bold text-amber-700">🟡 Pending confirmations</p>
              <p className="mt-1 text-xs text-stone-500">{stats.pendingConfirmations} needing action</p>
            </Link>
            <Link to="/agency/messages" className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm text-stone-700 hover:border-sky-300">
              <p className="font-bold text-sky-700">🔵 Family inquiry follow-ups</p>
              <p className="mt-1 text-xs text-stone-500">{inquiries.length} recent conversations</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Today's Shifts</h2>
            <p className="text-sm text-stone-500">Operational strip for current-day execution.</p>
          </div>
          <Link to="/agency/calendar" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Open full calendar</Link>
        </div>

        {todayShiftStripe.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-sm text-stone-500 shadow-sm">No shifts on today's timeline yet.</div>
        ) : (
          <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
            {todayShiftStripe.map((event) => {
              const status = getTodayShiftStatus(event);
              const area = event.locationLabel || 'Area TBD';
              const defaultEnd = new Date(new Date(event.start).getTime() + 4 * 60 * 60 * 1000).toISOString();
              const shiftLinkTo = status === 'risk'
                ? `/agency/emergency?startAt=${encodeURIComponent(event.start)}&endAt=${encodeURIComponent(event.end || defaultEnd)}&area=${encodeURIComponent(area)}&title=${encodeURIComponent(event.title || 'Emergency Childcare Coverage')}`
                : '/agency/calendar';
              return (
                <Link key={event.id} to={shiftLinkTo} className={`min-w-[260px] max-w-[300px] rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${status === 'risk' ? 'border-rose-200 hover:border-rose-400' : 'border-stone-200'}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-stone-400">{formatTime(event.start)}</p>
                  <p className="mt-2 text-sm font-bold text-stone-900">Family · {area}</p>
                  <p className="mt-1 text-xs text-stone-500">Assigned: {event.nannyName || 'Unassigned'}</p>
                  <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillStyles[status]}`}>
                    {status === 'confirmed' ? '✅ confirmed' : status === 'pending' ? '⏳ pending' : '⚠️ risk'}
                  </span>
                  {status === 'risk' && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">→ Find replacement</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold text-stone-900">Quick Actions</h2>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">Do now</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link to="/agency/jobs/new" className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
              <div className="mb-3 h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900">Post Job</h3>
            </Link>
            <Link to="/agency/emergency" className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md">
              <div className="mb-3 h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900">Emergency Replacement</h3>
            </Link>
            <Link to="/agency/search" className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
              <div className="mb-3 h-10 w-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-stone-900">View Available Nannies</h3>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold text-stone-900">Smart Insights</h2>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-3 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <Link to="/agency/talent" className="block rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-amber-200 hover:bg-amber-50">
              <p className="text-sm font-bold text-stone-900">{decliningReliabilityNannies} nannies with declining reliability</p>
              <p className="mt-1 text-xs text-stone-500">Based on recent call no-show outcomes.</p>
            </Link>
            <Link to="/agency/calendar" className="block rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-rose-200 hover:bg-rose-50">
              <p className="text-sm font-bold text-stone-900">{highRiskThisWeek} high-risk shifts this week</p>
              <p className="mt-1 text-xs text-stone-500">Includes unassigned and near-term pending shifts.</p>
            </Link>
            <Link to="/agency/request-settings" className="block rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-teal-200 hover:bg-teal-50">
              <p className="text-sm font-bold text-stone-900">Improve match quality</p>
              <p className="mt-1 text-xs text-stone-500">Adjust matching rules to reduce emergency replacements.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Long-Term Placements</h2>
            <p className="text-sm text-stone-500">Live breakdown of active placements by schedule type.</p>
          </div>
          <Link to="/agency/applications" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Open applications</Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link to="/agency/applications?placementType=full-time" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Full-Time</p>
            <p className="mt-2 text-3xl font-black text-emerald-900">{longTermPlacementSummary.fullTime}</p>
            <p className="mt-1 text-xs text-emerald-800/80">Core full-time family placements</p>
            <p className="mt-2 text-xs font-semibold text-emerald-700">View in Applications</p>
          </Link>

          <Link to="/agency/applications?placementType=part-time" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Part-Time</p>
            <p className="mt-2 text-3xl font-black text-sky-900">{longTermPlacementSummary.partTime}</p>
            <p className="mt-1 text-xs text-sky-800/80">Ongoing part-time placements</p>
            <p className="mt-2 text-xs font-semibold text-sky-700">View in Applications</p>
          </Link>

          <Link to="/agency/applications?placementType=recurring" className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Other Recurring</p>
            <p className="mt-2 text-3xl font-black text-violet-900">{longTermPlacementSummary.recurring}</p>
            <p className="mt-1 text-xs text-violet-800/80">Recurring weekly and repeating placements</p>
            <p className="mt-2 text-xs font-semibold text-violet-700">View in Applications</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
          <span className="font-semibold text-stone-800">{longTermPlacementSummary.total}</span> active long-term placements are currently in progress.
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Recent Inquiries</h2>
            <p className="text-sm text-stone-500">Update stage inline and hand off fast.</p>
          </div>
          <Link to="/agency/messages" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">View all</Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {inquiries.length === 0 ? (
            <div className="p-6 text-sm text-stone-500">No recent inquiries yet. New family messages will appear here.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {inquiries.map((inq) => {
                const stage = (inq.inquiry_stage || 'new') as InquiryStage;
                return (
                  <article key={inq.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${INQUIRY_STAGE_STYLES[stage] || 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {INQUIRY_STAGE_LABELS[stage]}
                        </span>
                        <p className="truncate text-sm font-semibold text-stone-900">{inq.family_name || 'Family'} inquiry</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-stone-500">{inq.inquiry_description_preview || inq.last_message || 'No details'}</p>
                      <p className="mt-1 text-[11px] text-stone-400">Updated {formatDate(inq.updated_at || inq.created_at)}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                      Stage
                      <select
                        value={stage}
                        onChange={(e) => handleInquiryStageChange(inq.id, (e.target as HTMLInputElement).value as InquiryStage)}
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-700"
                      >
                        {Object.entries(INQUIRY_STAGE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
