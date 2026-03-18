import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save, CheckCircle2 } from 'lucide-react';
import { getFamilyProfile, updateFamilyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyProfile() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    family_name: '',
    email: '',
    phone: '',
    location_borough: '',
    location_neighborhood: '',
    children: [{ name: '', age: '', allergies: '', special_needs: '' }],
    care_needs: '',
    languages: [] as string[],
    special_skills: [] as string[],
    driver_requirement: false,
    pet_friendly: false,
    parenting_style: '',
    dietary_preferences: '',
    cultural_values: '',
    additional_notes: ''
  });
  
  const familyId = user?.uid || '';

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to manage your profile.</div>;
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const prof = await getFamilyProfile(familyId);
        setProfile(prof);

        setFormData({
          family_name: prof?.family_name || prof?.name || '',
          email: prof?.email || '',
          phone: prof?.phone || '',
          location_borough: prof?.location_borough || '',
          location_neighborhood: prof?.location_neighborhood || '',
          children: prof?.children?.length ? prof.children : [{ name: '', age: '', allergies: '', special_needs: '' }],
          care_needs: prof?.care_needs || '',
          languages: prof?.languages || [],
          special_skills: prof?.special_skills || [],
          driver_requirement: prof?.driver_requirement || false,
          pet_friendly: prof?.pet_friendly || false,
          parenting_style: prof?.parenting_style || '',
          dietary_preferences: prof?.dietary_preferences || '',
          cultural_values: prof?.cultural_values || '',
          additional_notes: prof?.additional_notes || ''
        });
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadData();
  }, [familyId]);

  const handleChildChange = (index: number, field: string, value: string) => {
    setFormData((prev: any) => {
      const children = [...prev.children];
      children[index] = { ...children[index], [field]: value };
      return { ...prev, children };
    });
  };

  const addChild = () => {
    setFormData((prev: any) => ({
      ...prev,
      children: [...prev.children, { name: '', age: '', allergies: '', special_needs: '' }]
    }));
  };

  const removeChild = (index: number) => {
    setFormData((prev: any) => {
      const children = prev.children.filter((_: any, i: number) => i !== index);
      return { ...prev, children: children.length ? children : [{ name: '', age: '', allergies: '', special_needs: '' }] };
    });
  };

  const toggleArrayItem = (field: 'languages' | 'special_skills', value: string) => {
    setFormData((prev: any) => {
      const values = prev[field] || [];
      const has = values.includes(value);
      return { ...prev, [field]: has ? values.filter((item: string) => item !== value) : [...values, value] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateFamilyProfile(familyId, {
        family: {
          name: formData.family_name,
          email: formData.email,
          phone: formData.phone,
          location_borough: formData.location_borough,
          location_neighborhood: formData.location_neighborhood
        },
        profile: {
          children: formData.children.map((child: any) => ({
            name: child.name,
            age: Number(child.age) || 0,
            allergies: child.allergies ? child.allergies.split(',').map((a: string) => a.trim()) : [],
            special_needs: child.special_needs
          })),
          care_needs: formData.care_needs,
          languages: formData.languages,
          special_skills: formData.special_skills,
          driver_requirement: formData.driver_requirement,
          pet_friendly: formData.pet_friendly,
          parenting_style: formData.parenting_style,
          dietary_preferences: formData.dietary_preferences,
          cultural_values: formData.cultural_values,
          additional_notes: formData.additional_notes,
          onboarding_complete: true
        }
      });
      setProfile({ ...profile, ...formData });
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
                  value={formData.family_name}
                  onChange={e => setFormData({...formData, family_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Email Address</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Phone Number</label>
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
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
                  value={formData.location_borough}
                  onChange={e => setFormData({...formData, location_borough: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
                >
                  <option value="">Select borough</option>
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
                  value={formData.location_neighborhood}
                  onChange={e => setFormData({...formData, location_neighborhood: e.target.value})}
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
                  min={0}
                  value={formData.children?.length || 0}
                  onChange={e => {
                    const count = Math.max(0, parseInt(e.target.value) || 0);
                    setFormData(prev => ({
                      ...prev,
                      children: Array.from({ length: count }, (_, idx) => prev.children?.[idx] || { name: '', age: '', allergies: '', special_needs: '' })
                    }));
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-900 mb-2">Care Type</label>
                <select 
                  value={formData.care_needs}
                  onChange={e => setFormData({...formData, care_needs: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                >
                  <option value="">Select care type</option>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-stone-900 mb-4">Children Details</h3>
              <div className="space-y-4">
                {formData.children.map((child: any, index: number) => (
                  <div key={`child-${index}`} className="p-4 border border-stone-200 rounded-xl">
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <p className="text-sm font-medium text-stone-700">Child {index + 1}</p>
                      {formData.children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChild(index)}
                          className="text-rose-600 hover:text-rose-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <input
                        type="text"
                        placeholder="Name"
                        value={child.name}
                        onChange={e => handleChildChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Age"
                        value={child.age}
                        onChange={e => handleChildChange(index, 'age', e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Allergies (comma separated)"
                        value={child.allergies}
                        onChange={e => handleChildChange(index, 'allergies', e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Special Needs"
                        value={child.special_needs}
                        onChange={e => handleChildChange(index, 'special_needs', e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChild}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold"
                >
                  + Add another child
                </button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.pet_friendly}
                  onChange={e => setFormData({...formData, pet_friendly: e.target.checked})}
                  id="pet_friendly"
                  className="h-4 w-4 text-emerald-600 border-stone-300 rounded"
                />
                <label htmlFor="pet_friendly" className="text-sm text-stone-800">Pet-friendly environment</label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.driver_requirement}
                  onChange={e => setFormData({...formData, driver_requirement: e.target.checked})}
                  id="driver_requirement"
                  className="h-4 w-4 text-emerald-600 border-stone-300 rounded"
                />
                <label htmlFor="driver_requirement" className="text-sm text-stone-800">Driver required</label>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold text-stone-900 mb-2">Additional Notes</label>
              <textarea
                value={formData.additional_notes}
                onChange={e => setFormData({...formData, additional_notes: e.target.value})}
                className="w-full h-28 px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
