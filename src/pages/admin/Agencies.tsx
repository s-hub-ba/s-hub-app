import { useState, useEffect, useRef } from 'react';
import { Search, Filter, ShieldCheck, ShieldAlert, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { getAgencies, updateAgencyProfile } from '../../lib/api';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: any): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : 'N/A';
}

export default function AdminAgencies() {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [activeMenuAgencyId, setActiveMenuAgencyId] = useState<string | null>(null);
  const [isUpdatingAgencyId, setIsUpdatingAgencyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getAgencies();
        setAgencies(data);
      } catch (error) {
        console.error('Error loading agencies:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuAgencyId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredAgencies = agencies.filter((agency) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [agency.company_name, agency.website, agency.users?.email, agency.id]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
      .includes(query);
  });

  const handleVerificationAction = async (agency: any, action: 'approve' | 'reject' | 'reopen') => {
    if (!agency?.id || isUpdatingAgencyId) return;

    const nextStatusLabel = action === 'approve' ? 'approve' : action === 'reject' ? 'decline' : 'reopen';
    const confirmed = window.confirm(
      `${nextStatusLabel.charAt(0).toUpperCase()}${nextStatusLabel.slice(1)} ${agency.company_name || 'this agency'}?`
    );
    if (!confirmed) return;

    setIsUpdatingAgencyId(agency.id);
    setActionError(null);

    const updates = action === 'approve'
      ? {
          is_verified: true,
          isVerified: true,
          verification_status: 'approved',
        }
      : action === 'reject'
        ? {
            is_verified: false,
            isVerified: false,
            verification_status: 'rejected',
          }
        : {
            is_verified: false,
            isVerified: false,
            verification_status: 'pending',
          };

    try {
      const updated = await updateAgencyProfile(agency.id, updates);
      if (!updated) {
        setActionError(`Unable to ${nextStatusLabel} agency right now. Please try again.`);
        return;
      }

      setAgencies((prev) => prev.map((entry) => entry.id === agency.id ? { ...entry, ...updated } : entry));
    } catch {
      setActionError(`Unable to ${nextStatusLabel} agency right now. Please try again.`);
    } finally {
      setIsUpdatingAgencyId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Agency Verification</h1>
          <p className="text-stone-500 mt-1">Review and manage agency access to the platform.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search agencies..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Status
        </button>
      </div>
      {actionError && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Agency Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Applied Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredAgencies.map((agency, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  key={agency.id} 
                  className="hover:bg-stone-50/50 transition-colors group"
                >
                  <td className="p-4 pl-6">
                    <div className="font-bold text-stone-900">{agency.company_name}</div>
                    <div className="text-xs text-stone-500 mt-1">{agency.website || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                    {agency.verification_status === 'rejected' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-100 text-rose-700">
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Rejected
                      </span>
                    ) : agency.is_verified ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700">
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{agency.users?.email || 'N/A'}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-stone-600">{formatDate(agency.users?.created_at)}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {!agency.is_verified && agency.verification_status !== 'rejected' ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleVerificationAction(agency, 'approve')}
                          disabled={isUpdatingAgencyId === agency.id}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" 
                          title="Approve"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleVerificationAction(agency, 'reject')}
                          disabled={isUpdatingAgencyId === agency.id}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Reject"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    ) : agency.verification_status === 'rejected' ? (
                      <div className="flex justify-end items-center gap-2">
                        <div className="relative inline-flex" ref={activeMenuAgencyId === agency.id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={() => setActiveMenuAgencyId((current) => current === agency.id ? null : agency.id)}
                            className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>

                          {activeMenuAgencyId === agency.id ? (
                            <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => { setActiveMenuAgencyId(null); handleVerificationAction(agency, 'reopen'); }}
                                disabled={isUpdatingAgencyId === agency.id}
                                className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                              >
                                Move To Pending
                              </button>
                              <button
                                type="button"
                                onClick={() => { setActiveMenuAgencyId(null); handleVerificationAction(agency, 'approve'); }}
                                disabled={isUpdatingAgencyId === agency.id}
                                className="w-full px-4 py-3 text-left text-sm text-emerald-700 hover:bg-emerald-50 border-t border-stone-100 disabled:opacity-60"
                              >
                                Approve Agency
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <div className="relative inline-flex" ref={activeMenuAgencyId === agency.id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={() => setActiveMenuAgencyId((current) => current === agency.id ? null : agency.id)}
                            className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>

                          {activeMenuAgencyId === agency.id ? (
                            <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => { setActiveMenuAgencyId(null); handleVerificationAction(agency, 'reopen'); }}
                                disabled={isUpdatingAgencyId === agency.id}
                                className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                              >
                                Mark As Pending
                              </button>
                              <button
                                type="button"
                                onClick={() => { setActiveMenuAgencyId(null); handleVerificationAction(agency, 'reject'); }}
                                disabled={isUpdatingAgencyId === agency.id}
                                className="w-full px-4 py-3 text-left text-sm text-rose-700 hover:bg-rose-50 border-t border-stone-100 disabled:opacity-60"
                              >
                                Reject Agency
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
