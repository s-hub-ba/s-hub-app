/**
 * Agency Pricing & Entitlement System — Single Source of Truth
 *
 * All plan codes, addon codes, prices, feature flags, and data model
 * interfaces live here. The rest of the app imports from this file.
 */

// ─── Plan Codes ─────────────────────────────────────────────────────────────

export const PLAN_CODES = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

// ─── Addon Codes ─────────────────────────────────────────────────────────────

export const ADDON_CODES = {
  FEATURED_AGENCY_BOOST: 'featured_agency_boost',
  PRIORITY_LEAD_BOOST: 'priority_lead_boost',
  BULK_IMPORT: 'bulk_import',
} as const;

export type AddonCode = (typeof ADDON_CODES)[keyof typeof ADDON_CODES];

// ─── Sentinel value for "unlimited" limits ──────────────────────────────────

/** null means no limit (unlimited). A number means a hard cap. */
export type Limit = number | null;

// ─── Plan Definition ─────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  /** Short marketing tagline, e.g. "Launch" */
  tagline: string;
  monthly_price: number;
  description: string;
  /** Short blurb about the ideal customer */
  target: string;
  color: 'emerald' | 'blue' | 'red';

  // Usage limits (null = unlimited)
  recruiter_seat_limit: Limit;
  active_job_limit: Limit;
  nanny_profile_limit: Limit;

  // Feature flags
  has_invite_link: boolean;
  has_family_request_inbox: boolean;
  has_advanced_search: boolean;
  has_priority_family_discovery: boolean;
  has_early_family_request_access: boolean;
  has_agency_branding: boolean;
  has_top_marketplace_placement: boolean;
  has_priority_lead_access: boolean;
  has_advanced_matching: boolean;
  has_bulk_import: boolean;
  has_api_access: boolean;
  has_dedicated_support: boolean;

  is_active: boolean;
  is_popular?: boolean;
}

// ─── Plans Config ─────────────────────────────────────────────────────────────

export const PLANS: Plan[] = [
  {
    id: 'starter',
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    tagline: 'Launch',
    monthly_price: 29,
    description: 'Start receiving family inquiries and managing your placements in one place.',
    target: 'Boutique agencies starting out',
    color: 'emerald',
    recruiter_seat_limit: 1,
    active_job_limit: 5,
    nanny_profile_limit: 50,
    has_invite_link: true,
    has_family_request_inbox: true,
    has_advanced_search: false,
    has_priority_family_discovery: false,
    has_early_family_request_access: false,
    has_agency_branding: false,
    has_top_marketplace_placement: false,
    has_priority_lead_access: false,
    has_advanced_matching: false,
    has_bulk_import: false,
    has_api_access: false,
    has_dedicated_support: false,
    is_active: true,
  },
  {
    id: 'professional',
    code: PLAN_CODES.PROFESSIONAL,
    name: 'Professional',
    tagline: 'Growth',
    monthly_price: 59,
    description: 'Grow your placements with priority visibility and faster access to families.',
    target: 'Growing agencies',
    color: 'blue',
    recruiter_seat_limit: 3,
    active_job_limit: null,
    nanny_profile_limit: null,
    has_invite_link: true,
    has_family_request_inbox: true,
    has_advanced_search: true,
    has_priority_family_discovery: true,
    has_early_family_request_access: true,
    has_agency_branding: true,
    has_top_marketplace_placement: false,
    has_priority_lead_access: false,
    has_advanced_matching: false,
    has_bulk_import: false,
    has_api_access: false,
    has_dedicated_support: false,
    is_active: true,
    is_popular: true,
  },
  {
    id: 'enterprise',
    code: PLAN_CODES.ENTERPRISE,
    name: 'Enterprise',
    tagline: 'Scale',
    // Configurable price between ENTERPRISE_PRICE_RANGE.min and max
    monthly_price: 149,
    description: 'Scale your agency with premium visibility, automation, and high-quality leads.',
    target: 'Serious agencies',
    color: 'red',
    recruiter_seat_limit: null,
    active_job_limit: null,
    nanny_profile_limit: null,
    has_invite_link: true,
    has_family_request_inbox: true,
    has_advanced_search: true,
    has_priority_family_discovery: true,
    has_early_family_request_access: true,
    has_agency_branding: true,
    has_top_marketplace_placement: true,
    has_priority_lead_access: true,
    has_advanced_matching: true,
    has_bulk_import: true,
    has_api_access: true,
    has_dedicated_support: true,
    is_active: true,
  },
];

