import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, Filter, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { followAgency, unfollowAgency, getFamilyFollowedAgencies, getAgencies } from '../lib/api';
import { PLAN_CODES } from '../lib/plans';

const BOROUGHS = ['All', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const TIER_CONFIG: Record<string, { label: string; className: string; sortOrder: number }> = {
  [PLAN_CODES.ENTERPRISE]: {
    label: 'Team',
    className: 'bg-red-100 text-red-700 border border-red-200',
    sortOrder: 0,
  },
  [PLAN_CODES.PROFESSIONAL]: {
    label: 'Pro',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    sortOrder: 1,
  },
  [PLAN_CODES.STARTER]: {
    label: 'Starter',
    className: 'bg-stone-100 text-stone-600 border border-stone-200',
    sortOrder: 2,
  },
};

export default function AgencyDirectory() {
  const [selectedBorough, setSelectedBorough] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [followedAgencyIds, setFollowedAgencyIds] = useState<string[]>([]);
  const { user, role } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const dbAgencies = await getAgencies();
        setAgencies(dbAgencies || []);
      } catch (err) {
        console.error('Error fetching agencies:', err);
        setAgencies([]);
      }
    };

    fetchAgencies();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchFollows = async () => {
      try {
        const follows = await getFamilyFollowedAgencies(user.uid);
        setFollowedAgencyIds(follows || []);
      } catch (err) {
        console.error('Error fetching followed agencies:', err);
      }
    };

    fetchFollows();
  }, [user]);

  const toggleFollow = async (agencyId: string) => {
    if (!user) {
      return alert('Please log in to follow agencies.');
    }
    const isFollowing = followedAgencyIds.includes(agencyId);
    try {
      if (isFollowing) {
        await unfollowAgency(user.uid, agencyId);
        setFollowedAgencyIds(prev => prev.filter(id => id !== agencyId));
      } else {
        await followAgency(user.uid, agencyId);
        setFollowedAgencyIds(prev => [...prev, agencyId]);
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  };

  const filteredAgencies = agencies
    .filter(agency => {
      const matchesBorough = selectedBorough === 'All' || (agency.boroughs || [])?.includes(selectedBorough);
      const agencyName = (agency.company_name || agency.name || '').toLowerCase();
      const matchesSearch = agencyName.includes(searchQuery.toLowerCase()) || 
        (agency.specialties || [])?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesBorough && matchesSearch;
    })
    .sort((a, b) => {
      // Team > Pro > Starter > Free/none; sponsored (Featured boost) within each tier first
      const aTier = TIER_CONFIG[a.plan_tier ?? '']?.sortOrder ?? 3;
      const bTier = TIER_CONFIG[b.plan_tier ?? '']?.sortOrder ?? 3;
      if (aTier !== bTier) return aTier - bTier;
      const aSponsored = a.sponsored || a.isSponsored ? -1 : 0;
      const bSponsored = b.sponsored || b.isSponsored ? -1 : 0;
      return aSponsored - bSponsored;
    });

  const getAgencyHref = (agencyId: string) => {
    if (role === 'family' || location.pathname.startsWith('/family/')) {
      return `/family/agencies/${agencyId}`;
    }

    return `/agencies/${agencyId}`;
  };

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl font-bold text-stone-900 tracking-tight mb-4">Find a Verified Agency</h1>
          <p className="text-lg text-stone-600">
            Browse our directory of trusted, vetted nanny agencies operating in New York City. 
            Send inquiries directly to find the perfect fit for your family.
          </p>
        </div>

        {/* Featured Agencies Strip */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-amber-500 fill-current" />
            <h2 className="text-xl font-bold text-stone-900">Featured Agencies</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agencies.filter(a => a.isSponsored || a.sponsored).map((agency, index) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                key={`featured-${agency.id}`} 
                className="bg-gradient-to-br from-amber-50 to-white rounded-3xl border-2 border-amber-200 p-6 shadow-md relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Featured
                </div>
                <div className="flex items-center gap-4 mb-4">
                  {agency.logo ? (
                    <img 
                      src={agency.logo}
                      alt={agency.company_name || agency.name || 'Agency'} 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                     
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl border-2 border-white shadow-sm bg-stone-100 flex items-center justify-center text-stone-600 font-bold">
                      {(agency.company_name || agency.name || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors">{agency.company_name || agency.name || 'Agency'}</h3>
                    <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                      <MapPin className="h-3 w-3" />
                      {(agency.boroughs || []).join(', ') || 'Multiple locations'}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-stone-600 line-clamp-2 mb-4">
                  {agency.description || agency.bio || 'Professional nanny agency'}
                </p>
                <Link 
                  to={getAgencyHref(agency.id)}
                  className="inline-flex items-center text-sm font-bold text-amber-600 hover:text-amber-700"
                >
                  View Profile <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by agency name or specialty..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {BOROUGHS.map(borough => (
              <button
                key={borough}
                onClick={() => setSelectedBorough(borough)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedBorough === borough 
                    ? 'bg-stone-900 text-white' 
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {borough}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgencies.map((agency, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              key={agency.id} 
              className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col relative ${(agency.isSponsored || agency.sponsored) ? 'border-amber-300 ring-1 ring-amber-300' : 'border-stone-200'}`}
            >
              {(agency.isSponsored || agency.sponsored) && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Sponsored
                </div>
              )}
              <div className="p-6 flex-1">
                <div className="flex items-start gap-4 mb-4">
                  {agency.logo ? (
                    <img 
                      src={agency.logo}
                      alt={`${agency.company_name || agency.name || 'Agency'} logo`} 
                      className="w-16 h-16 rounded-xl object-cover border border-stone-100"
                     
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-stone-100 bg-stone-100 flex items-center justify-center text-stone-600 font-bold">
                      {(agency.company_name || agency.name || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 leading-tight flex items-center gap-1.5">
                      {agency.company_name || agency.name || 'Agency'}
                      {agency.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {(agency.boroughs || []).join(', ') || 'NYC'}
                    </div>
                    {agency.plan_tier && agency.plan_tier !== PLAN_CODES.STARTER && (
                      <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_CONFIG[agency.plan_tier]?.className ?? ''}`}>
                        {agency.plan_tier === PLAN_CODES.ENTERPRISE ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        {TIER_CONFIG[agency.plan_tier]?.label}
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-stone-600 text-sm mb-6 line-clamp-3">
                  {agency.description || agency.bio || 'Professional nanny agency'}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {(agency.specialties || []).slice(0, 3).map(spec => (
                    <span key={spec} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                      {spec}
                    </span>
                  ))}
                  {(agency.specialties || []).length > 3 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-50 text-stone-500">
                      +{(agency.specialties || []).length - 3} more
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-4 border-t border-stone-100 bg-stone-50/50 space-y-2">
                <Link 
                  to={getAgencyHref(agency.id)}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 font-medium hover:bg-stone-50 hover:border-stone-300 transition-colors"
                >
                  View Agency
                </Link>
                <button
                  onClick={() => toggleFollow(agency.id)}
                  className={`block w-full text-center px-4 py-2.5 rounded-xl font-medium transition-colors ${
                    followedAgencyIds.includes(agency.id)
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
                      : 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-200'
                  }`}
                >
                  {followedAgencyIds.includes(agency.id) ? 'Following' : 'Follow Agency'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredAgencies.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-100 mb-4">
              <Search className="h-8 w-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-medium text-stone-900 mb-1">No agencies found</h3>
            <p className="text-stone-500">Try adjusting your search or borough filter.</p>
          </div>
        )}

      </div>
    </div>
  );
}
