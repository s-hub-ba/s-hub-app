import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { createJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function PostJob() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    job_type: '',
    work_type: '',
    description: '',
    location_borough: '',
    location_neighborhood: '',
    private_job_address: '',
    pay_min: '',
    pay_max: '',
    start_date: '',
    required_experience_years: '',
    schedule_summary: '',
    status: 'published'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await createJob({
        ...formData,
        agency_id: user?.id || 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
        pay_min: parseFloat(formData.pay_min),
        pay_max: parseFloat(formData.pay_max),
        required_experience_years: parseInt(formData.required_experience_years) || 0
      });
      
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/agency/jobs');
      }, 2000);
    } catch (err: any) {
      console.error('Error creating job:', err);
      setError(err.message || 'Failed to post job. Please ensure your agency profile is complete.');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-50 p-8 rounded-3xl flex flex-col items-center text-center max-w-md"
        >
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">Job Posted Successfully!</h2>
          <p className="text-emerald-700">Your job is now live and visible to nannies in the network. Redirecting to jobs dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/agency/jobs')}
          className="p-2 text-stone-400 hover:text-stone-900 bg-white rounded-full border border-stone-200 shadow-sm transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Post a New Job</h1>
          <p className="text-stone-500 text-sm">Step {step} of 3</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-stone-100 w-full">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>

        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h2 className="text-xl font-bold text-stone-900 mb-6">Basic Information</h2>
                
                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Job Title</label>
                  <input name="title" value={formData.title} onChange={handleChange} type="text" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="e.g. Full-Time Nanny for Infant" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Job Type</label>
                    <select name="job_type" value={formData.job_type} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white">
                      <option value="">Select Type</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Temporary">Temporary</option>
                      <option value="Overnight">Overnight</option>
                      <option value="Date Night">Date Night</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Work Type</label>
                    <select name="work_type" value={formData.work_type} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white">
                      <option value="">Select Work Type</option>
                      <option value="Live-Out">Live-Out</option>
                      <option value="Live-In">Live-In</option>
                      <option value="Travel">Travel</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Job Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} required rows={6} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none" placeholder="Describe the role, responsibilities, and ideal candidate..."></textarea>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h2 className="text-xl font-bold text-stone-900 mb-6">Location & Compensation</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Borough</label>
                    <select name="location_borough" value={formData.location_borough} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white">
                      <option value="">Select Borough</option>
                      <option value="Manhattan">Manhattan</option>
                      <option value="Brooklyn">Brooklyn</option>
                      <option value="Queens">Queens</option>
                      <option value="Bronx">Bronx</option>
                      <option value="Staten Island">Staten Island</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Neighborhood (Public)</label>
                    <input name="location_neighborhood" value={formData.location_neighborhood} onChange={handleChange} type="text" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="e.g. Upper East Side" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Exact Address (Private)</label>
                  <input name="private_job_address" value={formData.private_job_address} onChange={handleChange} type="text" className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="e.g. 123 Main St, Apt 4B" />
                  <div className="flex items-start gap-2 mt-2 text-sm text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-100">
                    <AlertCircle className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                    <p>Exact address is never shown publicly. It is only revealed to nannies you explicitly invite or accept.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Min Pay ($/hr)</label>
                    <input name="pay_min" value={formData.pay_min} onChange={handleChange} type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Max Pay ($/hr)</label>
                    <input name="pay_max" value={formData.pay_max} onChange={handleChange} type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="35" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h2 className="text-xl font-bold text-stone-900 mb-6">Requirements & Schedule</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Start Date</label>
                    <input name="start_date" value={formData.start_date} onChange={handleChange} type="date" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Required Experience (Years)</label>
                    <input name="required_experience_years" value={formData.required_experience_years} onChange={handleChange} type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="3" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Schedule Summary</label>
                  <input name="schedule_summary" value={formData.schedule_summary} onChange={handleChange} type="text" required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="e.g. Mon-Fri, 8am-6pm" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-900 mb-2">Required Certifications</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['CPR', 'First Aid', 'Water Safety', 'Special Needs', 'Newborn Care Specialist', 'Early Childhood Ed'].map(cert => (
                      <label key={cert} className="flex items-center gap-2 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                        <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm font-medium text-stone-700">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="pt-6 border-t border-stone-100 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => navigate('/agency/jobs')}
                className="px-6 py-3 text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-70"
              >
                {step < 3 ? 'Continue' : isSubmitting ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
