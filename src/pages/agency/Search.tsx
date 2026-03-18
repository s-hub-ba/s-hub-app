import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, MapPin, Star, ShieldCheck, BookmarkPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { getNannies } from '../../lib/api';

export default function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [nannies, setNannies] = useState<any[]>([]);
  const [selectedBorough, setSelectedBorough] = useState('All');
  const [selectedTier, setSelectedTier] = useState('All');
  const [minExperience, setMinExperience] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchedNannies = await getNannies();
        setNannies(fetchedNannies);
      } catch (error) {
        console.error('Error loading nannies:', error);
      }
    };
    loadData();
  }, []);

  const filteredNannies = nannies.filter(nanny => {
    const matchesSearch = nanny.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          nanny.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          nanny.specialties?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesBorough = selectedBorough === 'All' || nanny.location_borough === selectedBorough;
    const matchesTier = selectedTier === 'All' || nanny.tier === selectedTier;
    const matchesExperience = nanny.experience >= minExperience;

    return matchesSearch && matchesBorough && matchesTier && matchesExperience;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Global Nanny Search</h1>
          <p className="text-stone-500 mt-1">Discover verified childcare professionals across NYC.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by name, specialty, or keyword..." 
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
            <Star className="h-4 w-4 text-stone-400" />
            <select 
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="text-sm font-medium text-stone-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="All">All Tiers</option>
              <option value="Elite">Elite</option>
              <option value="Professional">Professional</option>
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

          {(selectedBorough !== 'All' || selectedTier !== 'All' || minExperience !== 0 || searchQuery !== '') && (
            <button 
              onClick={() => {
                setSelectedBorough('All');
                setSelectedTier('All');
                setMinExperience(0);
                setSearchQuery('');
              }}
              className="text-sm font-medium text-red-500 hover:text-red-600 px-2"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredNannies.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-3xl border border-stone-200 text-center text-stone-500">
            No nannies found matching your search.
          </div>
        ) : (
          filteredNannies.map((nanny, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              key={nanny.id} 
              className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border-2 border-stone-100 text-xl">
                    {nanny.first_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-stone-100 px-2 py-1 rounded-lg">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold text-stone-900">{nanny.shiftScore}</span>
                    </div>
                    <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mt-1">{nanny.tier}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-1.5">
                  {nanny.first_name} {nanny.last_name}
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </h3>
                
                <div className="flex items-center gap-1.5 text-sm text-stone-500 mt-1 mb-4">
                  <MapPin className="h-3.5 w-3.5" />
                  {nanny.location_neighborhood}, {nanny.location_borough}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Experience</p>
                    <p className="text-sm text-stone-900 font-medium">{nanny.experience} years</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nanny.specialties.map((spec: string) => (
                        <span key={spec} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex gap-2">
                <button 
                  onClick={() => console.log(`View profile clicked for nanny ${nanny.id}`)}
                  className="flex-1 text-center px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  View Profile
                </button>
                <button 
                  onClick={() => console.log(`Save to Talent Pool clicked for nanny ${nanny.id}`)}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition-colors flex items-center justify-center" 
                  title="Save to Talent Pool"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
