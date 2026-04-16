import { useState, useEffect } from 'react';
import { Search as SearchIcon, MapPin, Star, ShieldCheck, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getAgencySharedNannyReferences,
  getNannyBgChecksForAgency,
  getAgencyTalentPool,
  getNannyBgStatusMap,
  getNannyReviews,
  getNannyReviewSummary,
  resolveAgencyIdForUser,
  updateAgencyTalentPoolItem,
  upsertAgencyNannyBgCheck,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDisplayCvid } from '../../lib/nannyIdentity';
import NannyCvidCardModal from '../../components/NannyCvidCardModal';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-stone-100 text-stone-700',
  invited: 'bg-orange-100 text-orange-700',
  communicated: 'bg-blue-100 text-blue-700',
  top_candidate: 'bg-emerald-100 text-emerald-700',
  done: 'bg-indigo-100 text-indigo-700'
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  invited: 'Invited',
  communicated: 'Communicated',
  top_candidate: 'Top Candidate',
  done: 'Done'
};

const STATUS_OPTIONS = ['new', 'invited', 'communicated', 'done'] as const;

const INVITATION_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Invite Pending', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  accepted: { label: 'Joined Pool', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  declined: { label: 'Invite Declined', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  left: { label: 'Left Pool', className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function TalentPool() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [talentPool, setTalentPool] = useState<any[]>([]);
  const [reviewSummaryByNanny, setReviewSummaryByNanny] = useState<Record<string, any>>({});
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [selectedNanny, setSelectedNanny] = useState<any>(null);
  const [selectedSummary, setSelectedSummary] = useState<any>(null);
  const [selectedReviews, setSelectedReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<any[]>([]);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [bgStatusByNanny, setBgStatusByNanny] = useState<Record<string, any>>({});
  const [bgManageOpen, setBgManageOpen] = useState(false);
  const [bgTargetNanny, setBgTargetNanny] = useState<any>(null);
  const [bgStatusInput, setBgStatusInput] = useState<'checked' | 'not_checked' | 'expired'>('checked');
  const [bgCheckedAtInput, setBgCheckedAtInput] = useState('');
  const [bgExpiresAtInput, setBgExpiresAtInput] = useState('');
  const [bgConfidenceInput, setBgConfidenceInput] = useState('85');
  const [bgPrivateUrlInput, setBgPrivateUrlInput] = useState('');
  const [bgSourceHidden, setBgSourceHidden] = useState(true);
  const [isSavingBg, setIsSavingBg] = useState(false);
  const [bgSaveError, setBgSaveError] = useState<string | null>(null);
  const [isSavingCardActionById, setIsSavingCardActionById] = useState<Record<string, boolean>>({});
  const [cvidCardOpen, setCvidCardOpen] = useState(false);
  const [cvidCardNanny, setCvidCardNanny] = useState<any>(null);
  const [cvidCardShiftScore, setCvidCardShiftScore] = useState<number | null>(null);

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) return;
      const resolved = await resolveAgencyIdForUser(user.uid);
      setAgencyId(resolved || '');
    };
    resolveAgency();
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      if (!agencyId) return;
      try {
        const items = await getAgencyTalentPool(agencyId);

        const bgStatusMap = await getNannyBgStatusMap(items.map((item) => item.nanny_id));
        const summaries = await Promise.all(
          items.map(async (item) => ({
            nannyId: item.nanny_id,
            summary: await getNannyReviewSummary(item.nanny_id),
          }))
        );

        const summaryMap = Object.fromEntries(
          summaries.map((entry) => [entry.nannyId, entry.summary])
        );

        setTalentPool(items);
        setReviewSummaryByNanny(summaryMap);
        setBgStatusByNanny(bgStatusMap);
      } catch (error) {
        console.error('Error loading talent pool:', error);
      }
    };
    loadData();
  }, [agencyId]);

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view your talent pool.</div>;
  }

  const filteredTalent = talentPool.filter((item) => {
    const profile = item.nanny_profile || {};
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.toLowerCase();
    const borough = (profile.location_borough || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || borough.includes(query);
  });

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatNoteTimestamp = (value: any) => {
    const date = toDate(value);
    if (!date) return 'Unknown time';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const openReviewsForNanny = async (item: any) => {
    setSelectedNanny(item);
    setSelectedSummary(reviewSummaryByNanny[item.nanny_id] || null);
    setReviewsOpen(true);
    setIsLoadingReviews(true);
    try {
      const [summary, reviews] = await Promise.all([
        getNannyReviewSummary(item.nanny_id),
        getNannyReviews(item.nanny_id),
      ]);
      setSelectedSummary(summary);
      setSelectedReviews(reviews);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const openSharedReferencesForNanny = async (item: any) => {
    if (!agencyId) return;

    setSelectedNanny(item);
    setReferencesOpen(true);
    setIsLoadingReferences(true);
    try {
      const refs = await getAgencySharedNannyReferences({
        agencyId,
        nannyId: item.nanny_id,
      });
      setSelectedReferences(refs || []);
    } finally {
      setIsLoadingReferences(false);
    }
  };

  const formatBgStatus = (status: string) => {
    if (status === 'checked') return { label: 'BG Checked', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (status === 'expired') return { label: 'BG Expired', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'BG Not Checked', className: 'bg-stone-100 text-stone-700 border-stone-200' };
  };

  const openBgManage = async (item: any) => {
    if (!agencyId) return;
    setBgSaveError(null);
    setBgTargetNanny(item);
    setBgManageOpen(true);
    setBgStatusInput('checked');
    setBgCheckedAtInput('');
    setBgExpiresAtInput('');
    setBgConfidenceInput('85');
    setBgPrivateUrlInput('');
    setBgSourceHidden(true);

    const checks = await getNannyBgChecksForAgency(agencyId, item.nanny_id);
    if (checks.length > 0) {
      const latest = checks[0];
      setBgStatusInput((latest.status || 'checked') as 'checked' | 'not_checked' | 'expired');
      setBgCheckedAtInput(latest.checked_at ? String(latest.checked_at).slice(0, 10) : '');
      setBgExpiresAtInput(latest.expires_at ? String(latest.expires_at).slice(0, 10) : '');
      setBgConfidenceInput(String(Number(latest.confidence || 0)));
      setBgPrivateUrlInput(latest.doc_url_private || '');
      setBgSourceHidden(latest.source_hidden !== false);
    }
  };

  const handleSaveBgCheck = async () => {
    if (isSavingBg) return;
    if (!agencyId || !user?.uid || !bgTargetNanny?.nanny_id) {
      setBgSaveError('Could not save right now. Please refresh and try again.');
      return;
    }

    setBgSaveError(null);
    setIsSavingBg(true);
    try {
      const saved = await upsertAgencyNannyBgCheck({
        nannyId: bgTargetNanny.nanny_id,
        sourceAgencyId: agencyId,
        sourceUserId: user.uid,
        status: bgStatusInput,
        checkedAt: bgCheckedAtInput || undefined,
        expiresAt: bgExpiresAtInput || undefined,
        confidence: Number(bgConfidenceInput || 0),
        docUrlPrivate: bgPrivateUrlInput || undefined,
        sourceHidden: bgSourceHidden
      });

      if (!saved) {
        setBgSaveError('Save failed. Check your permissions and try again.');
        return;
      }

      const freshMap = await getNannyBgStatusMap([bgTargetNanny.nanny_id]);
      const synced = freshMap[bgTargetNanny.nanny_id];
      const fallbackStatus = {
        nanny_id: saved.nanny_id,
        status: saved.status,
        last_checked_at: saved.checked_at || saved.updated_at || saved.created_at || null,
        expires_at: saved.expires_at || null,
        confidence: Number(saved.confidence || 0),
        source_hidden: saved.source_hidden !== false,
        updated_at: saved.updated_at || new Date().toISOString()
      };

      setBgStatusByNanny((prev) => ({
        ...prev,
        [bgTargetNanny.nanny_id]: synced || fallbackStatus
      }));
      setBgManageOpen(false);
      setBgTargetNanny(null);
    } finally {
      setIsSavingBg(false);
    }
  };

  const updateCardStatus = async (item: any, nextStatus: string) => {
    if (!item?.id) return;
    setIsSavingCardActionById((prev) => ({ ...prev, [item.id]: true }));
    try {
      const updated = await updateAgencyTalentPoolItem(item.id, { status: nextStatus });
      if (!updated) return;
      setTalentPool((prev) => prev.map((entry) => (
        entry.id === item.id ? { ...entry, ...updated } : entry
      )));
    } finally {
      setIsSavingCardActionById((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const toggleTopCandidate = async (item: any) => {
    const currentStatus = item.status || 'new';
    const nextStatus = currentStatus === 'top_candidate' ? 'new' : 'top_candidate';
    await updateCardStatus(item, nextStatus);
  };

  const openCvidCard = (item: any, cvid: string, shiftScore?: number) => {
    setCvidCardNanny({
      ...(item.nanny_profile || {}),
      id: item.nanny_id,
      cvid,
    });
    setCvidCardShiftScore(typeof shiftScore === 'number' ? shiftScore : null);
    setCvidCardOpen(true);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Talent Pool</h1>
          <p className="text-stone-500 mt-1">Only nannies you explicitly invite from Global Search appear here.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search talent pool..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      {filteredTalent.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 text-center text-stone-500">
          No nannies in your talent pool yet. Invite from Global Search.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredTalent.map((item, index) => {
            const profile = item.nanny_profile || {};
            const status = STATUS_LABELS[item.status] ? item.status : 'new';
            const isTopCandidate = status === 'top_candidate';
            const bgStatus = bgStatusByNanny[item.nanny_id];
            const bgMeta = formatBgStatus(bgStatus?.status || 'not_checked');
            const reviewSummary = reviewSummaryByNanny[item.nanny_id];
            const fullName = `${profile.first_name || 'Unknown'} ${profile.last_name || ''}`.trim();
            const isSavingCardAction = !!isSavingCardActionById[item.id];
            const statusDropdownValue = status === 'top_candidate' ? 'new' : status;
            const cvid = getDisplayCvid({
              cvid: profile.cvid,
              id: item.nanny_id,
              first_name: profile.first_name,
              last_name: profile.last_name,
            });
            const invitationStatus = item.invitation_status || 'accepted';
            const invitationMeta = INVITATION_STATUS_META[invitationStatus] || INVITATION_STATUS_META.accepted;

            return (
              <motion.article
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                key={item.id}
                className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 md:p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold border border-stone-300 shrink-0">
                      {profile.first_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xl text-stone-900 flex items-center gap-1.5 truncate">
                        <span className="truncate">{fullName}</span>
                        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      </div>
                      <div className="text-sm text-stone-500 flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{profile.location_borough || 'Unknown location'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-700">
                          CVID {cvid}
                        </span>
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${invitationMeta.className}`}>
                          {invitationMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${STATUS_COLORS[status] || STATUS_COLORS.new}`}>
                      {STATUS_LABELS[status] || 'New'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTopCandidate(item)}
                        disabled={isSavingCardAction}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${isTopCandidate ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'} disabled:opacity-60`}
                        title={isTopCandidate ? 'Unmark top candidate' : 'Mark as top candidate'}
                      >
                        <Star className={`h-3.5 w-3.5 ${isTopCandidate ? 'fill-current' : ''}`} />
                        Top
                      </button>
                      <select
                        value={statusDropdownValue}
                        onChange={(e) => updateCardStatus(item, (e.target as HTMLInputElement).value)}
                        disabled={isSavingCardAction}
                        className="text-xs rounded-lg border border-stone-200 bg-white px-2 py-1 font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                        aria-label="Update candidate status"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>{STATUS_LABELS[option]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Experience</div>
                    <div className="mt-2 flex items-center gap-1.5 text-stone-900">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-xl font-bold">{profile.years_experience ?? '--'}</span>
                      <span className="text-xs text-stone-500">years</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">BG Signal</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${bgMeta.className}`}>
                        {bgMeta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openBgManage(item)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                      >
                        Manage BG
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Tags</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 min-h-6">
                      {(item.tags ?? []).length > 0 ? (
                        (item.tags ?? []).map((tag: string) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white text-stone-600 border border-stone-200">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-stone-500">No tags yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 p-4 bg-white">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-stone-700 font-medium">
                        {reviewSummary?.reviewCount
                          ? `${reviewSummary.averageRating.toFixed(1)}/5 avg - ${reviewSummary.reviewCount} reviews`
                          : 'No verified review signal yet'}
                      </p>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {reviewSummary?.highlightText || 'Review data appears here once families or agencies submit feedback.'}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openCvidCard(item, cvid, reviewSummary?.shiftScore)}
                          className="text-sm font-semibold text-stone-700 hover:text-stone-900"
                        >
                          Open CVID card
                        </button>
                        <button
                          type="button"
                          onClick={() => openReviewsForNanny(item)}
                          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          View review breakdown
                        </button>
                        <button
                          type="button"
                          onClick={() => openSharedReferencesForNanny(item)}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                        >
                          View shared references
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {item.exclusion_note ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Exit note</p>
                    <p className="mt-2 text-sm text-stone-700">{item.exclusion_note}</p>
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      )}

      <NannyCvidCardModal
        isOpen={cvidCardOpen}
        nanny={cvidCardNanny}
        shiftScore={cvidCardShiftScore}
        onClose={() => {
          setCvidCardOpen(false);
          setCvidCardNanny(null);
          setCvidCardShiftScore(null);
        }}
      />

      {reviewsOpen && selectedNanny && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500 px-6 pt-8 pb-10 overflow-hidden">
              <button
                type="button"
                onClick={() => { setReviewsOpen(false); setSelectedNanny(null); setSelectedReviews([]); setSelectedSummary(null); }}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <span className="text-white font-bold text-sm leading-none">✕</span>
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/25 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedNanny.nanny_profile?.first_name || 'N').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Structured Review Signal</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {selectedNanny.nanny_profile?.first_name || 'Nanny'} {selectedNanny.nanny_profile?.last_name || ''}
                  </h2>
                </div>
              </div>
              {selectedSummary?.reviewCount ? (
                <div className="mt-3 flex items-center gap-3 relative z-10">
                  <span className="text-white/70 text-xs">ShiftScore</span>
                  <span className="text-white font-bold text-xl">{selectedSummary.shiftScore?.toFixed(1) ?? '—'}</span>
                  <span className="text-emerald-100/60 text-xs">·</span>
                  <span className="text-white/70 text-xs">{selectedSummary.reviewCount} review{selectedSummary.reviewCount !== 1 ? 's' : ''}</span>
                </div>
              ) : null}
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[65vh] overflow-y-auto">
              {/* Metric tiles */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Avg Reliability" value={selectedSummary?.reviewCount ? `${selectedSummary.averageReliability.toFixed(1)}/5` : '—'} />
                <MetricCard label="Avg Communication" value={selectedSummary?.reviewCount ? `${selectedSummary.averageCommunication.toFixed(1)}/5` : '—'} />
                <MetricCard label="Would Rehire" value={selectedSummary?.reviewCount ? `${Math.round((selectedSummary.rehireRate || 0) * 100)}%` : '—'} />
                <MetricCard label="Punctuality" value={selectedSummary?.reviewCount ? `${Math.round((selectedSummary.punctualityRate || 0) * 100)}%` : '—'} />
              </div>

              {/* ShiftScore highlight */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-4">
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">ShiftScore Review Contribution</div>
                <div className="text-4xl font-bold text-stone-900">{selectedSummary?.shiftScore?.toFixed?.(1) ?? '0.0'}</div>
                <p className="text-sm text-stone-500 mt-1.5">{selectedSummary?.highlightText || 'No structured review signal available yet.'}</p>
              </div>
              {/* Recent reviews */}
              <div className="rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 bg-stone-50 text-xs font-bold text-stone-500 uppercase tracking-widest border-b border-stone-100">Recent Verified Reviews</div>
                {isLoadingReviews ? (
                  <div className="px-4 py-6 text-sm text-stone-500">Loading reviews…</div>
                ) : selectedReviews.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-stone-500">No verified reviews have been submitted for this nanny yet.</div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {selectedReviews.slice(0, 6).map((review) => (
                      <div key={review.id} className="px-4 py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-stone-700 uppercase tracking-wider">{review.reviewer_type}</span>
                          <span className="text-stone-400">{formatNoteTimestamp(review.created_at)}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <ReviewChip label="Reliability" value={`${review.reliability_rating}/5`} />
                          <ReviewChip label="Communication" value={`${review.communication_rating}/5`} />
                          <ReviewChip label="Punctual" value={review.punctuality ? 'Yes' : 'No'} />
                          <ReviewChip label="Rehire" value={review.rehire ? 'Yes' : 'No'} />
                        </div>
                        {review.strengths && <p className="text-sm text-stone-700"><span className="font-semibold">Strengths:</span> {review.strengths}</p>}
                        {review.notes && <p className="text-sm text-stone-600"><span className="font-semibold">Notes:</span> {review.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => { setReviewsOpen(false); setSelectedNanny(null); setSelectedReviews([]); setSelectedSummary(null); }}
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {bgManageOpen && bgTargetNanny && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl overflow-hidden">
            <div className="relative bg-gradient-to-br from-sky-600 via-blue-500 to-indigo-500 px-6 pt-8 pb-10 overflow-hidden">
              <button
                type="button"
                onClick={() => { setBgManageOpen(false); setBgTargetNanny(null); }}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <span className="text-white font-bold text-sm leading-none">✕</span>
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(bgTargetNanny.nanny_profile?.first_name || 'N').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sky-100 text-xs font-semibold uppercase tracking-widest mb-0.5">Background Check Signal</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {bgTargetNanny.nanny_profile?.first_name || 'Nanny'} {bgTargetNanny.nanny_profile?.last_name || ''}
                  </h2>
                </div>
              </div>
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[60vh] overflow-y-auto">
              {bgSaveError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{bgSaveError}</div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Status</label>
                <select
                  value={bgStatusInput}
                  onChange={(e) => setBgStatusInput((e.target as HTMLInputElement).value as 'checked' | 'not_checked' | 'expired')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                >
                  <option value="checked">BG checked</option>
                  <option value="not_checked">BG not checked</option>
                  <option value="expired">BG check expired</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Checked Date</label>
                  <input
                    type="date"
                    value={bgCheckedAtInput}
                    onChange={(e) => setBgCheckedAtInput((e.target as HTMLInputElement).value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Expires Date</label>
                  <input
                    type="date"
                    value={bgExpiresAtInput}
                    onChange={(e) => setBgExpiresAtInput((e.target as HTMLInputElement).value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Confidence (0–100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bgConfidenceInput}
                  onChange={(e) => setBgConfidenceInput((e.target as HTMLInputElement).value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Private Doc URL <span className="font-normal text-stone-300 normal-case">(internal only)</span></label>
                <input
                  type="url"
                  value={bgPrivateUrlInput}
                  onChange={(e) => setBgPrivateUrlInput((e.target as HTMLInputElement).value)}
                  placeholder="https://…"
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => setBgSourceHidden(!bgSourceHidden)}
                className={`w-full rounded-2xl p-3.5 text-sm font-semibold border-2 flex items-center justify-between gap-2 transition-all ${bgSourceHidden ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
              >
                <span>Hide source agency identity in public BG signal</span>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${bgSourceHidden ? 'border-sky-500 bg-sky-500' : 'border-stone-300'}`}>
                  {bgSourceHidden && <span className="text-white text-xs leading-none">✓</span>}
                </div>
              </button>
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setBgManageOpen(false); setBgTargetNanny(null); }}
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBgCheck}
                disabled={isSavingBg}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-500 text-white font-bold shadow-md shadow-sky-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isSavingBg ? (
                  <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</span>
                ) : 'Save BG Signal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {referencesOpen && selectedNanny && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-stone-700 via-stone-600 to-stone-800 px-6 pt-8 pb-10 overflow-hidden">
              <button
                type="button"
                onClick={() => { setReferencesOpen(false); setSelectedNanny(null); setSelectedReferences([]); }}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <span className="text-white font-bold text-sm leading-none">✕</span>
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(selectedNanny.nanny_profile?.first_name || 'N').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-stone-300 text-xs font-semibold uppercase tracking-widest mb-0.5">Shared References</p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {selectedNanny.nanny_profile?.first_name || 'Nanny'} {selectedNanny.nanny_profile?.last_name || ''}
                  </h2>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 overflow-y-auto max-h-[55vh]">
              {isLoadingReferences ? (
                <p className="text-sm text-stone-500 py-6 text-center">Loading references…</p>
              ) : selectedReferences.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-stone-400 text-sm">This nanny has not approved any references for your agency yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReferences.map((doc) => (
                    <div key={doc.id} className="bg-stone-50 rounded-2xl border border-stone-100 p-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">{doc.file_name}</h3>
                        <p className="text-xs text-stone-400 mt-0.5 font-medium">Reference document</p>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                      >
                        Open →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => { setReferencesOpen(false); setSelectedNanny(null); setSelectedReferences([]); }}
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</div>
      <div className="text-2xl font-bold text-stone-900 mt-2">{value}</div>
    </div>
  );
}

function ReviewChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-stone-900 mt-1">{value}</div>
    </div>
  );
}
