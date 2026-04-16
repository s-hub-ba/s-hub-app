import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, MapPin, Globe, Calendar, CheckCircle2, Star, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createAgencyInquiryConversation, getAgencyById, getAgencyReviewStats, getAgencyPosts, followAgency, unfollowAgency, getFamilyFollowedAgencies, getFamilyProfile, AgencyProfile as AgencyProfileType, AgencyPost, FamilyProfile } from '../lib/api';


export default function AgencyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [agency, setAgency] = useState<AgencyProfileType | null>(null);
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile | null>(null);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
  const [posts, setPosts] = useState<AgencyPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [inquiryDescription, setInquiryDescription] = useState('');
  const [inquiryScheduleType, setInquiryScheduleType] = useState<'date_range' | 'weekly_days'>('weekly_days');
  const [inquiryStartDate, setInquiryStartDate] = useState('');
  const [inquiryEndDate, setInquiryEndDate] = useState('');
  const [inquiryWeekdays, setInquiryWeekdays] = useState<string[]>([]);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgency = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const [ag, stats, agencyPosts] = await Promise.all([
          getAgencyById(id),
          getAgencyReviewStats(id),
          getAgencyPosts(id)
        ]);

        setAgency(ag);
        setReviewStats(stats || { avg: 0, count: 0 });
        setPosts(agencyPosts || []);

        if (user) {
          try {
            const follows = await getFamilyFollowedAgencies(user.uid);
            setIsFollowing(Array.isArray(follows) ? follows.includes(id) : false);
          } catch (err) {
            console.error('Error checking follows:', err);
            setIsFollowing(false);
          }
        }
      } catch (err) {
        console.error('Error loading agency:', err);
        // Continue to show loading state after clearing it
      } finally {
        setLoading(false);
      }
    };
    loadAgency();
  }, [id, user]);

  useEffect(() => {
    const loadFamilyProfile = async () => {
      if (!user || role !== 'family') {
        setFamilyProfile(null);
        return;
      }

      const profile = await getFamilyProfile(user.uid);
      setFamilyProfile(profile);
    };

    loadFamilyProfile();
  }, [role, user]);

  const handleToggleWeekday = (day: string) => {
    setInquiryWeekdays(prev => prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day]);
  };

  const handleSendInquiry = async () => {
    if (!user || role !== 'family' || !agency || !id) {
      navigate('/login');
      return;
    }

    const trimmedDescription = inquiryDescription.trim();
    if (!trimmedDescription) {
      setInquiryError('Please describe your care needs before sending your inquiry.');
      return;
    }

    if (inquiryScheduleType === 'date_range' && (!inquiryStartDate || !inquiryEndDate)) {
      setInquiryError('Please include both start and end dates for a date-range inquiry.');
      return;
    }

    if (inquiryScheduleType === 'weekly_days' && inquiryWeekdays.length === 0) {
      setInquiryError('Please select at least one weekday for a weekly schedule inquiry.');
      return;
    }

    setInquiryError(null);
    setIsSubmittingInquiry(true);
    try {
      const familyName = familyProfile?.family_name || familyProfile?.name || user.email || 'Family';
      const conversation = await createAgencyInquiryConversation({
        familyId: user.uid,
        agencyId: id,
        familyName,
        familyEmail: user.email || undefined,
        familyPhone: familyProfile?.phone || undefined,
        familyBorough: familyProfile?.location_borough || undefined,
        agencyName: agency.company_name,
        inquiry: {
          description: trimmedDescription,
          schedule_type: inquiryScheduleType,
          start_date: inquiryScheduleType === 'date_range' ? inquiryStartDate : undefined,
          end_date: inquiryScheduleType === 'date_range' ? inquiryEndDate : undefined,
          weekdays: inquiryScheduleType === 'weekly_days' ? inquiryWeekdays : undefined,
        }
      });

      if (conversation?.id) {
        navigate(`/family/messages?conversation=${conversation.id}`);
      } else {
        setInquiryError('Unable to send inquiry right now. Please try again.');
      }
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!user || !id) {
      return alert('Please log in as a family or nanny to follow agencies.');
    }

    try {
      if (isFollowing) {
        await unfollowAgency(user.uid, id);
        setIsFollowing(false);
      } else {
        await followAgency(user.uid, id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Failed toggling follow status', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">Loading agency profile...</div>
    );
  }

  if (!agency) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">Agency not found.</div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Cover Image */}
      <div className="h-64 md:h-80 w-full relative">
        {agency.cover ? (
          <img 
            src={agency.cover}
            alt="Agency Cover" 
            className="w-full h-full object-cover"
           
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-stone-200 to-stone-300" />
        )}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-8">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {agency.logo ? (
                  <img 
                    src={agency.logo}
                    alt={`${agency.company_name || 'Agency'} logo`} 
                    className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-md bg-white -mt-16 md:-mt-20"
                   
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl border-4 border-white shadow-md bg-stone-100 -mt-16 md:-mt-20 flex items-center justify-center text-4xl font-bold text-stone-600">
                    {(agency.company_name || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{agency.company_name || 'Unnamed Agency'}</h1>
                    <div className="flex items-center gap-2">
                      {agency.isVerified && (
                        <div className="flex items-center justify-center bg-emerald-100 text-emerald-600 p-1 rounded-full" title="Verified Agency">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                      )}
                      {agency?.sponsored && (
                        <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
                          <Star className="h-3 w-3 fill-current" />
                          Sponsored
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-stone-600 mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-stone-400" />
                      {agency?.boroughs?.join(', ') || 'Unknown location'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-stone-400" />
                      {agency?.website || 'No website provided'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-stone-400" />
                      Est. {agency?.established || 'TBA'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                    onClick={handleToggleFollow}
                    className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                      isFollowing
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow Agency'}
                  </button>
                  <button className="px-5 py-2.5 bg-stone-100 text-stone-900 text-sm font-medium rounded-xl hover:bg-stone-200 transition-colors border border-stone-200">
                    View Jobs
                  </button>
                </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <h2 className="text-xl font-bold text-stone-900 mb-4">About the Agency</h2>
              <p className="text-stone-600 leading-relaxed mb-8">
                {agency?.bio || 'No description is available for this agency yet.'}
              </p>

              <h3 className="text-lg font-semibold text-stone-900 mb-4">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {agency?.specialties?.length ? (
                  agency.specialties.map((spec: string) => (
                    <span key={spec} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {spec}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-stone-500">No specialties listed yet.</span>
                )}
              </div>
            </div>

            {/* Contact / Message */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <h2 className="text-xl font-bold text-stone-900 mb-2">Send an Inquiry</h2>
              <p className="text-sm text-stone-500 mb-6">
                Parents can send an inquiry to {agency?.company_name || 'this agency'} and continue the conversation in Messages.
              </p>
              {user && role === 'family' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Care needs</label>
                    <textarea
                      value={inquiryDescription}
                      onChange={(e) => setInquiryDescription(e.currentTarget.value)}
                      rows={4}
                      placeholder="Share details like child age, preferred timing, and any special requirements..."
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Schedule type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInquiryScheduleType('weekly_days')}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          inquiryScheduleType === 'weekly_days'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Weekly days
                      </button>
                      <button
                        type="button"
                        onClick={() => setInquiryScheduleType('date_range')}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          inquiryScheduleType === 'date_range'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Date range
                      </button>
                    </div>
                  </div>

                  {inquiryScheduleType === 'weekly_days' ? (
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">Preferred weekdays</label>
                      <div className="flex flex-wrap gap-2">
                        {weekdays.map((day) => {
                          const selected = inquiryWeekdays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleWeekday(day)}
                              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                selected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Start date</label>
                        <input
                          type="date"
                          value={inquiryStartDate}
                          onChange={(e) => setInquiryStartDate(e.currentTarget.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">End date</label>
                        <input
                          type="date"
                          value={inquiryEndDate}
                          onChange={(e) => setInquiryEndDate(e.currentTarget.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {inquiryError && (
                    <p className="text-sm text-rose-600">{inquiryError}</p>
                  )}

                  <button
                    onClick={handleSendInquiry}
                    disabled={isSubmittingInquiry}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {isSubmittingInquiry ? 'Sending inquiry...' : 'Send Inquiry'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Sign in as a parent to send an inquiry
                </button>
              )}
            </div>
          </div>

          {/* Right Rail */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              {/* Reviews Summary */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">Parent Reviews</h2>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="font-bold text-stone-900">{reviewStats.avg.toFixed(1)}</span>
                    <span className="text-stone-500 text-sm">({reviewStats.count})</span>
                  </div>
                </div>
                <p className="text-stone-500 italic text-sm">Detailed reviews are available to registered users.</p>
              </div>

              {/* Agency Posts */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
                <h2 className="text-lg font-bold text-stone-900 mb-4">Agency News Feed</h2>
                {posts.length === 0 ? (
                  <p className="text-stone-500 text-sm">No posts yet. Follow this agency to see updates and announcements.</p>
                ) : (
                  <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                    {posts.slice(0, 5).map((post) => (
                      <div key={post.id} className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <h3 className="text-sm font-bold text-stone-900 line-clamp-2">{post.title}</h3>
                          <span className="text-xs text-stone-500 shrink-0">{post.created_at ? new Date(post.created_at.toDate ? post.created_at.toDate() : post.created_at).toLocaleDateString() : 'Now'}</span>
                        </div>
                        <p className="text-sm text-stone-600 line-clamp-4">{post.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