/** Enterprise plan price range (configurable billing) */
export const ENTERPRISE_PRICE_RANGE = { min: 149, max: 199 };

/** Lookup map by plan code */
export const PLAN_CONFIG_MAP: Record<PlanCode, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.code, p])
) as Record<PlanCode, Plan>;

// ─── Addon Definition ─────────────────────────────────────────────────────────

export interface AddonDef {
  code: AddonCode;
  name: string;
  description: string;
  monthly_price: number;
  /** One-line summary of what the addon does functionally */
  effect: string;
}

export const ADDONS: AddonDef[] = [
  {
    code: ADDON_CODES.FEATURED_AGENCY_BOOST,
    name: 'Featured Agency Boost',
    description:
      'Higher ranking in family discovery with a featured/sponsored badge. Boost placement while still respecting relevance matching.',
    monthly_price: 19,
    effect: 'Sponsored badge + boosted rank in family discovery',
  },
  {
    code: ADDON_CODES.PRIORITY_LEAD_BOOST,
    name: 'Priority Lead Boost',
    description:
      'Get top family requests first and earlier access to matched family requests. Integrates with the Family Request Inbox ordering.',
    monthly_price: 29,
    effect: 'First-in-queue access to matched family requests',
  },
  {
    code: ADDON_CODES.BULK_IMPORT,
    name: 'Bulk Import',
    description: 'CSV nanny upload and bulk onboarding support.',
    monthly_price: 19,
    effect: 'CSV nanny upload enabled',
  },
];

/** Lookup map by addon code */
export const ADDON_CONFIG_MAP: Record<AddonCode, AddonDef> = Object.fromEntries(
  ADDONS.map((a) => [a.code, a])
) as Record<AddonCode, AddonDef>;

// ─── Data Model Interfaces ────────────────────────────────────────────────────

export interface AgencySubscription {
  id?: string;
  agency_id: string;
  plan_code: PlanCode;
  status: 'active' | 'inactive' | 'cancelled' | 'trial';
  start_date: any;
  renewal_date: any;
  price_at_purchase: number;
  created_at: any;
  updated_at: any;
}

export interface AgencyAddon {
  id?: string;
  agency_id: string;
  addon_code: AddonCode;
  status: 'active' | 'inactive' | 'cancelled';
  start_date: any;
  renewal_date: any;
  price_at_purchase: number;
  created_at: any;
  updated_at: any;
}

// ─── Entitlements Interface ────────────────────────────────────────────────────

export interface AgencyEntitlements {
  plan_code: PlanCode;
  plan: Plan;
  subscription_status: AgencySubscription['status'] | 'none';
  active_addons: AddonCode[];

  // Usage limits for display and enforcement
  recruiterSeatLimit: Limit;
  activeJobLimit: Limit;
  nannyProfileLimit: Limit;

  // Functional checks
  canCreateRecruiter: (currentCount: number) => boolean;
  canCreateJobPosting: (currentCount: number) => boolean;
  canAddNannyProfile: (currentCount: number) => boolean;

  // Feature flag checks
  canUseAdvancedSearch: boolean;
  canAccessPriorityDiscovery: boolean;
  canAccessEarlyFamilyRequests: boolean;
  canUseAgencyBranding: boolean;
  canUseBulkImport: boolean;
  canUseApiAccess: boolean;
  hasDedicatedSupport: boolean;

