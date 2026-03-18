import { ShieldCheck, Users, Building2, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-stone-500 mt-1">Platform overview and pending actions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Total Agencies</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">-</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Total Nannies</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">-</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-orange-200 shadow-sm flex flex-col bg-orange-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Pending Verification</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">-</h2>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm flex flex-col bg-red-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Flagged Reviews</p>
          </div>
          <h2 className="text-3xl font-bold text-stone-900">-</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">Recent Agency Signups</h2>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 text-sm text-stone-500">
              No pending agency signups to review.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900">System Alerts</h2>
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <AlertTriangle className="h-5 w-5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">PayPal Webhook Sync</h4>
                  <p className="text-xs text-stone-500 mt-1">All subscription states are currently synced. Last check: 5 mins ago.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
