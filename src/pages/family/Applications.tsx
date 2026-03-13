import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign, Clock, CheckCircle2, MessageSquare, XCircle } from 'lucide-react';
import { getFamilyApplications } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        const apps = await getFamilyApplications(familyId);
        setApplications(apps);
      } catch (error) {
        console.error('Error loading applications:', error);
      }
    };
    loadData();
  }, []);

  const filteredApps = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Your Applications</h1>
          <p className="text-stone-500 mt-1">Track the status of your job applications.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex gap-2 overflow-x-auto">
          {['all', 'pending', 'reviewing', 'interviewing', 'hired', 'declined'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                filter === status 
                  ? 'bg-stone-900 text-white' 
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                {status === 'all' 
                  ? applications.length 
                  : applications.filter(a => a.status === status).length}
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-stone-100">
          {filteredApps.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-900">No applications found</h3>
              <p className="text-stone-500 mt-1 mb-6">You haven't applied to any jobs with this status.</p>
              <Link 
                to="/family/jobs"
                className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Find Jobs
              </Link>
            </div>
          ) : (
            filteredApps.map(app => (
              <div key={app.id} className="p-6 md:p-8 hover:bg-stone-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        app.status === 'reviewing' ? 'bg-purple-100 text-purple-700' :
                        app.status === 'interviewing' ? 'bg-blue-100 text-blue-700' :
                        app.status === 'hired' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-stone-100 text-stone-700'
                      }`}>
                        {app.status === 'pending' && <Clock className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'reviewing' && <Briefcase className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'interviewing' && <MessageSquare className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'hired' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        {app.status === 'declined' && <XCircle className="h-3.5 w-3.5 mr-1" />}
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                      <span className="text-sm text-stone-500">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-stone-900 mb-1">{app.job.title}</h3>
                    <p className="text-sm font-medium text-emerald-600 mb-4">{app.job.agency_profiles?.company_name || 'Agency'}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                      <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-stone-400" /> {app.job.location_neighborhood}, {app.job.location_borough}</span>
                      <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-stone-400" /> ${app.job.pay_min}-${app.job.pay_max}/hr</span>
                      <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-stone-400" /> {app.job.job_type}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {app.status === 'interviewing' && (
                      <Link 
                        to="/family/messages"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors text-center"
                      >
                        Message Agency
                      </Link>
                    )}
                    <Link 
                      to={`/family/jobs/${app.job.id}`}
                      className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors text-center"
                    >
                      View Job
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
