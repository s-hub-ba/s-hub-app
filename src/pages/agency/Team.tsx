import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  addAgencyRecruiterSeat,
  getAgencyRecruiterSeats,
  removeAgencyRecruiterSeat,
  resolveAgencyIdForUser,
  type AgencyRecruiterSeat,
} from '../../lib/api';

export default function AgencyTeam() {
  const { user, role } = useAuth();

  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [planCode, setPlanCode] = useState('');
  const [seatLimit, setSeatLimit] = useState<number | null>(0);
  const [activeSeatCount, setActiveSeatCount] = useState(0);
  const [recruiters, setRecruiters] = useState<AgencyRecruiterSeat[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canAddSeat = useMemo(() => {
    if (seatLimit === null) return true;
    return activeSeatCount < seatLimit;
  }, [activeSeatCount, seatLimit]);

  const load = async (resolvedAgencyId: string, silent = false) => {
    if (!resolvedAgencyId) return;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const data = await getAgencyRecruiterSeats(resolvedAgencyId);
      setPlanCode(data.plan_code);
      setSeatLimit(data.seat_limit);
      setActiveSeatCount(data.active_seat_count);
      setRecruiters(data.recruiters);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load team seats right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const resolved = await resolveAgencyIdForUser(user.uid);
        setAgencyId(resolved || '');
        if (resolved) {
          await load(resolved);
        } else {
          setLoading(false);
        }
      } catch {
        setError('Unable to resolve agency context.');
        setLoading(false);
      }
    };

    resolveAgency();
  }, [user]);

  const handleAddRecruiter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agencyId || !canAddSeat) return;

    setError(null);
    setSuccess(null);
    setAdding(true);

    try {
      await addAgencyRecruiterSeat(agencyId, {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      setFirstName('');
      setLastName('');
      setEmail('');
      setSuccess('Recruiter added successfully.');
      await load(agencyId, true);
    } catch (addError: any) {
      setError(addError?.message || 'Unable to add recruiter seat.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRecruiter = async (recruiterId: string) => {
    if (!agencyId) return;

    setError(null);
    setSuccess(null);
    setRemovingId(recruiterId);

    try {
      await removeAgencyRecruiterSeat(agencyId, recruiterId);
      setSuccess('Recruiter removed successfully.');
      await load(agencyId, true);
    } catch (removeError: any) {
      setError(removeError?.message || 'Unable to remove recruiter seat.');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center text-stone-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading team seats...
      </div>
    );
  }

  if (role !== 'agency_admin' && role !== 'agency') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        Only agency admins can manage team seats.
      </div>
    );
  }

  if (!agencyId) {
    return <div className="text-stone-500">Agency context not found for this account.</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Team Seats</h1>
        <p className="mt-1 text-stone-500">Manage recruiter access for your agency workspace.</p>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">
            <Users className="h-4 w-4" />
            Plan: {planCode || 'free'}
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            Seats used: {activeSeatCount}{seatLimit === null ? ' / unlimited' : ` / ${seatLimit}`}
          </div>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">Add Recruiter</h2>
        <p className="mt-1 text-sm text-stone-500">Recruiters can access recruiting workflows only.</p>

        <form onSubmit={handleAddRecruiter} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            className="rounded-xl border border-stone-200 px-3 py-2"
            required
          />
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
            className="rounded-xl border border-stone-200 px-3 py-2"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Work email"
            className="rounded-xl border border-stone-200 px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={adding || !canAddSeat}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Recruiter
          </button>
        </form>

        {!canAddSeat && (
          <p className="mt-3 text-sm text-amber-700">
            Your current plan seat limit has been reached. Upgrade to add more recruiters.
          </p>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">Recruiters</h2>

        {recruiters.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No recruiter seats have been added yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recruiters.map((recruiter) => {
              const fullName = `${recruiter.first_name || ''} ${recruiter.last_name || ''}`.trim() || 'Recruiter';
              return (
                <div key={recruiter.id} className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
                  <div>
                    <p className="font-semibold text-stone-900">{fullName}</p>
                    <p className="text-sm text-stone-500">{recruiter.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecruiter(recruiter.id)}
                    disabled={removingId === recruiter.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {removingId === recruiter.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
