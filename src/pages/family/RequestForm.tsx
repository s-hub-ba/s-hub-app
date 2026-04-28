import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { closeFamilyRequest, getFamilyProfile, getFamilyRequestsForFamily, submitFamilyRequestAndMatch, type FamilyRequestInput } from '../../lib/api';
import { formatCareTypeLabel } from '../../lib/jobTypes';
import { isValidEmail, isValidPhone } from '../../lib/validation';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'];
const AGE_GROUPS = ['newborn', 'infant', 'toddler', 'preschool', 'school-age', 'teen'];
const CARE_TYPES: Array<{ value: FamilyRequestInput['care_type']; label: string; description: string }> = [
  { value: 'full-time', label: 'Full-Time', description: 'Longer-term placement with a deliberate interview and matching process.' },
  { value: 'part-time', label: 'Part-Time', description: 'Recurring weekly schedule with time to interview and coordinate fit.' },
  { value: 'occasional', label: 'Occasional', description: 'Flexible or recurring backup care when coverage is helpful but not urgent.' },
  { value: 'last-minute', label: 'Last Minute', description: 'Urgent coverage needed quickly, often with short notice.' },
];
const LANGUAGE_CHOICES = ['English', 'Spanish', 'French', 'Mandarin', 'Cantonese', 'Russian', 'Hebrew', 'Arabic'];

const normalizeProfileCareType = (value: unknown): FamilyRequestInput['care_type'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'part-time' || normalized === 'part time') return 'part-time';
  if (normalized === 'last-minute' || normalized === 'last minute') return 'last-minute';
  if (normalized === 'temporary' || normalized === 'occasional') return 'occasional';
  return 'full-time';
};

