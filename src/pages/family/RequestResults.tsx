import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2, Star, ArrowRight, AlertCircle, MessageSquare,
  Clock, XCircle, CircleEllipsis, Trophy,
} from 'lucide-react';
import { getFamilyRequestById, getMatchedAgenciesForRequest, chooseFamilyRequestAgency } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const TIER_LABELS: Record<string, string> = {
  best_match: 'Best Match',
  great_match: 'Great Match',
  possible_match: 'Possible Match',
};

const RESPONSE_LABEL: Record<string, string> = {
  new: 'Reviewing…',
  accepted: 'Interested',
  more_details: 'Asked a Question',
  declined: 'Declined',
};
const RESPONSE_STYLE: Record<string, string> = {
  new: 'bg-stone-100 text-stone-500',
  accepted: 'bg-emerald-100 text-emerald-700',
  more_details: 'bg-amber-100 text-amber-700',
  declined: 'bg-rose-100 text-rose-600',
};
const RESPONSE_ICON: Record<string, React.ReactNode> = {
  new: <Clock className="h-3 w-3" />,
  accepted: <CheckCircle2 className="h-3 w-3" />,
  more_details: <CircleEllipsis className="h-3 w-3" />,
  declined: <XCircle className="h-3 w-3" />,
};

export default function FamilyRequestResults() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState('');

  const familyId = user?.uid || '';

  const load = async () => {
    if (!id) { setLoading(false); return; }
    const [requestRow, matchedAgencies] = await Promise.all([
      getFamilyRequestById(id),
      getMatchedAgenciesForRequest(id),
    ]);
    setRequest(requestRow);
    setMatches(matchedAgencies || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleChoose = async (assignmentId: string) => {
    if (!familyId || choosing) return;
    setChoosing(assignmentId);
    setChooseError('');
    const result = await chooseFamilyRequestAgency(id, assignmentId, familyId);
    if (result.ok) {
      await load(); // refresh to show chosen state
    } else {
      setChooseError('Something went wrong. Please try again.');
    }
    setChoosing(null);
  };

  if (loading) {
    return <div className="p-10 text-center text-stone-500">Loading your request...</div>;
  }

  const isChosen = !!request?.chosen_agency_id;
  const chosenAgency = isChosen ? matches.find((m) => m.agency_id === request.chosen_agency_id) : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header banner */}
      {isChosen ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <Trophy className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-emerald-900">Agency Selected</h1>
              <p className="text-sm text-emerald-800 mt-1">
                You chose <span className="font-semibold">{chosenAgency?.agency?.company_name || 'an agency'}</span> for your care request.
                They've been notified and will post a job to find the right nanny for you.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-emerald-900">Request Submitted</h1>
              <p className="text-sm text-emerald-800 mt-1">
                Agencies are reviewing your request. Once one responds as <strong>Interested</strong> or <strong>Asks a Question</strong>,
                you can choose who to move forward with.
              </p>
            </div>
          </div>
        </div>
      )}

      {chooseError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {chooseError}
        </div>
      )}

      {/* Request summary */}
      {request && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-stone-900">Your Request</h2>
          <p className="text-sm text-stone-500 mt-1">
            {request.care_type} care in {request.neighborhood || 'your area'}, {request.borough} · {request.children_count} child{request.children_count > 1 ? 'ren' : ''}
            {request.budget_min || request.budget_max ? ` · $${request.budget_min ?? '–'}–$${request.budget_max ?? '–'}/hr` : ''}
          </p>
          <p className="text-sm text-stone-500 mt-2">
            {request.is_flexible
              ? 'Flexible timing'
              : request.start_date && request.end_date
                ? `Dates: ${request.start_date} to ${request.end_date}`
                : request.start_date
                  ? `First date needed: ${request.start_date}`
                  : 'Dates not specified yet'}
          </p>
        </div>
      )}

      {/* Agency list */}
      {matches.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-stone-900">No agencies matched yet</h3>
          <p className="text-sm text-stone-500 mt-1">
            We did not find a fit above the relevance threshold. Try broadening your budget, neighborhood, or care preferences.
          </p>
          <Link to="/family/request-care" className="inline-flex mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold">
            Edit and Resubmit
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">
            {isChosen ? 'All Matched Agencies' : `${matches.length} Matched ${matches.length === 1 ? 'Agency' : 'Agencies'}`}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {matches.map((match) => {
              const isChosenMatch = request?.chosen_agency_id === match.agency_id;
              const canChoose = !isChosen && (match.status === 'accepted' || match.status === 'more_details');

              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col gap-4 transition-all ${
                    isChosenMatch
                      ? 'border-emerald-400 ring-2 ring-emerald-200'
                      : 'border-stone-200'
                  }`}
                >
                  {/* Agency header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-stone-900">{match.agency?.company_name || 'Agency'}</h3>
                        {isChosenMatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <Trophy className="h-3 w-3" />
                            Your Choice
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">Match score {match.score}/100</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Response status badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${RESPONSE_STYLE[match.status] || 'bg-stone-100 text-stone-500'}`}>
                        {RESPONSE_ICON[match.status]}
                        {RESPONSE_LABEL[match.status] || match.status}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                        {TIER_LABELS[match.tier] || 'Matched'}
                      </span>
                      {match.sponsored_boost > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          <Star className="h-3 w-3 fill-current" />
                          Sponsored
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Match reasons */}
                  <ul className="space-y-1 text-sm text-stone-600">
                    {(match.reasons || []).map((reason: string) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>

                  {/* Agency response message */}
                  {match.agency_response_message && (
                    <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 text-sm text-stone-700">
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Agency Note</p>
                      <p className="leading-relaxed">{match.agency_response_message}</p>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2 flex-wrap">
                    <Link
                      to={`/family/agencies/${match.agency?.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-stone-800"
                    >
                      View profile
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center gap-2">
                      {(match.status === 'accepted' || match.status === 'more_details') && (
                        <Link
                          to={`/family/messages`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Messages
                        </Link>
                      )}
                      {canChoose && (
                        <button
                          onClick={() => handleChoose(match.id)}
                          disabled={!!choosing}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {choosing === match.id ? 'Choosing…' : 'Choose this Agency'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
