import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, MapPin, Star, ShieldCheck, FileText, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { getNannies } from '../../lib/api';

const STATUS_COLORS = {
  saved: 'bg-stone-100 text-stone-700',
  interviewed: 'bg-blue-100 text-blue-700',
  top_candidate: 'bg-emerald-100 text-emerald-700',
  previously_placed: 'bg-purple-100 text-purple-700',
  do_not_contact: 'bg-red-100 text-red-700',
  invited: 'bg-orange-100 text-orange-700',
  unclaimed: 'bg-stone-200 text-stone-500'
};

const STATUS_LABELS = {
  saved: 'Saved',
  interviewed: 'Interviewed',
  top_candidate: 'Top Candidate',
  previously_placed: 'Previously Placed',
  do_not_contact: 'Do Not Contact',
  invited: 'Invited',
  unclaimed: 'Unclaimed'
};

export default function TalentPool() {
  const [searchQuery, setSearchQuery] = useState('');
  const [talentPool, setTalentPool] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const nannies = await getNannies();
        setTalentPool(nannies);
      } catch (error) {
        console.error('Error loading talent pool:', error);
      }
    };
    loadData();
  }, []);

  const filteredTalent = talentPool.filter(talent => 
    talent.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    talent.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    talent.location_borough?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Talent Pool</h1>
          <p className="text-stone-500 mt-1">Manage your agency's private roster and saved candidates.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-white border border-stone-200 text-stone-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-stone-50 transition-colors"
          >
            Import CSV
          </button>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            Invite Nanny
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search talent pool..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors">
          <Filter className="h-4 w-4" />
          Status
        </button>
      </div>

      {/* Results List */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Nanny</th>
                <th className="p-4">Status</th>
                <th className="p-4">ShiftScore</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Latest Note</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredTalent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-500">
                    No nannies found in your talent pool.
                  </td>
                </tr>
              ) : (
                filteredTalent.map((talent, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={talent.id} 
                    className="hover:bg-stone-50/50 transition-colors group"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border border-stone-300">
                          {talent.first_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-1">
                            {talent.first_name} {talent.last_name}
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </div>
                          <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {talent.location_borough}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[talent.status as keyof typeof STATUS_COLORS]}`}>
                        {STATUS_LABELS[talent.status as keyof typeof STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-bold text-stone-900">{talent.shiftScore}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {talent.tags.map((tag: string) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 max-w-xs">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-stone-600 line-clamp-2 italic">"{talent.latestNote}"</p>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button 
                        onClick={() => console.log(`More options clicked for nanny ${talent.id}`)}
                        className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-stone-200"
          >
            <h3 className="text-xl font-bold text-stone-900 mb-2">Invite Nanny</h3>
            <p className="text-stone-600 mb-6">Send an invitation to a nanny to join your talent pool.</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Email Address</label>
                <input type="email" className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="nanny@example.com" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
              >
                Send Invite
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-stone-200"
          >
            <h3 className="text-xl font-bold text-stone-900 mb-2">Import CSV</h3>
            <p className="text-stone-600 mb-6">Upload a CSV file to import multiple nannies into your talent pool.</p>
            <div className="border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center mb-6">
              <FileText className="h-8 w-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm text-stone-600 font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-stone-400 mt-1">CSV files only</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false);
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-colors"
              >
                Import
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
