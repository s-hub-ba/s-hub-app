import { useEffect, useState, type ReactNode } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Users, Briefcase, ChevronRight, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getActiveJobCount, getAgencyNannyProfileCount, getRecruiterSeatCount, resolveAgencyIdForUser } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAgencyEntitlements } from '../../lib/entitlements';
import { formatLimit, ADDON_CONFIG_MAP, PLAN_CODES, PLAN_CONFIG_MAP } from '../../lib/plans';
import { toDate } from '../../lib/utils';

const PLAN_COLOR_MAP: Record<string, string> = {
  stone: 'bg-stone-100 text-stone-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
};

export default function Billing() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [usage, setUsage] = useState({ recruiterSeats: 0, activeJobs: 0, nannyProfiles: 0 });

  const { entitlements, subscription, loading: loadingSub } = useAgencyEntitlements(agencyId);
  const fallbackPlan = PLAN_CONFIG_MAP[PLAN_CODES.FREE];

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user?.uid) {
        setAgencyId('');
        return;
      }
      const resolved = await resolveAgencyIdForUser(user.uid);
      setAgencyId(resolved || '');
    };
    resolveAgency();
  }, [user]);

  useEffect(() => {
    if (!agencyId) {
      setUsage({ recruiterSeats: 0, activeJobs: 0, nannyProfiles: 0 });
      return;
    }

    Promise.all([
      getRecruiterSeatCount(agencyId),
      getActiveJobCount(agencyId),
      getAgencyNannyProfileCount(agencyId),
    ])
      .then(([recruiterSeats, activeJobs, nannyProfiles]) => {
        setUsage({ recruiterSeats, activeJobs, nannyProfiles });
      })
      .catch(() => {
        setUsage({ recruiterSeats: 0, activeJobs: 0, nannyProfiles: 0 });
      });
  }, [agencyId]);

  const plan = entitlements?.plan;
  const planBadgeClass = plan ? (PLAN_COLOR_MAP[plan.color] ?? 'bg-stone-100 text-stone-700') : '';
  const renewalDate = toDate(subscription?.renewal_date);
  const activeAddons = entitlements?.active_addons ?? [];
  const enabledCapabilities = [
    { label: 'Advanced Search', enabled: !!entitlements?.canUseAdvancedSearch },
    { label: 'Priority Discovery', enabled: !!entitlements?.canAccessPriorityDiscovery },
    { label: 'Early Family Requests', enabled: !!entitlements?.canAccessEarlyFamilyRequests },
    { label: 'Agency Branding', enabled: !!entitlements?.canUseAgencyBranding },
    { label: 'Bulk Import', enabled: !!entitlements?.canUseBulkImport },
    { label: 'API Access', enabled: !!entitlements?.canUseApiAccess },
    { label: 'Dedicated Support', enabled: !!entitlements?.hasDedicatedSupport },
    { label: 'Advanced Matching', enabled: !!entitlements?.hasAdvancedMatching },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Billing & Subscription</h1>
          <p className="text-stone-500 mt-1">Manage your agency's plan, add-ons, and revenue.</p>
        </div>
        <Link
          to="/agency/subscription"
          className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Change Plan
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Plan Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {loadingSub ? (
                    <div className="h-7 w-32 bg-stone-100 rounded animate-pulse" />
                  ) : (
                    <h2 className="text-2xl font-bold text-stone-900">{plan?.name ?? fallbackPlan.name} Plan</h2>
                  )}
                  {!loadingSub && subscription?.status === 'active' && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${planBadgeClass}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Active
                    </span>
                  )}
                  {!loadingSub && (!subscription || subscription.status === 'none' as any) && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                      Free Default
                    </span>
                  )}
                </div>
                <p className="text-stone-500">Billed monthly - {plan?.tagline ?? fallbackPlan.tagline}</p>
              </div>
              <div className="text-left md:text-right">
                {loadingSub ? (
                  <div className="h-10 w-24 bg-stone-100 rounded animate-pulse" />
                ) : (
                  <div className="text-3xl font-bold text-stone-900">
                    ${plan?.monthly_price ?? fallbackPlan.monthly_price}
                    <span className="text-lg text-stone-500 font-medium">/mo</span>
                  </div>
                )}
                {renewalDate && (
                  <p className="text-sm text-stone-500 mt-1">
                    Renews {renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Plan limits */}
            <div className="p-6 md:p-8 bg-stone-50/50">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Plan Limits</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LimitCard
                  icon={<Users className="h-5 w-5" />}
                  iconBg="bg-blue-100 text-blue-600"
                  label="Recruiter Seats"
                  value={formatLimit(entitlements?.recruiterSeatLimit ?? fallbackPlan.recruiter_seat_limit)}
                />
                <LimitCard
                  icon={<Briefcase className="h-5 w-5" />}
                  iconBg="bg-purple-100 text-purple-600"
                  label="Active Job Listings"
                  value={formatLimit(entitlements?.activeJobLimit ?? fallbackPlan.active_job_limit)}
                />
                <LimitCard
                  icon={<Users className="h-5 w-5" />}
                  iconBg="bg-emerald-100 text-emerald-600"
                  label="Nanny Profiles"
                  value={formatLimit(entitlements?.nannyProfileLimit ?? fallbackPlan.nanny_profile_limit)}
                />
              </div>
            </div>

            {/* Active Add-Ons */}
            {activeAddons.length > 0 && (
              <div className="p-6 md:p-8 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">Active Add-Ons</h3>
                <div className="flex flex-wrap gap-2">
                  {activeAddons.map((code) => {
                    const addon = ADDON_CONFIG_MAP[code];
                    if (!addon) return null;
                    return (
                      <span key={code} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800">
                        <Zap className="h-3 w-3" />
                        {addon.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-6 md:p-8 border-t border-stone-100 flex flex-col sm:flex-row gap-3">
              <Link
                to="/agency/subscription"
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Manage Plan & Add-Ons
              </Link>
              <button
                onClick={() => console.log('No invoices available yet.')}
                className="flex-1 bg-white border border-stone-200 text-stone-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-stone-50 transition-colors"
              >
                View Invoices
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Enabled Capabilities
              </h2>
              <p className="text-sm text-stone-500 mt-1">Your plan and active add-ons determine which operational tools are currently available.</p>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enabledCapabilities.map((capability) => (
                  <div key={capability.label} className={`rounded-2xl border p-4 ${capability.enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-stone-200 bg-stone-50/60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{capability.label}</div>
                        <div className="text-xs text-stone-500 mt-1">
                          {capability.enabled ? 'Included in your current plan setup.' : 'Available on higher plans or eligible add-ons.'}
                        </div>
                      </div>
                      <CheckCircle2 className={`h-5 w-5 ${capability.enabled ? 'text-emerald-600' : 'text-stone-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-orange-600 shrink-0" />
              <div>
                <h3 className="font-bold text-orange-900">Platform Policy</h3>
                <p className="text-sm text-orange-800 mt-1 leading-relaxed">
                  Free agencies can receive and manage family requests. Paid plans unlock job posting, recruiter seats, and advanced agency tools.
                  Families do not contact nannies directly. Agencies coordinate all matching.
                </p>
              </div>
            </div>
          </div>

          {/* Quick plan comparison */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <h3 className="font-bold text-stone-900 mb-4">Quick Plan Overview</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Free</span>
                <span className="font-semibold text-stone-900">$0/mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Starter</span>
                <span className="font-semibold text-stone-900">$29/mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Pro</span>
                <span className="font-semibold text-stone-900">$59/mo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Team</span>
                <span className="font-semibold text-stone-900">$149/mo</span>
              </div>
            </div>
            <Link
              to="/agency/subscription"
              className="mt-4 w-full py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
            >
              View All Plans
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <h3 className="font-bold text-stone-900 mb-4">Current Usage</h3>
            <div className="space-y-3 text-sm">
              <UsageRow
                label="Recruiter Seats"
                used={usage.recruiterSeats}
                limit={entitlements?.recruiterSeatLimit ?? fallbackPlan.recruiter_seat_limit}
              />
              <UsageRow
                label="Active Jobs"
                used={usage.activeJobs}
                limit={entitlements?.activeJobLimit ?? fallbackPlan.active_job_limit}
              />
              <UsageRow
                label="Nanny Profiles"
                used={usage.nannyProfiles}
                limit={entitlements?.nannyProfileLimit ?? fallbackPlan.nanny_profile_limit}
              />
            </div>
            <Link
              to="/agency/subscription"
              className="mt-4 w-full py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
            >
              Upgrade If Near Limits
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <h3 className="font-bold text-stone-900 mb-4">Payment Method</h3>
            <div className="flex items-center gap-3 p-3 border border-stone-200 rounded-xl bg-stone-50 mb-4">
              <div className="h-8 w-12 bg-white border border-stone-200 rounded flex items-center justify-center">
                <span className="text-xs font-bold text-blue-800 italic">PayPal</span>
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">PayPal Account</p>
                <p className="text-xs text-stone-500">agency@example.com</p>
              </div>
            </div>
            <button
              onClick={() => console.log('Update payment method clicked')}
              className="w-full py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Update Payment Method
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-stone-900 text-sm">{label}</h4>
        <p className={`text-sm mt-0.5 font-semibold ${value === 'Unlimited' ? 'text-emerald-600' : 'text-stone-700'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const nearLimit = limit !== null && limit > 0 && used / limit >= 0.8;
  const reachedLimit = limit !== null && used >= limit;

  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-600">{label}</span>
      <span className={`font-semibold ${reachedLimit ? 'text-rose-600' : nearLimit ? 'text-amber-600' : 'text-stone-900'}`}>
        {used}/{limit === null ? 'Unlimited' : limit}
      </span>
    </div>
  );
}
