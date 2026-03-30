import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, MapPin, Star, ShieldCheck, BookmarkPlus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { getNannies, resolveAgencyIdForUser, addNannyToAgencyTalentPool, getAgencyTalentPool, getNannyBgStatusMap, getNannyReviewSummary } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDisplayCvid } from '../../lib/nannyIdentity';
import NannyCvidCardModal from '../../components/NannyCvidCardModal';

export default function GlobalSearch() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [nannies, setNannies] = useState<any[]>([]);
  const [savedNannyIds, setSavedNannyIds] = useState<Set<string>>(new Set());
  const [savingNannyIds, setSavingNannyIds] = useState<Set<string>>(new Set());
  const [bgStatusByNanny, setBgStatusByNanny] = useState<Record<string, any>>({});
  const [selectedBorough, setSelectedBorough] = useState('All');
  const [minExperience, setMinExperience] = useState(0);
  const [cvidCardOpen, setCvidCardOpen] = useState(false);
  const [selectedNanny, setSelectedNanny] = useState<any>(null);
  const [selectedShiftScore, setSelectedShiftScore] = useState<number | null>(null);
  const [loadingShiftScore, setLoadingShiftScore] = useState(false);

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
      try {
        const fetchedNannies = await getNannies();
        setNannies(fetchedNannies);
        const statusMap = await getNannyBgStatusMap(fetchedNannies.map((item) => item.id));
        setBgStatusByNanny(statusMap);

        if (agencyId) {
          const pool = await getAgencyTalentPool(agencyId);
          setSavedNannyIds(new Set(pool.map((item) => item.nanny_id)));
        }
      } catch (error) {
        console.error('Error loading nannies:', error);
      }
    };
    loadData();
  }, [agencyId]);

  const handleAddToPool = async (nannyId: string) => {
    if (!agencyId || !nannyId || savedNannyIds.has(nannyId)) return;

    setSavingNannyIds((prev) => new Set(prev).add(nannyId));
    try {
      const added = await addNannyToAgencyTalentPool(agencyId, nannyId);
      if (added?.id) {
        setSavedNannyIds((prev) => {
          const next = new Set(prev);
          next.add(nannyId);
          return next;
        });
      }
    } catch (error) {
      console.error('Error adding nanny to talent pool:', error);
    } finally {
      setSavingNannyIds((prev) => {
        const next = new Set(prev);
        next.delete(nannyId);
        return next;
      });
    }
  };

  const filteredNannies = nannies.filter(nanny => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      nanny.first_name?.toLowerCase().includes(query) ||
      nanny.last_name?.toLowerCase().includes(query) ||
      nanny.location_borough?.toLowerCase().includes(query) ||
      (Array.isArray(nanny.certifications) && nanny.certifications.some((s: string) => s.toLowerCase().includes(query)));

    const matchesBorough = selectedBorough === 'All' || nanny.location_borough === selectedBorough;
    const matchesExperience = (nanny.years_experience || 0) >= minExperience;

    return matchesSearch && matchesBorough && matchesExperience;
  });

  const formatBgStatus = (status: string) => {
    if (status === 'checked') return { label: 'BG Checked', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (status === 'expired') return { label: 'BG Check Expired', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'BG Not Checked', className: 'bg-stone-100 text-stone-700 border-stone-200' };
  };

  const openCvidCard = async (nanny: any) => {
    setSelectedNanny(nanny);
    setSelectedShiftScore(null);
    setLoadingShiftScore(true);
    setCvidCardOpen(true);
    try {
      const summary = await getNannyReviewSummary(nanny.id);
      setSelectedShiftScore(summary?.shiftScore ?? null);
    } catch {
      setSelectedShiftScore(null);
    } finally {
      setLoadingShiftScore(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Global Nanny Search</h1>
          <p className="text-stone-500 mt-1">Search the global directory, then invite selected nannies into your private talent pool.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, borough, or certification..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
            <MapPin className="h-4 w-4 text-stone-400" />
            <select
              value={selectedBorough}
              onChange={(e) => setSelectedBorough(e.target.value)}
              className="text-sm font-medium text-stone-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="All">All Boroughs</option>
              <option value="Manhattan">Manhattan</option>
              <option value="Brooklyn">Brooklyn</option>
              <option value="Queens">Queens</option>
              <option value="Bronx">Bronx</option>
              <option value="Staten Island">Staten Island</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
            <Filter className="h-4 w-4 text-stone-400" />
            <select
              value={minExperience}
              onChange={(e) => setMinExperience(Number(e.target.value))}
              className="text-sm font-medium text-stone-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="0">Any Experience</option>
              <option value="2">2+ Years</option>
              <option value="5">5+ Years</option>
              <option value="10">10+ Years</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredNannies.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-3xl border border-stone-200 text-center text-stone-500">
            No nannies found matching your search.
          </div>
        ) : (
          filteredNannies.map((nanny, index) => {
            const isSaved = savedNannyIds.has(nanny.id);
            const isSaving = savingNannyIds.has(nanny.id);
            const bgStatus = bgStatusByNanny[nanny.id];
            const bgMeta = formatBgStatus(bgStatus?.status || 'not_checked');
            const cvid = getDisplayCvid(nanny);
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                key={nanny.id}
                className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border-2 border-stone-100 text-xl">
                      {nanny.first_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex items-center gap-1 bg-stone-100 px-2 py-1 rounded-lg">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold text-stone-900">{nanny.years_experience ?? '--'}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-1.5">
                    {nanny.first_name} {nanny.last_name}
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </h3>

                  <div className="flex items-center gap-1.5 text-sm text-stone-500 mt-1 mb-4">
                    <MapPin className="h-3.5 w-3.5" />
                    {nanny.location_borough || 'Unknown location'}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-700">
                      CVID {cvid}
                    </span>
                  </div>

                  {nanny.bio && (
                    <p className="mb-4 line-clamp-3 text-sm leading-6 text-stone-600">
                      {nanny.bio}
                    </p>
                  )}

                  <div>
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Certifications</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(nanny.certifications || []).slice(0, 4).map((spec: string) => (
                        <span key={spec} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600">
                          {spec}
                        </span>
                      ))}
                      {(!nanny.certifications || nanny.certifications.length === 0) && (
                        <span className="text-xs text-stone-400">No certifications listed</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Background Signal</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${bgMeta.className}`}>
                        {bgMeta.label}
                      </span>
                      {bgStatus?.confidence ? (
                        <span className="text-xs text-stone-500">Confidence {Math.round(bgStatus.confidence)}%</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex gap-2">
                  <button
                    onClick={() => openCvidCard(nanny)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    Open CVID Card
                  </button>
                  <button
                    disabled={isSaved || isSaving || !agencyId}
                    onClick={() => handleAddToPool(nanny.id)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isSaved
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {isSaved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                    {isSaved ? 'In Talent Pool' : isSaving ? 'Inviting...' : 'Invite to Talent Pool'}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <NannyCvidCardModal
        isOpen={cvidCardOpen}
        nanny={selectedNanny ? {
          ...selectedNanny,
          cvid: getDisplayCvid(selectedNanny),
        } : null}
        shiftScore={selectedShiftScore}
        shiftScoreLoading={loadingShiftScore}
        onClose={() => {
          setCvidCardOpen(false);
          setSelectedNanny(null);
          setSelectedShiftScore(null);
        }}
      />
    </div>
  );
}
