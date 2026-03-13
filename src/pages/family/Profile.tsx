import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save, CheckCircle2 } from 'lucide-react';
import { getFamilyProfile, updateFamilyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyProfile() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        const prof = await getFamilyProfile(familyId);
        setProfile(prof);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await updateFamilyProfile(familyId, {
        family: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          location_borough: profile.location_borough,
          location_neighborhood: profile.location_neighborhood
        },
        profile: {
          children_count: profile.children_count,
          schedule: profile.schedule,
          care_type: profile.care_type
        }
      });
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Family Profile</h1>
          <p className="text-stone-500 mt-1">Manage your account details and childcare needs.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isSaving ? (
            <><Save className="h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4" /> Save Changes</>
          )}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSave}>
          <div className="p-6 md:p-8 border-b border-stone-100">
            <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Family Name</label>
                <input 
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile({...profile, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Email Address</label>
                <input 
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile({...profile, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Phone Number</label>
                <input 
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile({...profile, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 border-b border-stone-100 bg-stone-50/50">
            <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              Location
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Borough</label>
                <select 
                  value={profile.location_borough}
                  onChange={e => setProfile({...profile, location_borough: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                >
                  <option value="Manhattan">Manhattan</option>
                  <option value="Brooklyn">Brooklyn</option>
                  <option value="Queens">Queens</option>
                  <option value="Bronx">The Bronx</option>
                  <option value="Staten Island">Staten Island</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Neighborhood</label>
                <input 
                  type="text"
                  value={profile.location_neighborhood}
                  onChange={e => setProfile({...profile, location_neighborhood: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                />
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Care Needs Summary
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Number of Children</label>
                <input 
                  type="number"
                  value={profile.children_count}
                  onChange={e => setProfile({...profile, children_count: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Care Type</label>
                <select 
                  value={profile.care_type}
                  onChange={e => setProfile({...profile, care_type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Schedule</label>
                <input 
                  type="text"
                  value={profile.schedule}
                  onChange={e => setProfile({...profile, schedule: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
