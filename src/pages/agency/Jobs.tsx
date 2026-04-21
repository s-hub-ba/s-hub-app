import { useState, useEffect } from 'react';
import { Search, Filter, Plus, MapPin, Clock, Trash2, Lock, RotateCcw, BriefcaseBusiness, Hourglass, CheckCircle2, XCircle, CalendarPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { getJobs, deleteJob, getApplicationsForAgency, notifyApplicationCareMilestone, resolveAgencyIdForUser, updateApplicationCareSession, updateApplicationStatus, updateJob } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { toDate } from '../../lib/utils';

export default function AgencyJobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'closed' | 'draft'>('all');
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [resolvingAgency, setResolvingAgency] = useState(true);
  const [activeCare, setActiveCare] = useState<any[]>([]);
  const [careActionLoadingId, setCareActionLoadingId] = useState<string | null>(null);
  const [careBoardError, setCareBoardError] = useState<string | null>(null);
  const [jobActionError, setJobActionError] = useState<string | null>(null);

  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) {
        setAgencyId('');
        setResolvingAgency(false);
        return;
      }

      try {
        const resolved = await resolveAgencyIdForUser(user.uid);
        setAgencyId(resolved || '');
      } catch (error) {
        console.error('Error resolving agency for jobs:', error);
        setAgencyId('');
      } finally {
        setResolvingAgency(false);
      }
    };

    resolveAgency();
  }, [user]);

  useEffect(() => {
    if (!agencyId) return;
    loadJobs();
  }, [agencyId]);

  useEffect(() => {
    const requestedStatus = String(searchParams.get('status') || '').toLowerCase();
    if (requestedStatus === 'published' || requestedStatus === 'closed' || requestedStatus === 'draft') {
      setStatusFilter(requestedStatus);
      return;
    }
    setStatusFilter('all');
  }, [searchParams]);

  const applyStatusFilter = (nextFilter: 'all' | 'published' | 'closed' | 'draft') => {
    setStatusFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'all') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', nextFilter);
    }
    setSearchParams(nextParams);
  };

  const loadJobs = async () => {
    try {
      const [fetchedJobs, apps] = await Promise.all([
        getJobs(agencyId),
        getApplicationsForAgency(agencyId),
      ]);
      setJobs(fetchedJobs);
      setApplications(apps);
      setActiveCare(apps.filter((app) => app.status === 'active' || app.status === 'pending_family_approval'));
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const getCareTimeline = (app: any) => {
    const start = toDate(app.care_started_at || app.active_at || app.start_date || app.jobs?.start_date || app.created_at) || new Date();
    const fallbackEnd = new Date(start);
    fallbackEnd.setDate(fallbackEnd.getDate() + 30);
    const end = toDate(app.care_extended_to || app.care_expected_end_at || app.end_date || app.jobs?.end_date) || fallbackEnd;

    const now = new Date();
    const totalMs = Math.max(1, end.getTime() - start.getTime());
    const elapsedMs = Math.max(0, now.getTime() - start.getTime());
    const remainingMs = Math.max(0, end.getTime() - now.getTime());
    const progressPct = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    return {
      start,
      end,
      progressPct,
      remainingMs,
      remainingLabel: remainingMs <= 0 ? 'Expected end reached' : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`,
      halfwayReached: progressPct >= 50,
      endingSoon: remainingMs > 0 && remainingMs <= 1000 * 60 * 60 * 24,
    };
  };

  useEffect(() => {
    if (!activeCare.length) return;

    const checkMilestones = async () => {
      for (const app of activeCare) {
        const timeline = getCareTimeline(app);

        if (!app?.care_milestones_notified?.started) {
          await notifyApplicationCareMilestone({
            applicationId: app.id,
            milestone: 'started',
            familyTitle: 'Care started',
            familyMessage: `Care for {jobTitle} has started.`,
            nannyTitle: 'Care session started',
            nannyMessage: `Your care session for {jobTitle} has started.`,
          });
        }

        if (timeline.halfwayReached && !app?.care_milestones_notified?.halfway) {
          await notifyApplicationCareMilestone({
            applicationId: app.id,
            milestone: 'halfway',
            familyTitle: 'Care is halfway complete',
            familyMessage: `{jobTitle} is now around halfway through.`,
            nannyTitle: 'Care halfway milestone',
            nannyMessage: `You are now around halfway through {jobTitle}.`,
          });
        }

        if (timeline.endingSoon && !app?.care_milestones_notified?.ending_soon) {
          await notifyApplicationCareMilestone({
            applicationId: app.id,
            milestone: 'ending_soon',
            familyTitle: 'Care ending soon',
            familyMessage: `{jobTitle} is approaching its expected end date.`,
            nannyTitle: 'Care ending soon',
            nannyMessage: `Your care session for {jobTitle} is approaching its expected end date.`,
          });
        }
      }
    };

    checkMilestones();
    const timer = window.setInterval(checkMilestones, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [activeCare]);

  const handleProlongService = async (app: any) => {
    const daysInput = window.prompt('How many days do you want to prolong this service?', '7');
    const days = Number(daysInput || 0);
    if (!Number.isFinite(days) || days <= 0) return;

    const timeline = getCareTimeline(app);
    const nextEnd = new Date(timeline.end);
    nextEnd.setDate(nextEnd.getDate() + Math.floor(days));

    setCareActionLoadingId(app.id);
    setCareBoardError(null);
    try {
      await updateApplicationCareSession(app.id, {
        care_expected_end_at: nextEnd.toISOString(),
        care_extended_to: nextEnd.toISOString(),
        care_override_status: null,
        care_override_reason: null,
      });
      await loadJobs();
    } catch {
      setCareBoardError('Unable to prolong this service right now.');
    } finally {
      setCareActionLoadingId(null);
    }
  };

  const handleFinishCare = async (app: any, override?: 'cancelled' | 'ended_early') => {
    const isOverride = !!override;
    const reason = isOverride
      ? window.prompt(`Add a short note for ${override === 'cancelled' ? 'service cancellation' : 'early end'}:`, '')
      : null;

    if (isOverride && reason === null) return;

    setCareActionLoadingId(app.id);
    setCareBoardError(null);
    try {
      const nowIso = new Date().toISOString();
      await updateApplicationCareSession(app.id, {
        care_actual_end_at: nowIso,
        care_override_status: override || null,
        care_override_reason: override ? (reason?.trim() || 'No reason provided') : null,
      });

      await updateApplicationStatus(app.id, 'completed', {
        actorRole: 'agency',
        note: override
          ? `Care marked completed (${override}) by agency.`
          : 'Care marked completed by agency.',
      });

      await notifyApplicationCareMilestone({
        applicationId: app.id,
        milestone: 'review_requested',
        familyTitle: 'Care finished - reviews needed',
        familyMessage: `Care for {jobTitle} is complete. Please leave both an agency review and a nanny review.`,
      });

      await loadJobs();
    } catch {
      setCareBoardError('Unable to finish this care session right now.');
    } finally {
      setCareActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (jobToDelete) {
      try {
        setJobActionError(null);
        await deleteJob(jobToDelete);
        await loadJobs();
        setJobToDelete(null);
      } catch (error) {
        console.error('Error deleting job:', error);
        setJobActionError('Unable to delete this job right now.');
      }
    }
  };

  const handleJobStatus = async (jobId: string, status: 'published' | 'closed') => {
    try {
      setJobActionError(null);
      await updateJob(jobId, {
        status,
        ...(status === 'closed' ? { closed_reason: 'agency_closed' } : { closed_reason: null })
      });
      await loadJobs();
    } catch (error: any) {
      console.error('Error updating job status:', error);
      setJobActionError(error?.message || 'Unable to update this job right now.');
    }
  };

  const filteredJobs = jobs.filter(job => 
    (statusFilter === 'all' || (job.status || 'published') === statusFilter) && (
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location_neighborhood?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location_borough?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const openJobsCount = jobs.filter((job) => (job.status || 'published') === 'published').length;
  const closedJobsCount = jobs.filter((job) => job.status === 'closed').length;
  const draftJobsCount = jobs.filter((job) => job.status === 'draft').length;
  const activeCareCount = activeCare.filter((app) => app.status === 'active').length;

  const applicationsByJob = applications.reduce((acc, app) => {
    const jobId = String(app.job_id || '');
    if (!jobId) return acc;
    if (!acc[jobId]) acc[jobId] = [];
    acc[jobId].push(app);
    return acc;
  }, {} as Record<string, any[]>);

  const formatPostedDate = (value: unknown) => {
    const date = toDate(value);
    return date ? date.toLocaleDateString() : 'Not available';
  };

  if (resolvingAgency) {
    return <div className="p-8 text-center text-stone-500">Loading agency jobs...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to manage jobs.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Manage Jobs</h1>
          <p className="text-stone-500 mt-1">Create and manage your agency's job postings.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyStatusFilter('draft')}
            className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            Open Draft Jobs
          </button>
          <Link to="/agency/jobs/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Post New Job
          </Link>
        </div>
      </div>

      {jobActionError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start justify-between gap-3">
          <span>{jobActionError}</span>
          <Link to="/agency/subscription" className="shrink-0 font-semibold text-amber-800 hover:text-amber-900 underline">
            Upgrade
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Total Jobs</div>
          <div className="text-2xl font-bold text-stone-900 mt-1">{jobs.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Open</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{openJobsCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Closed</div>
          <div className="text-2xl font-bold text-stone-700 mt-1">{closedJobsCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Drafts</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{draftJobsCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm md:col-span-3">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">In Session (Active Care)</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{activeCareCount}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-stone-900">Active Care Sessions</h2>
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Live timeline tracking</span>
        </div>
        {careBoardError && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">
            {careBoardError}
          </div>
        )}
        {activeCare.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-sm text-stone-500">
            No in-session care yet. When an application is marked as active, it appears here.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeCare.map((app, index) => {
              const timeline = getCareTimeline(app);
              const isPendingSignoff = app.status === 'pending_family_approval';
              const isBusy = careActionLoadingId === app.id;
              const nannyName = app.nanny_profiles
                ? `${app.nanny_profiles.first_name || ''} ${app.nanny_profiles.last_name || ''}`.trim()
                : 'Nanny';

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{app.jobs?.title || 'Care Placement'}</h3>
                      <p className="text-sm text-stone-600 mt-1">{nannyName} · {app.jobs?.location_borough || 'Location pending'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${isPendingSignoff ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                      {isPendingSignoff ? 'Awaiting Family Sign-off' : 'Active'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>{timeline.start.toLocaleDateString()}</span>
                      <span className="font-semibold text-stone-700">{timeline.progressPct}%</span>
                      <span>{timeline.end.toLocaleDateString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${timeline.progressPct >= 100 ? 'bg-emerald-500' : timeline.progressPct >= 50 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                        style={{ width: `${timeline.progressPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-stone-600">
                        <Hourglass className="h-3.5 w-3.5" />
                        {timeline.remainingLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <MilestonePill label="Started" active={!!app?.care_milestones_notified?.started} />
                        <MilestonePill label="Halfway" active={!!app?.care_milestones_notified?.halfway} />
                        <MilestonePill label="Ending Soon" active={!!app?.care_milestones_notified?.ending_soon} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleProlongService(app)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Prolong
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinishCare(app, 'ended_early')}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-60"
                    >
                      <Hourglass className="h-3.5 w-3.5" /> End Early
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinishCare(app, 'cancelled')}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelled
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinishCare(app)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Finished
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            placeholder="Search by title or location..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 text-stone-700 font-medium bg-white min-w-[180px]">
          <Filter className="h-4 w-4" />
          <select
            value={statusFilter}
            onChange={(e) => applyStatusFilter(e.currentTarget.value as 'all' | 'published' | 'closed' | 'draft')}
            className="bg-transparent outline-none w-full cursor-pointer"
          >
            <option value="all">All Jobs</option>
            <option value="published">Open Jobs</option>
            <option value="closed">Closed Jobs</option>
            <option value="draft">Draft Jobs</option>
          </select>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mb-4">
            <BriefcaseBusiness className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">No matching jobs</h3>
          <p className="text-sm text-stone-500 mt-1">Try adjusting your search or status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map((job, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              key={job.id}
              className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 md:p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold text-stone-900 leading-tight break-words">{job.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-stone-400" />
                      {[job.location_neighborhood, job.location_borough].filter(Boolean).join(', ') || 'Location not set'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-stone-400" />
                      Posted {formatPostedDate(job.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 lg:justify-end shrink-0">
                  <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold ${
                    job.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-700'
                  }`}>
                    {job.status === 'closed' ? 'Closed' : 'Published'}
                  </span>

                  {job.status === 'closed' ? (
                    <button
                      onClick={() => handleJobStatus(job.id, 'published')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJobStatus(job.id, 'closed')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors"
                    >
                      <Lock className="h-4 w-4" />
                      Close Job
                    </button>
                  )}

                  <button
                    onClick={() => setJobToDelete(job.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors"
                    title="Delete Job"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Applications for this Job</p>
                  <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700">
                    {(applicationsByJob[job.id] || []).length}
                  </span>
                </div>

                {(applicationsByJob[job.id] || []).length === 0 ? (
                  <p className="mt-3 text-sm text-stone-500">No applications yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(applicationsByJob[job.id] || []).slice(0, 4).map((app) => {
                      const nannyName = app.nanny_profiles
                        ? `${app.nanny_profiles.first_name || ''} ${app.nanny_profiles.last_name || ''}`.trim()
                        : 'Nanny applicant';
                      return (
                        <div key={app.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 truncate">{nannyName}</p>
                            <p className="text-xs text-stone-500">Applied {formatPostedDate(app.created_at)}</p>
                          </div>
                          <span className="inline-flex items-center rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-700 capitalize">
                            {String(app.status || 'applied').replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                    {(applicationsByJob[job.id] || []).length > 4 ? (
                      <Link to="/agency/applications" className="inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                        View all applications for this job
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-red-500 via-red-600 to-rose-600 px-6 pt-8 pb-10 overflow-hidden text-center">
              <div className="relative z-10 flex flex-col items-center">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl shadow-lg mb-3">
                  🗑️
                </div>
                <p className="text-red-100 text-xs font-semibold uppercase tracking-widest mb-1">Destructive Action</p>
                <h3 className="text-2xl font-bold text-white">Delete Job</h3>
              </div>
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="px-6 py-5">
              <p className="text-stone-600 text-sm text-center leading-relaxed">
                This will permanently delete <span className="font-semibold text-stone-900">{jobs.find((job) => job.id === jobToDelete)?.title || 'this job'}</span>. All applications linked to this job will also be affected. This cannot be undone.
              </p>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setJobToDelete(null)}
                className="flex-1 py-2.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white font-bold shadow-md shadow-red-200/60 hover:opacity-90 transition-all text-sm"
              >
                Delete Job
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MilestonePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>
      {label}
    </span>
  );
}