export default function FamilyRequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const familyId = user?.uid || null;

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [checkingExistingRequest, setCheckingExistingRequest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closingExistingRequest, setClosingExistingRequest] = useState(false);
  const [error, setError] = useState('');
  const [activeRequest, setActiveRequest] = useState<any>(null);

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
    if (!familyId) {
      setLoadingProfile(false);
      setCheckingExistingRequest(false);
      return;
    }

    const loadProfile = async () => {
      const [profile, requests] = await Promise.all([
        getFamilyProfile(familyId),
        getFamilyRequestsForFamily(familyId),
      ]);

      const currentActiveRequest = (requests || []).find((request: any) =>
        ['submitted', 'matched', 'in_progress', 'accepted', 'family_chosen'].includes(String(request?.status || ''))
      ) || null;

      setForm((prev) => ({
        ...prev,
        parent_name: profile?.family_name || profile?.name || prev.parent_name,
        email: profile?.email || prev.email,
        phone: profile?.phone || prev.phone,
        borough: profile?.location_borough || prev.borough,
        neighborhood: profile?.location_neighborhood || prev.neighborhood,
        children_count: Array.isArray(profile?.children) && profile.children.length > 0 ? profile.children.length : prev.children_count,
        child_age_groups: Array.isArray(profile?.children)
          ? profile.children
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
              .filter(Boolean)
          : prev.child_age_groups,
        care_type: profile?.care_needs ? normalizeProfileCareType(profile.care_needs) : prev.care_type,
        languages: Array.isArray(profile?.languages) ? profile.languages : prev.languages,
        driver_required: !!profile?.driver_requirement,
        pet_friendly: !!profile?.pet_friendly,
      }));
      setActiveRequest(currentActiveRequest);
      setLoadingProfile(false);
      setCheckingExistingRequest(false);
    };

    loadProfile().catch(() => {
      setLoadingProfile(false);
      setCheckingExistingRequest(false);
    });
  }, [familyId]);

  const handleCloseActiveRequest = async () => {
    if (!familyId || !activeRequest?.id || closingExistingRequest) return;

    const confirmed = window.confirm('Delete your current childcare request? Agencies that received it will be notified.');
    if (!confirmed) return;

    setClosingExistingRequest(true);
    setError('');
    try {
      const result = await closeFamilyRequest(activeRequest.id, familyId);
      if (!result.ok) {
        setError(result.error || 'Unable to delete your current request right now. Please try again.');
        return;
      }
      setActiveRequest(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to delete your current request right now. Please try again.');
    } finally {
      setClosingExistingRequest(false);
    }
  };

  const canSubmit = useMemo(() => {
    const needsDateRange = form.care_type === 'full-time' || form.care_type === 'part-time';
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
  }, [form]);

  const needsDateRange = form.care_type === 'full-time' || form.care_type === 'part-time';

  const toggleAgeGroup = (value: string) => {
    setForm((prev) => {
      const has = prev.child_age_groups.includes(value);
      return {
        ...prev,
        child_age_groups: has
          ? prev.child_age_groups.filter((v) => v !== value)
          : [...prev.child_age_groups, value],
      };
    });
  };

  const toggleLanguage = (value: string) => {
    setForm((prev) => {
      const has = (prev.languages || []).includes(value);
      return {
        ...prev,
        languages: has
          ? (prev.languages || []).filter((v) => v !== value)
          : [...(prev.languages || []), value],
      };
    });
  };

  const submitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (form.parent_name.trim().length < 2) {
      setError('Please enter a valid parent name.');
      return;
    }

    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (form.phone && !isValidPhone(form.phone)) {
      setError('Please enter a valid phone number with at least 10 digits.');
      return;
    }

    if (needsDateRange && !form.is_flexible && (!form.start_date || !form.end_date)) {
      setError('Please add both a start date and end date, or mark the request as flexible.');
      return;
    }

    if (needsDateRange && form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date must be on or after the start date.');
      return;
    }

    if ((form.budget_min ?? 0) < 0 || (form.budget_max ?? 0) < 0) {
      setError('Budget values cannot be negative.');
      return;
    }

    if (form.budget_min != null && form.budget_max != null && form.budget_max < form.budget_min) {
      setError('Budget max must be greater than or equal to budget min.');
      return;
    }

    if (!canSubmit) {
      setError('Please complete all required fields before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await submitFamilyRequestAndMatch(familyId, form);
      setSubmitting(false);

      if (!result.requestId) {
        setError('Unable to submit request right now. Please try again.');
        return;
      }

      navigate(`/family/requests/${result.requestId}`);
    } catch (error: any) {
      setSubmitting(false);
      setError(error?.message || 'Unable to submit request right now. Please try again.');
    }
  };

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to submit a request.</div>;
  }

  if (loadingProfile || checkingExistingRequest) {
    return <div className="p-8 text-center text-stone-500">Loading your request details...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Submit Childcare Request</h1>
          <p className="text-stone-500 mt-1">We match your request to agencies, not individual nannies.</p>
        </div>
        <Link
          to="/family/agencies"
          className="inline-flex items-center px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50"
        >
          Browse Agencies
        </Link>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Families never contact nannies directly. Agencies coordinate all introductions and communication.
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Families stay free. You can keep one active childcare request open at a time so agencies respond to a single clear brief.
      </div>

      {activeRequest ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-amber-900">You already have an active care request</h2>
            <p className="mt-1 text-sm text-amber-800">
              You can manage or delete your current request before submitting a new one.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">{formatCareTypeLabel(activeRequest.care_type || 'Care')} request in {activeRequest.borough || 'NYC'}</p>
            <p className="mt-1">Status: {String(activeRequest.status || 'submitted').replace(/_/g, ' ')}</p>
            <p className="mt-1">
              {activeRequest.start_date
                ? `Starts ${activeRequest.start_date}${activeRequest.end_date ? ` and ends ${activeRequest.end_date}` : ''}`
                : 'Dates are still being finalized.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/family/requests/${activeRequest.id}`}
              className="inline-flex items-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-800"
            >
              View Active Request
            </Link>
            <button
              type="button"
              onClick={handleCloseActiveRequest}
              disabled={closingExistingRequest}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {closingExistingRequest ? 'Deleting...' : 'Delete Current Request'}
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          {error}
        </div>
      )}

      {activeRequest ? null : (
      <form onSubmit={submitRequest} className="space-y-6">
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-lg font-bold text-stone-900">Parent Contact</h2>
          <input
            value={form.parent_name}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, parent_name: value }));
            }}
            placeholder="Parent name"
            className="px-4 py-3 rounded-xl border border-stone-200"
            disabled={loadingProfile}
          />
          <input
            value={form.email}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, email: value }));
            }}
            placeholder="Email"
            type="email"
            className="px-4 py-3 rounded-xl border border-stone-200"
            disabled={loadingProfile}
          />
          <input
            value={form.phone || ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, phone: value }));
            }}
            placeholder="Phone"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-lg font-bold text-stone-900">Location & Household</h2>
          <select
            value={form.borough}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, borough: value }));
            }}
            className="px-4 py-3 rounded-xl border border-stone-200 bg-white"
          >
            {BOROUGHS.map((borough) => <option key={borough} value={borough}>{borough}</option>)}
          </select>
          <input
            value={form.neighborhood || ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, neighborhood: value }));
            }}
            placeholder="Neighborhood"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            type="number"
            min={1}
            value={form.children_count}
            onChange={(e) => {
              const value = Math.max(1, Number(e.currentTarget.value) || 1);
              setForm((prev) => ({ ...prev, children_count: value }));
            }}
            placeholder="Number of children"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Care Preferences</h2>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">How to choose the right care type</p>
            <p className="mt-1">Choose Full-Time or Part-Time when you expect a more deliberate interview and placement process. Choose Occasional for flexible backup or repeating ad hoc support, and Last Minute when you need urgent coverage fast.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {CARE_TYPES.map((careType) => (
              <button
                type="button"
                key={careType.value}
                onClick={() => setForm((prev) => ({
                  ...prev,
                  care_type: careType.value,
                  end_date: careType.value === 'occasional' || careType.value === 'last-minute' ? '' : prev.end_date,
                }))}
                className={`px-4 py-3 rounded-2xl border text-left transition-colors ${form.care_type === careType.value ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
              >
                <span className="block text-sm font-semibold">{careType.label}</span>
                <span className={`mt-1 block text-xs ${form.care_type === careType.value ? 'text-stone-300' : 'text-stone-500'}`}>{careType.description}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {needsDateRange ? 'Placement Dates' : form.care_type === 'last-minute' ? 'Urgent Care Timing' : 'Occasional Care Timing'}
              </h3>
              <p className="text-sm text-stone-500 mt-1">
                {needsDateRange
                  ? 'For full-time and part-time care, add a start and end date or mark the request as flexible.'
                  : form.care_type === 'last-minute'
                    ? 'Use this when coverage is urgent and you need fast coordination from agencies.'
                    : 'Use this for flexible or recurring backup care, weekends, or date nights.'}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.is_flexible}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setForm((prev) => ({ ...prev, is_flexible: checked }));
                }}
              />
              Flexible
            </label>

            <div className={`grid grid-cols-1 ${needsDateRange ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  {needsDateRange ? 'Start date' : 'First date needed'}
                </label>
                <input
                  value={form.start_date || ''}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setForm((prev) => ({ ...prev, start_date: value }));
                  }}
                  type="date"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white"
                />
              </div>
              {needsDateRange && (
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">End date</label>
                  <input
                    value={form.end_date || ''}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setForm((prev) => ({
                        ...prev,
                        end_date: value,
                        // If an explicit end date is provided, treat the request as not flexible.
                        is_flexible: value ? false : prev.is_flexible,
                      }));
                    }}
                    type="date"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white"
                  />
                </div>
              )}
            </div>

            <textarea
              value={form.schedule || ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setForm((prev) => ({ ...prev, schedule: value }));
              }}
              placeholder={needsDateRange
                ? 'Add hours, days, school pickup details, or anything agencies should know about the weekly schedule.'
                : 'Describe the dates, hours, or situations you need care for. Example: Friday evenings, sick-day backup, weekends, or urgent coverage.'}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {(['live-in', 'live-out', 'either'] as const).map((liveIn) => (
              <button
                type="button"
                key={liveIn}
                onClick={() => setForm((prev) => ({ ...prev, live_in: liveIn }))}
                className={`px-3 py-2.5 rounded-xl border text-sm font-semibold ${form.live_in === liveIn ? 'bg-emerald-600 text-white border-emerald-600' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
              >
                {liveIn}
              </button>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-stone-700 mb-2">Child age groups</p>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((group) => (
                <button
                  type="button"
                  key={group}
                  onClick={() => toggleAgeGroup(group)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${form.child_age_groups.includes(group) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-stone-600 border-stone-200'}`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              min={0}
              value={form.budget_min ?? ''}
              onChange={(e) => {
                const rawValue = e.currentTarget.value;
                const value = rawValue === '' ? null : Math.max(0, Number(rawValue) || 0);
                setForm((prev) => ({ ...prev, budget_min: value }));
              }}
              placeholder="Budget min ($/hr)"
              className="px-4 py-3 rounded-xl border border-stone-200"
            />
            <input
              type="number"
              min={0}
              value={form.budget_max ?? ''}
              onChange={(e) => {
                const rawValue = e.currentTarget.value;
                const value = rawValue === '' ? null : Math.max(0, Number(rawValue) || 0);
                setForm((prev) => ({ ...prev, budget_max: value }));
              }}
              placeholder="Budget max ($/hr)"
              className="px-4 py-3 rounded-xl border border-stone-200"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-stone-700 mb-2">Preferred languages</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_CHOICES.map((language) => (
                <button
                  type="button"
                  key={language}
                  onClick={() => toggleLanguage(language)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${(form.languages || []).includes(language) ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-stone-600 border-stone-200'}`}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.driver_required}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({ ...prev, driver_required: checked }));
                  }}
              />
              Driver required
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.pet_friendly}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({ ...prev, pet_friendly: checked }));
                  }}
              />
              Pet friendly
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.special_needs}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({ ...prev, special_needs: checked }));
                  }}
              />
              Special needs support
            </label>
          </div>

          <textarea
            value={form.special_requirements || ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, special_requirements: value }));
            }}
            placeholder="Special requirements"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
            rows={2}
          />

          <textarea
            value={form.notes || ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setForm((prev) => ({ ...prev, notes: value }));
            }}
            placeholder="Additional notes"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
            rows={3}
          />
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            to="/family/dashboard"
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold disabled:opacity-60"
          >
            {submitting ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            {submitting ? 'Matching...' : 'Submit Request'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
