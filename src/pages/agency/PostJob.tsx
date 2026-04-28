import React, { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { createJob, resolveAgencyIdForUser, getConversationById, ensureFamilyApplicationForInquiryJob, linkInquiryConversationToJob, getActiveJobCount, getFamilyRequestById, getJobById, updateJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAgencyEntitlements } from '../../lib/entitlements';
import { formatCareTypeLabel } from '../../lib/jobTypes';
import { formatLimit } from '../../lib/plans';

export default function PostJob() {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [resolvedAgencyId, setResolvedAgencyId] = useState('');
  const [inquiryContext, setInquiryContext] = useState<any>(null);
  const [familyRequestContext, setFamilyRequestContext] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingJobId, setEditingJobId] = useState('');
  const [editingJobStatus, setEditingJobStatus] = useState<'draft' | 'published' | 'closed'>('draft');
  const [submitIntent, setSubmitIntent] = useState<'draft' | 'publish'>('publish');
  const [sourceRequestId, setSourceRequestId] = useState<string | null>(null);

  const { entitlements } = useAgencyEntitlements(resolvedAgencyId);

  const normalizeNonNegativeInput = (value: string, allowDecimal = true) => {
    if (!value) return '';
    const parsed = allowDecimal ? Number(value) : parseInt(value, 10);
    if (!Number.isFinite(parsed)) return '';
    return String(Math.max(0, allowDecimal ? parsed : Math.floor(parsed)));
  };
  
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
    schedule_type: 'weekly_days',
    start_date: '',
    end_date: '',
    weekdays: [] as string[],
    required_experience_years: '',
    status: 'published'
  });

  useEffect(() => {
    const loadContext = async () => {
      if (!user?.uid) return;
      const agency = await resolveAgencyIdForUser(user.uid);
      setResolvedAgencyId(agency || '');

      if (agency) {
        const count = await getActiveJobCount(agency);
        setActiveJobCount(count);
      }

      const editId = searchParams.get('edit');
      if (editId) {
        const existingJob = await getJobById(editId);
        if (!existingJob) {
          setError('The draft job could not be found.');
          return;
        }

        if (agency && existingJob.agency_id !== agency) {
          setError('You do not have access to edit this job.');
          return;
        }

        const normalizedStatus = String(existingJob.status || 'draft').toLowerCase();
        const safeStatus: 'draft' | 'published' | 'closed' =
          normalizedStatus === 'published'
            ? 'published'
            : normalizedStatus === 'closed'
              ? 'closed'
              : 'draft';

        setIsEditMode(true);
        setEditingJobId(editId);
        setEditingJobStatus(safeStatus);
        setSourceRequestId(existingJob.source_inquiry_id ? String(existingJob.source_inquiry_id) : null);

        setFormData((prev) => ({
          ...prev,
          title: String(existingJob.title || ''),
          job_type: String(existingJob.job_type || ''),
          work_type: String(existingJob.work_type || ''),
          description: String(existingJob.description || ''),
          location_borough: String(existingJob.location_borough || ''),
          location_neighborhood: String(existingJob.location_neighborhood || ''),
          private_job_address: String(existingJob.private_job_address || ''),
          pay_min: existingJob.pay_min != null ? String(existingJob.pay_min) : '',
          pay_max: existingJob.pay_max != null ? String(existingJob.pay_max) : '',
          schedule_type: String(existingJob.schedule_type || 'weekly_days'),
          start_date: String(existingJob.start_date || ''),
          end_date: String(existingJob.end_date || ''),
          weekdays: Array.isArray(existingJob.weekdays) ? existingJob.weekdays : [],
          required_experience_years: existingJob.required_experience_years != null
            ? String(existingJob.required_experience_years)
            : '',
          status: safeStatus,
        }));

        if (existingJob.source_inquiry_id) {
          const familyReq = await getFamilyRequestById(String(existingJob.source_inquiry_id));
          if (familyReq) {
            setFamilyRequestContext(familyReq);
          }
        }
        return;
      }

      const inquiryId = searchParams.get('inquiry');
      if (!inquiryId) {
        // Check for from_request context
        const fromRequestId = searchParams.get('from_request');
        if (fromRequestId) {
          const familyReq = await getFamilyRequestById(fromRequestId);
          if (familyReq) {
            setFamilyRequestContext(familyReq);
            const careLabel = familyReq.care_type
              ? formatCareTypeLabel(familyReq.care_type)
              : '';
            const desc = [
              `Care request from: ${familyReq.parent_name || 'Family'}`,
              familyReq.schedule ? `Schedule: ${familyReq.schedule}` : null,
              familyReq.special_requirements ? `Special requirements: ${familyReq.special_requirements}` : null,
              familyReq.notes ? `Notes: ${familyReq.notes}` : null,
            ].filter(Boolean).join('\n');
            setFormData(prev => ({
              ...prev,
              title: careLabel ? `${careLabel} Nanny – ${familyReq.borough || 'NYC'}` : prev.title,
              location_borough: familyReq.borough || prev.location_borough,
              location_neighborhood: familyReq.neighborhood || prev.location_neighborhood,
              pay_min: familyReq.budget_min != null ? String(familyReq.budget_min) : prev.pay_min,
              pay_max: familyReq.budget_max != null ? String(familyReq.budget_max) : prev.pay_max,
              start_date: familyReq.start_date || prev.start_date,
              description: desc || prev.description,
              job_type: familyReq.care_type || prev.job_type,
            }));
          }
        }
        return;
      }

      const convo = await getConversationById(inquiryId);
      if (convo?.inquiry_type === 'agency_intro') {
        setInquiryContext(convo);
        const inquirySummary = [
          `Inquiry from: ${convo.family_name || 'Family'}`,
          convo.family_email ? `Email: ${convo.family_email}` : null,
          convo.family_phone ? `Phone: ${convo.family_phone}` : null,
          convo.family_borough ? `Borough: ${convo.family_borough}` : null,
          convo.inquiry_schedule_type === 'date_range'
            ? `Date range: ${convo.inquiry_start_date || 'TBD'} to ${convo.inquiry_end_date || 'TBD'}`
            : `Preferred weekdays: ${(Array.isArray(convo.inquiry_weekdays) ? convo.inquiry_weekdays : []).join(', ') || 'Not specified'}`,
          convo.inquiry_description_preview || null,
        ].filter(Boolean).join('\n');

        setFormData(prev => ({
          ...prev,
          title: prev.title || `Nanny Placement${convo.family_borough ? ` - ${convo.family_borough}` : ''}`,
          location_borough: convo.family_borough || prev.location_borough,
          description: prev.description || inquirySummary,
          schedule_type: convo.inquiry_schedule_type === 'date_range' ? 'date_range' : 'weekly_days',
          start_date: convo.inquiry_schedule_type === 'date_range' ? (convo.inquiry_start_date || '') : prev.start_date,
          end_date: convo.inquiry_schedule_type === 'date_range' ? (convo.inquiry_end_date || '') : '',
          weekdays: convo.inquiry_schedule_type === 'weekly_days' && Array.isArray(convo.inquiry_weekdays)
            ? convo.inquiry_weekdays
            : prev.weekdays
        }));
      }
    };

    loadContext();
  }, [searchParams, user]);

  // Job limit gate: show upgrade prompt if limit is reached
  const jobLimitReached =
    entitlements !== null &&
    !entitlements.canCreateJobPosting(activeJobCount);

  if (!isEditMode && jobLimitReached && entitlements) {
    const limit = entitlements.activeJobLimit;
    return (
      <div className="max-w-lg mx-auto py-16 text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Job Posting Limit Reached</h2>
        <p className="text-stone-500 mb-2">
          Your <span className="font-semibold">{entitlements.plan.name}</span> plan allows up to{' '}
          <span className="font-semibold">{formatLimit(limit)}</span> active job{limit === 1 ? '' : 's'}.
          You currently have <span className="font-semibold">{activeJobCount}</span> active.
        </p>
        <p className="text-stone-400 text-sm mb-6">
          {limit === 0
            ? 'Free agencies can receive family requests, but publishing jobs starts on Starter.'
            : 'Upgrade to Pro or Team for higher job capacity and faster growth.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/agency/subscription"
            className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            Upgrade Plan
          </Link>
          <Link
            to="/agency/jobs"
            className="bg-white border border-stone-200 text-stone-700 px-6 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-stone-50 transition-colors"
          >
            View My Jobs
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'pay_min' || name === 'pay_max') {
      setFormData(prev => ({ ...prev, [name]: normalizeNonNegativeInput(value) }));
      return;
    }
    if (name === 'required_experience_years') {
      setFormData(prev => ({ ...prev, [name]: normalizeNonNegativeInput(value, false) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleWeekday = (day: string) => {
    setFormData(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(item => item !== day)
        : [...prev.weekdays, day]
    }));
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
      if (!user?.uid) {
        throw new Error('Sign in as an agency to post jobs.');
      }

      if (!resolvedAgencyId) {
        throw new Error('Could not resolve your agency. Please reload and try again.');
      }

      if (formData.schedule_type === 'date_range' && (!formData.start_date || !formData.end_date)) {
        throw new Error('Please include both start and end dates for a date-range schedule.');
      }

      if (formData.schedule_type === 'weekly_days' && formData.weekdays.length === 0) {
        throw new Error('Please select at least one weekday for a weekly schedule.');
      }

      const payMin = formData.pay_min === '' ? null : Math.max(0, Number(formData.pay_min));
      const payMax = formData.pay_max === '' ? null : Math.max(0, Number(formData.pay_max));
      const requiredExperienceYears = formData.required_experience_years === ''
        ? 0
        : Math.max(0, parseInt(formData.required_experience_years, 10) || 0);

      if (payMin == null || payMax == null) {
        throw new Error('Please add both a min pay and max pay.');
      }

      if (payMax < payMin) {
        throw new Error('Max pay must be greater than or equal to min pay.');
      }

      const scheduleSummary = formData.schedule_type === 'date_range'
        ? `Date range: ${formData.start_date || 'TBD'} to ${formData.end_date || 'TBD'}`
        : `Weekdays: ${formData.weekdays.join(', ') || 'Not specified'}`;

      const payload = {
        ...formData,
        agency_id: resolvedAgencyId,
        family_id: inquiryContext?.family_id || familyRequestContext?.family_id || null,
        source_inquiry_id: sourceRequestId || inquiryContext?.id || familyRequestContext?.id || null,
        linked_from_inquiry: !!inquiryContext?.id,
        end_date: formData.schedule_type === 'date_range' ? formData.end_date : null,
        weekdays: formData.schedule_type === 'weekly_days' ? formData.weekdays : [],
        schedule_summary: scheduleSummary,
        schedule: scheduleSummary,
        pay_min: payMin,
        pay_max: payMax,
        required_experience_years: requiredExperienceYears,
      };

      let persistedJobId = '';
      if (isEditMode && editingJobId) {
        const nextStatus = submitIntent === 'draft' ? 'draft' : 'published';
        const updated = await updateJob(editingJobId, {
          ...payload,
          status: nextStatus,
        });
        persistedJobId = String(updated?.id || editingJobId);
      } else {
        const created = await createJob({
          ...payload,
          status: 'published',
        });
        persistedJobId = String(created?.id || '');

        if (persistedJobId && inquiryContext?.family_id) {
          await ensureFamilyApplicationForInquiryJob(
            inquiryContext.family_id,
            persistedJobId,
            resolvedAgencyId,
            inquiryContext.id
          );
          if (inquiryContext.id) {
            await linkInquiryConversationToJob(inquiryContext.id, persistedJobId);
          }
        }
      }
      
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (isEditMode && submitIntent === 'draft') {
          navigate('/agency/jobs?status=draft');
          return;
        }
        navigate('/agency/jobs?status=published');
      }, 2000);
    } catch (err: any) {
      console.error('Error creating job:', err);
      setError(err.message || 'Failed to post job. Please ensure your agency profile is complete.');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    const finishedAsDraft = isEditMode && submitIntent === 'draft';
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
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">
            {finishedAsDraft ? 'Draft Saved' : isEditMode ? 'Job Updated Successfully!' : 'Job Posted Successfully!'}
          </h2>
          <p className="text-emerald-700">
            {finishedAsDraft
              ? 'Your draft has been updated. Publish it when you are ready for nannies to see it.'
              : 'Your job is now live and visible to nannies in the network. Redirecting to jobs dashboard...'}
          </p>
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
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{isEditMode ? 'Edit Draft Job' : 'Post a New Job'}</h1>
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
          {inquiryContext && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm">
              This job will be linked to inquiry from {inquiryContext.family_name || 'Family'}. On publish, their case is automatically attached for follow-through and past-care tracking.
            </div>
          )}
          {familyRequestContext && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm">
              <p className="font-semibold mb-0.5">Posting for a family care request</p>
              <p className="text-emerald-800">
                This job has been pre-filled from {familyRequestContext.parent_name || 'a family'}'s care request
                {familyRequestContext.borough ? ` in ${familyRequestContext.borough}` : ''}. Review and adjust the details, then publish so nannies can apply.
              </p>
            </div>
          )}
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
                      <option value="Occasional">Occasional</option>
                      <option value="Last-Minute">Last Minute</option>
                      <option value="Overnight">Overnight</option>
                      <option value="Date Night">Date Night</option>
                    </select>
                    <p className="mt-2 text-xs text-stone-500">Use Full-Time or Part-Time for longer interview-led placements. Use Occasional for flexible backup care and Last Minute for urgent short-notice coverage.</p>
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
                    <input name="pay_min" value={formData.pay_min} onChange={handleChange} type="number" min={0} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Max Pay ($/hr)</label>
                    <input name="pay_max" value={formData.pay_max} onChange={handleChange} type="number" min={0} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="35" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h2 className="text-xl font-bold text-stone-900 mb-6">Requirements & Schedule</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Required Experience (Years)</label>
                    <input name="required_experience_years" value={formData.required_experience_years} onChange={handleChange} type="number" min={0} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="3" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Schedule Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, schedule_type: 'weekly_days', start_date: '', end_date: '' }))}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                          formData.schedule_type === 'weekly_days'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Weekly days
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, schedule_type: 'date_range', weekdays: [] }))}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                          formData.schedule_type === 'date_range'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Date range
                      </button>
                    </div>
                  </div>
                </div>

                {formData.schedule_type === 'weekly_days' ? (
                  <div>
                    <label className="block text-sm font-bold text-stone-900 mb-2">Preferred Weekdays</label>
                    <div className="flex flex-wrap gap-2">
                      {weekdays.map((day) => {
                        const selected = formData.weekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleWeekday(day)}
                            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                              selected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-sm text-stone-500">Choose the recurring days this role usually covers.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-stone-900 mb-2">Start Date</label>
                      <input name="start_date" value={formData.start_date} onChange={handleChange} type="date" required={formData.schedule_type === 'date_range'} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-900 mb-2">End Date</label>
                      <input name="end_date" value={formData.end_date} onChange={handleChange} type="date" required={formData.schedule_type === 'date_range'} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                    </div>
                  </div>
                )}

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
              {step < 3 ? (
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-70"
                >
                  Continue
                </button>
              ) : isEditMode && editingJobStatus === 'draft' ? (
                <>
                  <button
                    type="submit"
                    onClick={() => setSubmitIntent('draft')}
                    disabled={isSubmitting}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-70"
                  >
                    {isSubmitting && submitIntent === 'draft' ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitIntent('publish')}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-70"
                  >
                    {isSubmitting && submitIntent === 'publish' ? 'Publishing...' : 'Publish Job'}
                  </button>
                </>
              ) : (
                <button 
                  type="submit"
                  onClick={() => setSubmitIntent('publish')}
                  disabled={isSubmitting}
                  className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? (isEditMode ? 'Updating...' : 'Posting...') : (isEditMode ? 'Update Job' : 'Post Job')}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
