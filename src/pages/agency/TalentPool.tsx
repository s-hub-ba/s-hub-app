import { useState, useEffect } from 'react';
import { Search as SearchIcon, MapPin, Star, ShieldCheck, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { getAgencyTalentPool, resolveAgencyIdForUser } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

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

export default function TalentPool() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [talentPool, setTalentPool] = useState<any[]>([]);

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
        setTalentPool(items);
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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Nanny</th>
                <th className="p-4">Status</th>
                <th className="p-4">Exp. (yrs)</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Latest Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredTalent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    No nannies in your talent pool yet. Invite from Global Search.
                  </td>
                </tr>
              ) : (
                filteredTalent.map((item, index) => {
                  const profile = item.nanny_profile || {};
                  const status = item.status || 'new';
                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      key={item.id}
                      className="hover:bg-stone-50/50 transition-colors"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold border border-stone-300">
                            {profile.first_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 flex items-center gap-1">
                              {profile.first_name || 'Unknown'} {profile.last_name || ''}
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {profile.location_borough || 'Unknown location'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.new}`}>
                          {STATUS_LABELS[status] || 'New'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="font-bold text-stone-900">{profile.years_experience ?? '—'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(item.tags ?? []).map((tag: string) => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-stone-600 line-clamp-2 italic">{item.latest_note ? `"${item.latest_note}"` : '—'}</p>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
