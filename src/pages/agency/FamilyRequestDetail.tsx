import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, CircleEllipsis, MessageSquare, AlertCircle, ArrowLeft, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createDraftJobFromFamilyRequest,
  getAgencyFamilyRequestAssignment,
  resolveAgencyIdForUser,
  respondToFamilyRequestAssignment,
  type FamilyRequestAssignmentStatus,
} from '../../lib/api';
import { formatCareTypeLabel } from '../../lib/jobTypes';

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  accepted: 'Accepted',
  declined: 'Declined',
  more_details: 'More Details Requested',
};

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
  more_details: 'bg-amber-100 text-amber-700',
};

export default function AgencyFamilyRequestDetail() {
  const { user } = useAuth();
  const { assignmentId = '' } = useParams();
  const navigate = useNavigate();

  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<FamilyRequestAssignmentStatus | null>(null);
  const [message, setMessage] = useState('');
  const [row, setRow] = useState<any>(null);
  const [error, setError] = useState('');
  const [draftActionError, setDraftActionError] = useState('');
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);

  const canCreateDraftFromAssignment = (assignment: any) => {
    const request = assignment?.request;
    if (!request || !agencyId) return false;
    return request.chosen_agency_id === agencyId && request.status === 'family_chosen';
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.uid || !assignmentId) {
        setLoading(false);
        return;
      }

      const resolved = await resolveAgencyIdForUser(user.uid);
      if (!resolved) {
        setLoading(false);
        return;
      }

      const assignment = await getAgencyFamilyRequestAssignment(assignmentId);
      setAgencyId(resolved);
      setRow(assignment);
      setLoading(false);
    };

    load();
  }, [user, assignmentId]);

  const handleCreateDraftNow = async () => {
    if (!row?.request || !row?.request_id || creatingDraft) return;
    setError('');
    setDraftActionError('');
    setCreatingDraft(true);
    try {
      await createDraftJobFromFamilyRequest(row.request_id, agencyId);
      navigate('/agency/jobs?status=draft');
    } catch {
      setDraftActionError('Could not create a draft job right now. Please try again in a moment.');
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleResponse = async (status: FamilyRequestAssignmentStatus) => {
    if (!assignmentId || !agencyId || saving) return;
    setError('');
    setDraftActionError('');
    setSaving(status);
    const result = await respondToFamilyRequestAssignment(assignmentId, agencyId, status, message);
    setSaving(null);

    if (!result.ok) {
      setError('Something went wrong. Please try again.');
      return;
    }

    const updated = await getAgencyFamilyRequestAssignment(assignmentId);
    setRow(updated);

    if (status === 'accepted') {
      if (!canCreateDraftFromAssignment(updated)) {
        return;
      }

      const requestId = updated?.request_id || row?.request_id;

      try {
        if (!requestId) {
          throw new Error('Missing request id for draft creation.');
        }
        await createDraftJobFromFamilyRequest(requestId, agencyId);

        navigate('/agency/jobs?status=draft');
      } catch {
        setDraftActionError('Request accepted, but draft auto-creation did not finish. Use "Create Draft Job" below to retry.');
      }
      return;
    }

    if (status === 'more_details' && result.conversationId) {
      navigate(`/agency/messages?conversation=${result.conversationId}`);
      return;
    }

    if (status === 'declined') {
      navigate('/agency/family-requests?declined=1');
    }
  };

  const handleDeclineConfirmed = () => {
    setConfirmDecline(false);
    handleResponse('declined');
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500">Loading request...</div>;
  }

  if (!row || !row.request) {
    return (
      <div className="p-8 text-center">
        <p className="text-stone-500 mb-4">Request not found or you no longer have access.</p>
        <Link to="/agency/family-requests" className="text-emerald-600 font-semibold hover:underline">← Back to Care Marketplace</Link>
      </div>
    );
  }

  const request = row.request;
  const status: FamilyRequestAssignmentStatus = row.status;
  const isResponded = status !== 'new';
  const canCreateDraft = status === 'accepted' && canCreateDraftFromAssignment(row);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <Link to="/agency/family-requests" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Care Marketplace
          </Link>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
            {request.parent_name || 'Family'} · {request.borough || 'NYC'}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] || 'bg-stone-100 text-stone-600'}`}>
              {STATUS_LABEL[status] || status}
            </span>
            <span className="text-sm text-stone-500">Match score {row.score}/100</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Responded state */}
      {status === 'accepted' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-start gap-2 text-emerald-900">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Request accepted. Continue with these next steps:</p>
              <p className="mt-1 text-sm text-emerald-800">
                {canCreateDraft
                  ? 'Message the family to coordinate details, then create a draft job so nannies can apply.'
                  : 'Message the family to coordinate details. Draft job creation will unlock once this request is family-approved for your agency.'}
              </p>
            </div>
          </div>

          {draftActionError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {draftActionError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/agency/messages"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
            >
              <MessageSquare className="h-4 w-4" />
              Continue in Messages
            </Link>
            {canCreateDraft && (
              <button
                type="button"
                onClick={handleCreateDraftNow}
                disabled={creatingDraft}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" />
                {creatingDraft ? 'Creating Draft...' : 'Create Draft Job'}
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'declined' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          You declined this request.
        </div>
      )}

      {status === 'more_details' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 flex items-center gap-2">
          <CircleEllipsis className="h-4 w-4 shrink-0" />
          <span>You requested more details. Continue in messages with the family.</span>
          <Link to="/agency/messages" className="ml-auto underline font-semibold whitespace-nowrap">Open Messages →</Link>
        </div>
      )}

      {/* Request details */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Care Request</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Info label="Parent" value={request.parent_name} />
          <Info label="Contact Email" value={request.email} />
          <Info label="Phone" value={request.phone || 'Not provided'} />
          <Info label="Care Type" value={formatCareTypeLabel(request.care_type)} />
          <Info label="Children" value={`${request.children_count}`} />
          <Info label="Age Groups" value={(request.child_age_groups || []).join(', ') || 'Not provided'} />
          <Info label="Live-In Preference" value={request.live_in} />
          <Info label="Driver Required" value={request.driver_required ? 'Yes' : 'No'} />
          <Info label="Special Needs Support" value={request.special_needs ? 'Yes' : 'No'} />
          <Info label="Pet Friendly" value={request.pet_friendly ? 'Yes' : 'No'} />
          <Info label="Budget" value={`$${request.budget_min ?? '–'} – $${request.budget_max ?? '–'}/hr`} />
          <Info label="Start Date" value={request.start_date || 'Not specified'} />
          <Info label="End Date" value={request.end_date || (request.is_flexible ? 'Flexible' : 'Not specified')} />
          <Info label="Schedule Flexibility" value={request.is_flexible ? 'Flexible timing accepted' : 'Specific dates requested'} />
          {(request.languages || []).length > 0 && (
            <Info label="Languages" value={(request.languages || []).join(', ')} />
          )}
        </div>
        {(request.schedule || request.notes || request.special_requirements) && (
          <div className="pt-2 space-y-3 border-t border-stone-100">
            {request.schedule && <Info label="Schedule" value={request.schedule} />}
            {request.special_requirements && <Info label="Special Requirements" value={request.special_requirements} />}
            {request.notes && <Info label="Additional Notes" value={request.notes} />}
          </div>
        )}
      </div>

      {/* Match reasons */}
      {(row.reasons || []).length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-bold text-stone-900">Why This Matched Your Agency</h2>
          <ul className="space-y-2 text-sm text-stone-700">
            {(row.reasons || []).map((reason: string) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Response actions — only when status is 'new' */}
      {!isResponded && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Respond to This Request</h2>
            <p className="text-sm text-stone-500 mt-1">Accepting or asking for more details will open a direct message thread with the family.</p>
          </div>
          <textarea
            value={message}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setMessage(v);
            }}
            placeholder="Optional message to the family (shown in the conversation thread)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleResponse('accepted')}
              disabled={!!saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-60 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving === 'accepted' ? 'Accepting…' : 'Accept & Message Family'}
            </button>
            <button
              onClick={() => handleResponse('more_details')}
              disabled={!!saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold disabled:opacity-60 transition-colors"
            >
              <CircleEllipsis className="h-4 w-4" />
              {saving === 'more_details' ? 'Opening thread…' : 'Ask for More Details'}
            </button>
            <button
              onClick={() => setConfirmDecline(true)}
              disabled={!!saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-semibold disabled:opacity-60 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Decline confirmation modal */}
      {confirmDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-stone-900">Decline this request?</h3>
            <p className="text-sm text-stone-500">The family will be notified and we'll continue matching them with other agencies. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDecline(false)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclineConfirmed}
                disabled={saving === 'declined'}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
              >
                {saving === 'declined' ? 'Declining…' : 'Yes, Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-stone-400 font-semibold">{label}</p>
      <p className="text-sm text-stone-900 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
