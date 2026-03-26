export const MATCH_WEIGHTS = {
  location: 40,
  careType: 20,
  ageGroup: 15,
  specialRequirements: 15,
  budget: 10,
} as const;

export const MATCH_THRESHOLD = 60;
export const SPONSORED_BOOST_MAX = 12;

export type MatchTier = 'best_match' | 'great_match' | 'possible_match' | 'below_threshold';

export interface FamilyRequestForMatch {
  borough: string;
  neighborhood?: string;
  child_age_groups: string[];
  care_type: 'full-time' | 'part-time' | 'temporary';
  live_in: 'live-in' | 'live-out' | 'either';
  budget_min?: number | null;
  budget_max?: number | null;
  languages: string[];
  driver_required: boolean;
  special_needs: boolean;
}

export interface AgencyCapabilityForMatch {
  boroughs_served: string[];
  neighborhoods_served: string[];
  supported_care_types: string[];
  supported_age_groups: string[];
  supports_live_in: boolean;
  supports_live_out: boolean;
  supports_special_needs: boolean;
  supports_driver_requests: boolean;
  supported_languages: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  is_featured?: boolean;
  has_priority_lead_boost?: boolean;
}

export interface AgencyMatchResult {
  score: number;
  base_score: number;
  sponsored_boost: number;
  is_eligible: boolean;
  tier: MatchTier;
  reasons: string[];
  breakdown: {
    location: number;
    care_type: number;
    age_group: number;
    special_requirements: number;
    budget: number;
  };
}

const normalize = (value: string): string => value.trim().toLowerCase();

const toSet = (values: string[]): Set<string> => new Set((values || []).map(normalize).filter(Boolean));

const intersects = (a: Set<string>, b: Set<string>): boolean => {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
};

const hasMeaningfulOverlap = (a: Set<string>, b: Set<string>): number => {
  let matches = 0;
  for (const value of a) {
    if (b.has(value)) matches += 1;
  }
  return matches;
};

const getTier = (score: number): MatchTier => {
  if (score >= 85) return 'best_match';
  if (score >= 70) return 'great_match';
  if (score >= MATCH_THRESHOLD) return 'possible_match';
  return 'below_threshold';
};

export function scoreAgencyForFamilyRequest(
  request: FamilyRequestForMatch,
  capability: AgencyCapabilityForMatch
): AgencyMatchResult {
  const reasons: string[] = [];

  const requestBorough = normalize(request.borough || '');
  const requestNeighborhood = normalize(request.neighborhood || '');
  const servedBoroughs = toSet(capability.boroughs_served || []);
  const servedNeighborhoods = toSet(capability.neighborhoods_served || []);

  let locationScore = 0;
  if (requestBorough && servedBoroughs.has(requestBorough)) {
    locationScore += 24;
    reasons.push(`Serves ${request.borough}`);
  }
  if (requestNeighborhood && servedNeighborhoods.has(requestNeighborhood)) {
    locationScore += 16;
    reasons.push(`Covers ${request.neighborhood}`);
  }
  locationScore = Math.min(locationScore, MATCH_WEIGHTS.location);

  const careTypes = toSet(capability.supported_care_types || []);
  const requestCareType = normalize(request.care_type || '');
  let careTypeScore = 0;
  if (requestCareType && careTypes.has(requestCareType)) {
    careTypeScore = MATCH_WEIGHTS.careType;
    reasons.push(`Supports ${request.care_type} care`);
  }

  const requestAgeGroups = toSet(request.child_age_groups || []);
  const agencyAgeGroups = toSet(capability.supported_age_groups || []);
  const ageOverlapCount = hasMeaningfulOverlap(requestAgeGroups, agencyAgeGroups);
  let ageGroupScore = 0;
  if (ageOverlapCount > 0 && requestAgeGroups.size > 0) {
    ageGroupScore = Math.round((ageOverlapCount / requestAgeGroups.size) * MATCH_WEIGHTS.ageGroup);
    if (ageGroupScore > 0) reasons.push('Experienced with your children age group');
  }

  let specialScore = 0;
  if (request.special_needs) {
    if (capability.supports_special_needs) {
      specialScore += 9;
      reasons.push('Supports special needs placements');
    }
  } else {
    specialScore += 6;
  }

  if (request.driver_required) {
    if (capability.supports_driver_requests) {
      specialScore += 4;
      reasons.push('Can provide driver-capable caregivers');
    }
  } else {
    specialScore += 2;
  }

  if (request.live_in === 'live-in' && capability.supports_live_in) {
    specialScore += 2;
    reasons.push('Supports live-in placements');
  }
  if (request.live_in === 'live-out' && capability.supports_live_out) {
    specialScore += 2;
    reasons.push('Supports live-out placements');
  }
  if (request.live_in === 'either') {
    if (capability.supports_live_in || capability.supports_live_out) specialScore += 1;
  }

  const requestLang = toSet(request.languages || []);
  const agencyLang = toSet(capability.supported_languages || []);
  if (requestLang.size > 0 && intersects(requestLang, agencyLang)) {
    specialScore += 2;
    reasons.push('Language preferences are supported');
  }
  specialScore = Math.min(specialScore, MATCH_WEIGHTS.specialRequirements);

  let budgetScore = 0;
  const reqMin = request.budget_min ?? null;
  const reqMax = request.budget_max ?? null;
  const agencyMin = capability.budget_min ?? null;
  const agencyMax = capability.budget_max ?? null;

  if (reqMin !== null || reqMax !== null) {
    const overlapLow = Math.max(reqMin ?? 0, agencyMin ?? 0);
    const overlapHigh = Math.min(reqMax ?? Number.MAX_SAFE_INTEGER, agencyMax ?? Number.MAX_SAFE_INTEGER);
    if (overlapHigh >= overlapLow) {
      budgetScore = MATCH_WEIGHTS.budget;
      reasons.push('Budget range aligns');
    } else if (agencyMin !== null && reqMax !== null && agencyMin <= reqMax + 5) {
      budgetScore = 5;
    } else if (agencyMax !== null && reqMin !== null && agencyMax >= reqMin - 5) {
      budgetScore = 5;
    }
  } else {
    budgetScore = 6;
  }

  const base = Math.min(
    100,
    locationScore + careTypeScore + ageGroupScore + specialScore + budgetScore
  );

  const eligibleForSponsoredBoost = base >= MATCH_THRESHOLD;
  const hasSponsorBoost = !!capability.is_featured || !!capability.has_priority_lead_boost;
  const sponsoredBoost = eligibleForSponsoredBoost && hasSponsorBoost ? SPONSORED_BOOST_MAX : 0;
  if (sponsoredBoost > 0 && capability.is_featured) {
    reasons.push('Featured agency boost applied');
  }

  const finalScore = Math.min(100, base + sponsoredBoost);

  return {
    score: finalScore,
    base_score: base,
    sponsored_boost: sponsoredBoost,
    is_eligible: finalScore >= MATCH_THRESHOLD,
    tier: getTier(finalScore),
    reasons: reasons.slice(0, 4),
    breakdown: {
      location: locationScore,
      care_type: careTypeScore,
      age_group: ageGroupScore,
      special_requirements: specialScore,
      budget: budgetScore,
    },
  };
}
