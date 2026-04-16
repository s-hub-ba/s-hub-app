import { useEffect, useMemo, useState } from 'react';
import { Download, Search, ShieldAlert, X } from 'lucide-react';
import { motion } from 'motion/react';
import { clearAdminBgPublicStatusOverride, getAdminBgPublicStatuses, getBgCheckAuditLogs, setAdminBgPublicStatusOverride } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminBgAudit() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'created' | 'updated' | 'override_set' | 'override_cleared'>('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [publicStatuses, setPublicStatuses] = useState<any[]>([]);
  const [selectedOverrideRow, setSelectedOverrideRow] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState<'checked' | 'not_checked' | 'expired'>('checked');
  const [overrideConfidence, setOverrideConfidence] = useState('80');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [clearOverrideRow, setClearOverrideRow] = useState<any>(null);
  const [clearOverrideReason, setClearOverrideReason] = useState('');
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditLogs, statuses] = await Promise.all([
        getBgCheckAuditLogs(),
        getAdminBgPublicStatuses()
      ]);
      setLogs(auditLogs);
      setPublicStatuses(statuses);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const actionMatch = actionFilter === 'all' || log.action === actionFilter;
      const blob = [
        log.nanny_name,
        log.nanny_email,
        log.agency_name,
        log.actor_email,
        log.previous_status,
        log.new_status
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      const searchMatch = !query || blob.includes(query);
      return actionMatch && searchMatch;
    });
  }, [logs, searchQuery, actionFilter]);

  const formatDate = (value: any) => {
    if (!value) return 'Unknown';
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString();
  };

  const exportCsv = () => {
    const headers = ['when', 'action', 'nanny_name', 'nanny_email', 'agency_name', 'actor_email', 'previous_status', 'new_status', 'previous_confidence', 'new_confidence', 'source_hidden', 'override_reason', 'risk_flags'];
    const rows = filteredLogs.map((log) => [
      formatDate(log.created_at),
      log.action,
      log.nanny_name || '',
      log.nanny_email || '',
      log.agency_name || '',
      log.actor_email || '',
      log.previous_status || '',
      log.new_status || '',
      String(log.previous_confidence ?? ''),
      String(log.new_confidence ?? ''),
      log.source_hidden ? 'Yes' : 'No',
      log.override_reason || '',
      (log.risk_flags || []).join('; ')
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bg-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openOverrideModal = (row: any) => {
    setSelectedOverrideRow(row);
    setOverrideStatus(row.status || 'checked');
    setOverrideConfidence(String(Number(row.confidence || 0)));
    setOverrideExpiresAt(row.expires_at ? String(row.expires_at).slice(0, 10) : '');
    setOverrideReason(row.override_reason || '');
  };

  const handleSaveOverride = async () => {
    if (!selectedOverrideRow?.nanny_id || !user?.uid || !overrideReason.trim() || isSavingOverride) return;
    setIsSavingOverride(true);
    try {
      await setAdminBgPublicStatusOverride({
        nannyId: selectedOverrideRow.nanny_id,
        adminUserId: user.uid,
        status: overrideStatus,
        confidence: Number(overrideConfidence || 0),
        expiresAt: overrideExpiresAt || undefined,
        reason: overrideReason.trim()
      });
      setSelectedOverrideRow(null);
      setOverrideReason('');
      await loadData();
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleClearOverride = async () => {
    if (!clearOverrideRow?.nanny_id || !user?.uid || !clearOverrideReason.trim() || isSavingOverride) return;
    setIsSavingOverride(true);
    try {
      await clearAdminBgPublicStatusOverride({
        nannyId: clearOverrideRow.nanny_id,
        adminUserId: user.uid,
        reason: clearOverrideReason.trim()
      });
      setClearOverrideRow(null);
      setClearOverrideReason('');
      await loadData();
    } finally {
      setIsSavingOverride(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">BG Audit Log</h1>
          <p className="text-stone-500 mt-1">Track who changed nanny background-check signals, when, and how.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search nanny, agency, actor, or status..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.currentTarget.value as 'all' | 'created' | 'updated' | 'override_set' | 'override_cleared')}
          className="px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="all">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="override_set">Override set</option>
          <option value="override_cleared">Override cleared</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <span className="text-lg font-bold text-stone-900">Current Public BG Status</span>
          <span className="text-xs text-stone-500">Manual overrides persist until cleared</span>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-stone-500">Loading BG public statuses...</div>
        ) : publicStatuses.length === 0 ? (
          <div className="px-6 py-10 text-sm text-stone-500">No public BG statuses yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Nanny</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Override</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {publicStatuses.map((row) => (
                  <tr key={row.nanny_id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-semibold text-stone-900">{row.nanny_name || row.nanny_email || row.nanny_id}</div>
                      {row.nanny_email && <div className="text-xs text-stone-500">{row.nanny_email}</div>}
                    </td>
                    <td className="p-4 text-sm text-stone-700 capitalize">{String(row.status || 'not_checked').replace('_', ' ')}</td>
                    <td className="p-4 text-sm text-stone-700">{Math.round(Number(row.confidence || 0))}%</td>
                    <td className="p-4">
                      {row.override_active ? (
                        <div>
                          <div className="text-xs font-semibold text-amber-700">Active override</div>
                          <div className="text-xs text-stone-500 mt-1">{row.override_reason || 'No reason'}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">No override</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openOverrideModal(row)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white"
                        >
                          Set Override
                        </button>
                        {row.override_active && (
                          <button
                            type="button"
                            onClick={() => {
                              setClearOverrideRow(row);
                              setClearOverrideReason('');
                            }}
                            disabled={isSavingOverride}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
                          >
                            Clear Override
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-stone-700">{filteredLogs.length} log entries</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            Immutable audit history
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-stone-500">Loading BG audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="px-6 py-10 text-sm text-stone-500">No BG audit logs found for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">When</th>
                  <th className="p-4">Nanny</th>
                  <th className="p-4">Agency</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Change</th>
                  <th className="p-4 pr-6">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-4 pl-6 text-sm text-stone-600">{formatDate(log.created_at)}</td>
                    <td className="p-4">
                      <div className="font-semibold text-stone-900">{log.nanny_name || log.nanny_email || 'Nanny user'}</div>
                      {log.nanny_email && <div className="text-xs text-stone-500">{log.nanny_email}</div>}
                    </td>
                    <td className="p-4 text-sm text-stone-700">{log.agency_name || log.source_agency_id}</td>
                    <td className="p-4 text-sm text-stone-700">{log.actor_email || log.actor_user_id}</td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-stone-900 capitalize">{log.action}</div>
                      <div className="text-xs text-stone-500 mt-1">{`${log.previous_status || 'none'} -> ${log.new_status}`}</div>
                      {log.override_reason && <div className="text-xs text-stone-500 mt-1">Reason: {log.override_reason}</div>}
                    </td>
                    <td className="p-4 pr-6">
                      <div className="text-sm text-stone-700">{`${log.previous_confidence ?? '-'} -> ${log.new_confidence}`}</div>
                      <div className="text-xs text-stone-500 mt-1">Source hidden: {log.source_hidden ? 'Yes' : 'No'}</div>
                      {!!log.risk_flags?.length && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {log.risk_flags.map((flag: string) => (
                            <span key={flag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-100 text-red-700 border border-red-200">
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOverrideRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-violet-600 via-violet-500 to-purple-600 px-6 pt-8 pb-10 overflow-hidden">
              <button type="button" onClick={() => setSelectedOverrideRow(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedOverrideRow.nanny_name || selectedOverrideRow.nanny_email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-violet-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Admin Override</p>
                  <h2 className="text-xl font-bold text-white leading-tight">Set BG Override</h2>
                  <p className="text-violet-100/80 text-sm mt-0.5">{selectedOverrideRow.nanny_name || selectedOverrideRow.nanny_email || selectedOverrideRow.nanny_id}</p>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Override Status</label>
                <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.currentTarget.value as 'checked' | 'not_checked' | 'expired')} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 transition">
                  <option value="checked">BG checked</option>
                  <option value="not_checked">BG not checked</option>
                  <option value="expired">BG expired</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Confidence</label>
                  <input type="number" min={0} max={100} value={overrideConfidence} onChange={(e) => setOverrideConfidence(e.currentTarget.value)} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Expires At</label>
                  <input type="date" value={overrideExpiresAt} onChange={(e) => setOverrideExpiresAt(e.currentTarget.value)} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Reason</label>
                <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.currentTarget.value)} rows={4} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none transition" placeholder="Why is this override needed?" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button type="button" onClick={() => setSelectedOverrideRow(null)} className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleSaveOverride} disabled={!overrideReason.trim() || isSavingOverride} className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-md shadow-violet-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm">
                {isSavingOverride ? (
                  <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</span>
                ) : 'Save Override'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {clearOverrideRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 px-6 pt-8 pb-10 overflow-hidden">
              <button type="button" onClick={() => setClearOverrideRow(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div>
                  <p className="text-amber-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Clear Override</p>
                  <h2 className="text-xl font-bold text-white leading-tight">Confirm BG Override Removal</h2>
                  <p className="text-amber-100/80 text-sm mt-0.5">{clearOverrideRow.nanny_name || clearOverrideRow.nanny_email || clearOverrideRow.nanny_id}</p>
                </div>
              </div>
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Reason (required)</label>
                <textarea
                  value={clearOverrideReason}
                  onChange={(e) => setClearOverrideReason(e.currentTarget.value)}
                  rows={4}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition"
                  placeholder="Why should this override be cleared?"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button type="button" onClick={() => setClearOverrideRow(null)} className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearOverride}
                disabled={!clearOverrideReason.trim() || isSavingOverride}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold shadow-md shadow-amber-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isSavingOverride ? (
                  <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Clearing…</span>
                ) : 'Clear Override'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
