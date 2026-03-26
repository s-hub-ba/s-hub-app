import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Star, ArrowRight, AlertCircle } from 'lucide-react';
import { getFamilyRequestById, getMatchedAgenciesForRequest } from '../../lib/api';

const TIER_LABELS: Record<string, string> = {
  best_match: 'Best Match',
  great_match: 'Great Match',
  possible_match: 'Possible Match',
};

export default function FamilyRequestResults() {
  const { id = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const [requestRow, matchedAgencies] = await Promise.all([
        getFamilyRequestById(id),
        getMatchedAgenciesForRequest(id),
      ]);

      setRequest(requestRow);
      setMatches(matchedAgencies || []);
      setLoading(false);
    };

    load();
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-stone-500">Loading matched agencies...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Request Submitted</h1>
            <p className="text-sm text-emerald-800 mt-1">
              We matched your request with agencies based on neighborhood, care type, age group, special requirements, and budget fit.
            </p>
          </div>
        </div>
      </div>

      {request && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-stone-900">Request Summary</h2>
          <p className="text-sm text-stone-500 mt-1">
            {request.care_type} care in {request.neighborhood || 'your area'}, {request.borough} · {request.children_count} child{request.children_count > 1 ? 'ren' : ''}
          </p>
        </div>
      )}

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{match.agency.company_name || 'Agency'}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Match score {match.score}/100</p>
                </div>
                <div className="flex items-center gap-1.5">
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

              <ul className="space-y-1 text-sm text-stone-600">
                {(match.reasons || []).map((reason: string) => (
                  <li key={reason} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {reason}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-xs text-stone-500">Agencies receive this request in their inbox</span>
                <Link
                  to={`/family/agencies/${match.agency.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View agency
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
