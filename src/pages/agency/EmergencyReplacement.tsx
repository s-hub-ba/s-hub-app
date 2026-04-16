import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, MapPin, Send, ShieldCheck, Timer, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  getAgencyTalentPool,
  getNannyBgStatusMap,
  getNannyReviewSummary,
  resolveAgencyIdForUser,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

type PoolCandidate = {
  nannyId: string;
  fullName: string;
  borough: string;
  reliability: number;
  bgStatus: 'checked' | 'not_checked' | 'expired';
  bgConfidence: number;
};

type RankedCandidate = PoolCandidate & {
  score: number;
  distanceLabel: string;
  availabilityMatch: boolean;
  reasons: string[];
};

type ShiftOfferLite = {
  id: string;
  status: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function getAuthHeaders(): Promise<HeadersInit> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  return {
    'x-user-id': localStorage.getItem('dev_user_id') ?? '',
    'Content-Type': 'application/json',
  };
}

async function getNannyAvailability(nannyId: string, rangeStart: string, rangeEnd: string): Promise<Array<{ start: string; end: string }>> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE}/api/scheduling/availability/${encodeURIComponent(nannyId)}?rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`,
    { headers },
  );

  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.availability) ? payload.availability : [];
}

async function createShiftOffer(input: {
  nannyId: string;
  startAt: string;
  endAt: string;
  title: string;
  locationGeneral: string;
  notesVisible?: string;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/scheduling/shift-offer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nannyId: input.nannyId,
      startAt: input.startAt,
      endAt: input.endAt,
      title: input.title,
      locationGeneral: input.locationGeneral,
      notesVisible: input.notesVisible || '',
      metadata: {
        urgency: 'high',
        source: 'agency_created',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to send emergency offer');
  }

  return payload as { primaryId: string; eventIds: string[] };
}

async function getShiftOfferStatuses(rangeStart: string, rangeEnd: string): Promise<ShiftOfferLite[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE}/api/scheduling/events?rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`,
    { headers },
  );

  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  if (!Array.isArray(payload?.events)) return [];

  return payload.events.map((event: any) => ({
    id: String(event.id || ''),
    status: String(event.status || ''),
  }));
}

function overlapsAvailability(
  availability: Array<{ start: string; end: string }>,
  shiftStart: Date,
  shiftEnd: Date,
): boolean {
  const shiftStartMs = shiftStart.getTime();
  const shiftEndMs = shiftEnd.getTime();

  return availability.some((slot) => {
    const slotStart = new Date(slot.start).getTime();
    const slotEnd = new Date(slot.end).getTime();
    if (Number.isNaN(slotStart) || Number.isNaN(slotEnd)) return false;
    return slotStart <= shiftStartMs && slotEnd >= shiftEndMs;
  });
}

function scoreDistance(targetBorough: string, candidateBorough: string) {
  const normalizedTarget = targetBorough.trim().toLowerCase();
  const normalizedCandidate = candidateBorough.trim().toLowerCase();

  if (!normalizedTarget || !normalizedCandidate) {
    return { points: 6, label: 'Distance unknown' };
  }

  if (normalizedTarget === normalizedCandidate) {
    return { points: 20, label: 'Same area' };
  }

  return { points: 8, label: 'Further area' };
}

