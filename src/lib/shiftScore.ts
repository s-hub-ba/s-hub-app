export type ShiftScoreReviewerType = 'agency' | 'family';

export interface ShiftScoreReviewInput {
  reviewer_type: ShiftScoreReviewerType;
  reliability_rating: number;
  communication_rating: number;
  punctuality: boolean;
  rehire: boolean;
  status?: 'active' | 'hidden';
  moderated_status?: 'pending' | 'approved' | 'flagged';
}

export interface ShiftScoreReviewWeights {
  reliability: number;
  communication: number;
  punctuality: number;
  rehire: number;
}

export interface ShiftScoreBlendWeights {
  profile: number;
  review: number;
}

export interface ShiftScoreProfileWeights {
  completenessBase: number;
  experienceBonus: number;
  certificationBonus: number;
  documentBonusPerVerifiedDoc: number;
  documentBonusCap: number;
  activityBonusPerApplication: number;
  activityBonusCap: number;
}

export interface ShiftScoreConfig {
  reviewWeights: ShiftScoreReviewWeights;
  blendWeights: ShiftScoreBlendWeights;
  profileWeights: ShiftScoreProfileWeights;
}

export interface ShiftScoreConfigOverrides {
  reviewWeights?: Partial<ShiftScoreReviewWeights>;
  blendWeights?: Partial<ShiftScoreBlendWeights>;
  profileWeights?: Partial<ShiftScoreProfileWeights>;
}

export interface ShiftScoreSummary {
  reviewCount: number;
  agencyReviewCount: number;
  familyReviewCount: number;
  averageReliability: number;
  averageCommunication: number;
  punctualityRate: number;
  rehireRate: number;
  punctualityPct: number;
  rehirePct: number;
  shiftScore: number;
  highlights: string[];
  highlightText: string;
}

export const DEFAULT_SHIFT_SCORE_REVIEW_WEIGHTS: ShiftScoreReviewWeights = {
  reliability: 0.35,
  communication: 0.35,
  punctuality: 0.15,
  rehire: 0.15,
};

export const DEFAULT_SHIFT_SCORE_BLEND_WEIGHTS: ShiftScoreBlendWeights = {
  profile: 0.35,
  review: 0.65,
};

export const DEFAULT_SHIFT_SCORE_PROFILE_WEIGHTS: ShiftScoreProfileWeights = {
  completenessBase: 2.6,
  experienceBonus: 0.4,
  certificationBonus: 0.3,
  documentBonusPerVerifiedDoc: 0.15,
  documentBonusCap: 0.7,
  activityBonusPerApplication: 0.05,
  activityBonusCap: 0.4,
};

