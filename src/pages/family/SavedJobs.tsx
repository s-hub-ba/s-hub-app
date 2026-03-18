import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, DollarSign, Briefcase, Star } from 'lucide-react';
import { getFamilyCareHistory, addNannyReview, addAgencyReview } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SavedJobs() {
  const { user } = useAuth();
  const [careHistory, setCareHistory] = useState<any[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [reviewTarget, setReviewTarget] = useState<'agency' | 'nanny'>('agency');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
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

  const openReviewModal = (item: any, target: 'agency' | 'nanny') => {
    setSelectedHistory(item);
    setReviewTarget(target);
    setRating(5);
    setComment('');
    setReviewSuccess(false);
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedHistory(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedHistory || !comment.trim()) return;
    setIsSubmittingReview(true);

    try {
      if (reviewTarget === 'agency') {
        await addAgencyReview({
          agency_id: selectedHistory.agency_id,
          reviewer_id: familyId,
          reviewer_role: 'family',
          rating,
          comment
        });
      } else {
        await addNannyReview({
          nanny_id: selectedHistory.nanny_id,
          reviewer_id: familyId,
          reviewer_role: 'family',
          rating,
          comment
        });
      }
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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Past Care</h1>
          <p className="text-stone-500 mt-1">Track completed placements and leave reviews for agencies and nannies.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
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
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Completed</span>
                      <span className="text-sm text-stone-500">{item.start_date ? `From ${new Date(item.start_date).toLocaleDateString()}` : 'Start date N/A'} • {item.end_date ? `To ${new Date(item.end_date).toLocaleDateString()}` : 'End date N/A'}</span>
                    </div>

                    <h3 className="text-xl font-bold text-stone-900 mb-1">{item.job_title || 'Past Care Role'}</h3>
                    <p className="text-sm font-medium text-emerald-600 mb-1">{item.agency_name || 'Agency'} • Nanny: {item.nanny_name || 'Unknown'}</p>
                    <p className="text-sm text-stone-600">{item.summary || 'No summary provided.'}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => openReviewModal(item, 'agency')}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                    >
                      <Star className="h-4 w-4 text-amber-500" />
                      Review Agency
                    </button>
                    <button
                      onClick={() => openReviewModal(item, 'nanny')}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
                    >
                      <Star className="h-4 w-4 text-amber-500" />
                      Review Nanny
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {reviewModalOpen && selectedHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={closeReviewModal}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">Leave a Review</h2>
            <p className="text-sm text-stone-500 mb-4">{reviewTarget === 'agency' ? `Agency: ${selectedHistory.agency_name}` : `Nanny: ${selectedHistory.nanny_name}`}</p>
            <div className="mb-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`text-2xl ${value <= rating ? 'text-amber-400' : 'text-stone-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Write your review..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={closeReviewModal}
                className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={!comment.trim() || isSubmittingReview}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
            {reviewSuccess && (
              <p className="mt-3 text-green-600">Thank you! Your review is posted.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
