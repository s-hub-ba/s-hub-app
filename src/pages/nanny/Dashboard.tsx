import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Star, ShieldCheck, Calendar, MapPin, CheckCircle2, Coins, TrendingUp } from 'lucide-react';
import { getJobs, getApplicationsForNanny, getNannyById, getNannyDocuments, getNannyReviews, getNannyReviewSummary, computeShiftScore, getNannyPremiumAnalytics, getNannyCreditWallet } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function NannyDashboard() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState('seeking');
  const [stats, setStats] = useState({
    activeApps: 0,
    shiftScore: 0,
    profileCompletion: 0,
    verifiedDocumentCount: 0,
    documentBonus: 0,
    reviewCount: 0,
    averageReliability: 0,
    averageCommunication: 0,
    punctualityRate: 0,
    rehireRate: 0,
    reviewSignal: 0,
  });
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [premiumAnalytics, setPremiumAnalytics] = useState<any>(null);
  const [creditWallet, setCreditWallet] = useState<any>(null);

  const nannyId = user?.uid || '';

  if (!nannyId) {
    return (
      <div className="p-8 text-center text-stone-500">Please sign in to view your dashboard.</div>
    );
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [apps, fetchedProfile] = await Promise.all([
          getApplicationsForNanny(nannyId),
          getNannyById(nannyId)
        ]);

        const [analytics, wallet] = await Promise.all([
          getNannyPremiumAnalytics(nannyId),
          getNannyCreditWallet(nannyId)
        ]);
        setPremiumAnalytics(analytics);
        setCreditWallet(wallet);

        const documents = await getNannyDocuments(nannyId);
        const approvedDocumentCount = documents.filter((doc) => doc.status === 'approved').length;

        setProfile(fetchedProfile);

        const activeApps = apps.filter(a => ['applied', 'reviewing', 'interviewing', 'interview_invited', 'accepted', 'hired', 'active', 'pending_family_approval'].includes(a.status));
        const [reviews, reviewSummary] = await Promise.all([
          getNannyReviews(nannyId),
          getNannyReviewSummary(nannyId),
        ]);

        const shiftScoreData = computeShiftScore(
          fetchedProfile,
          apps.length,
          approvedDocumentCount,
          reviewSummary
        );
        const profileCompletion = Math.round((shiftScoreData.details.completedFields / shiftScoreData.details.totalFields) * 100);

        setStats(prev => ({
          ...prev,
          activeApps: activeApps.length,
          shiftScore: shiftScoreData.score,
          profileCompletion,
          verifiedDocumentCount: shiftScoreData.details.verifiedDocumentCount,
          documentBonus: shiftScoreData.details.documentBonus,
          reviewCount: reviewSummary.reviewCount,
          averageReliability: reviewSummary.averageReliability,
          averageCommunication: reviewSummary.averageCommunication,
          punctualityRate: reviewSummary.punctualityRate,
          rehireRate: reviewSummary.rehireRate,
          reviewSignal: reviewSummary.shiftScore,
        }));

        setRecentReviews(reviews);

        const jobs = await getJobs();
        setRecommendedJobs(jobs.slice(0, 2));
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };
    if (nannyId) loadData();
  }, [nannyId]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
            Welcome back, {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : user?.email ?? 'Nanny'}
          </h1>
          <p className="text-stone-500 mt-1">Here's what's happening with your profile today.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={availability}
            onChange={(e) => setAvailability((e.target as HTMLInputElement).value)}
            className="bg-white border border-stone-200 text-stone-700 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none font-medium shadow-sm"
          >
            <option value="seeking">Actively Seeking</option>
            <option value="open">Open to Offers</option>
            <option value="not_seeking">Not Seeking</option>
          </select>
          <Link to="/nanny/profile" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
            Update Profile
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Star className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">ShiftScore</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.shiftScore}</h2>
              <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Professional</span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {stats.verifiedDocumentCount} approved docs • +{stats.documentBonus} score bonus
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Profile Completion</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.profileCompletion}%</h2>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
            <Calendar className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Active Apps</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-stone-900">{stats.activeApps}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Reliability</p>
          <div className="flex items-end gap-2 mt-1">
            <h3 className="text-3xl font-bold text-stone-900">{stats.averageReliability.toFixed(1)}</h3>
            <span className="text-sm text-stone-500">({stats.reviewCount} reviews)</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full mt-3 overflow-hidden">
            <div style={{ width: `${Math.min(100, (stats.averageReliability / 5) * 100)}%` }} className="h-full bg-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Review Signal</p>
          <div className="flex items-end gap-2 mt-1">
            <h3 className="text-3xl font-bold text-stone-900">{stats.reviewSignal.toFixed(1)}</h3>
            <span className="text-sm text-stone-500">ShiftScore review component</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full mt-3 overflow-hidden">
            <div style={{ width: `${Math.min(100, (stats.reviewSignal / 5) * 100)}%` }} className="h-full bg-blue-500" />
          </div>
          <p className="text-xs text-stone-500 mt-3">
            {Math.round(stats.punctualityRate * 100)}% punctual • {Math.round(stats.rehireRate * 100)}% would rehire
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Premium Analytics</p>
              <h3 className="text-xl font-bold text-stone-900 mt-1">
                {premiumAnalytics?.is_premium ? 'Premium Active' : 'Premium Inactive'}
              </h3>
            </div>
            <Link to="/nanny/development" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800">
              Open Development Agent
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Acceptance Rate</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">{premiumAnalytics?.acceptance_rate_pct || 0}%</p>
            </div>
            <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Completion Rate</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">{premiumAnalytics?.completion_rate_pct || 0}%</p>
            </div>
            <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">30d Application Velocity</p>
              <p className="mt-2 text-2xl font-bold text-stone-900 inline-flex items-center gap-1">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                {premiumAnalytics?.application_velocity_30d || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Development Credits</p>
          <p className="mt-3 text-3xl font-bold text-stone-900 inline-flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500" />
            {Number(creditWallet?.balance_credits || 0)}
          </p>
          <p className="text-xs text-stone-500 mt-2">Each development-agent run uses 1 credit.</p>
          <Link to="/nanny/development" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Manage credits and sessions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommended Jobs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">Recommended Jobs</h2>
            <Link to="/nanny/jobs" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View all</Link>
          </div>

          <div className="space-y-4">
            {recommendedJobs.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center text-stone-500">
                No recommended jobs at the moment.
              </div>
            ) : (
              recommendedJobs.map((job, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={job.id} 
                  className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{job.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-stone-500 mt-1">
                        <span className="font-medium text-stone-700">{job.agency_profiles?.company_name || 'Agency'}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location_neighborhood}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-600">${job.pay_min} - ${job.pay_max}/hr</div>
                      <div className="text-xs font-medium text-stone-400 uppercase tracking-wider mt-1">{job.job_type}</div>
                    </div>
                  </div>
                  
                  <p className="text-stone-600 text-sm mb-4 line-clamp-2">
                    {job.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {job.special_requirements?.split(',').slice(0, 2).map((req: string) => (
                        <span key={req} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-600">
                          {req.trim()}
                        </span>
                      ))}
                    </div>
                    <Link to="/nanny/jobs" className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors">
                      Apply Now
                    </Link>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Recent Reviews */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              {recentReviews.length === 0 ? (
                <div className="text-stone-500 text-sm">No reviews yet. Keep working and earn more reviews to boost your score.</div>
              ) : (
                recentReviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <span className="font-semibold text-stone-700">Reliability {review.reliability_rating}/5</span>
                      <span className="font-semibold text-stone-700">Communication {review.communication_rating}/5</span>
                    </div>
                    <p className="text-sm text-stone-600 italic line-clamp-2">"{review.strengths || review.notes || 'No additional details provided.'}"</p>
                    <p className="text-xs text-stone-400 mt-2">— {review.reviewer_type === 'family' ? 'Family' : 'Agency'} reviewer</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
