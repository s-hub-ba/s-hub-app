import { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { Trophy, Star, Briefcase, CalendarClock, Clock3, IdCard, Megaphone } from 'lucide-react';
import {
  getApplicationsForNanny,
  getFollowedAgencyPostsForNanny,
  getJobs,
  getNannyById,
  getNannyOfficialShiftScore,
} from '../../lib/api';
import { getApiBaseUrl } from '../../lib/apiBase';
import { useAuth } from '../../contexts/AuthContext';
import NannyCvidCardModal from '../../components/NannyCvidCardModal';

type ScheduleEventLite = {
  id: string;
  type: string;
  status: string;
  start: string;
  title: string;
};

type ShiftScoreTier = {
  index: number;
  label: string;
  className: string;
};

const SHIFT_SCORE_TIERS: ShiftScoreTier[] = [
  { index: 0, label: 'Beginner', className: 'bg-stone-100 text-stone-700' },
  { index: 1, label: 'Momentum Maven', className: 'bg-sky-100 text-sky-700' },
  { index: 2, label: 'Care Catalyst', className: 'bg-indigo-100 text-indigo-700' },
  { index: 3, label: 'Rising Star', className: 'bg-amber-100 text-amber-700' },
  { index: 4, label: 'Top Notch', className: 'bg-emerald-100 text-emerald-700' },
];

const getShiftScoreTierIndex = (score: number): number => {
  if (score >= 5) return 4;
  if (score >= 4) return 3;
  if (score >= 3) return 2;
  if (score >= 2) return 1;
  return 0;
};

const API_BASE = getApiBaseUrl();

async function getSchedulingEvents(): Promise<ScheduleEventLite[]> {
  const auth = getAuth();
  const user = auth.currentUser;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (user) {
    const token = await user.getIdToken();
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    (headers as Record<string, string>)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
  }

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(`${API_BASE}/api/scheduling/events?rangeStart=${encodeURIComponent(rangeStart)}&rangeEnd=${encodeURIComponent(rangeEnd)}`, {
    headers,
  });

  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.events) ? payload.events : [];
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function NannyDashboard() {
  const { user } = useAuth();
  const nannyId = user?.uid || '';

  const [profile, setProfile] = useState<any>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [followedAgencyPosts, setFollowedAgencyPosts] = useState<any[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventLite[]>([]);
  const [shiftScore, setShiftScore] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [verifiedDocCount, setVerifiedDocCount] = useState(0);
  const [docBonus, setDocBonus] = useState(0);
  const [showCvidModal, setShowCvidModal] = useState(false);
  const [levelUpTier, setLevelUpTier] = useState<ShiftScoreTier | null>(null);
  const [shiftScoreLoaded, setShiftScoreLoaded] = useState(false);

  const currentTier = useMemo(() => {
    const tierIndex = getShiftScoreTierIndex(shiftScore);
    return SHIFT_SCORE_TIERS[tierIndex];
  }, [shiftScore]);

  useEffect(() => {
    const loadData = async () => {
      if (!nannyId) return;

      try {
        const [apps, fetchedProfile, scoreData, jobs, events, posts] = await Promise.all([
          getApplicationsForNanny(nannyId),
          getNannyById(nannyId),
          getNannyOfficialShiftScore(),
          getJobs(),
          getSchedulingEvents(),
          getFollowedAgencyPostsForNanny(nannyId, 6),
        ]);

        const completion = Math.round((Number(scoreData?.details?.completedFields || 0) / Math.max(1, Number(scoreData?.details?.totalFields || 1))) * 100);

        setProfile(fetchedProfile);
        setApplications(apps);
        setRecommendedJobs(jobs.slice(0, 2));
        setFollowedAgencyPosts(posts);
        setScheduleEvents(events);
        setShiftScore(Number(scoreData?.score || 0));
        setProfileCompletion(completion);
        setVerifiedDocCount(Number(scoreData?.details?.verifiedDocumentCount || 0));
        setDocBonus(Number(scoreData?.details?.documentBonus || 0));
        setShiftScoreLoaded(true);
      } catch (error) {
        console.error('Error loading nanny dashboard:', error);
        setShiftScoreLoaded(true);
      }
    };

    void loadData();
  }, [nannyId]);

  useEffect(() => {
    if (!nannyId || !shiftScoreLoaded) return;

    const currentTierIndex = getShiftScoreTierIndex(shiftScore);
    const storageKey = `nanny-shiftscore-tier:${nannyId}`;
    const storedRaw = window.localStorage.getItem(storageKey);

    if (storedRaw === null) {
      window.localStorage.setItem(storageKey, String(currentTierIndex));
      return;
    }

    const previousTierIndex = Number(storedRaw);
    if (Number.isNaN(previousTierIndex)) {
      window.localStorage.setItem(storageKey, String(currentTierIndex));
      return;
    }

    if (currentTierIndex !== previousTierIndex) {
      setLevelUpTier(SHIFT_SCORE_TIERS[currentTierIndex]);
      window.localStorage.setItem(storageKey, String(currentTierIndex));
      return;
    }
  }, [nannyId, shiftScore, shiftScoreLoaded]);

  useEffect(() => {
    if (!levelUpTier) return;
    const timer = window.setTimeout(() => setLevelUpTier(null), 4000);
    return () => window.clearTimeout(timer);
  }, [levelUpTier]);

  const pendingOffers = useMemo(() => {
    return scheduleEvents
      .filter((event) => event.type === 'shift_offer' && event.status === 'offered')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 2);
  }, [scheduleEvents]);

  const upcomingShifts = useMemo(() => {
    const now = Date.now();
    return scheduleEvents
      .filter((event) => {
        const start = new Date(event.start).getTime();
        return start > now
          && ['accepted', 'confirmed'].includes(event.status)
          && ['shift_offer', 'booking_confirmed'].includes(event.type);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 2);
  }, [scheduleEvents]);

  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at))
      .slice(0, 2);
  }, [applications]);

  const missingForHundred = useMemo(() => {
    const missing: string[] = [];
    if (!profile) return missing;

    if (!profile.first_name) missing.push('First name');
    if (!profile.last_name) missing.push('Last name');
    if (!profile.phone_number) missing.push('Phone number');
    if (!profile.bio) missing.push('Professional bio');
    if (!profile.location_borough) missing.push('Borough/location');
    if (!profile.years_experience) missing.push('Years of experience');
    if (!Array.isArray(profile.certifications) || profile.certifications.length === 0) missing.push('At least one certification');
    if (!profile.availability || Object.keys(profile.availability).length === 0) missing.push('Availability schedule');
    if (profile.expected_pay_min == null) missing.push('Expected pay minimum');
    if (profile.expected_pay_max == null) missing.push('Expected pay maximum');

    return missing;
  }, [profile]);

  if (!nannyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view your dashboard.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
            Welcome back, {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : user?.email ?? 'Nanny'}
          </h1>
          <p className="text-stone-500 mt-1">Your growth and shift activity at a glance.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCvidModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <IdCard className="h-4 w-4" />
            CVID Card
          </button>
          <Link to="/nanny/profile" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
            Update Profile
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wider text-stone-500">ShiftScore</p>
          <div className="mt-2 flex items-end gap-2">
            <h2 className="text-4xl font-bold text-stone-900">{shiftScore}</h2>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${currentTier.className}`}>{currentTier.label}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">{verifiedDocCount} approved docs • +{docBonus} score bonus • Tier {currentTier.index + 1}/5</p>
        </div>

        {profileCompletion < 100 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-stone-500">Profile Completion</p>
            <h2 className="mt-2 text-4xl font-bold text-stone-900">{profileCompletion}%</h2>
            <p className="mt-2 text-xs text-stone-500">Complete your profile milestones to boost visibility.</p>
            {missingForHundred.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">Missing For 100%</p>
                <ul className="mt-2 space-y-1">
                  {missingForHundred.map((item) => (
                    <li key={item} className="text-xs text-stone-700">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-amber-700">Milestone Unlocked</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-stone-900">
              Profile Completed
              <Trophy className="h-6 w-6 text-amber-600" />
            </h2>
            <p className="mt-2 text-sm text-stone-700">Your ShiftScore is increasing with every completed action.</p>
          </div>
        )}

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wider text-stone-500">CVID</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-900">{profile?.cvid || 'Pending'}</h2>
          <p className="mt-2 text-xs text-stone-500">{verifiedDocCount} approved verification docs</p>
          <button
            type="button"
            onClick={() => setShowCvidModal(true)}
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <IdCard className="h-3.5 w-3.5" />
            View CVID card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-stone-900"><CalendarClock className="h-5 w-5 text-emerald-600" />Upcoming Shifts</h3>
          <div className="mt-4 space-y-3">
            {upcomingShifts.length === 0 ? (
              <p className="text-sm text-stone-500">No upcoming confirmed shifts.</p>
            ) : upcomingShifts.map((shift) => (
              <div key={shift.id} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-sm font-semibold text-stone-900">{shift.title || 'Upcoming shift'}</p>
                <p className="text-xs text-stone-500">{new Date(shift.start).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-stone-900"><Clock3 className="h-5 w-5 text-orange-600" />Pending Offers</h3>
          <div className="mt-4 space-y-3">
            {pendingOffers.length === 0 ? (
              <p className="text-sm text-stone-500">No pending shift offers right now.</p>
            ) : pendingOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
                <p className="text-sm font-semibold text-stone-900">{offer.title || 'Shift offer'}</p>
                <p className="text-xs text-stone-500">Starts {new Date(offer.start).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-stone-900"><Briefcase className="h-5 w-5 text-blue-600" />Recent Applications</h3>
          <div className="mt-4 space-y-3">
            {recentApplications.length === 0 ? (
              <p className="text-sm text-stone-500">No recent applications yet.</p>
            ) : recentApplications.map((app) => (
              <div key={app.id} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-sm font-semibold text-stone-900">{app.jobs?.title || 'Application'}</p>
                <p className="text-xs text-stone-500">Status: {String(app.status || 'applied').replaceAll('_', ' ')}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-900 inline-flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-rose-600" />
            Posts From Agencies You Follow
          </h2>
          <Link to="/agencies" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Explore agencies</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {followedAgencyPosts.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-stone-500 md:col-span-2">
              No updates yet from followed agencies.
            </div>
          ) : followedAgencyPosts.map((post) => (
            <div key={post.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{post.agency_name || 'Agency update'}</p>
              <h3 className="mt-1 text-base font-bold text-stone-900">{post.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-stone-600">{post.content}</p>
              <p className="mt-3 text-[11px] text-stone-400">{post.created_at ? new Date(post.created_at?.seconds ? post.created_at.seconds * 1000 : post.created_at).toLocaleString() : 'Recently posted'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-900">Recommended Jobs</h2>
          <Link to="/nanny/jobs" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recommendedJobs.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-stone-500">No recommended jobs at the moment.</div>
          ) : recommendedJobs.map((job) => (
            <div key={job.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-stone-900">{job.title}</h3>
                  <p className="mt-1 text-sm text-stone-500">{job.agency_profiles?.company_name || 'Agency'}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">${job.pay_min ?? '--'}-${job.pay_max ?? '--'}/hr</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-stone-600">{job.description}</p>
              <Link to="/nanny/jobs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-900 hover:text-emerald-700">
                <Star className="h-4 w-4" />
                Apply from marketplace
              </Link>
            </div>
          ))}
        </div>
      </section>

      <NannyCvidCardModal
        isOpen={showCvidModal}
        nanny={{
          id: profile?.id || nannyId,
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          photo_url: profile?.photo_url,
          location_borough: profile?.location_borough,
          years_experience: profile?.years_experience,
          expected_pay_min: profile?.expected_pay_min,
          expected_pay_max: profile?.expected_pay_max,
          approved_certifications: profile?.approved_certifications,
          preferred_job_types: profile?.preferred_job_types,
          bio: profile?.bio,
          cvid: profile?.cvid || 'Pending',
        }}
        shiftScore={shiftScore}
        onClose={() => setShowCvidModal(false)}
      />

      {levelUpTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-2xl animate-[fadeIn_220ms_ease-out]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 animate-bounce">
              <Trophy className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Tier Updated</p>
            <h3 className="mt-2 text-2xl font-bold text-stone-900">{levelUpTier.label}</h3>
            <p className="mt-2 text-sm text-stone-600">Your ShiftScore tier changed. Keep improving your profile and verified signals to move higher.</p>
            <button
              type="button"
              onClick={() => setLevelUpTier(null)}
              className="mt-5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
            >
              Awesome
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
