import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAgencyFamilyRequestInbox, resolveAgencyIdForUser } from '../../lib/api';
import { formatCareTypeLabel } from '../../lib/jobTypes';

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
  more_details: 'bg-amber-100 text-amber-700',
};

export default function AgencyFamilyRequests() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const showDeclinedBanner = searchParams.get('declined') === '1';

  useEffect(() => {
    const init = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      const resolvedAgencyId = await resolveAgencyIdForUser(user.uid);
      if (!resolvedAgencyId) {
        setLoading(false);
        return;
      }
      setAgencyId(resolvedAgencyId);
      const inboxRows = await getAgencyFamilyRequestInbox(resolvedAgencyId);
      setRows(inboxRows);
      setLoading(false);
    };

    init();
  }, [user]);

  if (!user?.uid) {
    return <div className="p-8 text-center text-stone-500">Please sign in to see requests.</div>;
  }

  if (loading) {
    return <div className="p-8 text-center text-stone-500">Loading request inbox...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Agency profile not found for this account.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Care Marketplace</h1>
          <p className="text-stone-500 mt-1">Family care requests matched to your agency, ranked by fit.</p>
        </div>
        <Link
          to="/agency/request-settings"
          className="inline-flex items-center px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50"
        >
          Matching Settings
        </Link>
      </div>

      {showDeclinedBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Request declined. The family will be notified and matched with other agencies.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-10 text-center">
          <Inbox className="h-12 w-12 text-stone-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-stone-900">No care requests yet</h2>
          <p className="text-sm text-stone-500 mt-1">
            Requests matched to your capabilities will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rows.map((row) => (
            <Link
              key={row.id}
              to={`/agency/family-requests/${row.id}`}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-stone-900">
                      {row.request?.parent_name || 'Family'} · {row.request?.borough || 'NYC'}
                    </h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[row.status] || 'bg-stone-100 text-stone-600'}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                    {row.sponsored_boost > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        <Sparkles className="h-3 w-3" />
                        Sponsored Boost
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone-500 mt-1">
                    {formatCareTypeLabel(row.request?.care_type)} care · {row.request?.children_count || 1} child · score {row.score}/100
                  </p>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                    {(row.reasons || []).join(' • ')}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                  Open request
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
