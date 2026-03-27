import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getFamilyProfile, submitFamilyRequestAndMatch, type FamilyRequestInput } from '../../lib/api';
import { isValidEmail, isValidPhone } from '../../lib/validation';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'];
const AGE_GROUPS = ['newborn', 'infant', 'toddler', 'preschool', 'school-age', 'teen'];
const CARE_TYPES: FamilyRequestInput['care_type'][] = ['full-time', 'part-time', 'temporary'];
const LANGUAGE_CHOICES = ['English', 'Spanish', 'French', 'Mandarin', 'Cantonese', 'Russian', 'Hebrew', 'Arabic'];

export default function FamilyRequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const familyId = user?.uid || null;

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      return;
    }

    const loadProfile = async () => {
      const profile = await getFamilyProfile(familyId);
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
        care_type: (profile?.care_needs || '').toLowerCase() === 'part-time'
          ? 'part-time'
          : (profile?.care_needs || '').toLowerCase() === 'temporary'
            ? 'temporary'
            : prev.care_type,
        languages: Array.isArray(profile?.languages) ? profile.languages : prev.languages,
        driver_required: !!profile?.driver_requirement,
        pet_friendly: !!profile?.pet_friendly,
      }));
      setLoadingProfile(false);
    };

    loadProfile().catch(() => setLoadingProfile(false));
  }, [familyId]);

  const canSubmit = useMemo(() => {
    return (
      form.parent_name.trim().length >= 2
      && isValidEmail(form.email)
      && (!form.phone || isValidPhone(form.phone))
      && form.borough.trim().length > 0
      && form.children_count > 0
      && form.child_age_groups.length > 0
      && !!form.care_type
    );
  }, [form]);

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

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={submitRequest} className="space-y-6">
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-lg font-bold text-stone-900">Parent Contact</h2>
          <input
            value={form.parent_name}
            onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))}
            placeholder="Parent name"
            className="px-4 py-3 rounded-xl border border-stone-200"
            disabled={loadingProfile}
          />
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            type="email"
            className="px-4 py-3 rounded-xl border border-stone-200"
            disabled={loadingProfile}
          />
          <input
            value={form.phone || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 text-lg font-bold text-stone-900">Location & Household</h2>
          <select
            value={form.borough}
            onChange={(e) => setForm((prev) => ({ ...prev, borough: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-stone-200 bg-white"
          >
            {BOROUGHS.map((borough) => <option key={borough} value={borough}>{borough}</option>)}
          </select>
          <input
            value={form.neighborhood || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
            placeholder="Neighborhood"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            type="number"
            min={1}
            value={form.children_count}
            onChange={(e) => setForm((prev) => ({ ...prev, children_count: Math.max(1, Number(e.target.value) || 1) }))}
            placeholder="Number of children"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
          <input
            value={form.start_date || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            type="date"
            className="px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Care Preferences</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {CARE_TYPES.map((careType) => (
              <button
                type="button"
                key={careType}
                onClick={() => setForm((prev) => ({ ...prev, care_type: careType }))}
                className={`px-3 py-2.5 rounded-xl border text-sm font-semibold ${form.care_type === careType ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}
              >
                {careType}
              </button>
            ))}
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

          <textarea
            value={form.schedule || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value }))}
            placeholder="Schedule details"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
            rows={3}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              min={0}
              value={form.budget_min ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, budget_min: e.target.value ? Number(e.target.value) : null }))}
              placeholder="Budget min ($/hr)"
              className="px-4 py-3 rounded-xl border border-stone-200"
            />
            <input
              type="number"
              min={0}
              value={form.budget_max ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value ? Number(e.target.value) : null }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, driver_required: e.target.checked }))}
              />
              Driver required
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.pet_friendly}
                onChange={(e) => setForm((prev) => ({ ...prev, pet_friendly: e.target.checked }))}
              />
              Pet friendly
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={!!form.special_needs}
                onChange={(e) => setForm((prev) => ({ ...prev, special_needs: e.target.checked }))}
              />
              Special needs support
            </label>
          </div>

          <textarea
            value={form.special_requirements || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, special_requirements: e.target.value }))}
            placeholder="Special requirements"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
            rows={2}
          />

          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
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
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold disabled:opacity-60"
          >
            {submitting ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            {submitting ? 'Matching...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
