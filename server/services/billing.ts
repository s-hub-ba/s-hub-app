// ─── Plan codes (mirrors src/lib/plans.ts for server-side use) ────────────────

export const PLAN_CODES = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

// ─── Plan prices ──────────────────────────────────────────────────────────────

export const PLAN_PRICES: Record<PlanCode, number> = {
  [PLAN_CODES.FREE]: 0.00,
  [PLAN_CODES.STARTER]: 29.00,
  [PLAN_CODES.PROFESSIONAL]: 59.00,
  [PLAN_CODES.ENTERPRISE]: 149.00, // configurable 149–199
};

export const PLAN_RECRUITER_LIMITS: Record<PlanCode, number | null> = {
  [PLAN_CODES.FREE]: 0,
  [PLAN_CODES.STARTER]: 1,
  [PLAN_CODES.PROFESSIONAL]: 3,
  [PLAN_CODES.ENTERPRISE]: null,
};

export const PLAN_JOB_LIMITS: Record<PlanCode, number | null> = {
  [PLAN_CODES.FREE]: 0,
  [PLAN_CODES.STARTER]: 5,
  [PLAN_CODES.PROFESSIONAL]: null,
  [PLAN_CODES.ENTERPRISE]: null,
};

export const ENTERPRISE_PRICE_RANGE = { min: 149, max: 199 };

// ─── Addon prices ─────────────────────────────────────────────────────────────

export const ADDON_CODES = {
  FEATURED_AGENCY_BOOST: 'featured_agency_boost',
  PRIORITY_LEAD_BOOST: 'priority_lead_boost',
  BULK_IMPORT: 'bulk_import',
} as const;

export type AddonCode = (typeof ADDON_CODES)[keyof typeof ADDON_CODES];

export const ADDON_PRICES: Record<AddonCode, number> = {
  [ADDON_CODES.FEATURED_AGENCY_BOOST]: 19.00,
  [ADDON_CODES.PRIORITY_LEAD_BOOST]: 29.00,
  [ADDON_CODES.BULK_IMPORT]: 19.00,
};

// ─── Legacy: kept for backward-compat with agency route ──────────────────────

/** @deprecated Use PLAN_PRICES[PLAN_CODES.STARTER] and ADDON_PRICES instead */
export const PRICING = {
  BASE_PRICE: PLAN_PRICES[PLAN_CODES.STARTER],
  SEAT_PRICE: 5.00,
  INCLUDED_SEATS: 1,
};

/**
 * Returns the monthly price for a given plan code.
 * For Enterprise, optionally accepts a configured price within the allowed range.
 */
export function getPlanPrice(
  planCode: PlanCode,
  enterpriseConfiguredPrice?: number
): number {
  if (planCode === PLAN_CODES.ENTERPRISE && enterpriseConfiguredPrice !== undefined) {
    const clamped = Math.min(
      ENTERPRISE_PRICE_RANGE.max,
      Math.max(ENTERPRISE_PRICE_RANGE.min, enterpriseConfiguredPrice)
    );
    return Number(clamped.toFixed(2));
  }
  return PLAN_PRICES[planCode] ?? PLAN_PRICES[PLAN_CODES.FREE];
}

/**
 * @deprecated Legacy seat-based price calculator. Prefer getPlanPrice() for
 * plan-based billing. Kept for the existing agency route that tracks
 * recruiter_count on the subscriptions collection.
 *
 * Formula: 29 + (additional_recruiters * 5)
 */
export function calculateSubscriptionPrice(totalRecruiters: number): number {
  if (totalRecruiters <= 0) return 0;
  const additionalRecruiters = Math.max(0, totalRecruiters - PRICING.INCLUDED_SEATS);
  const totalPrice = PRICING.BASE_PRICE + (additionalRecruiters * PRICING.SEAT_PRICE);
  return Number(totalPrice.toFixed(2));
}
