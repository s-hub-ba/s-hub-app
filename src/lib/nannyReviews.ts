import { aggregateShiftScoreReviews } from './shiftScore';

export const NANNY_REVIEW_LIMITS = {
  strengths: 120,
  notes: 240,
} as const;

export type NannyReviewerType = 'agency' | 'family';

export type NannyReviewRelationshipContext =
  | 'managed'
  | 'applied'
  | 'interviewed'
  | 'placed'
  | 'trial_completed'
  | 'placement_completed'
  | 'engagement_completed';

export interface StructuredNannyReview {
  id?: string;
  nanny_id: string;
  reviewer_id: string;
  reviewer_type: NannyReviewerType;
  reviewer_role?: NannyReviewerType;
  relationship_context: NannyReviewRelationshipContext;
  relationship_reference_type?: 'application' | 'care_history' | 'managed_profile';
  relationship_reference_id?: string;
  reliability_rating: number;
  communication_rating: number;
  punctuality: boolean;
  rehire: boolean;
  strengths?: string;
  notes?: string;
  status?: 'active' | 'hidden';
  moderated_status?: 'pending' | 'approved' | 'flagged';
  visible_to_agencies?: boolean;
  visible_to_families?: boolean;
  internal_only?: boolean;
  created_at?: any;
  updated_at?: any;
}

export interface NannyReviewAggregate {
  reviewCount: number;
  agencyReviewCount: number;
  familyReviewCount: number;
  averageReliability: number;
  averageCommunication: number;
  punctualityRate: number;
  rehireRate: number;
  shiftScore: number;
  strongSignals: string[];
}

export const EMPTY_NANNY_REVIEW_AGGREGATE: NannyReviewAggregate = {
  reviewCount: 0,
  agencyReviewCount: 0,
  familyReviewCount: 0,
  averageReliability: 0,
  averageCommunication: 0,
  punctualityRate: 0,
  rehireRate: 0,
  shiftScore: 0,
  strongSignals: [],
};

export function sanitizeReviewText(value: string | undefined, maxLength: number): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validateStructuredNannyReview(review: StructuredNannyReview): string[] {
  const errors: string[] = [];

  if (!review.nanny_id) errors.push('Missing nanny.');
  if (!review.reviewer_id) errors.push('Missing reviewer.');
  if (!review.reviewer_type) errors.push('Missing reviewer type.');
  if (!review.relationship_context) errors.push('Missing relationship context.');

  if (!Number.isInteger(review.reliability_rating) || review.reliability_rating < 1 || review.reliability_rating > 5) {
    errors.push('Reliability rating must be between 1 and 5.');
  }

  if (!Number.isInteger(review.communication_rating) || review.communication_rating < 1 || review.communication_rating > 5) {
    errors.push('Communication rating must be between 1 and 5.');
  }

  if (typeof review.punctuality !== 'boolean') {
    errors.push('Punctuality must be yes or no.');
  }

  if (typeof review.rehire !== 'boolean') {
    errors.push('Rehire must be yes or no.');
  }

  if ((review.strengths || '').length > NANNY_REVIEW_LIMITS.strengths) {
    errors.push(`Strengths must be ${NANNY_REVIEW_LIMITS.strengths} characters or fewer.`);
  }

  if ((review.notes || '').length > NANNY_REVIEW_LIMITS.notes) {
    errors.push(`Notes must be ${NANNY_REVIEW_LIMITS.notes} characters or fewer.`);
  }

  return errors;
}

export function normalizeStructuredNannyReview(raw: any): StructuredNannyReview {
  const reviewerType = (raw?.reviewer_type || raw?.reviewer_role || 'family') as NannyReviewerType;
  const legacyRating = Math.max(1, Math.min(5, Number(raw?.rating || 0) || 5));

  return {
    id: raw?.id,
    nanny_id: String(raw?.nanny_id || ''),
    reviewer_id: String(raw?.reviewer_id || ''),
    reviewer_type: reviewerType,
    reviewer_role: reviewerType,
    relationship_context: (raw?.relationship_context || (reviewerType === 'agency' ? 'placed' : 'placement_completed')) as NannyReviewRelationshipContext,
    relationship_reference_type: raw?.relationship_reference_type,
    relationship_reference_id: raw?.relationship_reference_id,
    reliability_rating: Number(raw?.reliability_rating || legacyRating),
    communication_rating: Number(raw?.communication_rating || legacyRating),
    punctuality: typeof raw?.punctuality === 'boolean' ? raw.punctuality : true,
    rehire: typeof raw?.rehire === 'boolean' ? raw.rehire : legacyRating >= 4,
    strengths: sanitizeReviewText(raw?.strengths, NANNY_REVIEW_LIMITS.strengths),
    notes: sanitizeReviewText(raw?.notes || raw?.comment, NANNY_REVIEW_LIMITS.notes),
    status: raw?.status || 'active',
    moderated_status: raw?.moderated_status || 'approved',
    visible_to_agencies: raw?.visible_to_agencies ?? true,
    visible_to_families: raw?.visible_to_families ?? true,
    internal_only: raw?.internal_only ?? false,
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
  };
}

export function computeNannyReviewAggregate(reviews: StructuredNannyReview[]): NannyReviewAggregate {
  const summary = aggregateShiftScoreReviews(reviews);
  if (summary.reviewCount === 0) {
    return EMPTY_NANNY_REVIEW_AGGREGATE;
  }

  return {
    reviewCount: summary.reviewCount,
    agencyReviewCount: summary.agencyReviewCount,
    familyReviewCount: summary.familyReviewCount,
    averageReliability: summary.averageReliability,
    averageCommunication: summary.averageCommunication,
    punctualityRate: summary.punctualityRate,
    rehireRate: summary.rehireRate,
    shiftScore: summary.shiftScore,
    strongSignals: summary.highlights,
  };
}

export function deriveReviewHighlights(aggregate: NannyReviewAggregate): string {
  if (aggregate.reviewCount === 0) return 'No reviews yet.';
  if (aggregate.strongSignals.length > 0) return aggregate.strongSignals.slice(0, 2).join(' • ');
  return 'Building review history.';
}