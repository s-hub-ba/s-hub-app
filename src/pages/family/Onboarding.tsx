import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, ArrowRight, MapPin, Users, Calendar, Clock, Heart } from 'lucide-react';
import { getFamilyProfile, updateFamilyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const familyId = user?.uid || '';

  const [formData, setFormData] = useState({
    // Step 1: Family & Children
    family_name: '',
    phone: '',
    children: [{ name: '', age: '', allergies: '', special_needs: '' }],
    care_needs: '',

    // Step 2: Location
    location_borough: 'Manhattan',
    location_neighborhood: '',

    // Step 3: Preferences & Culture
    languages: [] as string[],
    special_skills: [] as string[],
    driver_requirement: false,
    pet_friendly: false,
    parenting_style: '',
    dietary_preferences: '',
    cultural_values: '',
    additional_notes: ''
  });

  useEffect(() => {
    const loadExistingFamilyData = async () => {
      if (!familyId) return;
      try {
        const familyData = await getFamilyProfile(familyId);
        if (familyData) {
          setFormData((prev) => ({
            ...prev,
            family_name: familyData.family_name || familyData.name || prev.family_name,
            phone: familyData.phone || prev.phone,
            location_borough: familyData.location_borough || prev.location_borough,
            location_neighborhood: familyData.location_neighborhood || prev.location_neighborhood,
            children: (Array.isArray(familyData.children) && familyData.children.length > 0)
              ? familyData.children.map((child: any) => ({
                  name: child.name || '',
                  age: child.age?.toString() || '',
                  allergies: Array.isArray(child.allergies) ? child.allergies.join(', ') : (child.allergies || ''),
                  special_needs: child.special_needs || ''
                }))
              : prev.children,
            care_needs: familyData.care_needs || prev.care_needs,
            languages: familyData.languages || prev.languages,
            special_skills: familyData.special_skills || prev.special_skills,
            driver_requirement: familyData.driver_requirement ?? prev.driver_requirement,
            pet_friendly: familyData.pet_friendly ?? prev.pet_friendly,
            parenting_style: familyData.parenting_style || prev.parenting_style,
            dietary_preferences: familyData.dietary_preferences || prev.dietary_preferences,
            cultural_values: familyData.cultural_values || prev.cultural_values,
            additional_notes: familyData.additional_notes || prev.additional_notes
          }));
        }
      } catch (error) {
        console.error('Error loading family onboarding defaults:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingFamilyData();
  }, [familyId]);

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to continue onboarding.</div>;
  }

  if (isLoading) {
    return <div className="p-8 text-center text-stone-500">Loading onboarding info…</div>;
  }

  const handleNext = () => {
    setStep(s => Math.min(3, s + 1));
    window.scrollTo(0, 0);
  };

  const handleChildChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const children = [...prev.children];
      children[index] = { ...children[index], [field]: value };
      return { ...prev, children };
    });
  };

  const addChild = () => {
    setFormData(prev => ({
      ...prev,
      children: [...prev.children, { name: '', age: '', allergies: '', special_needs: '' }]
    }));
  };

  const removeChild = (index: number) => {
    setFormData(prev => {
      const children = prev.children.filter((_, i) => i !== index);
      return { ...prev, children: children.length ? children : [{ name: '', age: '', allergies: '', special_needs: '' }] };
    });
  };

  const toggleArrayItem = (field: 'languages' | 'special_skills', value: string) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      const hasItem = arr.includes(value);
      return {
        ...prev,
        [field]: hasItem ? arr.filter((item: string) => item !== value) : [...arr, value]
      };
    });
  };

  const handleBack = () => {
    setStep(s => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Format data for API
    const profileData = {
      family: {
        name: formData.family_name,
        family_name: formData.family_name,
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
    };

    try {
      const result = await updateFamilyProfile(familyId, profileData);
      console.log('Family onboarding saved', result);
      setIsSubmitting(false);
      navigate('/family/dashboard');
    } catch (error) {
      console.error('Error updating profile:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-2xl mb-4">
            <Baby className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Tell us about your family</h1>
          <p className="mt-2 text-stone-500">This helps agencies match you with the perfect nanny.</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-stone-200 rounded-full -z-10"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-600 rounded-full -z-10 transition-all duration-500"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            ></div>
            
            {[1, 2, 3].map((num) => (
              <div 
                key={num}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  step >= num 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-white border-2 border-stone-200 text-stone-400'
                }`}
              >
                {num}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-2 text-xs font-medium text-stone-500">
            <span>Basic Needs</span>
            <span>Location</span>
            <span>Preferences</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            <div className="p-6 md:p-8">
              
              {/* Step 1: Basic Needs */}
              {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
                      <Users className="h-5 w-5 text-emerald-600" />
                      Family & Children Info
                    </h2>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">Family Name</label>
                        <input
                          type="text"
                          required
                          value={formData.family_name}
                          onChange={e => setFormData({ ...formData, family_name: e.currentTarget.value })}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          placeholder="e.g. Smith Family"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">Contact Phone</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.currentTarget.value })}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">Care Needs Summary</label>
                        <textarea
                          rows={3}
                          value={formData.care_needs}
                          onChange={e => setFormData({ ...formData, care_needs: e.currentTarget.value })}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          placeholder="E.g., special diet, early intervention, mobility support, etc."
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-4">Child Details</h3>
                    <div className="space-y-4">
                      {formData.children.map((child: any, index: number) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-600">Name</label>
                            <input
                              type="text"
                              value={child.name}
                              onChange={e => handleChildChange(index, 'name', e.currentTarget.value)}
                              className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              placeholder="Child Name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600">Age</label>
                            <input
                              type="number"
                              min={0}
                              value={child.age}
                              onChange={e => handleChildChange(index, 'age', e.currentTarget.value)}
                              className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              placeholder="Age"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-600">Allergies (comma-separated)</label>
                            <input
                              type="text"
                              value={child.allergies}
                              onChange={e => handleChildChange(index, 'allergies', e.currentTarget.value)}
                              className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              placeholder="E.g., peanuts, dairy"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600">Special Needs</label>
                            <input
                              type="text"
                              value={child.special_needs}
                              onChange={e => handleChildChange(index, 'special_needs', e.currentTarget.value)}
                              className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              placeholder="Optional note"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => removeChild(index)}
                              className="px-3 py-2 text-xs rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                            >Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addChild}
                      className="mt-2 px-4 py-2 text-sm rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    >Add Another Child</button>
                  </div>
                </div>
              )}

              {/* Step 2: Location */}
              {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
                      <MapPin className="h-5 w-5 text-emerald-600" />
                      Location
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">Borough</label>
                        <select 
                          value={formData.location_borough}
                          onChange={e => setFormData({...formData, location_borough: e.currentTarget.value})}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
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
                          required
                          placeholder="e.g. Upper West Side"
                          value={formData.location_neighborhood}
                          onChange={e => setFormData({...formData, location_neighborhood: e.currentTarget.value})}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Preferences */}
              {step === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 mb-6">Additional Preferences</h2>
                    
                    <div className="space-y-8">
                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-3">Languages Preferred</label>
                        <div className="flex flex-wrap gap-2">
                          {['English', 'Spanish', 'French', 'Mandarin', 'ASL', 'Other'].map(lang => (
                            <button
                              type="button"
                              key={lang}
                              onClick={() => toggleArrayItem('languages', lang)}
                              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                                formData.languages.includes(lang)
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-stone-50'
                              }`}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-stone-900 mb-2">Parenting Style</label>
                          <input
                            type="text"
                            value={formData.parenting_style}
                            onChange={e => setFormData({ ...formData, parenting_style: e.currentTarget.value })}
                            placeholder="E.g. positive reinforcement, structured routine"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-stone-900 mb-2">Dietary Preferences</label>
                          <input
                            type="text"
                            value={formData.dietary_preferences}
                            onChange={e => setFormData({ ...formData, dietary_preferences: e.currentTarget.value })}
                            placeholder="E.g. vegetarian, allergy-aware, farm-to-table"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-stone-900 mb-2">Cultural Values</label>
                          <input
                            type="text"
                            value={formData.cultural_values}
                            onChange={e => setFormData({ ...formData, cultural_values: e.currentTarget.value })}
                            placeholder="E.g. bilingual home, faith-based, arts-focused"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-4 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                          <input 
                            type="checkbox"
                            checked={formData.driver_requirement}
                            onChange={e => setFormData({...formData, driver_requirement: (e.target as HTMLInputElement).checked})}
                            className="w-5 h-5 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="block font-bold text-stone-900">Driver Required</span>
                            <span className="block text-xs text-stone-500">Nanny needs to drive children</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-4 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                          <input 
                            type="checkbox"
                            checked={formData.pet_friendly}
                            onChange={e => setFormData({...formData, pet_friendly: (e.target as HTMLInputElement).checked})}
                            className="w-5 h-5 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="block font-bold text-stone-900">Pet Friendly</span>
                            <span className="block text-xs text-stone-500">We have pets at home</span>
                          </div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-3">Special Skills Desired</label>
                        <div className="flex flex-wrap gap-2">
                          {['Newborn Care Specialist', 'Potty Training', 'Sleep Training', 'Special Needs Experience', 'Tutoring/Homework Help', 'Cooking/Meal Prep'].map(skill => (
                            <button
                              type="button"
                              key={skill}
                              onClick={() => toggleArrayItem('special_skills', skill)}
                              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                                formData.special_skills.includes(skill)
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                  : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-stone-50'
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
            
            <div className="p-6 md:p-8 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 text-stone-600 font-bold hover:text-stone-900 transition-colors"
                >
                  Back
                </button>
              ) : (
                <div></div>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {step === 3 ? (
                  isSubmitting ? 'Saving Profile...' : 'Complete Profile'
                ) : (
                  <>Next Step <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
