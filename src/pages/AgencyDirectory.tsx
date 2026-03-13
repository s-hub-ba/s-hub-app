import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, Filter } from 'lucide-react';
import { motion } from 'motion/react';

// Mock Data
const AGENCIES = [
  {
    id: '1',
    name: 'Manhattan Elite Nannies',
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=100&h=100',
    boroughs: ['Manhattan', 'Brooklyn'],
    specialties: ['Newborn Care', 'Bilingual', 'High-Profile'],
    description: 'Providing top-tier childcare professionals to discerning families across Manhattan and Brooklyn for over 10 years.',
    isVerified: true
  },
  {
    id: '2',
    name: 'Brooklyn Baby Co.',
    logo: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=100&h=100',
    boroughs: ['Brooklyn', 'Queens'],
    specialties: ['Part-time', 'Creative Arts', 'Special Needs'],
    description: 'A boutique agency focused on matching creative, engaging caregivers with modern Brooklyn families.',
    isVerified: true
  },
  {
    id: '3',
    name: 'NYC Night Nurses',
    logo: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=100&h=100',
    boroughs: ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
    specialties: ['Overnight', 'Newborn Care Specialist', 'Lactation'],
    description: 'Specialized overnight newborn care and sleep training across all five boroughs.',
    isVerified: true
  }
];

const BOROUGHS = ['All', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

export default function AgencyDirectory() {
  const [selectedBorough, setSelectedBorough] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgencies = AGENCIES.filter(agency => {
    const matchesBorough = selectedBorough === 'All' || agency.boroughs.includes(selectedBorough);
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agency.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesBorough && matchesSearch;
  });

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

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by agency name or specialty..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start gap-4 mb-4">
                  <img 
                    src={agency.logo} 
                    alt={`${agency.name} logo`} 
                    className="w-16 h-16 rounded-xl object-cover border border-stone-100"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 leading-tight flex items-center gap-1.5">
                      {agency.name}
                      {agency.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-stone-500 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {agency.boroughs.join(', ')}
                    </div>
                  </div>
                </div>
                
                <p className="text-stone-600 text-sm mb-6 line-clamp-3">
                  {agency.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {agency.specialties.slice(0, 3).map(spec => (
                    <span key={spec} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                      {spec}
                    </span>
                  ))}
                  {agency.specialties.length > 3 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-50 text-stone-500">
                      +{agency.specialties.length - 3} more
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-4 border-t border-stone-100 bg-stone-50/50">
                <Link 
                  to={`/agencies/${agency.id}`}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 font-medium hover:bg-stone-50 hover:border-stone-300 transition-colors"
                >
                  View Agency
                </Link>
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