export default function AgencyEmergencyReplacement() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [agencyId, setAgencyId] = useState('');
  const [loadingBase, setLoadingBase] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shiftTitle, setShiftTitle] = useState('Emergency Childcare Coverage');
  const [locationArea, setLocationArea] = useState('Manhattan');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [notes, setNotes] = useState('Please confirm as soon as possible. This is a high-priority replacement request.');

  const [poolCandidates, setPoolCandidates] = useState<PoolCandidate[]>([]);
  const [rankedMatches, setRankedMatches] = useState<RankedCandidate[]>([]);
  const [findingMatches, setFindingMatches] = useState(false);
  const [sendingOffers, setSendingOffers] = useState(false);

  const [sentOfferIds, setSentOfferIds] = useState<string[]>([]);
  const [viewedCount, setViewedCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);

  const isShiftWindowValid = useMemo(() => {
    if (!startAt || !endAt) return false;
    return new Date(endAt).getTime() > new Date(startAt).getTime();
  }, [startAt, endAt]);

  useEffect(() => {
    const toInput = (value: Date) => {
      const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    };

    const paramStart = searchParams.get('startAt');
    const paramEnd = searchParams.get('endAt');
    const paramArea = searchParams.get('area');
    const paramTitle = searchParams.get('title');

    if (paramArea) setLocationArea(decodeURIComponent(paramArea));
    if (paramTitle) setShiftTitle(decodeURIComponent(paramTitle));

    if (paramStart) {
      const d = new Date(decodeURIComponent(paramStart));
      if (!Number.isNaN(d.getTime())) setStartAt(toInput(d));
    } else {
      const now = new Date();
      setStartAt(toInput(new Date(now.getTime() + 90 * 60 * 1000)));
    }

    if (paramEnd) {
      const d = new Date(decodeURIComponent(paramEnd));
      if (!Number.isNaN(d.getTime())) setEndAt(toInput(d));
    } else {
      const now = new Date();
      setEndAt(toInput(new Date(now.getTime() + 90 * 60 * 1000 + 4 * 60 * 60 * 1000)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!user?.uid) {
        setLoadingBase(false);
        return;
      }

      try {
        const resolved = await resolveAgencyIdForUser(user.uid);
        if (!resolved) {
          setLoadingBase(false);
          return;
        }

        setAgencyId(resolved);
        const poolItems = await getAgencyTalentPool(resolved);
        const nannyIds = Array.from(new Set(poolItems.map((item) => item.nanny_id).filter(Boolean)));

        const [bgMap, summaryRows] = await Promise.all([
          getNannyBgStatusMap(nannyIds),
          Promise.all(nannyIds.map(async (nannyId) => ({ nannyId, summary: await getNannyReviewSummary(nannyId) }))),
        ]);

        const summaryByNanny = Object.fromEntries(summaryRows.map((row) => [row.nannyId, row.summary]));

        const candidates: PoolCandidate[] = poolItems.map((item) => {
          const profile = (item.nanny_profile || {}) as any;
          const bg = bgMap[item.nanny_id] || { status: 'not_checked', confidence: 0 };
          const summary = summaryByNanny[item.nanny_id];

          return {
            nannyId: item.nanny_id,
            fullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Nanny',
            borough: profile.location_borough || 'Unknown',
            reliability: Number(summary?.averageReliability || 0),
            bgStatus: (bg.status || 'not_checked') as 'checked' | 'not_checked' | 'expired',
            bgConfidence: Number(bg.confidence || 0),
          };
        });

        setPoolCandidates(candidates);
      } catch (initError: any) {
        setError(initError?.message || 'Unable to load emergency matching context.');
      } finally {
        setLoadingBase(false);
      }
    };

    init();
  }, [user]);

  useEffect(() => {
    if (sentOfferIds.length === 0 || !isShiftWindowValid) return;

    const poll = async () => {
      const start = new Date(startAt).toISOString();
      const end = new Date(new Date(endAt).getTime() + 48 * 60 * 60 * 1000).toISOString();
      const statuses = await getShiftOfferStatuses(start, end);
      const sent = statuses.filter((event) => sentOfferIds.includes(event.id));

      const viewed = sent.filter((event) => ['accepted', 'declined', 'confirmed', 'cancelled', 'completed'].includes(event.status));
      const accepted = sent.filter((event) => ['accepted', 'confirmed', 'completed'].includes(event.status));

      setViewedCount(viewed.length);
      setAcceptedCount(accepted.length);
    };

    poll();
    const intervalId = window.setInterval(poll, 8000);
    return () => window.clearInterval(intervalId);
  }, [sentOfferIds, startAt, endAt, isShiftWindowValid]);

  const findMatchesFast = async () => {
    if (!isShiftWindowValid) {
      setError('Please select a valid start and end time first.');
      return;
    }

    setError(null);
    setFindingMatches(true);

    try {
      const shiftStartIso = new Date(startAt).toISOString();
      const shiftEndIso = new Date(endAt).toISOString();
      const shiftStart = new Date(shiftStartIso);
      const shiftEnd = new Date(shiftEndIso);

      const rankedRows = await Promise.all(poolCandidates.map(async (candidate) => {
        const isRisky = candidate.bgStatus !== 'checked' || candidate.bgConfidence < 60;
        if (isRisky) return null;

        const availability = await getNannyAvailability(candidate.nannyId, shiftStartIso, shiftEndIso);
        const availabilityMatch = overlapsAvailability(availability, shiftStart, shiftEnd);
        if (!availabilityMatch) return null;

        const distance = scoreDistance(locationArea, candidate.borough);
        const reliabilityPoints = Math.round(Math.min(5, candidate.reliability) * 12);
        const confidencePoints = Math.round(Math.min(100, candidate.bgConfidence) / 10);
        const score = reliabilityPoints + distance.points + confidencePoints + 20;

        const reasons = [
          `${candidate.reliability.toFixed(1)}/5 reliability`,
          `${distance.label}`,
          `${candidate.bgConfidence}% background confidence`,
        ];

        return {
          ...candidate,
          score,
          distanceLabel: distance.label,
          availabilityMatch,
          reasons,
        } as RankedCandidate;
      }));

      const best = rankedRows
        .filter((entry): entry is RankedCandidate => Boolean(entry))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (best.length === 0) {
        setError('No available candidates found for this window. Candidates may be unavailable or need updated background checks (≥60% confidence required).');
      }

      setRankedMatches(best);
      setSentOfferIds([]);
      setViewedCount(0);
      setAcceptedCount(0);
    } catch (matchError: any) {
      setError(matchError?.message || 'Unable to rank emergency matches.');
    } finally {
      setFindingMatches(false);
    }
  };

  const handleSendRanked = async () => {
    if (!isShiftWindowValid || rankedMatches.length === 0) {
      setError('Find matches first before sending ranked offers.');
      return;
    }

    setSendingOffers(true);
    setError(null);

    try {
      const createdOfferIds: string[] = [];
      const shiftStartIso = new Date(startAt).toISOString();
      const shiftEndIso = new Date(endAt).toISOString();

      for (const candidate of rankedMatches) {
        const result = await createShiftOffer({
          nannyId: candidate.nannyId,
          startAt: shiftStartIso,
          endAt: shiftEndIso,
          title: shiftTitle.trim() || 'Emergency Childcare Coverage',
          locationGeneral: locationArea.trim() || 'NYC',
          notesVisible: notes,
        });

        if (result?.primaryId) createdOfferIds.push(result.primaryId);
      }

      setSentOfferIds(createdOfferIds);
      setViewedCount(0);
      setAcceptedCount(0);
    } catch (sendError: any) {
      setError(sendError?.message || 'Failed to send ranked offers.');
    } finally {
      setSendingOffers(false);
    }
  };

  if (loadingBase) {
    return <div className="p-8 text-center text-stone-500">Loading Emergency Mode...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Agency profile not found for this account.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-900 via-orange-900 to-stone-900 p-6 text-white shadow-lg md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-0 h-40 w-40 rounded-full bg-rose-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Emergency Mode</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Find Replacement FAST</h1>
            <p className="mt-2 text-sm text-stone-200 md:text-base">Instant ranked replacements based on reliability, proximity, and safety filters.</p>
          </div>
          <Link to="/agency/calendar" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
            Back to Calendar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-rose-600" />
          <h2 className="text-lg font-bold text-stone-900">Emergency Shift Setup</h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-stone-700">Shift Title</span>
            <input
              value={shiftTitle}
              onChange={(e) => setShiftTitle(e.currentTarget.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-stone-700">Area</span>
            <input
              value={locationArea}
              onChange={(e) => setLocationArea(e.currentTarget.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-stone-700">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.currentTarget.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-stone-700">End</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.currentTarget.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-semibold text-stone-700">Nanny-facing note</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            rows={3}
            className="w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={findMatchesFast}
            disabled={findingMatches || !isShiftWindowValid}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {findingMatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Find Replacement FAST
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Filters: reliability first, distance weighted, risky profiles excluded</p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold text-stone-900">Top 5 Instant Matches</h2>
          <button
            type="button"
            onClick={handleSendRanked}
            disabled={sendingOffers || rankedMatches.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sendingOffers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to all (ranked)
          </button>
        </div>

        {rankedMatches.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500 shadow-sm">Run emergency matching to see top ranked candidates.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rankedMatches.map((candidate, idx) => (
              <article key={candidate.nannyId} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Rank #{idx + 1}</p>
                    <h3 className="mt-1 text-base font-bold text-stone-900">{candidate.fullName}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Score {candidate.score}</span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-stone-600">
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-stone-400" />{candidate.borough} ({candidate.distanceLabel})</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-stone-400" />Reliability {candidate.reliability.toFixed(1)}/5</p>
                  <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-stone-400" />BG confidence {candidate.bgConfidence}%</p>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-stone-500">
                  {candidate.reasons.map((reason) => (
                    <li key={`${candidate.nannyId}-${reason}`}>- {reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-emerald-900">Live Offer Feedback</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Dispatch</p>
            <p className="mt-1 text-sm font-bold text-stone-900">Offer sent to {sentOfferIds.length} nannies</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Engagement</p>
            <p className="mt-1 text-sm font-bold text-stone-900">{viewedCount} viewed</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Conversion</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-stone-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{acceptedCount} accepted</p>
          </div>
        </div>
      </section>
    </div>
  );
}
