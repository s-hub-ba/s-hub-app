import { useState, useEffect, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Zap, TrendingUp, Star, ChevronRight, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useAgencyEntitlements } from '../../lib/entitlements';
import {
  PLANS,
  ADDONS,
  ADDON_CODES,
  PLAN_CODES,
  type PlanCode,
  type AddonCode,
  PLAN_CONFIG_MAP,
  ADDON_CONFIG_MAP,
  PAID_PLANS,
} from '../../lib/plans';
import {
  finalizeAgencyPlanCheckout,
  resolveAgencyIdForUser,
  startAgencyPlanCheckout,
  upsertAgencyAddon,
  upsertAgencySubscription,
} from '../../lib/api';

function isCredentialSetupError(message: string): boolean {
  const normalized = (message || '').toLowerCase();
  return normalized.includes('could not load the default credentials')
    || normalized.includes('application default credentials')
    || normalized.includes('default credentials');
}

const PLAN_ACCENT: Record<string, string> = {
  stone: 'border-stone-500 ring-2 ring-stone-300',
  emerald: 'border-emerald-500 ring-2 ring-emerald-400',
  blue: 'border-blue-500 ring-2 ring-blue-400',
  red: 'border-red-500 ring-2 ring-red-400',
};

const PLAN_BADGE: Record<string, string> = {
  stone: 'bg-stone-200 text-stone-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
};

const PLAN_BUTTON: Record<string, string> = {
  stone: 'bg-stone-700 hover:bg-stone-800',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  red: 'bg-red-600 hover:bg-red-700',
};

const PLAN_ICON: Record<string, string> = {
  stone: '⚪',
  emerald: '🟢',
  blue: '🔵',
  red: '🔴',
};

const featureRows: { label: string; key: keyof typeof PLAN_CONFIG_MAP['starter'] }[] = [
  { label: 'Agency Profile (family-visible)', key: 'has_family_request_inbox' },
  { label: 'Family Request Inbox', key: 'has_family_request_inbox' },
  { label: 'Emergency Care', key: 'has_emergency_care' },
  { label: 'Agency-Controlled Messaging', key: 'has_family_request_inbox' },
  { label: 'Invite Link for Nannies', key: 'has_invite_link' },
  { label: 'Advanced Search & Filters', key: 'has_advanced_search' },
  { label: 'Team Collaboration', key: 'has_team_collaboration' },
  { label: 'Advanced Analytics', key: 'has_advanced_analytics' },
  { label: 'Priority Placement in Discovery', key: 'has_priority_family_discovery' },
  { label: 'Early Access to Family Requests', key: 'has_early_family_request_access' },
  { label: 'Agency Branding on Profiles', key: 'has_agency_branding' },
  { label: 'Top Marketplace Placement', key: 'has_top_marketplace_placement' },
  { label: 'Priority Family Lead Access', key: 'has_priority_lead_access' },
  { label: 'Advanced Matching Suggestions', key: 'has_advanced_matching' },
  { label: 'Bulk CSV Import', key: 'has_bulk_import' },
  { label: 'API Access', key: 'has_api_access' },
  { label: 'Dedicated Support', key: 'has_dedicated_support' },
];

