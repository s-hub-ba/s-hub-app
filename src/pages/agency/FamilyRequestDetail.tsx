import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, CircleEllipsis, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAgencyFamilyRequestAssignment,
  resolveAgencyIdForUser,
  respondToFamilyRequestAssignment,
  type FamilyRequestAssignmentStatus,
} from '../../lib/api';

export default function AgencyFamilyRequestDetail() {
  const { user } = useAuth();
  const { assignmentId = '' } = useParams();
  const navigate = useNavigate();

  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [row, setRow] = useState<any>(null);

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

  const handleResponse = async (status: FamilyRequestAssignmentStatus) => {
    if (!assignmentId || !agencyId || saving) return;
    setSaving(true);
    const result = await respondToFamilyRequestAssignment(assignmentId, agencyId, status, message);
    setSaving(false);

    if (!result.ok) return;

    const updated = await getAgencyFamilyRequestAssignment(assignmentId);
    setRow(updated);

    if (status === 'accepted' && result.conversationId) {
      navigate(`/agency/messages?conversation=${result.conversationId}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-stone-500">Loading request...</div>;
  }

  if (!row || !row.request) {
    return <div className="p-8 text-center text-stone-500">Request not found or unavailable.</div>;
  }

  const request = row.request;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Family Request Detail</h1>
          <p className="text-stone-500 mt-1">Score {row.score}/100 · {request.borough}{request.neighborhood ? `, ${request.neighborhood}` : ''}</p>
        </div>
        <Link to="/agency/family-requests" className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50">
          Back to Inbox
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Parent Request</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Info label="Parent" value={request.parent_name} />
          <Info label="Email" value={request.email} />
          <Info label="Phone" value={request.phone || 'Not provided'} />
          <Info label="Care Type" value={request.care_type} />
          <Info label="Children" value={`${request.children_count}`} />
          <Info label="Age Groups" value={(request.child_age_groups || []).join(', ') || 'Not provided'} />
          <Info label="Live-In Preference" value={request.live_in} />
          <Info label="Driver Required" value={request.driver_required ? 'Yes' : 'No'} />
          <Info label="Special Needs" value={request.special_needs ? 'Yes' : 'No'} />
          <Info label="Pet Friendly" value={request.pet_friendly ? 'Yes' : 'No'} />
          <Info label="Budget" value={`$${request.budget_min ?? '-'} to $${request.budget_max ?? '-'}`} />
          <Info label="Start Date" value={request.start_date || 'Flexible'} />
        </div>

        {(request.schedule || request.notes || request.special_requirements) && (
          <div className="pt-2 space-y-3">
            {request.schedule && <Info label="Schedule" value={request.schedule} />}
            {request.special_requirements && <Info label="Special Requirements" value={request.special_requirements} />}
            {request.notes && <Info label="Notes" value={request.notes} />}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Why This Matched</h2>
        <ul className="space-y-2 text-sm text-stone-700">
          {(row.reasons || []).map((reason: string) => (
            <li key={reason} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Respond to Family</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage((e.target as HTMLInputElement).value)}
          placeholder="Optional note to the family"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-stone-200"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleResponse('accepted')}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept & Open Messaging
          </button>
          <button
            onClick={() => handleResponse('more_details')}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 font-semibold disabled:opacity-60"
          >
            <CircleEllipsis className="h-4 w-4" />
            Request More Details
          </button>
          <button
            onClick={() => handleResponse('declined')}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-semibold disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            Decline
          </button>
          <Link
            to="/agency/messages"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            <MessageSquare className="h-4 w-4" />
            Open Messages
          </Link>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</p>
      <p className="text-sm text-stone-900 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