  // Addon-driven flags (can be granted by plan OR addon)
  isFeaturedAgency: boolean;
  hasPriorityLeadBoost: boolean;
  hasTopMarketplacePlacement: boolean;
  hasAdvancedMatching: boolean;
}

// ─── Entitlement Resolver (pure function, no React) ──────────────────────────

/**
 * Computes an AgencyEntitlements object from a subscription + active addons.
 * Pass null subscription to get Starter defaults (graceful degradation).
 */
export function resolveEntitlements(
  subscription: AgencySubscription | null,
  addons: AgencyAddon[]
): AgencyEntitlements {
  const isActive =
    subscription?.status === 'active' || subscription?.status === 'trial';

  // Graceful default: treat missing/inactive subscription as Starter
  const planCode: PlanCode =
    isActive && subscription?.plan_code
      ? subscription.plan_code
      : PLAN_CODES.STARTER;

  const plan = PLAN_CONFIG_MAP[planCode] ?? PLAN_CONFIG_MAP[PLAN_CODES.STARTER];

  const activeAddonCodes = addons
    .filter((a) => a.status === 'active')
    .map((a) => a.addon_code);

  const hasAddon = (code: AddonCode) => activeAddonCodes.includes(code);

  return {
    plan_code: planCode,
    plan,
    subscription_status: subscription?.status ?? 'none',
    active_addons: activeAddonCodes,

    recruiterSeatLimit: plan.recruiter_seat_limit,
    activeJobLimit: plan.active_job_limit,
    nannyProfileLimit: plan.nanny_profile_limit,

    canCreateRecruiter: (count: number) =>
      plan.recruiter_seat_limit === null || count < plan.recruiter_seat_limit,

    canCreateJobPosting: (count: number) =>
      plan.active_job_limit === null || count < plan.active_job_limit,

    canAddNannyProfile: (count: number) =>
      plan.nanny_profile_limit === null || count < plan.nanny_profile_limit,

    canUseAdvancedSearch: plan.has_advanced_search,
    canAccessPriorityDiscovery: plan.has_priority_family_discovery,
    canAccessEarlyFamilyRequests:
      plan.has_early_family_request_access ||
      hasAddon(ADDON_CODES.PRIORITY_LEAD_BOOST),
    canUseAgencyBranding: plan.has_agency_branding,
    canUseBulkImport:
      plan.has_bulk_import || hasAddon(ADDON_CODES.BULK_IMPORT),
    canUseApiAccess: plan.has_api_access,
    hasDedicatedSupport: plan.has_dedicated_support,

    isFeaturedAgency: hasAddon(ADDON_CODES.FEATURED_AGENCY_BOOST),
    hasPriorityLeadBoost: hasAddon(ADDON_CODES.PRIORITY_LEAD_BOOST),
    hasTopMarketplacePlacement: plan.has_top_marketplace_placement,
    hasAdvancedMatching: plan.has_advanced_matching,
  };
}

// ─── Discovery Ranking ────────────────────────────────────────────────────────

/**
 * Returns a numeric sort boost for an agency in family discovery.
 * Higher numbers appear first. This is additive; base relevance scoring
 * should still be the primary sort key.
 *
 * Enterprise = +300, Professional = +200, Featured boost addon = +100
 */
export function getDiscoveryBoost(entitlements: AgencyEntitlements): number {
  let boost = 0;
  if (entitlements.hasTopMarketplacePlacement) boost += 300;   // Enterprise
  else if (entitlements.canAccessPriorityDiscovery) boost += 200; // Professional
  if (entitlements.isFeaturedAgency) boost += 100;              // Addon
  return boost;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a human-friendly label for a limit value. */
export function formatLimit(limit: Limit): string {
  return limit === null ? 'Unlimited' : String(limit);
}

/** Returns true if the given code is a valid PlanCode. */
export function isPlanCode(value: string): value is PlanCode {
  return Object.values(PLAN_CODES).includes(value as PlanCode);
}
