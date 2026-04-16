import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, DollarSign, Briefcase, Star, CheckCircle2, Clock, X } from 'lucide-react';
import { getFamilyCareHistory, submitCareHistoryReview } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SavedJobs() {
  const { user } = useAuth();
  const [careHistory, setCareHistory] = useState<any[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [reviewTarget, setReviewTarget] = useState<'agency' | 'nanny'>('agency');
  const [reviewPhase, setReviewPhase] = useState<'week_one' | 'completion'>('completion');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reliabilityRating, setReliabilityRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [punctuality, setPunctuality] = useState(true);
  const [rehire, setRehire] = useState(true);
  const [strengths, setStrengths] = useState('');
  const [nannyNotes, setNannyNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const familyId = user?.uid || '';

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view saved jobs.</div>;
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const history = await getFamilyCareHistory(familyId);
        setCareHistory(history);
      } catch (error) {
        console.error('Error loading care history:', error);
      }
    };
    loadData();
  }, [familyId]);

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const openReviewModal = (item: any, target: 'agency' | 'nanny', phase: 'week_one' | 'completion') => {
    setSelectedHistory(item);
    setReviewTarget(target);
    setReviewPhase(phase);
    setRating(5);
    setComment('');
    setReliabilityRating(5);
    setCommunicationRating(5);
    setPunctuality(true);
    setRehire(true);
    setStrengths('');
    setNannyNotes('');
    setReviewSuccess(false);
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedHistory(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedHistory) return;
    if (reviewTarget === 'agency' && !comment.trim()) return;
    if (reviewTarget === 'nanny' && !strengths.trim()) return;
    setIsSubmittingReview(true);

    try {
      const ok = await submitCareHistoryReview({
        careHistoryId: selectedHistory.id,
        familyId,
        target: reviewTarget,
        phase: reviewPhase,
        agencyId: selectedHistory.agency_id,
        nannyId: selectedHistory.nanny_id,
        rating,
        comment,
        review: reviewTarget === 'nanny'
          ? {
              relationship_context: 'engagement_completed',
              reliability_rating: reliabilityRating,
              communication_rating: communicationRating,
              punctuality,
              rehire,
              strengths,
              notes: nannyNotes,
            }
          : undefined,
      });
      if (!ok) return;

      setCareHistory(prev => prev.map(item => {
        if (item.id !== selectedHistory.id) return item;
        return {
          ...item,
          reviewed_agency_by_family: reviewTarget === 'agency' && reviewPhase === 'completion' ? true : item.reviewed_agency_by_family,
          reviewed_nanny_by_family: reviewTarget === 'nanny' && reviewPhase === 'completion' ? true : item.reviewed_nanny_by_family,
          reviewed_agency_week_one_by_family: reviewTarget === 'agency' && reviewPhase === 'week_one' ? true : item.reviewed_agency_week_one_by_family,
          reviewed_nanny_week_one_by_family: reviewTarget === 'nanny' && reviewPhase === 'week_one' ? true : item.reviewed_nanny_week_one_by_family,
          reviewed_agency_completion_by_family: reviewTarget === 'agency' && reviewPhase === 'completion' ? true : item.reviewed_agency_completion_by_family,
          reviewed_nanny_completion_by_family: reviewTarget === 'nanny' && reviewPhase === 'completion' ? true : item.reviewed_nanny_completion_by_family,
        };
      }));

      setReviewSuccess(true);
      setTimeout(() => {
        closeReviewModal();
      }, 1600);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isWeekOneEligible = (item: any) => {
    if (item.placement_status !== 'active') return false;
    if (item.reviewed_agency_week_one_by_family && item.reviewed_nanny_week_one_by_family) return false;
    const dueDate = toDate(item.week_one_review_available_at || item.start_date);
    if (!dueDate) return false;
    return Date.now() >= dueDate.getTime();
  };

  const isCompletionEligible = (item: any) => item.placement_status === 'completed';

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Past Care</h1>
          <p className="text-stone-500 mt-1">Track completed placements and leave reviews for agencies and nannies.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 border-b border-stone-100 bg-stone-50/60">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-stone-500 font-bold">Total Placements</p>
            <p className="text-2xl font-black text-stone-900 mt-1">{careHistory.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-stone-500 font-bold">Agency Reviews Left</p>
            <p className="text-2xl font-black text-stone-900 mt-1">{careHistory.filter(i => i.reviewed_agency_by_family).length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-stone-500 font-bold">Nanny Reviews Left</p>
            <p className="text-2xl font-black text-stone-900 mt-1">{careHistory.filter(i => i.reviewed_nanny_by_family).length}</p>
          </div>
        </div>
        <div className="divide-y divide-stone-100">
          {careHistory.length === 0 ? (
            <div className="p-12 text-center">
              <Heart className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-900">No past care records</h3>
              <p className="text-stone-500 mt-1 mb-6">When your family completes placements, this list will show the history and let you leave feedback.</p>
              <Link 
                to="/agencies"
                className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Find an Agency
              </Link>
            </div>
          ) : (
            careHistory.map(item => (
              <div key={item.id} className="p-6 md:p-8 hover:bg-stone-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${item.placement_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.placement_status === 'completed' ? 'Completed' : 'Active Placement'}
                      </span>
                      <span className="text-sm text-stone-500">{item.start_date ? `From ${toDate(item.start_date)?.toLocaleDateString() || 'N/A'}` : 'Start date N/A'} • {item.end_date ? `To ${toDate(item.end_date)?.toLocaleDateString() || 'N/A'}` : 'In progress'}</span>
                    </div>

                    <h3 className="text-xl font-bold text-stone-900 mb-1">{item.job_title || 'Past Care Role'}</h3>
                    <p className="text-sm font-medium text-emerald-600 mb-1">{item.agency_name || 'Agency'} • Nanny: {item.nanny_name || 'Unknown'}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-2">
                      {item.job_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">{item.job_type}</span>
                      )}
                      {(item.location_neighborhood || item.location_borough) && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location_neighborhood || 'NYC'}{item.location_borough ? `, ${item.location_borough}` : ''}</span>
                      )}
                      {item.source_inquiry_id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">From Inquiry</span>
                      )}
                    </div>
                    <p className="text-sm text-stone-600">{item.summary || 'No summary provided.'}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {isWeekOneEligible(item) && (
                      <>
                        <button
                          onClick={() => openReviewModal(item, 'agency', 'week_one')}
                          disabled={!!item.reviewed_agency_week_one_by_family}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                        >
                          {item.reviewed_agency_week_one_by_family ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Star className="h-4 w-4 text-amber-500" />}
                          {item.reviewed_agency_week_one_by_family ? 'Week 1 Agency Review Sent' : 'Week 1 Agency Review'}
                        </button>
                        <button
                          onClick={() => openReviewModal(item, 'nanny', 'week_one')}
                          disabled={!!item.reviewed_nanny_week_one_by_family}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                        >
                          {item.reviewed_nanny_week_one_by_family ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Star className="h-4 w-4 text-amber-500" />}
                          {item.reviewed_nanny_week_one_by_family ? 'Week 1 Nanny Review Sent' : 'Week 1 Nanny Review'}
                        </button>
                      </>
                    )}
                    {isCompletionEligible(item) && (
                      <>
                        <button
                          onClick={() => openReviewModal(item, 'agency', 'completion')}
                          disabled={!!item.reviewed_agency_completion_by_family || !!item.reviewed_agency_by_family}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                        >
                          {(item.reviewed_agency_completion_by_family || item.reviewed_agency_by_family) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Star className="h-4 w-4 text-amber-500" />}
                          {(item.reviewed_agency_completion_by_family || item.reviewed_agency_by_family) ? 'Agency Completion Review Sent' : 'Review Agency'}
                        </button>
                        <button
                          onClick={() => openReviewModal(item, 'nanny', 'completion')}
                          disabled={!!item.reviewed_nanny_completion_by_family || !!item.reviewed_nanny_by_family}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                        >
                          {(item.reviewed_nanny_completion_by_family || item.reviewed_nanny_by_family) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Star className="h-4 w-4 text-amber-500" />}
                          {(item.reviewed_nanny_completion_by_family || item.reviewed_nanny_by_family) ? 'Nanny Completion Review Sent' : 'Review Nanny'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {reviewModalOpen && selectedHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden"
          >
            {/* Hero header */}
            <div className="relative bg-gradient-to-br from-amber-500 via-amber-400 to-orange-400 px-6 pt-8 pb-10 overflow-hidden">
              <button
                onClick={closeReviewModal}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/35 text-white rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-white/25 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {(reviewTarget === 'agency' ? selectedHistory.agency_name : selectedHistory.nanny_name || 'R').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-amber-100 text-xs font-semibold uppercase tracking-widest mb-0.5">
                    {reviewPhase === 'week_one' ? 'Week 1 Review' : 'Completion Review'}
                  </p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {reviewTarget === 'agency' ? selectedHistory.agency_name : selectedHistory.nanny_name}
                  </h2>
                  {selectedHistory.end_date && (
                    <p className="text-amber-100/80 text-xs mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />Completed {toDate(selectedHistory.end_date)?.toLocaleDateString() || 'N/A'}
                    </p>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 pt-6 pb-4 space-y-5 max-h-[60vh] overflow-y-auto">
              {reviewTarget === 'agency' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(value => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          className={`text-3xl transition-all duration-100 ${value <= rating ? 'text-amber-400 scale-110' : 'text-stone-300 hover:text-amber-300'}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Your Review</label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.currentTarget.value)}
                      rows={4}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition"
                      placeholder="Write your review..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                      <RatingField label="Reliability" value={reliabilityRating} onChange={setReliabilityRating} />
                    </div>
                    <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                      <RatingField label="Communication" value={communicationRating} onChange={setCommunicationRating} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPunctuality(!punctuality)}
                      className={`rounded-2xl p-3.5 text-sm font-semibold border-2 flex items-center justify-between gap-2 transition-all ${punctuality ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                    >
                      <span>Punctual</span>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${punctuality ? 'border-amber-500 bg-amber-500' : 'border-stone-300'}`}>
                        {punctuality && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRehire(!rehire)}
                      className={`rounded-2xl p-3.5 text-sm font-semibold border-2 flex items-center justify-between gap-2 transition-all ${rehire ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                    >
                      <span>Would Rehire</span>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${rehire ? 'border-amber-500 bg-amber-500' : 'border-stone-300'}`}>
                        {rehire && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                    </button>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Highlights</label>
                    <textarea
                      value={strengths}
                      onChange={e => setStrengths(e.currentTarget.value)}
                      rows={3}
                      maxLength={120}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition"
                      placeholder="What stood out about this nanny?"
                    />
                    <span className="absolute bottom-3 right-3 text-xs text-stone-400">{strengths.length}/120</span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">Notes <span className="font-normal text-stone-300 normal-case">(optional)</span></label>
                    <textarea
                      value={nannyNotes}
                      onChange={e => setNannyNotes(e.currentTarget.value)}
                      rows={3}
                      maxLength={240}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition"
                      placeholder="Optional additional notes for future families and agencies."
                    />
                    <span className="absolute bottom-3 right-3 text-xs text-stone-400">{nannyNotes.length}/240</span>
                  </div>
                </>
              )}

              {reviewSuccess && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <p className="text-emerald-700 text-sm font-medium">Thank you! Your review is posted.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center gap-3">
              <button
                onClick={closeReviewModal}
                className="px-5 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={(reviewTarget === 'agency' ? !comment.trim() : !strengths.trim()) || isSubmittingReview}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 text-white font-bold shadow-md shadow-amber-200/60 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isSubmittingReview ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : 'Submit Review'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function RatingField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const active = hovered ?? value;
  return (
    <div>
      <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            onMouseEnter={() => setHovered(option)}
            onMouseLeave={() => setHovered(null)}
            className={`text-2xl transition-all duration-100 ${option <= active ? 'text-amber-400 scale-110' : 'text-stone-300 hover:text-amber-300'}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-400 mt-1.5 font-semibold">{value}/5</p>
    </div>
  );
}
