import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, ChevronRight, Upload, Camera } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { updateNannyProfile, getNannyById } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../lib/firebase';

const CHILDCARE_PHILOSOPHY_OPTIONS = [
  'Montessori-inspired',
  'Play-based learning',
  'Gentle parenting',
  'Routine-focused care',
  'Outdoor-first activities',
  'Language-rich environment',
  'Social-emotional learning',
  'Positive discipline',
];

export default function NannyOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    phone_number: '',
    photo_url: '',
    years_experience: '',
    bio: '',
    certifications: [],
    childcare_philosophy_tags: [],
    location_borough: '',
    travel_radius_miles: 10,
    expected_pay_min: '',
    expected_pay_max: '',
    preferred_job_types: []
  });

  useEffect(() => {
    if (user?.uid) {
      getNannyById(user.uid).then(data => {
        if (data) {
          const existingTags = Array.isArray((data as any).childcare_philosophy_tags)
            ? (data as any).childcare_philosophy_tags
            : [];
          const legacyParentingStyle = String((data as any).parenting_style || '').trim();
          setFormData(prev => ({
            ...prev,
            ...data,
            childcare_philosophy_tags: existingTags.length > 0
              ? existingTags
              : (legacyParentingStyle ? [legacyParentingStyle] : prev.childcare_philosophy_tags)
          }));
        }
      }).catch(err => console.error("Error fetching nanny profile:", err));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, value: string) => {
    setFormData(prev => {
      const current = prev[name] || [];
      if (current.includes(value)) {
        return { ...prev, [name]: current.filter((v: string) => v !== value) };
      } else {
        return { ...prev, [name]: [...current, value] };
      }
    });
  };

  const handleProfilePhotoUpload = async (file: File | null) => {
    if (!file || !user?.uid) return;

    if (!file.type.startsWith('image/')) {
      setPhotoUploadError('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError('Please choose an image smaller than 5MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoUploadError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
      const storagePath = `nanny-documents/${user.uid}/profile-photo-${Date.now()}.${safeExt}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const photoUrl = await getDownloadURL(fileRef);
      setFormData((prev: any) => ({ ...prev, photo_url: photoUrl }));
    } catch (uploadErr: any) {
      console.error('Error uploading onboarding profile photo:', uploadErr);
      setPhotoUploadError(uploadErr?.message || 'Unable to upload photo right now. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      if (user?.uid) {
        console.log('[NannyOnboarding] saving profile', user.uid);
        const updated = await updateNannyProfile(user.uid, {
          ...formData,
          years_experience: parseInt(formData.years_experience) || 0,
          travel_radius_miles: parseInt(formData.travel_radius_miles) || 10,
          expected_pay_min: parseFloat(formData.expected_pay_min) || 0,
          expected_pay_max: parseFloat(formData.expected_pay_max) || 0,
        });
        console.log('[NannyOnboarding] profile updated', updated);
      }

      window.localStorage.setItem('userRole', 'nanny');
      navigate('/nanny/dashboard', { replace: true });

    } catch (error) {
      console.error('Error saving onboarding data:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">S</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-stone-900">Shift Me Up</span>
        </div>
        <div className="text-sm font-medium text-stone-500">
          Step {step} of 4
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-24">
        <div className="w-full max-w-xl">
          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-emerald-500' : 'bg-stone-200'}`} />
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 md:p-10">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-stone-900 mb-2">Welcome to Shift Me Up!</h1>
                  <p className="text-stone-500">Let's build your professional profile. Agencies will use this to find you for jobs.</p>
                </div>

                <div className="flex flex-col items-center gap-4 mb-8">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="h-24 w-24 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer transition-colors overflow-hidden disabled:opacity-70"
                  >
                    {formData.photo_url ? (
                      <img src={formData.photo_url} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-8 w-8" />
                    )}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      void handleProfilePhotoUpload(file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-70"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {isUploadingPhoto ? 'Uploading...' : (formData.photo_url ? 'Change photo' : 'Upload photo')}
                  </button>
                  <p className="text-sm font-medium text-stone-600">Upload a professional photo</p>
                  {photoUploadError && <p className="text-xs text-red-600">{photoUploadError}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">First Name</label>
                    <input name="first_name" value={formData.first_name} onChange={handleChange} type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Sarah" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Last Name</label>
                    <input name="last_name" value={formData.last_name} onChange={handleChange} type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Jenkins" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Phone Number</label>
                  <input name="phone_number" value={formData.phone_number} onChange={handleChange} type="tel" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="(555) 123-4567" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-stone-900 mb-2">Experience & Skills</h1>
                  <p className="text-stone-500">Tell agencies about your background.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Years of Professional Experience</label>
                  <input name="years_experience" value={formData.years_experience} onChange={handleChange} type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 5" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Professional Bio</label>
                  <textarea name="bio" value={formData.bio} onChange={handleChange} rows={4} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="Briefly describe your childcare philosophy and experience..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Childcare Philosophy (Tags)</label>
                  <p className="text-xs text-stone-500 mb-3">Pick the care approaches that best match how you work with children.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CHILDCARE_PHILOSOPHY_OPTIONS.map((tag) => (
                      <label key={tag} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={formData.childcare_philosophy_tags?.includes(tag)}
                          onChange={() => handleCheckboxChange('childcare_philosophy_tags', tag)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-stone-700">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Certifications (Select all that apply)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['CPR', 'First Aid', 'Water Safety', 'Special Needs', 'Newborn Care', 'Early Ed Degree'].map(cert => (
                      <label key={cert} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50">
                        <input 
                          type="checkbox" 
                          checked={formData.certifications?.includes(cert)}
                          onChange={() => handleCheckboxChange('certifications', cert)}
                          className="rounded text-emerald-600 focus:ring-emerald-500" 
                        />
                        <span className="text-sm font-medium text-stone-700">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-stone-900 mb-2">Location & Preferences</h1>
                  <p className="text-stone-500">Where and how do you want to work?</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Primary Borough</label>
                  <select name="location_borough" value={formData.location_borough} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                    <option value="">Select Borough</option>
                    <option value="Manhattan">Manhattan</option>
                    <option value="Brooklyn">Brooklyn</option>
                    <option value="Queens">Queens</option>
                    <option value="Bronx">Bronx</option>
                    <option value="Staten Island">Staten Island</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Travel Radius ({Number(formData.travel_radius_miles || 10)} miles)</label>
                  <input
                    type="range"
                    name="travel_radius_miles"
                    min={1}
                    max={50}
                    step={1}
                    value={Number(formData.travel_radius_miles || 10)}
                    onChange={handleChange}
                    className="w-full accent-emerald-600"
                  />
                  <p className="mt-2 text-sm text-stone-600">Willing to commute up to {Number(formData.travel_radius_miles || 10)} miles.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Min Pay ($/hr)</label>
                    <input name="expected_pay_min" value={formData.expected_pay_min} onChange={handleChange} type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Max Pay ($/hr)</label>
                    <input name="expected_pay_max" value={formData.expected_pay_max} onChange={handleChange} type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="45" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Preferred Job Types</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Full-Time', 'Part-Time', 'Temporary', 'Overnight', 'Live-In', 'Live-Out'].map(type => (
                      <label key={type} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50">
                        <input 
                          type="checkbox" 
                          checked={formData.preferred_job_types?.includes(type)}
                          onChange={() => handleCheckboxChange('preferred_job_types', type)}
                          className="rounded text-emerald-600 focus:ring-emerald-500" 
                        />
                        <span className="text-sm font-medium text-stone-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-center">
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-stone-900 mb-2">You're All Set!</h1>
                <p className="text-stone-600 mb-8">
                  Your profile is ready. You can now start applying to jobs and connecting with top agencies in NYC.
                </p>
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 text-left">
                  <h3 className="font-bold text-stone-900 mb-2">Next Steps:</h3>
                  <ul className="space-y-3 text-sm text-stone-600">
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">1</div>
                      Set your detailed weekly availability in your dashboard.
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">2</div>
                      Upload verification documents (ID, CPR card) to boost your ShiftScore.
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">3</div>
                      Browse the job board and apply!
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}

            <div className="mt-8 pt-6 border-t border-stone-100 flex justify-between items-center">
              {step > 1 ? (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <button 
                onClick={handleNext}
                disabled={isSubmitting}
                className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {step === 4 ? (
                  isSubmitting ? 'Finishing...' : 'Go to Dashboard'
                ) : (
                  <>Continue <ChevronRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
