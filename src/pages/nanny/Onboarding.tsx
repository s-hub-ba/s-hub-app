import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, ChevronRight, Upload, Camera } from 'lucide-react';

export default function NannyOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      setIsSubmitting(true);
      setTimeout(() => {
        navigate('/nanny/dashboard');
      }, 1500);
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
                  <div className="h-24 w-24 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer transition-colors">
                    <Camera className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium text-stone-600">Upload a professional photo</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">First Name</label>
                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Sarah" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Last Name</label>
                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Jenkins" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Phone Number</label>
                  <input type="tel" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="(555) 123-4567" />
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
                  <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 5" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Professional Bio</label>
                  <textarea rows={4} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="Briefly describe your childcare philosophy and experience..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Certifications (Select all that apply)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['CPR', 'First Aid', 'Water Safety', 'Special Needs', 'Newborn Care', 'Early Ed Degree'].map(cert => (
                      <label key={cert} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50">
                        <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
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
                  <select name="location_borough" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                    <option value="">Select Borough</option>
                    <option value="Manhattan">Manhattan</option>
                    <option value="Brooklyn">Brooklyn</option>
                    <option value="Queens">Queens</option>
                    <option value="Bronx">Bronx</option>
                    <option value="Staten Island">Staten Island</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Min Pay ($/hr)</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Max Pay ($/hr)</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="45" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Preferred Job Types</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Full-Time', 'Part-Time', 'Temporary', 'Overnight', 'Live-In', 'Live-Out'].map(type => (
                      <label key={type} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50">
                        <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
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
