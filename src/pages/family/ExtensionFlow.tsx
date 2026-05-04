import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, MessageSquare, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getFamilyCareHistory,
  getFamilyPlacementApplications,
  getFamilyProfile,
  getFamilyRequestsForFamily,
  sendMessage,
  startConversation,
  submitFamilyRequestAndMatch,
  type FamilyRequestInput,
} from '../../lib/api';
import { formatCareTypeLabel } from '../../lib/jobTypes';
import { isValidEmail, isValidPhone } from '../../lib/validation';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'];

const normalizeProfileCareType = (value: unknown): FamilyRequestInput['care_type'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'part-time' || normalized === 'part time') return 'part-time';
  if (normalized === 'last-minute' || normalized === 'last minute') return 'last-minute';
  if (normalized === 'temporary' || normalized === 'occasional') return 'occasional';
  return 'full-time';
};

const inferAgeGroupsFromProfile = (children: any[]): string[] => {
  return (children || [])
    .map((c: any) => {
      const age = Number(c?.age);
      if (!Number.isFinite(age)) return null;
      if (age <= 0) return 'newborn';
      if (age <= 1) return 'infant';
      if (age <= 3) return 'toddler';
      if (age <= 5) return 'preschool';
      if (age <= 12) return 'school-age';
      return 'teen';
    })
    .filter(Boolean);
};