export const DEFAULT_SHIFT_SCORE_CONFIG: ShiftScoreConfig = {
  reviewWeights: DEFAULT_SHIFT_SCORE_REVIEW_WEIGHTS,
  blendWeights: DEFAULT_SHIFT_SCORE_BLEND_WEIGHTS,
  profileWeights: DEFAULT_SHIFT_SCORE_PROFILE_WEIGHTS,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeWeights<T extends { [K in keyof T]: number }>(weights: T): T {
  const entries = Object.entries(weights) as Array<[keyof T, number]>;
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  if (total <= 0) return weights;

  return Object.fromEntries(
    entries.map(([key, value]) => [key, Math.max(0, value) / total])
  ) as T;
}

export function resolveShiftScoreConfig(overrides?: ShiftScoreConfigOverrides): ShiftScoreConfig {
  return {
    reviewWeights: {
      ...DEFAULT_SHIFT_SCORE_CONFIG.reviewWeights,
      ...(overrides?.reviewWeights || {}),
    },
    blendWeights: {
      ...DEFAULT_SHIFT_SCORE_CONFIG.blendWeights,
      ...(overrides?.blendWeights || {}),
    },
    profileWeights: {
      ...DEFAULT_SHIFT_SCORE_CONFIG.profileWeights,
      ...(overrides?.profileWeights || {}),
    },
  };
}

export function buildShiftScoreHighlights(summary: Pick<ShiftScoreSummary, 'reviewCount' | 'averageReliability' | 'averageCommunication' | 'rehireRate' | 'punctualityRate'>): string[] {
  if (summary.reviewCount === 0) return [];

  const highlights: string[] = [];
  if (summary.averageReliability >= 4.2) highlights.push('Strong on reliability');
  if (summary.averageCommunication >= 4.2) highlights.push('Strong on communication');
  if (summary.rehireRate >= 0.8) highlights.push('Frequently recommended for rehire');
  if (summary.punctualityRate >= 0.85) highlights.push('Consistently punctual');
  return highlights;
}

export function aggregateShiftScoreReviews(
  reviews: ShiftScoreReviewInput[],
  reviewWeights: ShiftScoreReviewWeights = DEFAULT_SHIFT_SCORE_CONFIG.reviewWeights
): ShiftScoreSummary {
  const activeReviews = reviews.filter((review) => review.status !== 'hidden' && review.moderated_status !== 'flagged');
  if (activeReviews.length === 0) {
    return {
      reviewCount: 0,
      agencyReviewCount: 0,
      familyReviewCount: 0,
      averageReliability: 0,
      averageCommunication: 0,
      punctualityRate: 0,
      rehireRate: 0,
      punctualityPct: 0,
      rehirePct: 0,
      shiftScore: 0,
      highlights: [],
      highlightText: 'No reviews yet.',
    };
  }

  const weights = normalizeWeights(reviewWeights);
  const reviewCount = activeReviews.length;
  const agencyReviewCount = activeReviews.filter((review) => review.reviewer_type === 'agency').length;
  const familyReviewCount = activeReviews.filter((review) => review.reviewer_type === 'family').length;

  const averageReliability = activeReviews.reduce((sum, review) => sum + Number(review.reliability_rating || 0), 0) / reviewCount;
  const averageCommunication = activeReviews.reduce((sum, review) => sum + Number(review.communication_rating || 0), 0) / reviewCount;
  const punctualityRate = activeReviews.filter((review) => review.punctuality).length / reviewCount;
  const rehireRate = activeReviews.filter((review) => review.rehire).length / reviewCount;

  const rawScore =
    averageReliability * weights.reliability +
    averageCommunication * weights.communication +
    punctualityRate * 5 * weights.punctuality +
    rehireRate * 5 * weights.rehire;

  const shiftScore = round1(clamp(rawScore, 0, 5));
  const highlights = buildShiftScoreHighlights({
    reviewCount,
    averageReliability,
    averageCommunication,
    rehireRate,
    punctualityRate,
  });

  return {
    reviewCount,
    agencyReviewCount,
    familyReviewCount,
    averageReliability: round1(averageReliability),
    averageCommunication: round1(averageCommunication),
    punctualityRate,
    rehireRate,
    punctualityPct: Math.round(punctualityRate * 100),
    rehirePct: Math.round(rehireRate * 100),
    shiftScore,
    highlights,
    highlightText: highlights.length > 0 ? highlights.slice(0, 2).join(' • ') : 'Building review history.',
  };
}

export function computeProfileSignalScore(
  completedFields: number,
  totalFields: number,
  yearsExperience: number,
  certificationCount: number,
  verifiedDocumentCount: number,
  applicationCount: number,
  profileWeights: ShiftScoreProfileWeights = DEFAULT_SHIFT_SCORE_CONFIG.profileWeights
): number {
  const completenessRatio = totalFields > 0 ? clamp(completedFields / totalFields, 0, 1) : 0;
  const base = completenessRatio * profileWeights.completenessBase;
  const experienceBonus = yearsExperience >= 3 ? profileWeights.experienceBonus : 0;
  const certificationBonus = certificationCount > 0 ? profileWeights.certificationBonus : 0;
  const documentBonus = Math.min(profileWeights.documentBonusCap, verifiedDocumentCount * profileWeights.documentBonusPerVerifiedDoc);
  const activityBonus = Math.min(profileWeights.activityBonusCap, applicationCount * profileWeights.activityBonusPerApplication);

  return round1(clamp(base + experienceBonus + certificationBonus + documentBonus + activityBonus, 0, 5));
}

export function combineShiftScoreSignals(
  profileSignalScore: number,
  reviewSignalScore: number,
  hasReviewSignal: boolean,
  blendWeights: ShiftScoreBlendWeights = DEFAULT_SHIFT_SCORE_CONFIG.blendWeights
): number {
  if (!hasReviewSignal) {
    return round1(clamp(profileSignalScore, 0, 5));
  }

  const normalizedBlend = normalizeWeights(blendWeights);
  const score =
    profileSignalScore * normalizedBlend.profile +
    reviewSignalScore * normalizedBlend.review;

  return round1(clamp(score, 0, 5));
}