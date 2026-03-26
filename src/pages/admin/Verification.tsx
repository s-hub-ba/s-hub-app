import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldAlert } from 'lucide-react';
import { getAdminVerificationAnalytics, updateNannyDocumentStatus, VerificationRange } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminVerification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<VerificationRange>('30d');
  const [queue, setQueue] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cv' | 'certification' | 'id' | 'reference' | 'other'>('all');
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const analytics = await getAdminVerificationAnalytics(range);
      setQueue(analytics.queue || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [range]);

  const filteredQueue = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return queue.filter((item) => {
      const typeMatch = typeFilter === 'all' || (item.type || '') === typeFilter;
      const searchBlob = [item.nanny_name, item.nanny_email, item.file_name, item.type]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      const searchMatch = !query || searchBlob.includes(query);
      return typeMatch && searchMatch;
    });
  }, [queue, searchQuery, typeFilter]);

  const handleDocumentAction = async (docId: string, status: 'approved' | 'rejected') => {
    if (processingDocId || !user?.uid) return;

    let rejectionReason: string | undefined;
    if (status === 'rejected') {
      rejectionReason = window.prompt('Add rejection reason (required):')?.trim();
      if (!rejectionReason) return;
    }

    try {
      setProcessingDocId(docId);
      await updateNannyDocumentStatus({
        documentId: docId,
        status,
        reviewerUserId: user.uid,
        rejectionReason
      });
      await loadQueue();
    } finally {
      setProcessingDocId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Verification Queue</h1>
          <p className="text-stone-500 mt-1">This is the only admin approval queue for nanny documents. Approvals here are what affect ShiftScore.</p>
        </div>

        <div className="inline-flex rounded-xl border border-stone-200 overflow-hidden">
          {(['7d', '30d', 'all'] as VerificationRange[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`px-4 py-2 text-sm font-semibold ${range === option ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
            >
              {option === 'all' ? 'All Time' : option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nanny, email, file name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="all">All types</option>
          <option value="cv">CV</option>
          <option value="certification">Certification</option>
          <option value="id">ID</option>
          <option value="reference">Reference</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">{filteredQueue.length} items</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            SLA breaches sorted first
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-stone-500">Loading verification queue...</div>
        ) : filteredQueue.length === 0 ? (
          <div className="px-6 py-10 text-sm text-stone-500">No pending documents for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Nanny</th>
                  <th className="p-4">Document</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Age</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-semibold text-stone-900">{item.nanny_name || item.nanny_email || 'Nanny user'}</div>
                      {item.nanny_email && <div className="text-xs text-stone-500">{item.nanny_email}</div>}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-stone-900">{item.file_name}</div>
                      <a href={item.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:text-blue-700">Open file</a>
                    </td>
                    <td className="p-4 text-sm text-stone-600 capitalize">{String(item.type || 'other').replace('_', ' ')}</td>
                    <td className="p-4 text-sm">
                      <span className={item.sla_breached ? 'text-red-700 font-semibold' : 'text-stone-600'}>
                        {item.age_hours}h {item.sla_breached ? '(breach)' : ''}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDocumentAction(item.id, 'approved')}
                          disabled={processingDocId === item.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDocumentAction(item.id, 'rejected')}
                          disabled={processingDocId === item.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