export default function FamilyExtensionFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const familyId = user?.uid || '';
  const fromPlacement = String(searchParams.get('fromPlacement') || '').trim();
  const hintedAgencyId = String(searchParams.get('agencyId') || '').trim();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [placementContext, setPlacementContext] = useState<any>(null);

  const [form, setForm] = useState<FamilyRequestInput>({
    parent_name: '',
    email: '',
    phone: '',
    borough: 'Manhattan',
    neighborhood: '',
    children_count: 1,
    child_age_groups: ['toddler'],
    care_type: 'full-time',
    live_in: 'live-out',
    start_date: '',
    end_date: '',
    is_flexible: false,
    schedule: '',
    budget_min: null,
    budget_max: null,
    languages: [],
    driver_required: false,
    pet_friendly: false,
    special_needs: false,
    special_requirements: '',
    notes: '',
  });

  useEffect(() => {
    const loadContext = async () => {
      if (!familyId) {
        setLoading(false);
        return;
      }

      try {
        const [profile, requests, careHistory, placements] = await Promise.all([
          getFamilyProfile(familyId),
          getFamilyRequestsForFamily(familyId),
          getFamilyCareHistory(familyId),
          getFamilyPlacementApplications(familyId),
        ]);
        const profileExtras = (profile || {}) as Record<string, any>;

        const activeRequest = (requests || []).find((request: any) =>
          ['submitted', 'matched', 'in_progress', 'accepted', 'family_chosen'].includes(String(request?.status || ''))
        ) || null;
        setActiveRequestId(activeRequest?.id || null);

        let matchedPlacement = null as any;
        if (fromPlacement) {
          matchedPlacement = (careHistory || []).find((item: any) => String(item.id || '').trim() === fromPlacement) || null;

          if (!matchedPlacement) {
            matchedPlacement = (careHistory || []).find((item: any) => {
              const agencyAppId = String(item.agency_application_id || '').trim();
              const familyAppId = String(item.family_application_id || '').trim();
              return agencyAppId === fromPlacement || familyAppId === fromPlacement;
            }) || null;
          }

          if (!matchedPlacement) {
            const app = (placements || []).find((item: any) => String(item.id || '').trim() === fromPlacement) || null;
            if (app) {
              matchedPlacement = {
                id: `application-${app.id}`,
                agency_id: app.agency_id || app.jobs?.agency_id,
                agency_name: app.jobs?.agency_profiles?.company_name || 'Agency',
                job_title: app.jobs?.title || 'Care Placement',
                job_type: app.jobs?.job_type,
                start_date: app.active_at || app.created_at,
                end_date: app.care_expected_end_at || app.care_extended_to || app.jobs?.end_date || app.updated_at,
                location_borough: app.jobs?.location_borough,
                location_neighborhood: app.jobs?.location_neighborhood,
                summary: app.call_note || 'Requesting extension of existing care placement.',
              };
            }
          }
        }

        const derivedCareType = matchedPlacement?.job_type
          ? normalizeProfileCareType(matchedPlacement.job_type)
          : profile?.care_needs
            ? normalizeProfileCareType(profile.care_needs)
            : 'full-time';

        const fallbackEnd = matchedPlacement?.end_date
          ? new Date(matchedPlacement.end_date)
          : null;
        const suggestedStart = fallbackEnd && !Number.isNaN(fallbackEnd.getTime())
          ? fallbackEnd.toISOString().slice(0, 10)
          : '';

        const suggestedEnd = (() => {
          if (!fallbackEnd || Number.isNaN(fallbackEnd.getTime())) return '';
          const next = new Date(fallbackEnd);
          next.setDate(next.getDate() + (derivedCareType === 'full-time' || derivedCareType === 'part-time' ? 90 : 14));
          return next.toISOString().slice(0, 10);
        })();

        const familyName = profile?.family_name || profile?.name || user?.email || 'Family';
        const agencyId = String(matchedPlacement?.agency_id || hintedAgencyId || '').trim();
        const agencyName = String(matchedPlacement?.agency_name || 'Agency').trim() || 'Agency';

        setPlacementContext(matchedPlacement);

        setForm((prev) => ({
          ...prev,
          parent_name: familyName,
          email: profile?.email || user?.email || '',
          phone: profile?.phone || '',
          borough: matchedPlacement?.location_borough || profile?.location_borough || prev.borough,
          neighborhood: matchedPlacement?.location_neighborhood || profile?.location_neighborhood || prev.neighborhood,
          children_count: Array.isArray(profile?.children) && profile.children.length > 0 ? profile.children.length : prev.children_count,
          child_age_groups: Array.isArray(profile?.children)
            ? inferAgeGroupsFromProfile(profile.children)
            : prev.child_age_groups,
          care_type: derivedCareType,
          start_date: suggestedStart,
          end_date: suggestedEnd,
          schedule: matchedPlacement?.summary || prev.schedule,
          budget_min: profileExtras.budget_min ?? prev.budget_min,
          budget_max: profileExtras.budget_max ?? prev.budget_max,
          languages: Array.isArray(profile?.languages) ? profile.languages : prev.languages,
          driver_required: !!profile?.driver_requirement,
          pet_friendly: !!profile?.pet_friendly,
          special_needs: !!profileExtras.special_needs,
          special_requirements: profileExtras.special_requirements || '',
          notes: [
            `Extension request for existing placement${matchedPlacement?.job_title ? `: ${matchedPlacement.job_title}` : ''}.`,
            matchedPlacement?.agency_name ? `Preferred agency continuation: ${matchedPlacement.agency_name}.` : null,
          ].filter(Boolean).join(' '),
        }));

        if (agencyId) {
          const convo = await startConversation(familyId, agencyId, familyName, agencyName);
          if (convo?.id) {
            setConversationId(convo.id);

            const introKey = `extension-intro:${familyId}:${convo.id}:${fromPlacement || 'general'}`;
            if (!sessionStorage.getItem(introKey)) {
              const introMessage = [
                `Hi ${agencyName}, I want to discuss extending our care placement${matchedPlacement?.job_title ? ` for ${matchedPlacement.job_title}` : ''}.`,
                matchedPlacement?.end_date ? `Current planned end date: ${String(matchedPlacement.end_date).slice(0, 10)}.` : null,
                'Please share next steps so we can continue care without interruption.',
              ].filter(Boolean).join('\n');

              await sendMessage(convo.id, 'family', familyId, introMessage);
              sessionStorage.setItem(introKey, '1');
            }
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to load extension flow right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadContext();
  }, [familyId, fromPlacement, hintedAgencyId, user?.email]);

  const needsDateRange = form.care_type === 'full-time' || form.care_type === 'part-time';

  const canSubmit = useMemo(() => {
    const hasValidDateRange = form.is_flexible || (!!form.start_date && !!form.end_date);
    return (
      form.parent_name.trim().length >= 2
      && isValidEmail(form.email)
      && (!form.phone || isValidPhone(form.phone))
      && form.borough.trim().length > 0
      && form.children_count > 0
      && form.child_age_groups.length > 0
      && !!form.care_type
      && (!needsDateRange || hasValidDateRange)
    );
  }, [form, needsDateRange]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (activeRequestId) {
      setError('You already have an active request. Please close it before submitting an extension request.');
      return;
    }

    if (needsDateRange && !form.is_flexible && (!form.start_date || !form.end_date)) {
      setError('Please add both a start date and end date, or mark this request as flexible.');
      return;
    }

    if (needsDateRange && form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date must be on or after start date.');
      return;
    }

    if (!canSubmit) {
      setError('Please complete all required extension details before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await submitFamilyRequestAndMatch(familyId, {
        ...form,
        notes: `${form.notes || ''}${placementContext?.id ? ` Source placement: ${placementContext.id}.` : ''}`.trim(),
      });

      if (!result.requestId) {
        setError('Unable to submit extension request right now. Please try again.');
        setSubmitting(false);
        return;
      }

      navigate(`/family/requests/${result.requestId}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to submit extension request right now. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to request a care extension.</div>;
  }

  if (loading) {
    return <div className="p-8 text-center text-stone-500">Preparing your extension request...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Extend Existing Care</h1>
          <p className="text-stone-500 mt-1">Pre-filled from your placement details. Submit once ready and continue coordination with your agency.</p>
        </div>
        <Link
          to="/family/placements"
          className="inline-flex items-center px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50"
        >
          Back to Placements
        </Link>
      </div>

      {conversationId ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-semibold">Extension discussion opened</p>
              <p className="mt-1">A direct thread with your agency was opened automatically so you can discuss extension details now.</p>
            </div>
          </div>
          <Link
            to={`/family/messages?conversation=${conversationId}`}
            className="shrink-0 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Open Thread
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          We could not determine the agency automatically. You can still submit this extension request, then choose an agency from the request results.
        </div>
      )}

      {activeRequestId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You currently have an active request. Please close it first, then return here.
          <div className="mt-3">
            <Link
              to={`/family/requests/${activeRequestId}`}
              className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              View Active Request
            </Link>
          </div>
        </div>
      ) : null}

      {placementContext ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Placement Context</p>
          <h2 className="mt-2 text-xl font-bold text-stone-900">{placementContext.job_title || 'Existing Care Placement'}</h2>
          <p className="mt-1 text-sm text-stone-600">{placementContext.agency_name || 'Agency'} • {formatCareTypeLabel(placementContext.job_type || form.care_type)}</p>
          <p className="mt-1 text-sm text-stone-600">Current end: {placementContext.end_date ? String(placementContext.end_date).slice(0, 10) : 'Not set'}</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-lg font-bold text-stone-900">Extension Details</h2>

          <input
            value={form.parent_name}
            onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.currentTarget.value }))}
            placeholder="Parent name"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.currentTarget.value }))}
            placeholder="Email"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            value={form.phone || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.currentTarget.value }))}
            placeholder="Phone"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <select
            value={form.borough}
            onChange={(e) => setForm((prev) => ({ ...prev, borough: e.currentTarget.value }))}
            className="px-4 py-3 rounded-xl border border-stone-200"
          >
            {BOROUGHS.map((borough) => (
              <option key={borough} value={borough}>{borough}</option>
            ))}
          </select>
          <input
            value={form.neighborhood || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.currentTarget.value }))}
            placeholder="Neighborhood"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <select
            value={form.care_type}
            onChange={(e) => setForm((prev) => ({ ...prev, care_type: e.currentTarget.value as FamilyRequestInput['care_type'] }))}
            className="px-4 py-3 rounded-xl border border-stone-200"
          >
            <option value="full-time">Full-Time</option>
            <option value="part-time">Part-Time</option>
            <option value="occasional">Occasional</option>
            <option value="last-minute">Last Minute</option>
          </select>

          <input
            value={form.start_date || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.currentTarget.value }))}
            type="date"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            value={form.end_date || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.currentTarget.value }))}
            type="date"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />

          <textarea
            value={form.schedule || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.currentTarget.value }))}
            placeholder="Preferred schedule details"
            rows={3}
            className="md:col-span-2 px-4 py-3 rounded-xl border border-stone-200"
          />

          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.currentTarget.value }))}
            placeholder="Additional notes for agency matching"
            rows={3}
            className="md:col-span-2 px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !!activeRequestId}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting extension...' : 'Submit Extension Request'}
          </button>

          <div className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-[0.14em]">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Matching + agency thread in one flow
          </div>
        </div>
      </form>
    </div>
  );
}
