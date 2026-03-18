import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, XCircle, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { getApplicationsForNanny, getJobById, updateApplicationStatus, addFamilyNotification } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_CONFIG = {
  applied: { color: 'bg-stone-100 text-stone-700', icon: Clock, label: 'Applied' },
  reviewing: { color: 'bg-blue-100 text-blue-700', icon: FileText, label: 'In Review' },
  interview_invited: { color: 'bg-orange-100 text-orange-700', icon: Clock, label: 'Interview Invited' },
  accepted: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Accepted' },
  pending_family_approval: { color: 'bg-indigo-100 text-indigo-700', icon: Clock, label: 'Pending Family Approval' },
  completed: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Completed' },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Not Selected' },
  withdrawn: { color: 'bg-stone-200 text-stone-500', icon: XCircle, label: 'Withdrawn' }
};

export default function NannyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);

  const nannyId = user?.uid || '';

  useEffect(() => {
    if (!nannyId) {
      setApplications([]);
      return;
    }
    loadData();
  }, [nannyId]);

  const loadData = async () => {
    if (!nannyId) {
      return;
    }

    try {
      const fetchedApps = await getApplicationsForNanny(nannyId);
      
      // Enrich with job details
      const enrichedApps = await Promise.all(fetchedApps.map(async (app) => {
        const job = app.jobs || await getJobById(app.job_id);
        return {
          ...app,
          agency_name: job?.agency_profiles?.company_name || 'Unknown Agency',
          location: job ? `${job.location_neighborhood}, ${job.location_borough}` : 'Unknown Location',
          job_title: job?.title || 'Unknown Job'
        };
      }));
      
      setApplications(enrichedApps);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">My Applications</h1>
          <p className="text-stone-500 mt-1">Track the status of your job applications.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-stone-100">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              You haven't applied to any jobs yet.
            </div>
          ) : (
            applications.map((app, index) => {
              const statusConfig = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.applied;
              const StatusIcon = statusConfig.icon;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  key={app.id} 
                  className="p-6 hover:bg-stone-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-stone-900">{app.job_title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${statusConfig.color}`}>
                        <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                      <span className="font-medium text-stone-700">{app.agency_name}</span>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {app.location}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-2 text-sm border-t md:border-t-0 border-stone-100 pt-4 md:pt-0">
                    <div className="text-stone-500">
                      Applied: <span className="font-medium text-stone-900">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-stone-400 text-xs">
                      Last update: {new Date(app.updated_at).toLocaleDateString()}
                    </div>
                    {app.status === 'interview_invited' && (
                      <Link 
                        to="/nanny/messages"
                        className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center justify-center"
                      >
                        View Message
                      </Link>
                    )}

                    {app.status === 'accepted' && (
                      <button
                        onClick={async () => {
                          try {
                            await updateApplicationStatus(app.id, 'pending_family_approval');
                            await addFamilyNotification(app.family_id, 'Work completion requested', `Nanny ${app.nanny_profiles?.first_name || 'Nanny'} marked the job '${app.job_title || ''}' as done. Please review and confirm.`, '/family/applications');
                            await loadData();
                          } catch (error) {
                            console.error('Error marking work done:', error);
                          }
                        }}
                        className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center justify-center"
                      >
                        Mark Work Done
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
