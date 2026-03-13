import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, ArrowRight, MapPin, Users, Calendar, Clock, Heart } from 'lucide-react';
import { updateFamilyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  const [formData, setFormData] = useState({
    // Step 1: Basic Needs
    children_count: '1',
    children_ages: [] as string[],
    care_type: 'Full-Time',
    
    // Step 2: Schedule & Location
    location_borough: 'Manhattan',
    location_neighborhood: '',
    schedule: '',
    start_date: '',
    live_in: false,
    
    // Step 3: Preferences
    languages: [] as string[],
    driver_requirement: false,
    pet_friendly: false,
    special_skills: [] as string[]
  });

  const handleNext = () => {
    setStep(s => Math.min(3, s + 1));
    window.scrollTo(0, 0);
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
        location_borough: formData.location_borough,
        location_neighborhood: formData.location_neighborhood
      },
      profile: {
        children_count: parseInt(formData.children_count),
        children_ages: formData.children_ages,
        schedule: formData.schedule,
        care_type: formData.care_type,
        live_in: formData.live_in,
        start_date: formData.start_date,
        preferences: {
          languages: formData.languages,
          driver_requirement: formData.driver_requirement,
          pet_friendly: formData.pet_friendly,
          special_skills: formData.special_skills
        }
      }
    };

    try {
      await updateFamilyProfile(familyId, profileData);
      navigate('/family/dashboard');
    } catch (error) {
      console.error('Error updating profile:', error);
      setIsSubmitting(false);
    }
  };

  const toggleArrayItem = (field: 'children_ages' | 'languages' | 'special_skills', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
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
            <span>Schedule</span>
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
                      Children Information
                    </h2>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">Number of Children needing care</label>
                        <select 
                          value={formData.children_count}
                          onChange={e => setFormData({...formData, children_count: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                        >
                          {[1, 2, 3, 4, '5+'].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-3">Age Groups (Select all that apply)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {['Newborn (0-3 mos)', 'Infant (3-12 mos)', 'Toddler (1-3 yrs)', 'Preschool (4-5 yrs)', 'School Age (6+ yrs)'].map(age => (
                            <button
                              type="button"
                              key={age}
                              onClick={() => toggleArrayItem('children_ages', age)}
                              className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                                formData.children_ages.includes(age)
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                  : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-stone-50'
                              }`}
                            >
                              {age}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-stone-100" />

                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
                      <Heart className="h-5 w-5 text-emerald-600" />
                      Care Type
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {['Full-Time', 'Part-Time', 'Temporary'].map(type => (
                        <button
                          type="button"
                          key={type}
                          onClick={() => setFormData({...formData, care_type: type})}
                          className={`px-4 py-4 rounded-xl border text-center font-bold transition-all ${
                            formData.care_type === type
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                              : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-stone-50'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Schedule & Location */}
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
                          onChange={e => setFormData({...formData, location_borough: e.target.value})}
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
                          onChange={e => setFormData({...formData, location_neighborhood: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-stone-100" />

                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2 mb-6">
                      <Clock className="h-5 w-5 text-emerald-600" />
                      Schedule Details
                    </h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-900 mb-2">General Schedule</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Monday - Friday, 8am - 6pm"
                          value={formData.schedule}
                          onChange={e => setFormData({...formData, schedule: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-stone-900 mb-2">Desired Start Date</label>
                          <input 
                            type="date"
                            required
                            value={formData.start_date}
                            onChange={e => setFormData({...formData, start_date: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-3 p-3 w-full border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                            <input 
                              type="checkbox"
                              checked={formData.live_in}
                              onChange={e => setFormData({...formData, live_in: e.target.checked})}
                              className="w-5 h-5 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                            />
                            <span className="font-bold text-stone-900">Require Live-in Nanny</span>
                          </label>
                        </div>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-4 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                          <input 
                            type="checkbox"
                            checked={formData.driver_requirement}
                            onChange={e => setFormData({...formData, driver_requirement: e.target.checked})}
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
                            onChange={e => setFormData({...formData, pet_friendly: e.target.checked})}
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