export default function Subscription() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [saving, setSaving] = useState<PlanCode | AddonCode | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { entitlements, loading, refresh } = useAgencyEntitlements(agencyId);

  useEffect(() => {
    if (!user?.uid) return;
    resolveAgencyIdForUser(user.uid).then((id) => setAgencyId(id || ''));
  }, [user]);

  useEffect(() => {
    const completeCheckout = async () => {
      if (!user?.uid || !agencyId) return;
      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('paypal_checkout');
      const planCode = params.get('plan') as PlanCode | null;
      const subscriptionId = params.get('subscription_id') || undefined;

      if (checkoutState === 'agency_plan_cancelled') {
        setErrorMsg('Plan change was cancelled before payment completed.');
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (checkoutState !== 'agency_plan_success' || !planCode) return;

      setSaving(planCode);
      setErrorMsg(null);
      try {
        await finalizeAgencyPlanCheckout({ agencyId, userId: user.uid, planCode, subscriptionId });
        refresh();
        setSuccessMsg(`Successfully switched to ${PLAN_CONFIG_MAP[planCode].name} plan.`);
      } catch (error: any) {
        setErrorMsg(error?.message || 'Failed to activate the selected plan.');
      } finally {
        setSaving(null);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    completeCheckout();
  }, [agencyId, refresh, user]);

  const currentPlanCode = entitlements?.plan_code ?? PLAN_CODES.FREE;

  const handleSelectPlan = async (planCode: PlanCode) => {
    if (!agencyId || saving || !user?.uid) return;
    if (planCode === PLAN_CODES.FREE) return;
    const plan = PLAN_CONFIG_MAP[planCode];
    setSaving(planCode);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const returnUrl = `${window.location.origin}/agency/subscription?paypal_checkout=agency_plan_success&plan=${planCode}`;
      const cancelUrl = `${window.location.origin}/agency/subscription?paypal_checkout=agency_plan_cancelled`;
      const result = await startAgencyPlanCheckout({ agencyId, userId: user.uid, planCode, returnUrl, cancelUrl });

      if (result?.simulatedApplied) {
        refresh();
        setSuccessMsg(`Successfully switched to ${plan.name} plan.`);
        return;
      }

      if (result?.approvalUrl) {
        window.location.href = result.approvalUrl;
        return;
      }

      throw new Error('No approval URL returned from checkout.');
    } catch (error: any) {
      const message = error?.message || 'Failed to update plan. Please try again.';
      if (isCredentialSetupError(message)) {
        try {
          await upsertAgencySubscription(agencyId, planCode, plan.monthly_price);
          refresh();
          setSuccessMsg(`Demo mode: switched to ${plan.name} plan without live billing.`);
          return;
        } catch {
          setErrorMsg('Demo fallback failed. Please check Firestore access for this agency account.');
          return;
        }
      }

      setErrorMsg(message);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleAddon = async (addonCode: AddonCode, currentlyActive: boolean) => {
    if (!agencyId || saving) return;
    const addon = ADDON_CONFIG_MAP[addonCode];
    setSaving(addonCode);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await upsertAgencyAddon(agencyId, addonCode, addon.monthly_price, !currentlyActive);
      refresh();
      setSuccessMsg(
        currentlyActive
          ? `${addon.name} cancelled.`
          : `${addon.name} activated.`
      );
    } catch {
      setErrorMsg('Failed to update add-on. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Plans & Add-Ons</h1>
        <p className="text-stone-500 mt-1">
          Choose the right plan for your agency. All plans include a Family Request Inbox and Agency Profile.
        </p>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-emerald-800 text-sm font-medium"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-red-800 text-sm font-medium"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const isActive = plan.code === currentPlanCode;
          const isSaving = saving === plan.code;
          const canCheckout = plan.code !== PLAN_CODES.FREE;

          return (
            <motion.div
              key={plan.code}
              whileHover={{ y: -4 }}
              className={`relative bg-white rounded-3xl border-2 shadow-sm overflow-hidden flex flex-col transition-all ${
                isActive ? PLAN_ACCENT[plan.color] : 'border-stone-200'
              }`}
            >
              {plan.is_popular && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              {isActive && (
                <div className="absolute top-4 left-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${PLAN_BADGE[plan.color]}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    Current Plan
                  </span>
                </div>
              )}

              <div className="p-6 pt-14">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{PLAN_ICON[plan.color]}</span>
                  <div>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{plan.tagline}</p>
                    <h2 className="text-xl font-bold text-stone-900">{plan.name}</h2>
                  </div>
                </div>

                <div className="mt-4 mb-1">
                  <span className="text-4xl font-bold text-stone-900">${plan.monthly_price}</span>
                  <span className="text-stone-500 text-sm font-medium">/mo</span>
                </div>
                <p className="text-xs text-stone-400 mb-4">{plan.target}</p>
                <p className="text-sm text-stone-600 leading-relaxed">{plan.description}</p>
                {plan.has_emergency_care && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-800">
                    Unlock urgent care opportunities: same-day, last-minute, and emergency childcare requests.
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 space-y-2.5 flex-1">
                <div className="border-t border-stone-100 pt-4">
                  <UsageRow label="Recruiter Seats" limit={plan.recruiter_seat_limit} />
                  <UsageRow label="Active Job Listings" limit={plan.active_job_limit} />
                  <UsageRow label="Nanny Profiles" limit={plan.nanny_profile_limit} />
                </div>
              </div>

              <div className="px-6 pb-6 mt-auto">
                <button
                  onClick={() => handleSelectPlan(plan.code)}
                  disabled={isActive || !!saving || !canCheckout}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${PLAN_BUTTON[plan.color]}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isActive ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Current Plan
                    </>
                  ) : !canCheckout ? (
                    'Default Free Plan'
                  ) : (
                    <>
                      Select {plan.name}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-900">Feature Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-6 py-3 font-semibold text-stone-500 w-1/2">Feature</th>
                {PAID_PLANS.map((p) => (
                  <th key={p.code} className={`px-4 py-3 font-bold ${p.code === currentPlanCode ? 'text-stone-900' : 'text-stone-500'}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {featureRows.map((row) => (
                <tr key={row.key} className="hover:bg-stone-50/50">
                  <td className="px-6 py-3 text-stone-700">{row.label}</td>
                  {PAID_PLANS.map((p) => (
                    <td key={p.code} className="px-4 py-3 text-center">
                      {(p as any)[row.key] ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-stone-300 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add-Ons */}
      <div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Add-Ons</h2>
        <p className="text-stone-500 text-sm mb-6">
          Enhance your plan with targeted boosts. Add-ons stack on top of your plan's features.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ADDONS.map((addon) => {
            const isActive = entitlements?.active_addons.includes(addon.code) ?? false;
            const isSaving = saving === addon.code;

            return (
              <div
                key={addon.code}
                className={`bg-white rounded-2xl border-2 p-5 shadow-sm flex flex-col gap-4 transition-all ${
                  isActive ? 'border-stone-900' : 'border-stone-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-stone-900 text-sm">{addon.name}</h3>
                    {isActive && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed">{addon.description}</p>
                </div>

                <div className="flex items-center gap-1 text-stone-400 text-xs">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>{addon.effect}</span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-lg font-bold text-stone-900">
                    ${addon.monthly_price}<span className="text-xs text-stone-400 font-normal">/mo</span>
                  </span>
                  <button
                    onClick={() => handleToggleAddon(addon.code, isActive)}
                    disabled={!!saving}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
                      isActive
                        ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isActive ? (
                      'Cancel'
                    ) : (
                      'Add'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compliance note */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-900 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Platform Policy Reminder</p>
          <p className="text-amber-800 leading-relaxed">
            Families do not contact nannies directly. Agencies remain the central
            coordinator of all matching and communication on Shift Me Up. Free agencies can receive requests, while paid plans unlock job posting and team growth.
          </p>
        </div>
      </div>
    </div>
  );
}

function UsageRow({ label, limit }: { label: string; limit: number | null }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`text-xs font-semibold ${limit === null ? 'text-emerald-600' : 'text-stone-700'}`}>
        {limit === null ? 'Unlimited' : limit}
      </span>
    </div>
  );
}

function AddonBadge({ code }: { code: AddonCode }) {
  const LABELS: Record<AddonCode, { label: string; icon: ReactNode }> = {
    [ADDON_CODES.FEATURED_AGENCY_BOOST]: {
      label: 'Featured',
      icon: <Star className="h-3 w-3" />,
    },
    [ADDON_CODES.PRIORITY_LEAD_BOOST]: {
      label: 'Priority Access',
      icon: <TrendingUp className="h-3 w-3" />,
    },
    [ADDON_CODES.BULK_IMPORT]: {
      label: 'Bulk Import',
      icon: <Zap className="h-3 w-3" />,
    },
  };

  const meta = LABELS[code];
  if (!meta) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
      {meta.icon}
      {meta.label}
    </span>
  );
}

// Export badge for use in other pages
export { AddonBadge };
