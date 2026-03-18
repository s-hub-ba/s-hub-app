import { useState, useEffect, useRef } from 'react';
import { Search, Filter, MoreHorizontal, FileText, Star, ShieldCheck, Eye, X, BookmarkPlus, Check, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { getApplicationsForAgency, updateApplicationStatus, addNannyReview, recordCareHistoryFromApplication, resolveAgencyIdForUser, addNannyToAgencyTalentPool, getAgencyTalentPool, scheduleApplicationCall, computeNannyJobCompatibility, getNannyReviewStats } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = {
  applied: 'bg-stone-100 text-stone-700',
  reviewing: 'bg-blue-100 text-blue-700',
  interview_invited: 'bg-orange-100 text-orange-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-stone-200 text-stone-500'
};

const STATUS_LABELS = {
  applied: 'New',
  reviewing: 'Reviewing',
  interview_invited: 'Interview Invited',
  accepted: 'Accepted',
  completed: 'Completed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export default function AgencyApplications() {
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [agencyId, setAgencyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [applications, setApplications] = useState<any[]>([]);
  const [talentPoolIds, setTalentPoolIds] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [callDateTime, setCallDateTime] = useState('');
  const [callNote, setCallNote] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [isCallSubmitting, setIsCallSubmitting] = useState(false);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) return;
      const resolved = await resolveAgencyIdForUser(user.uid);
      setAgencyId(resolved || '');
    };
    resolveAgency();
  }, [user]);

  useEffect(() => {
    if (!agencyId) return;
    loadData();
  }, [agencyId]);

  const loadData = async () => {
    if (!agencyId) return;
    try {
      const [fetchedApps, poolItems] = await Promise.all([
        getApplicationsForAgency(agencyId),
        getAgencyTalentPool(agencyId)
      ]);
      const enrichedApps = await Promise.all(fetchedApps.map(async (app: any) => {
        const nannyName = app.nanny_profiles ? `${app.nanny_profiles.first_name || ''} ${app.nanny_profiles.last_name || ''}`.trim() : 'Unknown Applicant';
        const reviewStats = app.nanny_id ? await getNannyReviewStats(app.nanny_id) : { avg: 0, count: 0 };
        const compatibility = computeNannyJobCompatibility(app.jobs, app.nanny_profiles, reviewStats.avg, reviewStats.count);
        return {
          ...app,
          nanny_name: nannyName,
          job_title: app.jobs?.title || 'Unknown Job',
          compatibility
        };
      }));
      setApplications(enrichedApps);
      setTalentPoolIds(new Set(poolItems.map((p: any) => p.nanny_id)));
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddToPool = async (nannyId: string) => {
    if (!agencyId || !nannyId || talentPoolIds.has(nannyId)) return;
    await addNannyToAgencyTalentPool(agencyId, nannyId);
    setTalentPoolIds(prev => new Set([...prev, nannyId]));
    setOpenDropdownId(null);
  };

  const openScheduleModal = (app: any) => {
    setSelectedApp(app);
    setCallDateTime(app.call_scheduled_for ? new Date(app.call_scheduled_for).toISOString().slice(0, 16) : '');
    setCallNote(app.call_note || '');
    setScheduleModalOpen(true);
    setOpenDropdownId(null);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setSelectedApp(null);
    setCallDateTime('');
    setCallNote('');
  };

  const handleScheduleCall = async () => {
    if (!selectedApp?.id || !selectedApp?.nanny_id || !agencyId || !callDateTime) return;

    setIsCallSubmitting(true);
    try {
      await scheduleApplicationCall({
        applicationId: selectedApp.id,
        nannyId: selectedApp.nanny_id,
        agencyId,
        agencyName: selectedApp.agency_name || user?.displayName || 'Agency',
        jobTitle: selectedApp.job_title,
        scheduledFor: new Date(callDateTime).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        note: callNote
      });
      await loadData();
      closeScheduleModal();
    } catch (error) {
      console.error('Error scheduling call:', error);
    } finally {
      setIsCallSubmitting(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      await updateApplicationStatus(appId, newStatus);
      if (newStatus === 'completed') {
        await recordCareHistoryFromApplication(appId);
      }
      await loadData();
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const openReviewModal = (app: any) => {
    setSelectedApp(app);
    setReviewRating(5);
    setReviewComment('');
    setReviewSubmitSuccess(false);
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedApp(null);
  };

  const openQuickView = (app: any) => {
    setSelectedApp(app);
    setQuickViewOpen(true);
  };

  const closeQuickView = () => {
    setQuickViewOpen(false);
    setSelectedApp(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedApp || !agencyId || !selectedApp.nanny_id || reviewRating < 1 || reviewRating > 5 || !reviewComment.trim()) {
      return;
    }

    setIsReviewSubmitting(true);
    try {
      await addNannyReview({
        nanny_id: selectedApp.nanny_id,
        reviewer_id: agencyId,
        reviewer_role: 'agency',
        rating: reviewRating,
        comment: reviewComment
      });
      setReviewSubmitSuccess(true);
      setTimeout(() => {
        closeReviewModal();
      }, 1500);
    } catch (err) {
      console.error('Error submitting nanny review', err);
    } finally {
      setIsReviewSubmitting(false);
      loadData();
    }
  };

  const filteredApps = applications.filter(app =>
    app.nanny_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatCallDateTime = (value?: string | null) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Not scheduled';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Applications</h1>
          <p className="text-stone-500 mt-1">Review and manage candidates for your open jobs.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search applicants or jobs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Job Filter
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Applicant</th>
                <th className="p-4">Job</th>
                <th className="p-4">Status</th>
                <th className="p-4">Applied Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    No applications found.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={app.id}
                    className="hover:bg-stone-50/50 transition-colors group"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border border-stone-300">
                          {app.nanny_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-1">
                            {app.nanny_name}
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="text-xs font-bold text-stone-700">{app.nanny_profiles?.rating ? app.nanny_profiles.rating.toFixed(1) : 'N/A'}</span>
                          </div>
                          {app.compatibility && (
                            <div className="mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                app.compatibility.tier === 'excellent'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : app.compatibility.tier === 'good'
                                    ? 'bg-blue-100 text-blue-700'
                                    : app.compatibility.tier === 'fair'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-stone-100 text-stone-600'
                              }`}>
                                Match {app.compatibility.score}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-stone-400" />
                        <span className="text-sm font-medium text-stone-700">{app.job_title}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <select
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border border-transparent hover:border-stone-200 outline-none cursor-pointer appearance-none ${STATUS_COLORS[app.status as keyof typeof STATUS_COLORS]}`}
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key} className="bg-white text-stone-900">{label}</option>
                        ))}
                      </select>
                      {app.call_status && (
                        <p className={`mt-2 text-[11px] font-semibold ${app.call_status === 'confirmed' ? 'text-emerald-700' : app.call_status === 'declined' ? 'text-red-600' : 'text-orange-700'}`}>
                          {app.call_status === 'pending_nanny' && `Call proposed for ${formatCallDateTime(app.call_scheduled_for)}`}
                          {app.call_status === 'confirmed' && `Call confirmed for ${formatCallDateTime(app.call_scheduled_for)}`}
                          {app.call_status === 'declined' && 'Previous call proposal was declined'}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-stone-600">
                        {toDate(app.created_at)?.toLocaleDateString() || '—'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openQuickView(app)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          Quick View
                        </button>
                        {(app.status === 'accepted' || app.status === 'interview_invited') && (
                          <button
                            onClick={() => openReviewModal(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                          >
                            <Star className="h-3 w-3" />
                            Review
                          </button>
                        )}
                        <div ref={dropdownRef} className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === app.id ? null : app.id); }}
                            className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openDropdownId === app.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-20 overflow-hidden"
                            >
                              <button
                                onClick={() => openScheduleModal(app)}
                                className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors"
                              >
                                <Phone className="h-4 w-4 text-stone-400" />
                                {app.call_status === 'confirmed' || app.call_status === 'pending_nanny' ? 'Reschedule Call' : 'Schedule Call'}
                              </button>
                              <button
                                onClick={() => handleAddToPool(app.nanny_id)}
                                disabled={talentPoolIds.has(app.nanny_id)}
                                className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {talentPoolIds.has(app.nanny_id)
                                  ? <Check className="h-4 w-4 text-emerald-500" />
                                  : <BookmarkPlus className="h-4 w-4 text-stone-400" />}
                                {talentPoolIds.has(app.nanny_id) ? 'In Talent Pool' : 'Add to Talent Pool'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {quickViewOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-xl relative">
            <button onClick={closeQuickView} className="absolute top-4 right-4 p-2 text-stone-500 hover:text-stone-800 rounded-full">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Applicant Quick View</h2>
            <p className="text-stone-500 mb-6">{selectedApp.nanny_name}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Job</p>
                <p className="font-semibold text-stone-900 mt-1">{selectedApp.job_title}</p>
              </div>
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Current Status</p>
                <p className="font-semibold text-stone-900 mt-1">{STATUS_LABELS[selectedApp.status as keyof typeof STATUS_LABELS] || selectedApp.status}</p>
              </div>
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Experience</p>
                <p className="font-semibold text-stone-900 mt-1">{selectedApp.nanny_profiles?.years_experience ?? '—'} years</p>
              </div>
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-stone-400 text-xs uppercase tracking-wider">Location</p>
                <p className="font-semibold text-stone-900 mt-1">{selectedApp.nanny_profiles?.location_borough || '—'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 p-4">
              <p className="text-stone-400 text-xs uppercase tracking-wider">Cover Letter</p>
              <p className="text-stone-700 mt-2 whitespace-pre-wrap">{selectedApp.cover_letter || 'No cover letter provided.'}</p>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 p-4">
              <p className="text-stone-400 text-xs uppercase tracking-wider">Bio</p>
              <p className="text-stone-700 mt-2 whitespace-pre-wrap">{selectedApp.nanny_profiles?.bio || 'No bio available.'}</p>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 p-4 bg-stone-50/70">
              <p className="text-stone-400 text-xs uppercase tracking-wider">Call Status</p>
              <p className="text-stone-900 font-semibold mt-2">
                {selectedApp.call_status === 'confirmed' && `Confirmed for ${formatCallDateTime(selectedApp.call_scheduled_for)}`}
                {selectedApp.call_status === 'pending_nanny' && `Awaiting nanny confirmation for ${formatCallDateTime(selectedApp.call_scheduled_for)}`}
                {selectedApp.call_status === 'declined' && 'Last proposed call was declined'}
                {!selectedApp.call_status && 'No call scheduled yet.'}
              </p>
              {selectedApp.call_note && (
                <p className="text-stone-600 mt-2 whitespace-pre-wrap">{selectedApp.call_note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {scheduleModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-xl relative">
            <button
              onClick={closeScheduleModal}
              className="absolute top-4 right-4 p-2 text-stone-500 hover:text-stone-800 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Schedule Call</h2>
            <p className="text-stone-500 mb-6">Suggest a call time for {selectedApp.nanny_name} to confirm.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">Suggested date and time</label>
                <input
                  type="datetime-local"
                  value={callDateTime}
                  onChange={(e) => setCallDateTime(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">Call note</label>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  rows={4}
                  className="w-full border border-stone-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Example: 15-minute intro call to discuss availability and role fit."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={closeScheduleModal}
                type="button"
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleCall}
                disabled={isCallSubmitting || !callDateTime}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCallSubmitting ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl relative">
            <button
              onClick={closeReviewModal}
              className="absolute top-4 right-4 p-2 text-stone-500 hover:text-stone-800 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">Review Nanny</h2>
            <p className="text-stone-500 mb-5">{selectedApp.nanny_name || 'Candidate'}</p>
            <div className="mb-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setReviewRating(value)}
                    className={`transition-colors ${value <= reviewRating ? 'text-amber-400' : 'text-stone-300'} hover:text-amber-300`}
                    type="button"
                  >
                    <Star className="h-6 w-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              className="w-full border border-stone-200 rounded-xl p-3 mb-4 focus:ring-emerald-500 outline-none"
              placeholder="Share the nanny's performance (reliability, communication, skill, etc.)"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={closeReviewModal}
                type="button"
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isReviewSubmitting || !reviewComment.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isReviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
            {reviewSubmitSuccess && (
              <p className="text-green-600 text-sm mt-3">Review submitted successfully.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
