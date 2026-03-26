import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Building2, AlertTriangle, DollarSign, FileText } from 'lucide-react';
import { getAdminVerificationAnalytics, getAgencies, getNannies, VerificationRange } from '../../lib/api';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [agencyCount, setAgencyCount] = useState(0);
  const [nannyCount, setNannyCount] = useState(0);
  const [verificationStats, setVerificationStats] = useState<any>({
    total_documents: 0,
    pending_documents: 0,
    approved_documents: 0,
    rejected_documents: 0,
    approval_rate_pct: 0,
    avg_review_time_hours: 0,
    pending_over_72h: 0
  });
  const [verificationDeltas, setVerificationDeltas] = useState<any>({
    total_documents: 0,
    pending_documents: 0,
    approved_documents: 0,
    rejected_documents: 0,
    approval_rate_pct: 0,
    avg_review_time_hours: 0,
    pending_over_72h: 0
  });
  const [verificationBreakdown, setVerificationBreakdown] = useState<any[]>([]);
  const [verificationQueuePreview, setVerificationQueuePreview] = useState<any[]>([]);
  const [verificationRange, setVerificationRange] = useState<VerificationRange>('30d');

  useEffect(() => {
    const loadAdminMetrics = async () => {
      setLoading(true);
      try {
        const [agencies, nannies, verificationAnalytics] = await Promise.all([
          getAgencies(),
          getNannies(),
          getAdminVerificationAnalytics(verificationRange)
        ]);

        setAgencyCount(agencies.length);
        setNannyCount(nannies.length);
        setVerificationStats(verificationAnalytics.current);
        setVerificationDeltas(verificationAnalytics.deltas);
        setVerificationBreakdown(verificationAnalytics.type_breakdown || []);
        setVerificationQueuePreview((verificationAnalytics.queue || []).slice(0, 5));
      } finally {
        setLoading(false);
      }
    };

    loadAdminMetrics();
  }, [verificationRange]);

  const formatDelta = (value: number, suffix = '') => {
    if (!value) return `0${suffix}`;
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}${suffix}`;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-stone-500 mt-1">Platform overview and pending actions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Total Agencies</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{loading ? '...' : agencyCount}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Total Nannies</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{loading ? '...' : nannyCount}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-orange-200 shadow-sm flex flex-col bg-orange-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Pending Verifications</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{loading ? '...' : verificationStats.pending_documents}</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm flex flex-col bg-red-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Approval Rate</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">{loading ? '...' : `${verificationStats.approval_rate_pct}%`}</h2>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Verification Analytics</h2>
          <p className="text-xs text-stone-500 mt-1">Track approval quality, queue aging, and review speed by period.</p>
        </div>
        <div className="inline-flex rounded-xl border border-stone-200 overflow-hidden">
          {(['7d', '30d', 'all'] as VerificationRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setVerificationRange(range)}
              className={`px-4 py-2 text-sm font-semibold ${verificationRange === range ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Verification Queue</p>
          <h3 className="text-2xl font-bold text-stone-900 mt-2">{loading ? '...' : verificationStats.pending_documents}</h3>
          <p className="text-xs text-stone-500 mt-1">{loading ? '...' : `${verificationStats.pending_over_72h} pending over 72h (${formatDelta(verificationDeltas.pending_over_72h)})`}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Approved Docs</p>
          <h3 className="text-2xl font-bold text-emerald-800 mt-2">{loading ? '...' : verificationStats.approved_documents}</h3>
          <p className="text-xs text-emerald-700 mt-1">Delta {loading ? '...' : formatDelta(verificationDeltas.approved_documents)}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-rose-200 bg-rose-50/40 shadow-sm">
          <p className="text-xs font-medium text-rose-700 uppercase tracking-wider">Rejected Docs</p>
          <h3 className="text-2xl font-bold text-rose-800 mt-2">{loading ? '...' : verificationStats.rejected_documents}</h3>
          <p className="text-xs text-rose-700 mt-1">Delta {loading ? '...' : formatDelta(verificationDeltas.rejected_documents)}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-200 bg-blue-50/40 shadow-sm">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">Approval Rate</p>
          <h3 className="text-2xl font-bold text-blue-800 mt-2">{loading ? '...' : `${verificationStats.approval_rate_pct}%`}</h3>
          <p className="text-xs text-blue-700 mt-1">Avg review {loading ? '...' : `${verificationStats.avg_review_time_hours}h`} ({loading ? '...' : formatDelta(verificationDeltas.avg_review_time_hours, 'h')})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">Verification by Document Type</h2>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-sm text-stone-500">Loading type analytics...</div>
          ) : verificationBreakdown.length === 0 ? (
            <div className="px-6 py-8 text-sm text-stone-500">No verification data in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    <th className="p-4 pl-6">Type</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Pending</th>
                    <th className="p-4">Approved %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {verificationBreakdown.map((item) => (
                    <tr key={item.type}>
                      <td className="p-4 pl-6 text-sm font-semibold text-stone-900 capitalize">{String(item.type || 'other').replace('_', ' ')}</td>
                      <td className="p-4 text-sm text-stone-700">{item.total}</td>
                      <td className="p-4 text-sm text-stone-700">{item.pending}</td>
                      <td className="p-4 text-sm font-semibold text-emerald-700">{item.approval_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-stone-900">Aging Verification Queue</h2>
            <Link to="/admin/verification" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Open Full Queue</Link>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-sm text-stone-500">Loading queue...</div>
          ) : verificationQueuePreview.length === 0 ? (
            <div className="px-6 py-8 text-sm text-stone-500">No pending documents in this period.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {verificationQueuePreview.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{item.nanny_name || item.nanny_email || 'Nanny'}</div>
                    <div className="text-xs text-stone-500">{item.file_name} · {String(item.type || 'other').replace('_', ' ')}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${item.sla_breached ? 'text-red-700' : 'text-stone-700'}`}>{item.age_hours}h old</div>
                    <div className={`text-[11px] ${item.sla_breached ? 'text-red-600' : 'text-stone-500'}`}>{item.sla_breached ? 'SLA breach' : 'Within SLA'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">Review & Trust Operations</h2>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-100">
              <div className="p-4 flex items-center justify-between text-sm">
                <span className="text-stone-500">Verification documents reviewed</span>
                <span className="font-semibold text-stone-900">{loading ? '...' : verificationStats.total_documents}</span>
              </div>
              <div className="p-4 flex items-center justify-between text-sm">
                <span className="text-stone-500">Approved documents</span>
                <span className="font-semibold text-emerald-700">{loading ? '...' : verificationStats.approved_documents}</span>
              </div>
              <div className="p-4 flex items-center justify-between text-sm">
                <span className="text-stone-500">Rejected documents</span>
                <span className="font-semibold text-rose-700">{loading ? '...' : verificationStats.rejected_documents}</span>
              </div>
              <div className="p-4 flex items-center justify-between text-sm">
                <span className="text-stone-500">Average review time</span>
                <span className="font-semibold text-stone-900">{loading ? '...' : `${verificationStats.avg_review_time_hours}h`}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">System Alerts</h2>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <AlertTriangle className="h-5 w-5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">PayPal Webhook Sync</h4>
                  <p className="text-xs text-stone-500 mt-1">All subscription states are currently synced. Last check: 5 mins ago.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <FileText className="h-5 w-5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Structured Nanny Reviews</h4>
                  <p className="text-xs text-stone-500 mt-1">Agencies and families now contribute review signals directly to ShiftScore instead of sharing paid note listings.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <ShieldCheck className="h-5 w-5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Document Verification Pipeline</h4>
                  <p className="text-xs text-stone-500 mt-1">
                    {loading
                      ? 'Loading...'
                      : `${verificationStats.pending_documents} in queue, ${verificationStats.pending_over_72h} aging over 72h.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
