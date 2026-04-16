import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, LogOut, XCircle } from 'lucide-react';
import { getNannyTalentPools, leaveTalentPool, respondToTalentPoolInvite, type AgencyTalentPoolItem } from '../../lib/api';

function toDateLabel(value: any) {
  if (!value) return 'Unknown date';
  const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NannyTalentPools() {
  const [items, setItems] = useState<AgencyTalentPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<AgencyTalentPoolItem | null>(null);
  const [leaveNote, setLeaveNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNannyTalentPools();
      setItems(data);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load talent-pool invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingInvites = useMemo(
    () => items.filter((item) => item.invitation_status === 'pending'),
    [items],
  );
  const activeMemberships = useMemo(
    () => items.filter((item) => item.invitation_status === 'accepted'),
    [items],
  );
  const inactiveHistory = useMemo(
    () => items.filter((item) => item.invitation_status === 'declined' || item.invitation_status === 'left'),
    [items],
  );

  const handleRespond = async (itemId: string, responseStatus: 'accepted' | 'declined') => {
    setSavingId(itemId);
    setError(null);
    setSuccess(null);
    try {
      await respondToTalentPoolInvite(itemId, responseStatus);
      setSuccess(responseStatus === 'accepted' ? 'Talent-pool invitation accepted.' : 'Talent-pool invitation declined.');
      await load();
    } catch (responseError: any) {
      setError(responseError?.message || 'Unable to update talent-pool invitation.');
    } finally {
      setSavingId(null);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    if (!leaveNote.trim()) {
      setError('Please add a short note before leaving the talent pool.');
      return;
    }

    setSavingId(leaveTarget.id);
    setError(null);
    setSuccess(null);
    try {
      await leaveTalentPool(leaveTarget.id, leaveNote.trim());
      setSuccess('You left the talent pool and the agency was notified.');
      setLeaveTarget(null);
      setLeaveNote('');
      await load();
    } catch (leaveError: any) {
      setError(leaveError?.message || 'Unable to leave the talent pool.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-stone-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading talent pools...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Talent Pools</h1>
        <p className="mt-1 text-stone-500">Accept or decline agency invitations, and leave an active pool with a required note.</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-stone-900">Pending Invitations</h2>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">{pendingInvites.length} pending</span>
        </div>
        <div className="mt-4 space-y-3">
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-stone-500">No pending talent-pool invitations.</p>
          ) : pendingInvites.map((item) => (
            <div key={item.id} className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-bold text-stone-900"><Building2 className="h-4 w-4 text-orange-600" />{item.agency_name || 'Agency'}</p>
                  <p className="mt-1 text-sm text-stone-600">Invited {toDateLabel(item.invited_at || item.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => handleRespond(item.id, 'declined')}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                  >
                    {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => handleRespond(item.id, 'accepted')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-stone-900">Active Talent Pools</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{activeMemberships.length} / 5 active</span>
        </div>
        <div className="mt-4 space-y-3">
          {activeMemberships.length === 0 ? (
            <p className="text-sm text-stone-500">You are not currently in any active agency talent pools.</p>
          ) : activeMemberships.map((item) => (
            <div key={item.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-bold text-stone-900"><Building2 className="h-4 w-4 text-emerald-600" />{item.agency_name || 'Agency'}</p>
                  <p className="mt-1 text-sm text-stone-600">Accepted {toDateLabel(item.responded_at || item.updated_at || item.created_at)}</p>
                </div>
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => { setLeaveTarget(item); setLeaveNote(''); setError(null); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Leave Pool
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">History</h2>
        <div className="mt-4 space-y-3">
          {inactiveHistory.length === 0 ? (
            <p className="text-sm text-stone-500">No declined or exited talent pools yet.</p>
          ) : inactiveHistory.map((item) => (
            <div key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-stone-900">{item.agency_name || 'Agency'}</p>
                  <p className="mt-1 text-sm capitalize text-stone-600">{item.invitation_status} on {toDateLabel(item.left_at || item.responded_at || item.updated_at)}</p>
                  {item.exclusion_note ? <p className="mt-2 text-sm text-stone-700">Reason given: {item.exclusion_note}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {leaveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-stone-900">Leave {leaveTarget.agency_name || 'this agency'} talent pool</h3>
            <p className="mt-2 text-sm text-stone-500">Add a short exclusion note. The agency will receive it with your leave notification.</p>
            <textarea
              value={leaveNote}
              onChange={(event) => setLeaveNote(event.target.value)}
              rows={5}
              className="mt-4 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-800"
              placeholder="Why are you leaving this talent pool?"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setLeaveTarget(null); setLeaveNote(''); }}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingId === leaveTarget.id}
                onClick={handleLeave}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {savingId === leaveTarget.id ? 'Submitting…' : 'Leave and submit note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
