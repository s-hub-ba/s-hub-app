import { useEffect, useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAgencyCapabilities, resolveAgencyIdForUser, upsertAgencyCapabilities } from '../../lib/api';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'];
const CARE_TYPES = ['full-time', 'part-time', 'occasional'];
const AGE_GROUPS = ['newborn', 'infant', 'toddler', 'preschool', 'school-age', 'teen'];

const parseCsv = (value: string) => value.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);

export default function AgencyRequestSettings() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [boroughsServed, setBoroughsServed] = useState<string[]>([]);
  const [careTypes, setCareTypes] = useState<string[]>(['full-time']);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [neighborhoodCsv, setNeighborhoodCsv] = useState('');
  const [languageCsv, setLanguageCsv] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [supportsLiveIn, setSupportsLiveIn] = useState(false);
  const [supportsLiveOut, setSupportsLiveOut] = useState(true);
  const [supportsSpecialNeeds, setSupportsSpecialNeeds] = useState(false);
  const [supportsDriverRequests, setSupportsDriverRequests] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [priorityLeadBoost, setPriorityLeadBoost] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      const resolved = await resolveAgencyIdForUser(user.uid);
      if (!resolved) {
        setLoading(false);
        return;
      }

      setAgencyId(resolved);
      const capability = await getAgencyCapabilities(resolved);
      if (capability) {
        setBoroughsServed(capability.boroughs_served || []);
        setCareTypes(capability.supported_care_types || []);
        setAgeGroups(capability.supported_age_groups || []);
        setNeighborhoodCsv((capability.neighborhoods_served || []).join(', '));
        setLanguageCsv((capability.supported_languages || []).join(', '));
        setBudgetMin(typeof capability.budget_min === 'number' ? String(capability.budget_min) : '');
        setBudgetMax(typeof capability.budget_max === 'number' ? String(capability.budget_max) : '');
        setSupportsLiveIn(!!capability.supports_live_in);
        setSupportsLiveOut(!!capability.supports_live_out);
        setSupportsSpecialNeeds(!!capability.supports_special_needs);
        setSupportsDriverRequests(!!capability.supports_driver_requests);
        setIsFeatured(!!capability.is_featured);
        setPriorityLeadBoost(!!capability.has_priority_lead_boost);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const toggleInList = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const save = async () => {
    if (!agencyId || saving) return;
    setSaving(true);
    setSaveError(null);

    const ok = await upsertAgencyCapabilities(agencyId, {
      boroughs_served: boroughsServed,
      neighborhoods_served: parseCsv(neighborhoodCsv),
      supported_care_types: careTypes,
      supported_age_groups: ageGroups,
      supports_live_in: supportsLiveIn,
      supports_live_out: supportsLiveOut,
      supports_special_needs: supportsSpecialNeeds,
      supports_driver_requests: supportsDriverRequests,
      supported_languages: parseCsv(languageCsv),
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      is_featured: isFeatured,
      has_priority_lead_boost: priorityLeadBoost,
    });

    setSaving(false);
    setSaved(ok);
    if (ok) {
      window.setTimeout(() => setSaved(false), 1500);
    } else {
      setSaveError('Unable to save settings. Please refresh and try again.');
    }
  };

  if (!user?.uid) {
    return <div className="p-8 text-center text-stone-500">Please sign in to manage matching settings.</div>;
  }

  if (loading) {
    return <div className="p-8 text-center text-stone-500">Loading matching settings...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Family Request Matching Settings</h1>
          <p className="text-stone-500 mt-1">Configure service areas and capabilities used for ranking.</p>
          {saveError ? <p className="text-sm text-red-600 mt-2">{saveError}</p> : null}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold disabled:opacity-60"
        >
          {saving ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Coverage</h2>
          <div className="flex flex-wrap gap-2">
            {BOROUGHS.map((borough) => (
              <button
                type="button"
                key={borough}
                onClick={() => toggleInList(borough.toLowerCase(), boroughsServed, setBoroughsServed)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${boroughsServed.includes(borough.toLowerCase()) ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-stone-600 border-stone-200'}`}
              >
                {borough}
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-stone-700">Neighborhoods (comma separated)</label>
          <input
            value={neighborhoodCsv}
            onChange={(e) => setNeighborhoodCsv(e.currentTarget.value)}
            placeholder="park slope, upper west side"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Care Scope</h2>
          <p className="text-sm font-semibold text-stone-700">Supported care types</p>
          <div className="flex flex-wrap gap-2">
            {CARE_TYPES.map((careType) => (
              <button
                type="button"
                key={careType}
                onClick={() => toggleInList(careType, careTypes, setCareTypes)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${careTypes.includes(careType) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-stone-600 border-stone-200'}`}
              >
                {careType}
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold text-stone-700">Supported age groups</p>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((ageGroup) => (
              <button
                type="button"
                key={ageGroup}
                onClick={() => toggleInList(ageGroup, ageGroups, setAgeGroups)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${ageGroups.includes(ageGroup) ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-stone-600 border-stone-200'}`}
              >
                {ageGroup}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Capabilities</h2>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={supportsLiveIn} onChange={(e) => setSupportsLiveIn((e.target as HTMLInputElement).checked)} />
            Supports live-in placements
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={supportsLiveOut} onChange={(e) => setSupportsLiveOut((e.target as HTMLInputElement).checked)} />
            Supports live-out placements
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={supportsSpecialNeeds} onChange={(e) => setSupportsSpecialNeeds((e.target as HTMLInputElement).checked)} />
            Supports special needs placements
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={supportsDriverRequests} onChange={(e) => setSupportsDriverRequests((e.target as HTMLInputElement).checked)} />
            Supports driver-required requests
          </label>

          <label className="block text-sm font-semibold text-stone-700">Languages (comma separated)</label>
          <input
            value={languageCsv}
            onChange={(e) => setLanguageCsv(e.currentTarget.value)}
            placeholder="english, spanish"
            className="w-full px-4 py-3 rounded-xl border border-stone-200"
          />
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Budget & Boosts</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={0}
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.currentTarget.value)}
              placeholder="Budget min"
              className="px-4 py-3 rounded-xl border border-stone-200"
            />
            <input
              type="number"
              min={0}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.currentTarget.value)}
              placeholder="Budget max"
              className="px-4 py-3 rounded-xl border border-stone-200"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Sponsored boosts still require relevance threshold and cannot outrank highly relevant non-sponsored agencies unfairly.
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured((e.target as HTMLInputElement).checked)} />
            Featured agency placement enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={priorityLeadBoost} onChange={(e) => setPriorityLeadBoost((e.target as HTMLInputElement).checked)} />
            Priority lead boost enabled
          </label>
        </section>
      </div>
    </div>
  );
}
