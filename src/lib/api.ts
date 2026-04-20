import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  onSnapshot,
  runTransaction,
  limit as firestoreLimit
} from 'firebase/firestore';
import {
  PLAN_CODES,
  resolveEntitlements,
  type AgencyEntitlements,
  type AgencySubscription,
  type AgencyAddon,
  type AddonCode,
  type PlanCode,
} from './plans';
import { scoreAgencyForFamilyRequest, MATCH_THRESHOLD, type MatchTier } from './familyMatching';
import {
  EMPTY_NANNY_REVIEW_AGGREGATE,
  normalizeStructuredNannyReview,
  sanitizeReviewText,
  validateStructuredNannyReview,
  type NannyReviewAggregate,
  type NannyReviewRelationshipContext,
  type NannyReviewerType,
  type StructuredNannyReview,
} from './nannyReviews';
import {
  aggregateShiftScoreReviews,
  combineShiftScoreSignals,
  computeProfileSignalScore,
  resolveShiftScoreConfig,
  type ShiftScoreConfigOverrides,
} from './shiftScore';
import { db, auth } from './firebase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL;

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    throw new Error('Missing VITE_API_BASE_URL. Configure your backend API URL for GitHub Pages builds.');
  }

  return '';
}

function buildApiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  return base ? `${base}${path}` : path;
}

async function buildApiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Unable to resolve auth token for API request');
  }

  if (auth.currentUser?.uid && !headers['x-user-id']) {
    headers['x-user-id'] = auth.currentUser.uid;
  }

  return headers;
}

export const NANNY_FREE_APPLICATION_LIMIT = 5;
export const FAMILY_FREE_ACTIVE_REQUEST_LIMIT = 1;

const FREE_AGENCY_JOB_LIMIT_ERROR = 'Free agencies can create a profile and receive family requests, but job posting starts on the Starter plan.';

const getTimestampMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

// --- Types ---
export type AppUserRole = 'nanny' | 'family' | 'agency' | 'agency_admin' | 'agency_recruiter' | 'superadmin';

type PushRole = 'nanny' | 'family' | 'agency' | 'agency_admin' | 'agency_recruiter';

export type AppUserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  email: string;
  role: AppUserRole;
  agency_id?: string | null;
  agency_profile_id?: string | null;
  status?: AppUserStatus;
  created_at: any;
  updated_at?: any;
}

export async function registerPushTokenForCurrentUser(options: {
  role: PushRole;
  userId: string;
  token: string;
  deviceName?: string;
  os?: string;
  appVersion?: string;
}): Promise<boolean> {
  const token = String(options.token || '').trim();
  if (!token || !options.userId) return false;

  let path = '';
  const extraHeaders: Record<string, string> = {};

  if (options.role === 'nanny') {
    path = '/api/nanny/fcm-token';
  } else if (options.role === 'family') {
    path = '/api/family/fcm-token';
  } else {
    const agencyId = await resolveAgencyIdForUser(options.userId);
    if (!agencyId) {
      console.warn('[push] skipping agency token registration: no agencyId resolved');
      return false;
    }
    path = '/api/agency/fcm-token';
    extraHeaders['x-agency-id'] = agencyId;
  }

  const headers = await buildApiHeaders(extraHeaders);
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fcm_token: token,
      device_name: options.deviceName || 'Web Browser',
      os: options.os || 'Web',
      app_version: options.appVersion || 'web',
    }),
  });

  return response.ok;
}

export async function deactivatePushTokensForCurrentUser(options: {
  role: PushRole;
  userId: string;
}): Promise<boolean> {
  if (!options.userId) return false;

  let path = '';
  const extraHeaders: Record<string, string> = {};

  if (options.role === 'nanny') {
    path = '/api/nanny/fcm-tokens/logout';
  } else if (options.role === 'family') {
    path = '/api/family/fcm-tokens/logout';
  } else {
    const agencyId = await resolveAgencyIdForUser(options.userId);
    if (!agencyId) {
      console.warn('[push] skipping agency token deactivation: no agencyId resolved');
      return false;
    }
    path = '/api/agency/fcm-tokens/logout';
    extraHeaders['x-agency-id'] = agencyId;
  }

  const headers = await buildApiHeaders(extraHeaders);
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers,
  });

  return response.ok;
}

export interface Job {
  id: string;
  agency_id: string;
  family_id?: string | null;
  source_inquiry_id?: string | null;
  linked_from_inquiry?: boolean;
  title: string;
  description: string;
  location_borough: string;
  location_neighborhood: string;
  salary_range: string;
  schedule_type: string;
  status: 'published' | 'draft' | 'closed';
  selected_nanny_id?: string | null;
  selected_application_id?: string | null;
  assigned_at?: any;
  assigned_by_role?: 'agency' | 'family' | 'nanny' | 'admin' | 'system';
  closed_reason?: string | null;
  created_at: any;
  updated_at: any;
  agency_profiles?: any;
}

export type ApplicationStatus =
  | 'applied'
  | 'reviewing'
  | 'interviewing'
  | 'interview_invited'
  | 'accepted'
  | 'hired'
  | 'active'
  | 'pending_family_approval'
  | 'completed'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationStatusHistoryEntry {
  status: ApplicationStatus;
  at?: any;
  actor_role?: 'agency' | 'family' | 'nanny' | 'admin' | 'system';
  note?: string;
}

export interface Application {
  id: string;
  job_id: string;
  nanny_id: string;
  agency_id: string;
  family_id?: string | null;
  status: ApplicationStatus;
  cover_letter: string;
  call_status?: 'pending_nanny' | 'confirmed' | 'declined' | null;
  call_scheduled_for?: string | null;
  call_timezone?: string | null;
  call_note?: string | null;
  call_proposed_by?: 'agency' | 'nanny' | null;
  call_proposed_at?: any;
  call_confirmed_at?: any;
  call_declined_at?: any;
  call_outcome?: 'happened' | 'no_show' | 'cancelled' | null;
  call_outcome_notes?: string | null;
  call_outcome_at?: any;
  status_history?: ApplicationStatusHistoryEntry[];
  reviewed_at?: any;
  interview_invited_at?: any;
  accepted_at?: any;
  active_at?: any;
  care_started_at?: any;
  care_expected_end_at?: any;
  care_actual_end_at?: any;
  care_extended_to?: any;
  care_override_status?: 'cancelled' | 'ended_early' | null;
  care_override_reason?: string | null;
  care_milestones_notified?: Record<string, boolean>;
  pending_family_approval_at?: any;
  completed_at?: any;
  rejected_at?: any;
  withdrawn_at?: any;
  created_at: any;
  updated_at: any;
  jobs?: Job | null;
  nanny_profiles?: any;
}

export interface NannyProfile {
  id: string;
  first_name: string;
  last_name: string;
  cvid?: string;
  approved_certifications?: string[];
  agency_id?: string | null;
  premium_until?: string | null;
  status: string;
  availability?: Record<string, string[]>;
  phone_number?: string;
  bio?: string;
  years_experience?: number;
  certifications?: string[];
  location_borough?: string;
  expected_pay_min?: number;
  expected_pay_max?: number;
  preferred_job_types?: string[];
  created_at: any;
  updated_at?: any;
}

export interface NannyDocument {
  id?: string;
  nanny_id: string;
  uploader_user_id: string;
  type: 'cv' | 'certification' | 'id' | 'reference' | 'other';
  certification_name?: string | null;
  file_name: string;
  file_url: string;
  status: 'uploaded' | 'under_review' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: any;
  reference_shared_with_agencies?: boolean;
  shared_with_agency_ids?: string[];
  created_at?: any;
  updated_at?: any;
}

export interface NannyReferenceShareTarget {
  agency_id: string;
  agency_name: string;
}

export interface NannyCreditWallet {
  nanny_id: string;
  balance_credits: number;
  lifetime_used_credits: number;
  last_credit_refresh_at?: any;
  created_at?: any;
  updated_at?: any;
}

export interface NannyDevelopmentSession {
  id?: string;
  nanny_id: string;
  prompt: string;
  response: string;
  credits_used: number;
  created_at?: any;
}

export interface NannyPremiumAnalytics {
  is_premium: boolean;
  premium_until?: string | null;
  total_applications: number;
  active_pipeline_count: number;
  completed_placements: number;
  acceptance_rate_pct: number;
  completion_rate_pct: number;
  avg_family_rating: number;
  avg_agency_rating: number;
  application_velocity_30d: number;
  completion_velocity_30d: number;
  strengths: string[];
  opportunities: string[];
}

export interface NannyBgCheck {
  id?: string;
  nanny_id: string;
  source_agency_id: string;
  source_user_id: string;
  status: 'checked' | 'not_checked' | 'expired';
  checked_at?: any;
  expires_at?: any;
  confidence: number;
  doc_url_private?: string | null;
  source_hidden: boolean;
  created_at?: any;
  updated_at?: any;
}

export interface NannyBgPublicStatus {
  nanny_id: string;
  status: 'checked' | 'not_checked' | 'expired';
  last_checked_at?: any;
  expires_at?: any;
  confidence: number;
  source_hidden: boolean;
  override_active?: boolean;
  override_reason?: string | null;
  override_by_admin_id?: string | null;
  override_at?: any;
  updated_at?: any;
}

export interface NannyBgCheckAuditLog {
  id?: string;
  nanny_id: string;
  source_agency_id?: string | null;
  actor_user_id: string;
  action: 'created' | 'updated' | 'override_set' | 'override_cleared';
  previous_status?: string | null;
  new_status: string;
  previous_expires_at?: any;
  new_expires_at?: any;
  previous_confidence?: number | null;
  new_confidence: number;
  source_hidden: boolean;
  override_reason?: string | null;
  risk_flags?: string[];
  created_at?: any;
  nanny_name?: string;
  nanny_email?: string;
  agency_name?: string;
  actor_email?: string;
}

export interface AdminBgPublicStatusRow extends NannyBgPublicStatus {
  nanny_name?: string;
  nanny_email?: string;
}

export interface ShiftScoreResult {
  score: number;
  details: {
    completedFields: number;
    totalFields: number;
    documentBonus: number;
    verifiedDocumentCount: number;
    activityBonus: number;
    profileScore: number;
    reviewScore: number;
    reviewCount: number;
    averageReliability: number;
    averageCommunication: number;
    punctualityRate: number;
    rehireRate: number;
    growthBonus?: number;
    growthPointsEarned?: number;
    growthPointsAvailable?: number;
    growthWeekKey?: string;
  };
}

export interface NannyGrowthProgress {
  weekKey: string;
  isPremium: boolean;
  applicationsThisWeek: number;
  completedTaskIds: string[];
  autoCompletedTaskIds: string[];
  manualCompletedTaskIds: string[];
  premiumTaskId: string;
  quiz: {
    courseId?: string;
    selectedAnswer?: number;
    passed?: boolean;
    submitted_at?: any;
  } | null;
  points: {
    earned: number;
    available: number;
    progressPct: number;
  };
  officialShiftScore: number;
  officialShiftScoreDetails?: ShiftScoreResult['details'];
}

export interface JobCompatibilityResult {
  score: number;
  tier: 'excellent' | 'good' | 'fair' | 'low';
  reasons: string[];
}

export const computeShiftScore = (
  profile: Partial<NannyProfile> | null,
  applicationCount = 0,
  verifiedDocumentCount = 0,
  reviewAggregate: NannyReviewAggregate = EMPTY_NANNY_REVIEW_AGGREGATE,
  shiftScoreConfig?: ShiftScoreConfigOverrides
): ShiftScoreResult => {
  const config = resolveShiftScoreConfig(shiftScoreConfig);

  const fields = [
    !!profile?.first_name,
    !!profile?.last_name,
    !!profile?.phone_number,
    !!profile?.bio,
    !!profile?.location_borough,
    !!profile?.years_experience,
    !!profile?.certifications?.length,
    !!profile?.availability && Object.keys(profile.availability).length > 0,
    !!profile?.expected_pay_min,
    !!profile?.expected_pay_max,
  ];

  const completedFields = fields.filter(Boolean).length;
  const totalFields = fields.length;
  const documentBonus = Math.min(
    config.profileWeights.documentBonusCap,
    verifiedDocumentCount * config.profileWeights.documentBonusPerVerifiedDoc
  );
  const activityBonus = Math.min(
    config.profileWeights.activityBonusCap,
    applicationCount * config.profileWeights.activityBonusPerApplication
  );

  const profileScore = computeProfileSignalScore(
    completedFields,
    totalFields,
    profile?.years_experience ?? 0,
    profile?.certifications?.length ?? 0,
    verifiedDocumentCount,
    applicationCount,
    config.profileWeights
  );
  const reviewScore = reviewAggregate.reviewCount > 0 ? reviewAggregate.shiftScore : 0;
  const score = combineShiftScoreSignals(
    profileScore,
    reviewScore,
    reviewAggregate.reviewCount > 0,
    config.blendWeights
  );

  return {
    score,
    details: {
      completedFields,
      totalFields,
      documentBonus,
      verifiedDocumentCount,
      activityBonus,
      profileScore,
      reviewScore,
      reviewCount: reviewAggregate.reviewCount,
      averageReliability: reviewAggregate.averageReliability,
      averageCommunication: reviewAggregate.averageCommunication,
      punctualityRate: reviewAggregate.punctualityRate,
      rehireRate: reviewAggregate.rehireRate,
    }
  };
};

export const computeNannyJobCompatibility = (
  job: Partial<Job> | null,
  nanny: Partial<NannyProfile> | null,
  reviewAvg = 0,
  reviewCount = 0
): JobCompatibilityResult => {
  if (!job || !nanny) {
    return { score: 0, tier: 'low', reasons: ['Missing job or nanny data'] };
  }

  let points = 0;
  const reasons: string[] = [];

  const requiredExp = Number((job as any).required_experience_years || 0);
  const nannyExp = Number(nanny.years_experience || 0);
  if (requiredExp <= 0 || nannyExp >= requiredExp) {
    points += 30;
    reasons.push('Experience level matches');
  } else {
    const ratio = Math.max(0, Math.min(1, nannyExp / requiredExp));
    points += Math.round(30 * ratio);
    reasons.push(`Experience: ${nannyExp}y vs required ${requiredExp}y`);
  }

  if (job.location_borough && nanny.location_borough) {
    if (job.location_borough === nanny.location_borough) {
      points += 20;
      reasons.push('Same borough');
    } else {
      points += 5;
      reasons.push('Different borough');
    }
  }

  const minPay = Number((job as any).pay_min || 0);
  const maxPay = Number((job as any).pay_max || 0);
  const expectedMin = Number(nanny.expected_pay_min || 0);
  const expectedMax = Number(nanny.expected_pay_max || 0);
  if (minPay > 0 || maxPay > 0) {
    const overlaps = (!expectedMin || maxPay >= expectedMin) && (!expectedMax || minPay <= expectedMax || maxPay <= expectedMax);
    if (overlaps) {
      points += 20;
      reasons.push('Pay range overlaps');
    } else {
      points += 6;
      reasons.push('Pay range may be below expectations');
    }
  }

  const certCount = Array.isArray(nanny.certifications) ? nanny.certifications.length : 0;
  if (certCount >= 2) {
    points += 10;
    reasons.push('Multiple certifications');
  } else if (certCount === 1) {
    points += 6;
    reasons.push('Has certification');
  }

  const ratingScore = reviewCount > 0 ? Math.round((Math.max(0, Math.min(5, reviewAvg)) / 5) * 20) : 10;
  points += ratingScore;
  if (reviewCount > 0) {
    reasons.push(`${reviewAvg.toFixed(1)} avg review (${reviewCount})`);
  } else {
    reasons.push('No reviews yet');
  }

  const score = Math.max(0, Math.min(100, points));
  const tier: JobCompatibilityResult['tier'] =
    score >= 85 ? 'excellent' :
    score >= 70 ? 'good' :
    score >= 50 ? 'fair' : 'low';

  return { score, tier, reasons };
};

export interface AgencyProfile {
  id: string;
  company_name: string;
  contact_name: string;
  website?: string;
  cover?: string;
  logo?: string;
  boroughs?: string[];
  specialties?: string[];
  established?: string;
  response_rate?: number;
  score?: number;
  isVerified?: boolean;
  sponsored?: boolean;
  /** Denormalized from agency_subscriptions for fast directory display */
  plan_tier?: 'free' | 'starter' | 'professional' | 'enterprise';
  location?: string;
  bio?: string;
  created_at: any;
  updated_at?: any;
  users?: any;
}

export interface AgencyPost {
  id?: string;
  agency_id: string;
  title: string;
  content: string;
  created_at?: any;
  updated_at?: any;
}

export interface AdminVerificationOverview {
  total_documents: number;
  pending_documents: number;
  approved_documents: number;
  rejected_documents: number;
  approval_rate_pct: number;
  avg_review_time_hours: number;
  pending_over_72h: number;
}

export type VerificationRange = '7d' | '30d' | 'all';

export interface AdminVerificationQueueItem extends NannyDocument {
  age_hours: number;
  sla_breached: boolean;
  nanny_name?: string;
  nanny_email?: string;
}

export interface AdminVerificationTypeBreakdownItem {
  type: NannyDocument['type'];
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approval_rate_pct: number;
}

export interface AdminVerificationAnalytics {
  range: VerificationRange;
  current: AdminVerificationOverview;
  previous: AdminVerificationOverview | null;
  deltas: {
    total_documents: number;
    pending_documents: number;
    approved_documents: number;
    rejected_documents: number;
    approval_rate_pct: number;
    avg_review_time_hours: number;
    pending_over_72h: number;
  };
  type_breakdown: AdminVerificationTypeBreakdownItem[];
  queue: AdminVerificationQueueItem[];
}

export interface FamilyProfile {
  id: string;
  name?: string;
  family_name: string;
  family_id?: string;
  email: string;
  phone?: string;
  location_borough?: string;
  location_neighborhood?: string;
  bio?: string;
  children?: Array<{ name: string; age: number; allergies?: string[]; special_needs?: string }>;
  care_needs?: string;
  schedule?: string;
  live_in?: boolean;
  languages?: string[];
  special_skills?: string[];
  driver_requirement?: boolean;
  pet_friendly?: boolean;
  parenting_style?: string;
  dietary_preferences?: string;
  cultural_values?: string;
  additional_notes?: string;
  onboarding_complete?: boolean;
  created_at: any;
  updated_at?: any;
}

export interface CareHistory {
  id?: string;
  family_id: string;
  job_id: string;
  agency_id: string;
  nanny_id: string;
  family_application_id?: string;
  agency_application_id?: string;
  source_inquiry_id?: string;
  job_title?: string;
  job_type?: string;
  location_borough?: string;
  location_neighborhood?: string;
  agency_name?: string;
  nanny_name?: string;
  placement_status?: 'active' | 'completed';
  start_date?: string;
  end_date?: string;
  week_one_review_available_at?: string;
  summary?: string;
  reviewed_agency_by_family?: boolean;
  reviewed_nanny_by_family?: boolean;
  reviewed_agency_week_one_by_family?: boolean;
  reviewed_nanny_week_one_by_family?: boolean;
  reviewed_agency_completion_by_family?: boolean;
  reviewed_nanny_completion_by_family?: boolean;
  rating?: number;
  review?: string;
  created_at?: any;
  updated_at?: any;
}

// --- Error Handling ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  databaseId?: string;
  projectId?: string;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const runtimeDbId = ((db as any)?._databaseId?.database || (db as any)?._databaseId || 'unknown') as string;
  const runtimeProjectId = (db as any)?.app?.options?.projectId || 'unknown';
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path,
    databaseId: runtimeDbId,
    projectId: runtimeProjectId
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Do not throw here so that API utility callers can return fallback values and UI continues to render.
  return errInfo;
}

// --- JOBS ---
export const getJobs = async (agencyId?: string): Promise<Job[]> => {
  const path = 'jobs';
  try {
    let q = query(collection(db, path), orderBy('created_at', 'desc'));
    if (agencyId) {
      q = query(collection(db, path), where('agency_id', '==', agencyId), orderBy('created_at', 'desc'));
    } else {
      q = query(collection(db, path), where('status', '==', 'published'), orderBy('created_at', 'desc'));
    }

    const snapshot = await getDocs(q);
    const jobsWithAgency = await Promise.all(snapshot.docs.map(async (d) => {
      const jobData = d.data();
      const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
      return {
        id: d.id,
        ...jobData,
        agency_profiles: agencyDoc.exists() ? agencyDoc.data() : { company_name: 'Agency' }
      } as Job;
    }));
    return jobsWithAgency;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getJobById = async (id: string): Promise<Job | null> => {
  const path = `jobs/${id}`;
  try {
    const jobDoc = await getDoc(doc(db, 'jobs', id));
    if (!jobDoc.exists()) return null;
    const jobData = jobDoc.data();
    const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
    return { 
      id: jobDoc.id, 
      ...jobData, 
      agency_profiles: agencyDoc.exists() ? agencyDoc.data() : { company_name: 'Agency' }
    } as Job;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const createJob = async (jobData: any) => {
  const path = 'jobs';
  try {
    if (jobData?.agency_id) {
      try {
        const headers = await buildApiHeaders({ 'x-agency-id': String(jobData.agency_id) });
        const response = await fetch(buildApiUrl('/api/agency/jobs'), {
          method: 'POST',
          headers,
          body: JSON.stringify(jobData),
        });

        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          return payload;
        }

        if (response.status === 404 || response.status >= 500) {
          console.warn('[createJob] backend endpoint unavailable, falling back to client write');
        } else {
          throw new Error(payload?.error || 'Unable to create job.');
        }
      } catch (backendError: any) {
        const msg = String(backendError?.message || '');
        const isNetworkFailure = backendError instanceof TypeError || /failed to fetch|network/i.test(msg);
        if (!isNetworkFailure && msg) {
          throw backendError;
        }
      }
    }

    const shouldCountAgainstLimit = (jobData?.status || 'published') === 'published';
    if (shouldCountAgainstLimit && jobData?.agency_id) {
      const entitlements = await getAgencyEntitlementsForAgency(jobData.agency_id);
      const currentCount = await getActiveJobCount(jobData.agency_id);

      if (!entitlements.canCreateJobPosting(currentCount)) {
        throw new Error(
          entitlements.plan_code === PLAN_CODES.FREE
            ? FREE_AGENCY_JOB_LIMIT_ERROR
            : `Your ${entitlements.plan.name} plan allows ${entitlements.activeJobLimit} active job posting${entitlements.activeJobLimit === 1 ? '' : 's'}. Upgrade to publish more jobs.`
        );
      }
    }

    const docRef = await addDoc(collection(db, path), {
      ...jobData,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const ensureFamilyApplicationForInquiryJob = async (
  familyId: string,
  jobId: string,
  agencyId: string,
  sourceInquiryId?: string
) => {
  const path = 'family_applications';
  try {
    const existing = query(
      collection(db, path),
      where('family_id', '==', familyId),
      where('job_id', '==', jobId)
    );
    const existingSnap = await getDocs(existing);
    if (!existingSnap.empty) {
      return { id: existingSnap.docs[0].id };
    }

    const docRef = await addDoc(collection(db, path), {
      family_id: familyId,
      job_id: jobId,
      agency_id: agencyId,
      status: 'reviewing',
      source_inquiry_id: sourceInquiryId || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const getConversationById = async (conversationId: string): Promise<any | null> => {
  const path = `conversations/${conversationId}`;
  try {
    const convoDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!convoDoc.exists()) return null;
    return { id: convoDoc.id, ...convoDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const linkInquiryConversationToJob = async (conversationId: string, jobId: string) => {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      linked_job_id: jobId,
      inquiry_stage: 'done',
      updated_at: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const updateJob = async (id: string, updates: any) => {
  const path = `jobs/${id}`;
  try {
    const docRef = doc(db, 'jobs', id);
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : null;
    const nextStatus = updates?.status || existingData?.status || 'draft';
    const agencyId = updates?.agency_id || existingData?.agency_id;

    if (agencyId && nextStatus === 'published' && existingData?.status !== 'published') {
      const entitlements = await getAgencyEntitlementsForAgency(agencyId);
      const currentCount = await getActiveJobCount(agencyId);

      if (!entitlements.canCreateJobPosting(currentCount)) {
        throw new Error(
          entitlements.plan_code === PLAN_CODES.FREE
            ? FREE_AGENCY_JOB_LIMIT_ERROR
            : `Your ${entitlements.plan.name} plan allows ${entitlements.activeJobLimit} active job posting${entitlements.activeJobLimit === 1 ? '' : 's'}. Upgrade to publish more jobs.`
        );
      }
    }

    await updateDoc(docRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const deleteJob = async (id: string) => {
  const path = `jobs/${id}`;
  try {
    await deleteDoc(doc(db, 'jobs', id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// --- APPLICATIONS ---
export const getApplicationsForAgency = async (agencyId: string): Promise<Application[]> => {
  const path = 'applications';
  try {
    // In Firestore, we can't easily do a join filter in one query like Supabase's !inner
    // We'll fetch all applications and filter in memory or fetch jobs first.
    // Given the scale, fetching all applications for an agency's jobs is better.
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
    const snapshot = await getDocs(q);
    const apps = await Promise.all(snapshot.docs.map(async (d) => {
      const appData = d.data();
      const jobDoc = await getDoc(doc(db, 'jobs', appData.job_id));
      const nannyDoc = await getDoc(doc(db, 'nanny_profiles', appData.nanny_id));
      const agencyDoc = jobDoc.exists() ? await getDoc(doc(db, 'agency_profiles', jobDoc.data().agency_id)) : null;
      return {
        id: d.id,
        ...appData,
        jobs: jobDoc.exists() ? {
          id: jobDoc.id,
          ...jobDoc.data(),
          agency_profiles: agencyDoc?.exists() ? agencyDoc.data() : { company_name: 'Agency' }
        } as Job : null,
        nanny_profiles: nannyDoc.exists() ? nannyDoc.data() : null
      } as Application;
    }));
    return apps;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getApplicationsForNanny = async (nannyId: string): Promise<Application[]> => {
  const path = 'applications';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId));
    const snapshot = await getDocs(q);
    const apps = await Promise.all(snapshot.docs.map(async (d) => {
      const appData = d.data();
      const jobDoc = await getDoc(doc(db, 'jobs', appData.job_id));
      const agencyDoc = jobDoc.exists() ? await getDoc(doc(db, 'agency_profiles', jobDoc.data().agency_id)) : null;
      return {
        id: d.id,
        ...appData,
        jobs: jobDoc.exists() ? {
          id: jobDoc.id,
          ...jobDoc.data(),
          agency_profiles: agencyDoc?.exists() ? agencyDoc.data() : { company_name: 'Agency' }
        } as Job : null
      } as Application;
    }));
    return apps;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const createApplication = async (jobId: string, nannyId: string, coverLetter?: string) => {
  const path = 'applications';
  try {
    if (nannyId) {
      try {
        const headers = await buildApiHeaders();
        const response = await fetch(buildApiUrl('/api/nanny/applications'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ jobId, nannyId, coverLetter: coverLetter || '' }),
        });

        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          return payload;
        }

        if (response.status === 404 || response.status >= 500) {
          console.warn('[createApplication] backend endpoint unavailable, falling back to client write');
        } else {
          throw new Error(payload?.error || 'Unable to submit application.');
        }
      } catch (backendError: any) {
        const msg = String(backendError?.message || '');
        const isNetworkFailure = backendError instanceof TypeError || /failed to fetch|network/i.test(msg);
        if (!isNetworkFailure && msg) {
          throw backendError;
        }
      }
    }

    const applicationQuota = await getNannyApplicationQuota(nannyId);
    if (applicationQuota.monthlyLimit !== null && applicationQuota.used >= applicationQuota.monthlyLimit) {
      throw new Error(`You have used all ${applicationQuota.monthlyLimit} free applications for the last 30 days. Upgrade to premium to apply without limits.`);
    }

    const duplicateQuery = query(
      collection(db, path),
      where('nanny_id', '==', nannyId),
      where('job_id', '==', jobId)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);
    if (!duplicateSnapshot.empty) {
      throw new Error('You already applied to this job.');
    }

    // Need agency_id for filtering in getApplicationsForAgency
    const jobDoc = await getDoc(doc(db, 'jobs', jobId));
    const agencyId = jobDoc.exists() ? jobDoc.data().agency_id : null;
    const familyId = jobDoc.exists() ? (jobDoc.data().family_id || null) : null;

    const docRef = await addDoc(collection(db, path), {
      job_id: jobId,
      nanny_id: nannyId,
      agency_id: agencyId,
      family_id: familyId,
      cover_letter: coverLetter || '',
      status: 'applied',
      status_history: [{ status: 'applied', actor_role: 'nanny', at: Timestamp.now() }],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const updateApplicationStatus = async (
  id: string,
  status: ApplicationStatus,
  options?: {
    actorRole?: ApplicationStatusHistoryEntry['actor_role'];
    note?: string;
  }
) => {
  const path = `applications/${id}`;
  try {
    const docRef = doc(db, 'applications', id);
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};
    let derivedFamilyId = existingData.family_id || null;
    if (!derivedFamilyId && existingData.job_id) {
      try {
        const jobDoc = await getDoc(doc(db, 'jobs', existingData.job_id));
        if (jobDoc.exists()) {
          derivedFamilyId = (jobDoc.data() as any).family_id || null;
        }
      } catch {
        // Preserve existing status behavior if the job lookup fails.
      }
    }
    const existingHistory = Array.isArray(existingData.status_history)
      ? existingData.status_history
      : [];
    const historyEntry: ApplicationStatusHistoryEntry = {
      status,
      actor_role: options?.actorRole || 'system',
      ...(options?.note !== undefined ? { note: options.note } : {}),
      at: Timestamp.now()
    };
    const milestoneFieldByStatus: Partial<Record<ApplicationStatus, string>> = {
      reviewing: 'reviewed_at',
      interviewing: 'interview_invited_at',
      interview_invited: 'interview_invited_at',
      hired: 'accepted_at',
      accepted: 'accepted_at',
      active: 'active_at',
      pending_family_approval: 'pending_family_approval_at',
      completed: 'completed_at',
      rejected: 'rejected_at',
      withdrawn: 'withdrawn_at'
    };
    const milestoneField = milestoneFieldByStatus[status];

    await updateDoc(docRef, {
      status,
      ...(derivedFamilyId ? { family_id: derivedFamilyId } : {}),
      ...(milestoneField ? { [milestoneField]: serverTimestamp() } : {}),
      status_history: [...existingHistory, historyEntry],
      updated_at: serverTimestamp()
    });

    if (existingData.job_id && (status === 'active' || status === 'completed')) {
      try {
        await updateJob(existingData.job_id, {
          status: 'closed',
          closed_reason: 'filled',
        });
      } catch {
        // Job closure is helpful but non-blocking.
      }
    }

    if (status === 'active' || status === 'completed') {
      await recordCareHistoryFromApplication(id, status === 'completed' ? 'completed' : 'active');
    }

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const assignNannyToJob = async (
  applicationId: string,
  options?: {
    actorRole?: ApplicationStatusHistoryEntry['actor_role'];
    assignedStatus?: Extract<ApplicationStatus, 'accepted' | 'hired'>;
    note?: string;
  }
) => {
  const path = `applications/${applicationId}`;
  try {
    const appRef = doc(db, 'applications', applicationId);
    const appDoc = await getDoc(appRef);
    if (!appDoc.exists()) {
      throw new Error('Application not found.');
    }

    const appData = appDoc.data() as Application;
    if (!appData.job_id || !appData.nanny_id) {
      throw new Error('Application is missing a job or nanny reference.');
    }

    const actorRole = options?.actorRole || 'agency';
    const assignedStatus = options?.assignedStatus || 'accepted';
    const assignmentNote = options?.note || 'Agency assigned this nanny to the job.';

    let familyId = appData.family_id || null;
    const jobRef = doc(db, 'jobs', appData.job_id);
    const jobDoc = await getDoc(jobRef);
    if (jobDoc.exists()) {
      familyId = familyId || (jobDoc.data() as any).family_id || null;
    }

    await updateApplicationStatus(applicationId, assignedStatus, {
      actorRole,
      note: assignmentNote,
    });

    await updateDoc(jobRef, {
      selected_nanny_id: appData.nanny_id,
      selected_application_id: applicationId,
      assigned_at: serverTimestamp(),
      assigned_by_role: actorRole,
      ...(familyId ? { family_id: familyId } : {}),
      status: 'closed',
      closed_reason: 'filled',
      updated_at: serverTimestamp(),
    });

    const siblingQuery = query(collection(db, 'applications'), where('job_id', '==', appData.job_id));
    const siblingSnapshot = await getDocs(siblingQuery);
    await Promise.all(siblingSnapshot.docs.map(async (siblingDoc) => {
      if (siblingDoc.id === applicationId) return;

      const siblingData = siblingDoc.data() as Application;
      if (['rejected', 'withdrawn', 'completed'].includes(String(siblingData.status || ''))) {
        return;
      }

      const siblingHistory = Array.isArray(siblingData.status_history) ? siblingData.status_history : [];
      const rejectionEntry: ApplicationStatusHistoryEntry = {
        status: 'rejected',
        actor_role: actorRole,
        note: 'Another nanny was assigned to this job.',
        at: Timestamp.now(),
      };

      await updateDoc(siblingDoc.ref, {
        status: 'rejected',
        ...(familyId ? { family_id: familyId } : {}),
        rejected_at: serverTimestamp(),
        status_history: [...siblingHistory, rejectionEntry],
        updated_at: serverTimestamp(),
      });
    }));

    const updatedDoc = await getDoc(appRef);
    return updatedDoc.exists() ? ({ id: updatedDoc.id, ...updatedDoc.data() } as Application) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const updateApplicationCareSession = async (
  id: string,
  updates: Record<string, any>
) => {
  const path = `applications/${id}`;
  try {
    const docRef = doc(db, 'applications', id);
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(docRef, {
      ...cleanedUpdates,
      updated_at: serverTimestamp(),
    });
    const updatedDoc = await getDoc(docRef);
    return updatedDoc.exists() ? ({ id: updatedDoc.id, ...updatedDoc.data() } as Application) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

export const notifyApplicationCareMilestone = async ({
  applicationId,
  milestone,
  familyTitle,
  familyMessage,
  nannyTitle,
  nannyMessage,
}: {
  applicationId: string;
  milestone: 'started' | 'halfway' | 'ending_soon' | 'review_requested';
  familyTitle?: string;
  familyMessage?: string;
  nannyTitle?: string;
  nannyMessage?: string;
}) => {
  const path = `applications/${applicationId}`;
  try {
    const appRef = doc(db, 'applications', applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) return false;

    const app = appSnap.data() as Application;
    const alreadyNotified = !!app.care_milestones_notified?.[milestone];
    if (alreadyNotified) return false;

    const jobDoc = app.job_id ? await getDoc(doc(db, 'jobs', app.job_id)) : null;
    const jobTitle = jobDoc?.exists() ? String((jobDoc.data() as any).title || 'the placement') : 'the placement';
    const familyId = app.family_id || (jobDoc?.exists() ? (jobDoc.data() as any).family_id : null);

    if (familyId && familyTitle && familyMessage) {
      await addFamilyNotification(familyId, familyTitle, familyMessage.replace('{jobTitle}', jobTitle), '/family/applications');
    }
    if (app.nanny_id && nannyTitle && nannyMessage) {
      await addNannyNotification(app.nanny_id, nannyTitle, nannyMessage.replace('{jobTitle}', jobTitle), '/nanny/applications');
    }

    await updateDoc(appRef, {
      [`care_milestones_notified.${milestone}`]: true,
      updated_at: serverTimestamp(),
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

async function createInterviewCalendarEvent(input: {
  nannyId: string;
  familyId?: string | null;
  scheduledFor: string;
  timezone?: string;
  jobTitle?: string;
  note?: string;
}): Promise<string | null> {
  const startAt = new Date(input.scheduledFor);
  if (Number.isNaN(startAt.getTime())) return null;

  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/scheduling/interview'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nannyId: input.nannyId,
      familyId: input.familyId || undefined,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      timezone: input.timezone || 'America/New_York',
      title: input.jobTitle ? `Interview: ${input.jobTitle}` : 'Interview Call',
      notesVisible: input.note?.trim() || 'Application intro call',
      locationGeneral: 'Phone/Video Call',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to create interview event');
  }

  return typeof payload?.primaryId === 'string' && payload.primaryId
    ? payload.primaryId
    : null;
}

export const scheduleApplicationCall = async ({
  applicationId,
  nannyId,
  agencyId,
  agencyName,
  jobTitle,
  scheduledFor,
  timezone,
  note
}: {
  applicationId: string;
  nannyId?: string;
  agencyId: string;
  agencyName?: string;
  jobTitle?: string;
  scheduledFor: string;
  timezone?: string;
  note?: string;
}) => {
  const path = `applications/${applicationId}`;
  try {
    const docRef = doc(db, 'applications', applicationId);
    const appSnap = await getDoc(docRef);
    const appData = appSnap.exists() ? (appSnap.data() as any) : null;
    const resolvedNannyId = nannyId || appData?.nanny_id || appData?.nannyId || null;

    await updateDoc(docRef, {
      status: 'interview_invited',
      call_status: 'pending_nanny',
      call_scheduled_for: scheduledFor,
      call_timezone: timezone || 'America/New_York',
      call_note: note?.trim() || '',
      call_proposed_by: 'agency',
      call_proposed_at: serverTimestamp(),
      call_confirmed_at: null,
      call_declined_at: null,
      updated_at: serverTimestamp()
    });

    if (resolvedNannyId) {
      try {
        const eventId = await createInterviewCalendarEvent({
          nannyId: resolvedNannyId,
          familyId: appData?.family_id || null,
          scheduledFor,
          timezone,
          jobTitle,
          note,
        });

        if (eventId) {
          await updateDoc(docRef, {
            call_calendar_event_id: eventId,
            updated_at: serverTimestamp(),
          });
        }
      } catch (calendarError) {
        console.warn('[scheduleApplicationCall] Calendar event creation failed:', calendarError);
      }
    }

    if (resolvedNannyId) {
      await addNannyNotification(
        resolvedNannyId,
        'Call proposed',
        `${agencyName || 'An agency'} proposed a call for ${new Date(scheduledFor).toLocaleString()}.`,
        '/nanny/applications'
      );
    }

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const respondToApplicationCall = async ({
  applicationId,
  response,
  agencyId,
  nannyName,
  jobTitle,
  scheduledFor
}: {
  applicationId: string;
  response: 'confirmed' | 'declined';
  agencyId: string;
  nannyName?: string;
  jobTitle?: string;
  scheduledFor?: string | null;
}) => {
  const path = `applications/${applicationId}`;
  try {
    const docRef = doc(db, 'applications', applicationId);
    await updateDoc(docRef, {
      call_status: response,
      call_confirmed_at: response === 'confirmed' ? serverTimestamp() : null,
      call_declined_at: response === 'declined' ? serverTimestamp() : null,
      updated_at: serverTimestamp()
    });

    await addAgencyNotification(
      agencyId,
      response === 'confirmed' ? 'Call confirmed' : 'Call declined',
      response === 'confirmed'
        ? `${nannyName || 'The nanny'} confirmed the scheduled call${scheduledFor ? ` for ${new Date(scheduledFor).toLocaleString()}` : ''}.`
        : `${nannyName || 'The nanny'} declined the proposed call${jobTitle ? ` for ${jobTitle}` : ''}.`,
      '/agency/applications'
    );

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

export const updateApplicationCallOutcome = async ({
  applicationId,
  outcome,
  notes,
}: {
  applicationId: string;
  outcome: 'happened' | 'no_show' | 'cancelled';
  notes?: string;
}) => {
  const path = `applications/${applicationId}`;
  try {
    const docRef = doc(db, 'applications', applicationId);
    await updateDoc(docRef, {
      call_outcome: outcome,
      call_outcome_notes: notes?.trim() || null,
      call_outcome_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const updatedDoc = await getDoc(docRef);
    return updatedDoc.exists() ? ({ id: updatedDoc.id, ...updatedDoc.data() } as Application) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

// --- NANNIES ---
export const getNannies = async (): Promise<NannyProfile[]> => {
  const path = 'nanny_profiles';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as NannyProfile))
      .sort((a, b) => Number((b as any).shift_score || 0) - Number((a as any).shift_score || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyById = async (id: string): Promise<NannyProfile | null> => {
  const path = `nanny_profiles/${id}`;
  try {
    const nannyDoc = await getDoc(doc(db, 'nanny_profiles', id));
    if (!nannyDoc.exists()) return null;
    return { id: nannyDoc.id, ...nannyDoc.data() } as NannyProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateNannyProfile = async (id: string, updates: any) => {
  const path = `nanny_profiles/${id}`;
  try {
    const docRef = doc(db, 'nanny_profiles', id);
    await setDoc(docRef, { ...updates, updated_at: serverTimestamp() }, { merge: true });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getNannyDocuments = async (nannyId: string): Promise<NannyDocument[]> => {
  const path = 'nanny_documents';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyDocument));
    // Sort by created_at descending
    return docs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyReferenceShareTargets = async (nannyId: string): Promise<NannyReferenceShareTarget[]> => {
  const path = 'agency_talent_pool';
  try {
    if (!nannyId) return [];

    const targetIds = new Set<string>();

    const [talentPoolSnap, appSnap] = await Promise.all([
      getDocs(query(collection(db, 'agency_talent_pool'), where('nanny_id', '==', nannyId))),
      getDocs(query(collection(db, 'applications'), where('nanny_id', '==', nannyId))),
    ]);

    talentPoolSnap.docs.forEach((entry) => {
      const invitationStatus = String(entry.data()?.invitation_status || '').trim().toLowerCase();
      if (invitationStatus === 'declined' || invitationStatus === 'left') return;

      const agencyId = String(entry.data().agency_id || '');
      if (agencyId) targetIds.add(agencyId);
    });

    appSnap.docs.forEach((entry) => {
      const agencyId = String(entry.data().agency_id || '');
      if (agencyId) targetIds.add(agencyId);
    });

    const agencies = await Promise.all(
      Array.from(targetIds).map(async (agencyId) => {
        const snap = await getDoc(doc(db, 'agency_profiles', agencyId));
        return {
          agency_id: agencyId,
          agency_name: snap.exists() ? String(snap.data().company_name || 'Agency') : 'Agency',
        } as NannyReferenceShareTarget;
      })
    );

    return agencies.sort((a, b) => a.agency_name.localeCompare(b.agency_name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const updateNannyReferenceSharing = async ({
  documentId,
  sharedAgencyIds,
}: {
  documentId: string;
  sharedAgencyIds: string[];
}): Promise<NannyDocument | null> => {
  const path = `nanny_documents/${documentId}`;
  try {
    if (!documentId) return null;

    const normalizedIds = Array.from(new Set((sharedAgencyIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    const docRef = doc(db, 'nanny_documents', documentId);

    await updateDoc(docRef, {
      reference_shared_with_agencies: normalizedIds.length > 0,
      shared_with_agency_ids: normalizedIds,
      updated_at: serverTimestamp(),
    });

    const updated = await getDoc(docRef);
    return updated.exists() ? ({ id: updated.id, ...updated.data() } as NannyDocument) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

export const getAgencySharedNannyReferences = async ({
  agencyId,
  nannyId,
}: {
  agencyId: string;
  nannyId: string;
}): Promise<NannyDocument[]> => {
  const path = 'nanny_documents';
  try {
    if (!agencyId || !nannyId) return [];

    const toMillisLocal = (value: any): number => {
      if (!value) return 0;
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const q = query(
      collection(db, path),
      where('nanny_id', '==', nannyId),
      where('type', '==', 'reference'),
      where('status', '==', 'approved'),
      where('reference_shared_with_agencies', '==', true),
      where('shared_with_agency_ids', 'array-contains', agencyId)
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyDocument));

    docs.sort((a, b) => toMillisLocal(b.updated_at || b.created_at) - toMillisLocal(a.updated_at || a.created_at));
    return docs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyCreditWallet = async (nannyId: string): Promise<NannyCreditWallet> => {
  const path = `nanny_credit_wallets/${nannyId}`;
  try {
    const walletRef = doc(db, 'nanny_credit_wallets', nannyId);
    const walletSnap = await getDoc(walletRef);
    if (walletSnap.exists()) {
      return walletSnap.data() as NannyCreditWallet;
    }

    const seededWallet: NannyCreditWallet = {
      nanny_id: nannyId,
      balance_credits: 5,
      lifetime_used_credits: 0,
      last_credit_refresh_at: Timestamp.now(),
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    await setDoc(walletRef, seededWallet, { merge: true });
    return seededWallet;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return {
      nanny_id: nannyId,
      balance_credits: 0,
      lifetime_used_credits: 0
    };
  }
};

export const addNannyCredits = async ({
  nannyId,
  credits,
  reason
}: {
  nannyId: string;
  credits: number;
  reason?: string;
}): Promise<NannyCreditWallet | null> => {
  const path = `nanny_credit_wallets/${nannyId}`;
  try {
    const walletRef = doc(db, 'nanny_credit_wallets', nannyId);
    const updatedWallet = await runTransaction(db, async (tx) => {
      const existing = await tx.get(walletRef);
      const currentBalance = existing.exists()
        ? Math.max(0, Number(existing.data().balance_credits || 0))
        : 0;
      const currentUsed = existing.exists()
        ? Math.max(0, Number(existing.data().lifetime_used_credits || 0))
        : 0;

      const nextWallet: NannyCreditWallet = {
        nanny_id: nannyId,
        balance_credits: currentBalance + Math.max(0, Math.floor(credits)),
        lifetime_used_credits: currentUsed,
        last_credit_refresh_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        created_at: existing.exists() ? existing.data().created_at : Timestamp.now()
      };
      tx.set(walletRef, nextWallet, { merge: true });

      if (reason?.trim()) {
        tx.set(doc(collection(db, 'nanny_credit_ledger')), {
          nanny_id: nannyId,
          delta_credits: Math.max(0, Math.floor(credits)),
          reason: reason.trim(),
          created_at: Timestamp.now()
        });
      }

      return nextWallet;
    });

    return updatedWallet;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

export const startNannyPremiumCheckout = async ({
  nannyId,
  userId,
  months,
  returnUrl,
  cancelUrl,
}: {
  nannyId: string;
  userId: string;
  months: number;
  returnUrl: string;
  cancelUrl: string;
}) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/paypal/nanny/premium/checkout'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ nannyId, userId, months, returnUrl, cancelUrl })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to start premium checkout.');
  }
  return payload;
};

export const startNannyCreditsCheckout = async ({
  nannyId,
  userId,
  credits,
  returnUrl,
  cancelUrl,
}: {
  nannyId: string;
  userId: string;
  credits: number;
  returnUrl: string;
  cancelUrl: string;
}) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/paypal/nanny/credits/checkout'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ nannyId, userId, credits, returnUrl, cancelUrl })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to start credits checkout.');
  }
  return payload;
};

export const captureNannyPaypalOrder = async ({
  orderId,
  nannyId,
  userId,
}: {
  orderId: string;
  nannyId: string;
  userId: string;
}) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/paypal/nanny/order/capture'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId, nannyId, userId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to capture PayPal order.');
  }
  return payload;
};

const toMillisSafe = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildDevelopmentAgentResponse = ({
  prompt,
  analytics,
  profile
}: {
  prompt: string;
  analytics: NannyPremiumAnalytics;
  profile: NannyProfile | null;
}) => {
  const lines: string[] = [];
  lines.push('Here is your personalized development plan:');
  lines.push(`- Focus metric: acceptance ${analytics.acceptance_rate_pct}% and completion ${analytics.completion_rate_pct}%.`);
  lines.push(`- Current momentum: ${analytics.application_velocity_30d} applications in the last 30 days.`);

  if (analytics.strengths.length > 0) {
    lines.push(`- Strength to lean on: ${analytics.strengths[0]}.`);
  }

  if (analytics.opportunities.length > 0) {
    lines.push(`- Biggest opportunity: ${analytics.opportunities[0]}.`);
  }

  if ((profile?.certifications?.length || 0) === 0) {
    lines.push('- Add one certification to improve trust and premium match quality.');
  }

  if (!profile?.bio || profile.bio.trim().length < 80) {
    lines.push('- Expand your profile bio with outcomes, age groups served, and your care style.');
  }

  lines.push(`- Prompt interpreted: "${prompt.trim().slice(0, 180)}".`);
  lines.push('- Next 7-day target: submit 3 tailored applications and follow up on any open interview invite.');

  return lines.join('\n');
};

export const getNannyPremiumAnalytics = async (nannyId: string): Promise<NannyPremiumAnalytics> => {
  const [profile, apps, reviews] = await Promise.all([
    getNannyById(nannyId),
    getApplicationsForNanny(nannyId),
    getNannyReviews(nannyId)
  ]);

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const acceptedCount = apps.filter((app) => ['accepted', 'hired', 'active', 'pending_family_approval', 'completed'].includes(app.status)).length;
  const completedCount = apps.filter((app) => app.status === 'completed').length;
  const activePipelineCount = apps.filter((app) => ['applied', 'reviewing', 'interviewing', 'interview_invited', 'accepted', 'hired', 'active', 'pending_family_approval'].includes(app.status)).length;
  const applications30d = apps.filter((app) => toMillisSafe(app.created_at) >= thirtyDaysAgo).length;
  const completed30d = apps.filter((app) => app.status === 'completed' && toMillisSafe(app.completed_at || app.updated_at) >= thirtyDaysAgo).length;

  const familyReviews = reviews.filter((r) => (r.reviewer_type || r.reviewer_role) === 'family');
  const agencyReviews = reviews.filter((r) => (r.reviewer_type || r.reviewer_role) === 'agency');
  const familyAvg = familyReviews.length > 0
    ? familyReviews.reduce((sum, r) => sum + (Number(r.reliability_rating || 0) + Number(r.communication_rating || 0)) / 2, 0) / familyReviews.length
    : 0;
  const agencyAvg = agencyReviews.length > 0
    ? agencyReviews.reduce((sum, r) => sum + (Number(r.reliability_rating || 0) + Number(r.communication_rating || 0)) / 2, 0) / agencyReviews.length
    : 0;

  const premiumUntil = profile?.premium_until || null;
  const premiumUntilMs = premiumUntil ? new Date(premiumUntil).getTime() : 0;
  const isPremium = !!premiumUntilMs && premiumUntilMs > now;

  const strengths: string[] = [];
  const opportunities: string[] = [];

  if (familyAvg >= 4.6 || agencyAvg >= 4.6) {
    strengths.push('High review quality from families/agencies');
  }
  if ((profile?.years_experience || 0) >= 5) {
    strengths.push('Strong years-of-experience signal');
  }
  if ((profile?.certifications?.length || 0) > 0) {
    strengths.push('Certified profile increases trust in matching');
  }

  const acceptanceRate = apps.length > 0 ? Math.round((acceptedCount / apps.length) * 100) : 0;
  const completionRate = acceptedCount > 0 ? Math.round((completedCount / acceptedCount) * 100) : 0;

  if (acceptanceRate < 35) {
    opportunities.push('Improve targeting to increase acceptance rate');
  }
  if ((profile?.bio || '').trim().length < 80) {
    opportunities.push('Expand bio with concrete childcare outcomes');
  }
  if ((profile?.certifications?.length || 0) === 0) {
    opportunities.push('Add at least one certification for premium opportunities');
  }
  if (applications30d < 3) {
    opportunities.push('Increase monthly application cadence');
  }

  return {
    is_premium: isPremium,
    premium_until: premiumUntil,
    total_applications: apps.length,
    active_pipeline_count: activePipelineCount,
    completed_placements: completedCount,
    acceptance_rate_pct: acceptanceRate,
    completion_rate_pct: completionRate,
    avg_family_rating: Math.round(familyAvg * 10) / 10,
    avg_agency_rating: Math.round(agencyAvg * 10) / 10,
    application_velocity_30d: applications30d,
    completion_velocity_30d: completed30d,
    strengths,
    opportunities
  };
};

export const getNannyDevelopmentSessions = async (nannyId: string): Promise<NannyDevelopmentSession[]> => {
  const path = 'nanny_development_sessions';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyDevelopmentSession));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyGrowthProgress = async (weekKey: string): Promise<NannyGrowthProgress> => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl(`/api/nanny/growth-progress?week=${encodeURIComponent(weekKey)}`), {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to load growth progress.');
  }

  return payload as NannyGrowthProgress;
};

export const updateNannyGrowthTask = async ({
  weekKey,
  taskId,
  completed,
}: {
  weekKey: string;
  taskId: string;
  completed: boolean;
}) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/nanny/growth-progress/task'), {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ weekKey, taskId, completed }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to update growth task.');
  }

  return payload;
};

export const submitNannyWeeklyQuiz = async ({
  weekKey,
  courseId,
  selectedAnswer,
  passed,
}: {
  weekKey: string;
  courseId: string;
  selectedAnswer: number;
  passed: boolean;
}) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/nanny/growth-progress/weekly-quiz'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ weekKey, courseId, selectedAnswer, passed }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to submit weekly quiz.');
  }

  return payload;
};

export const getNannyOfficialShiftScore = async (weekKey?: string): Promise<ShiftScoreResult & { weekKey?: string }> => {
  const headers = await buildApiHeaders();
  const query = weekKey ? `?week=${encodeURIComponent(weekKey)}` : '';
  const response = await fetch(buildApiUrl(`/api/nanny/shift-score${query}`), {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to load official ShiftScore.');
  }

  return payload as ShiftScoreResult & { weekKey?: string };
};

export const createNannyDevelopmentSession = async ({
  nannyId,
  prompt
}: {
  nannyId: string;
  prompt: string;
}): Promise<NannyDevelopmentSession> => {
  const path = 'nanny_development_sessions';
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error('Please enter a prompt before running the development agent.');
  }

  const [analytics, profile] = await Promise.all([
    getNannyPremiumAnalytics(nannyId),
    getNannyById(nannyId)
  ]);

  if (!analytics.is_premium) {
    throw new Error('Development Agent is a premium feature. Upgrade premium to continue.');
  }

  try {
    const walletRef = doc(db, 'nanny_credit_wallets', nannyId);
    const sessionRef = doc(collection(db, path));
    const response = buildDevelopmentAgentResponse({
      prompt: trimmedPrompt,
      analytics,
      profile
    });

    const created = await runTransaction(db, async (tx) => {
      const walletSnap = await tx.get(walletRef);
      const currentBalance = walletSnap.exists()
        ? Math.max(0, Number(walletSnap.data().balance_credits || 0))
        : 5;
      const currentUsed = walletSnap.exists()
        ? Math.max(0, Number(walletSnap.data().lifetime_used_credits || 0))
        : 0;

      if (currentBalance < 1) {
        throw new Error('Not enough credits. Add credits to run another development session.');
      }

      tx.set(walletRef, {
        nanny_id: nannyId,
        balance_credits: currentBalance - 1,
        lifetime_used_credits: currentUsed + 1,
        updated_at: Timestamp.now(),
        created_at: walletSnap.exists() ? walletSnap.data().created_at : Timestamp.now()
      }, { merge: true });

      const createdSession: NannyDevelopmentSession = {
        id: sessionRef.id,
        nanny_id: nannyId,
        prompt: trimmedPrompt,
        response,
        credits_used: 1,
        created_at: Timestamp.now()
      };

      tx.set(sessionRef, createdSession);
      return createdSession;
    });

    return created;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const createNannyDocument = async (input: Omit<NannyDocument, 'id' | 'status' | 'reviewed_by' | 'reviewed_at' | 'created_at' | 'updated_at'>) => {
  const path = 'nanny_documents';
  try {
    const fileName = input.file_name?.trim();
    const fileUrl = input.file_url?.trim();
    const certificationName = input.type === 'certification' ? String(input.certification_name || '').trim() : '';
    if (!fileName || !fileUrl) return null;

    const docRef = await addDoc(collection(db, path), {
      nanny_id: input.nanny_id,
      uploader_user_id: input.uploader_user_id,
      type: input.type,
      certification_name: certificationName || null,
      file_name: fileName,
      file_url: fileUrl,
      status: 'uploaded',
      reference_shared_with_agencies: false,
      shared_with_agency_ids: [],
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    const saved = await getDoc(docRef);
    const createdDoc = saved.exists() ? ({ id: saved.id, ...saved.data() } as NannyDocument) : null;

    // Notify all superadmins that a document is pending review
    if (createdDoc) {
      try {
        const adminsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'superadmin')));
        const notifyAdmins = adminsSnap.docs.map((adminDoc) =>
          addAdminNotification(
            adminDoc.id,
            'New document pending review',
            `A nanny has submitted a document for verification: "${fileName}"`,
            '/admin/verification',
          )
        );
        await Promise.allSettled(notifyAdmins);
      } catch (notifErr) {
        console.warn('[createNannyDocument] failed to notify admins', notifErr);
      }
    }

    return createdDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const getPendingNannyDocuments = async (): Promise<NannyDocument[]> => {
  const path = 'nanny_documents';
  try {
    const q = query(collection(db, path), where('status', 'in', ['uploaded', 'under_review']));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyDocument));
    // Sort by created_at ascending
    return docs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return aTime - bTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

const normalizeBgStatus = (status: 'checked' | 'not_checked' | 'expired', expiresAt?: string | null) => {
  if (status !== 'checked') return status;
  if (!expiresAt) return status;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return status;
  return expiresMs < Date.now() ? 'expired' : status;
};

const computePublicBgStatus = (checks: NannyBgCheck[]): NannyBgPublicStatus | null => {
  if (checks.length === 0) return null;

  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sorted = [...checks].sort((a, b) => {
    const aTs = toMillis(a.checked_at || a.updated_at || a.created_at);
    const bTs = toMillis(b.checked_at || b.updated_at || b.created_at);
    return bTs - aTs;
  });

  const checked = sorted.find((item) => item.status === 'checked');
  const expired = sorted.find((item) => item.status === 'expired');
  const fallback = sorted[0];

  const selected = checked || expired || fallback;
  return {
    nanny_id: selected.nanny_id,
    status: selected.status,
    last_checked_at: selected.checked_at || selected.updated_at || selected.created_at || null,
    expires_at: selected.expires_at || null,
    confidence: Number(selected.confidence || 0),
    source_hidden: selected.source_hidden !== false,
    updated_at: serverTimestamp()
  };
};

export const upsertAgencyNannyBgCheck = async ({
  nannyId,
  sourceAgencyId,
  sourceUserId,
  status,
  checkedAt,
  expiresAt,
  confidence,
  docUrlPrivate,
  sourceHidden = true
}: {
  nannyId: string;
  sourceAgencyId: string;
  sourceUserId: string;
  status: 'checked' | 'not_checked' | 'expired';
  checkedAt?: string;
  expiresAt?: string;
  confidence?: number;
  docUrlPrivate?: string;
  sourceHidden?: boolean;
}): Promise<NannyBgCheck | null> => {
  const path = 'nanny_bg_checks';
  const auditPath = 'nanny_bg_check_audit_logs';
  const publicPath = 'nanny_bg_status_public';
  if (!nannyId || !sourceUserId) return null;

  const normalizedStatus = normalizeBgStatus(status, expiresAt || undefined);
  const saveWithAgency = async (agencyId: string): Promise<NannyBgCheck | null> => {
    const checkId = `${agencyId}_${nannyId}`;
    const checkRef = doc(db, path, checkId);
    let existing: NannyBgCheck | null = null;
    try {
      const existingSnap = await getDoc(checkRef);
      existing = existingSnap.exists() ? ({ id: existingSnap.id, ...existingSnap.data() } as NannyBgCheck) : null;
    } catch {
      // Do not block writes when read access to this exact doc is restricted.
      existing = null;
    }

    await setDoc(checkRef, {
      nanny_id: nannyId,
      source_agency_id: agencyId,
      source_user_id: sourceUserId,
      status: normalizedStatus,
      checked_at: checkedAt || null,
      expires_at: expiresAt || null,
      confidence: Math.max(0, Math.min(100, Number(confidence || 0))),
      doc_url_private: docUrlPrivate?.trim() || null,
      source_hidden: sourceHidden,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, auditPath), {
      nanny_id: nannyId,
      source_agency_id: agencyId,
      actor_user_id: sourceUserId,
      action: existing ? 'updated' : 'created',
      previous_status: existing?.status || null,
      new_status: normalizedStatus,
      previous_expires_at: existing?.expires_at || null,
      new_expires_at: expiresAt || null,
      previous_confidence: existing?.confidence ?? null,
      new_confidence: Math.max(0, Math.min(100, Number(confidence || 0))),
      source_hidden: sourceHidden,
      created_at: serverTimestamp()
    });

    let savedCheck: NannyBgCheck | null = null;
    try {
      const saved = await getDoc(checkRef);
      savedCheck = saved.exists() ? ({ id: saved.id, ...saved.data() } as NannyBgCheck) : null;
    } catch {
      // If post-write read is denied, still return a best-effort saved object.
      savedCheck = {
        id: checkId,
        nanny_id: nannyId,
        source_agency_id: agencyId,
        source_user_id: sourceUserId,
        status: normalizedStatus,
        checked_at: checkedAt || null,
        expires_at: expiresAt || null,
        confidence: Math.max(0, Math.min(100, Number(confidence || 0))),
        doc_url_private: docUrlPrivate?.trim() || null,
        source_hidden: sourceHidden,
      } as NannyBgCheck;
    }

    // Keep the main save path resilient: a public-status sync failure should not invalidate
    // an already-saved agency check document.
    try {
      const checksQ = query(collection(db, path), where('nanny_id', '==', nannyId));
      const checksSnap = await getDocs(checksQ);
      const checks = checksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as NannyBgCheck));
      const publicStatus = computePublicBgStatus(checks);

      if (publicStatus) {
        const publicStatusRef = doc(db, publicPath, nannyId);
        const existingPublicSnap = await getDoc(publicStatusRef);
        const existingPublic = existingPublicSnap.exists() ? (existingPublicSnap.data() as NannyBgPublicStatus) : null;
        const hasActiveOverride = existingPublic?.override_active === true;

        await setDoc(publicStatusRef, {
          ...(hasActiveOverride ? {
            nanny_id: nannyId,
            override_active: true,
            override_reason: existingPublic?.override_reason || null,
            override_by_admin_id: existingPublic?.override_by_admin_id || null,
            override_at: existingPublic?.override_at || null,
            status: existingPublic?.status || publicStatus.status,
            expires_at: existingPublic?.expires_at || publicStatus.expires_at,
            confidence: Number(existingPublic?.confidence ?? publicStatus.confidence ?? 0),
            source_hidden: existingPublic?.source_hidden !== false,
            last_checked_at: existingPublic?.last_checked_at || publicStatus.last_checked_at || null,
          } : publicStatus),
          updated_at: serverTimestamp()
        }, { merge: true });
      }
    } catch (publicSyncError) {
      handleFirestoreError(publicSyncError, OperationType.WRITE, publicPath);
    }

    return savedCheck;
  };

  let lastError: any = null;
  try {
    const resolvedAgencyIds = await resolveAgencyIdsForUser(sourceUserId);
    const candidateAgencyIds = Array.from(new Set([
      sourceAgencyId,
      ...resolvedAgencyIds,
    ].filter((value) => typeof value === 'string' && value.trim()))) as string[];

    if (candidateAgencyIds.length === 0) return null;

    for (const candidateAgencyId of candidateAgencyIds) {
      try {
        const savedCheck = await saveWithAgency(candidateAgencyId);
        if (savedCheck) return savedCheck;
      } catch (error: any) {
        lastError = error;
        if (error?.code !== 'permission-denied') {
          break;
        }
      }
    }
  } catch (error) {
    lastError = error;
  }

  if (lastError) {
    handleFirestoreError(lastError, OperationType.WRITE, path);
  }
  return null;
};

export const getNannyBgChecksForAgency = async (agencyId: string, nannyId?: string): Promise<NannyBgCheck[]> => {
  const path = 'nanny_bg_checks';
  try {
    const q = query(collection(db, path), where('source_agency_id', '==', agencyId), orderBy('updated_at', 'desc'));
    const snapshot = await getDocs(q);
    const checks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyBgCheck));
    if (!nannyId) return checks;
    return checks.filter((item) => item.nanny_id === nannyId);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyBgStatusMap = async (nannyIds: string[]): Promise<Record<string, NannyBgPublicStatus>> => {
  const path = 'nanny_bg_status_public';
  try {
    const ids = Array.from(new Set((nannyIds || []).filter(Boolean)));
    if (ids.length === 0) return {};

    const result: Record<string, NannyBgPublicStatus> = {};
    await Promise.all(ids.map(async (nannyId) => {
      const snap = await getDoc(doc(db, path, nannyId));
      if (!snap.exists()) return;
      result[nannyId] = snap.data() as NannyBgPublicStatus;
    }));

    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {};
  }
};

export const getAdminBgPublicStatuses = async (): Promise<AdminBgPublicStatusRow[]> => {
  const path = 'nanny_bg_status_public';
  try {
    const snapshot = await getDocs(query(collection(db, path), orderBy('updated_at', 'desc')));
    const rows = await Promise.all(snapshot.docs.map(async (entry) => {
      const data = entry.data() as NannyBgPublicStatus;
      const [nannyDoc, userDoc] = await Promise.all([
        getDoc(doc(db, 'nanny_profiles', entry.id)),
        getDoc(doc(db, 'users', entry.id))
      ]);

      const firstName = nannyDoc.exists() ? nannyDoc.data().first_name || '' : '';
      const lastName = nannyDoc.exists() ? nannyDoc.data().last_name || '' : '';

      return {
        nanny_id: entry.id,
        ...data,
        nanny_name: `${firstName} ${lastName}`.trim() || undefined,
        nanny_email: userDoc.exists() ? userDoc.data().email : undefined
      } as AdminBgPublicStatusRow;
    }));
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const setAdminBgPublicStatusOverride = async ({
  nannyId,
  adminUserId,
  status,
  confidence,
  expiresAt,
  reason
}: {
  nannyId: string;
  adminUserId: string;
  status: 'checked' | 'not_checked' | 'expired';
  confidence: number;
  expiresAt?: string;
  reason: string;
}): Promise<NannyBgPublicStatus | null> => {
  const publicPath = `nanny_bg_status_public/${nannyId}`;
  const auditPath = 'nanny_bg_check_audit_logs';
  try {
    if (!nannyId || !adminUserId || !reason.trim()) return null;

    const publicRef = doc(db, 'nanny_bg_status_public', nannyId);
    const existingSnap = await getDoc(publicRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as NannyBgPublicStatus) : null;

    await setDoc(publicRef, {
      nanny_id: nannyId,
      status,
      confidence: Math.max(0, Math.min(100, Number(confidence || 0))),
      expires_at: expiresAt || null,
      override_active: true,
      override_reason: reason.trim(),
      override_by_admin_id: adminUserId,
      override_at: serverTimestamp(),
      updated_at: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, auditPath), {
      nanny_id: nannyId,
      source_agency_id: null,
      actor_user_id: adminUserId,
      action: 'override_set',
      previous_status: existing?.status || null,
      new_status: status,
      previous_expires_at: existing?.expires_at || null,
      new_expires_at: expiresAt || null,
      previous_confidence: existing?.confidence ?? null,
      new_confidence: Math.max(0, Math.min(100, Number(confidence || 0))),
      source_hidden: existing?.source_hidden !== false,
      override_reason: reason.trim(),
      created_at: serverTimestamp()
    });

    const updated = await getDoc(publicRef);
    return updated.exists() ? (updated.data() as NannyBgPublicStatus) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, publicPath);
    return null;
  }
};

export const clearAdminBgPublicStatusOverride = async ({
  nannyId,
  adminUserId,
  reason
}: {
  nannyId: string;
  adminUserId: string;
  reason: string;
}): Promise<NannyBgPublicStatus | null> => {
  const publicPath = `nanny_bg_status_public/${nannyId}`;
  const auditPath = 'nanny_bg_check_audit_logs';
  try {
    if (!nannyId || !adminUserId || !reason.trim()) return null;

    const checksSnap = await getDocs(query(collection(db, 'nanny_bg_checks'), where('nanny_id', '==', nannyId)));
    const checks = checksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as NannyBgCheck));
    const computed = computePublicBgStatus(checks);
    if (!computed) return null;

    const publicRef = doc(db, 'nanny_bg_status_public', nannyId);
    const existingSnap = await getDoc(publicRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as NannyBgPublicStatus) : null;

    await setDoc(publicRef, {
      ...computed,
      override_active: false,
      override_reason: null,
      override_by_admin_id: null,
      override_at: null,
      updated_at: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, auditPath), {
      nanny_id: nannyId,
      source_agency_id: null,
      actor_user_id: adminUserId,
      action: 'override_cleared',
      previous_status: existing?.status || null,
      new_status: computed.status,
      previous_expires_at: existing?.expires_at || null,
      new_expires_at: computed.expires_at || null,
      previous_confidence: existing?.confidence ?? null,
      new_confidence: Number(computed.confidence || 0),
      source_hidden: computed.source_hidden !== false,
      override_reason: reason.trim(),
      created_at: serverTimestamp()
    });

    const updated = await getDoc(publicRef);
    return updated.exists() ? (updated.data() as NannyBgPublicStatus) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, publicPath);
    return null;
  }
};

export const getBgCheckAuditLogs = async (): Promise<NannyBgCheckAuditLog[]> => {
  const path = 'nanny_bg_check_audit_logs';
  try {
    const snapshot = await getDocs(query(collection(db, path), orderBy('created_at', 'desc')));
    const rawLogs = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as NannyBgCheckAuditLog));
    const logs = await Promise.all(rawLogs.map(async (data) => {
      const [nannyDoc, userDoc, agencyDoc, actorDoc] = await Promise.all([
        getDoc(doc(db, 'nanny_profiles', data.nanny_id)),
        getDoc(doc(db, 'users', data.nanny_id)),
        data.source_agency_id ? getDoc(doc(db, 'agency_profiles', data.source_agency_id)) : Promise.resolve(null as any),
        getDoc(doc(db, 'users', data.actor_user_id))
      ]);

      const firstName = nannyDoc.exists() ? nannyDoc.data().first_name || '' : '';
      const lastName = nannyDoc.exists() ? nannyDoc.data().last_name || '' : '';

      return {
        ...data,
        nanny_name: `${firstName} ${lastName}`.trim() || undefined,
        nanny_email: userDoc.exists() ? userDoc.data().email : undefined,
        agency_name: agencyDoc?.exists?.() ? agencyDoc.data().company_name : (data.action.startsWith('override') ? 'Admin Override' : undefined),
        actor_email: actorDoc.exists() ? actorDoc.data().email : undefined
      } as NannyBgCheckAuditLog;
    }));

    const flipCounter = new Map<string, number>();
    rawLogs.forEach((log) => {
      if (!log.source_agency_id || !log.previous_status || log.previous_status === log.new_status) return;
      const key = `${log.nanny_id}:${log.source_agency_id}`;
      flipCounter.set(key, (flipCounter.get(key) || 0) + 1);
    });

    return logs.map((log) => {
      const riskFlags: string[] = [];
      if (log.new_status === 'checked' && Number(log.new_confidence || 0) < 60) {
        riskFlags.push('Low-confidence checked submission');
      }
      if (log.source_agency_id) {
        const key = `${log.nanny_id}:${log.source_agency_id}`;
        if ((flipCounter.get(key) || 0) >= 2) {
          riskFlags.push('Repeated status flips');
        }
      }
      if (log.action === 'override_set') {
        riskFlags.push('Admin override active');
      }
      return {
        ...log,
        risk_flags: riskFlags
      } as NannyBgCheckAuditLog;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const summarizeVerificationDocs = (docs: NannyDocument[], nowMs: number): AdminVerificationOverview => {
  const reviewed = docs.filter((item) => item.status === 'approved' || item.status === 'rejected');
  const pending = docs.filter((item) => item.status === 'uploaded' || item.status === 'under_review');
  const approved = docs.filter((item) => item.status === 'approved');
  const rejected = docs.filter((item) => item.status === 'rejected');

  const reviewedDurationsHours = reviewed
    .map((item) => {
      const createdAt = toMillis(item.created_at);
      const reviewedAt = toMillis(item.reviewed_at);
      if (!createdAt || !reviewedAt || reviewedAt < createdAt) return 0;
      return (reviewedAt - createdAt) / (1000 * 60 * 60);
    })
    .filter((hours) => hours > 0);

  const avgReviewTimeHours = reviewedDurationsHours.length > 0
    ? Math.round((reviewedDurationsHours.reduce((sum, hours) => sum + hours, 0) / reviewedDurationsHours.length) * 10) / 10
    : 0;

  const pendingOver72h = pending.filter((item) => {
    const createdAt = toMillis(item.created_at);
    if (!createdAt) return false;
    return nowMs - createdAt > 72 * 60 * 60 * 1000;
  }).length;

  const total = docs.length;
  const approvalRatePct = total > 0 ? Math.round((approved.length / total) * 100) : 0;

  return {
    total_documents: total,
    pending_documents: pending.length,
    approved_documents: approved.length,
    rejected_documents: rejected.length,
    approval_rate_pct: approvalRatePct,
    avg_review_time_hours: avgReviewTimeHours,
    pending_over_72h: pendingOver72h
  };
};

const emptyVerificationOverview = (): AdminVerificationOverview => ({
  total_documents: 0,
  pending_documents: 0,
  approved_documents: 0,
  rejected_documents: 0,
  approval_rate_pct: 0,
  avg_review_time_hours: 0,
  pending_over_72h: 0
});

export const getAdminVerificationOverview = async (): Promise<AdminVerificationOverview> => {
  const analytics = await getAdminVerificationAnalytics('all');
  return analytics.current;
};

export const getAdminVerificationAnalytics = async (range: VerificationRange = 'all'): Promise<AdminVerificationAnalytics> => {
  const path = 'nanny_documents';
  try {
    const snapshot = await getDocs(query(collection(db, path), orderBy('created_at', 'desc')));
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NannyDocument));
    const nowMs = Date.now();

    const windowDays = range === '7d' ? 7 : range === '30d' ? 30 : null;
    const currentStartMs = windowDays ? nowMs - windowDays * 24 * 60 * 60 * 1000 : null;
    const previousStartMs = windowDays ? nowMs - windowDays * 2 * 24 * 60 * 60 * 1000 : null;

    const currentDocs = currentStartMs
      ? docs.filter((item) => {
          const createdAt = toMillis(item.created_at);
          return createdAt > 0 && createdAt >= currentStartMs;
        })
      : docs;

    const previousDocs = currentStartMs && previousStartMs
      ? docs.filter((item) => {
          const createdAt = toMillis(item.created_at);
          return createdAt > 0 && createdAt >= previousStartMs && createdAt < currentStartMs;
        })
      : null;

    const current = summarizeVerificationDocs(currentDocs, nowMs);
    const previous = previousDocs ? summarizeVerificationDocs(previousDocs, nowMs) : null;

    const typeMap = new Map<string, AdminVerificationTypeBreakdownItem>();
    currentDocs.forEach((item) => {
      const key = item.type || 'other';
      if (!typeMap.has(key)) {
        typeMap.set(key, {
          type: key as NannyDocument['type'],
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          approval_rate_pct: 0
        });
      }

      const bucket = typeMap.get(key)!;
      bucket.total += 1;
      if (item.status === 'approved') bucket.approved += 1;
      if (item.status === 'rejected') bucket.rejected += 1;
      if (item.status === 'uploaded' || item.status === 'under_review') bucket.pending += 1;
      bucket.approval_rate_pct = bucket.total > 0 ? Math.round((bucket.approved / bucket.total) * 100) : 0;
    });

    const typeBreakdown = Array.from(typeMap.values()).sort((a, b) => b.total - a.total);

    const pendingDocs = currentDocs.filter((item) => item.status === 'uploaded' || item.status === 'under_review');
    const identityMap = new Map<string, { nanny_name?: string; nanny_email?: string }>();
    const uniqueNannyIds = Array.from(new Set(pendingDocs.map((item) => item.nanny_id).filter(Boolean)));

    await Promise.all(uniqueNannyIds.map(async (nannyId) => {
      try {
        const [profileDoc, userDoc] = await Promise.all([
          getDoc(doc(db, 'nanny_profiles', nannyId)),
          getDoc(doc(db, 'users', nannyId))
        ]);
        const firstName = profileDoc.exists() ? (profileDoc.data().first_name || '') : '';
        const lastName = profileDoc.exists() ? (profileDoc.data().last_name || '') : '';
        const nannyName = `${firstName} ${lastName}`.trim() || undefined;
        const nannyEmail = userDoc.exists() ? userDoc.data().email : undefined;
        identityMap.set(nannyId, { nanny_name: nannyName, nanny_email: nannyEmail });
      } catch {
        identityMap.set(nannyId, {});
      }
    }));

    const queue: AdminVerificationQueueItem[] = pendingDocs
      .map((item) => {
        const createdAtMs = toMillis(item.created_at);
        const ageHoursRaw = createdAtMs > 0 ? (nowMs - createdAtMs) / (1000 * 60 * 60) : 0;
        const ageHours = Math.max(0, Math.round(ageHoursRaw * 10) / 10);
        const identity = identityMap.get(item.nanny_id) || {};
        return {
          ...item,
          age_hours: ageHours,
          sla_breached: ageHours > 72,
          nanny_name: identity.nanny_name,
          nanny_email: identity.nanny_email
        };
      })
      .sort((a, b) => {
        if (a.sla_breached !== b.sla_breached) {
          return a.sla_breached ? -1 : 1;
        }
        return b.age_hours - a.age_hours;
      });

    const deltas = {
      total_documents: previous ? current.total_documents - previous.total_documents : 0,
      pending_documents: previous ? current.pending_documents - previous.pending_documents : 0,
      approved_documents: previous ? current.approved_documents - previous.approved_documents : 0,
      rejected_documents: previous ? current.rejected_documents - previous.rejected_documents : 0,
      approval_rate_pct: previous ? current.approval_rate_pct - previous.approval_rate_pct : 0,
      avg_review_time_hours: previous ? Math.round((current.avg_review_time_hours - previous.avg_review_time_hours) * 10) / 10 : 0,
      pending_over_72h: previous ? current.pending_over_72h - previous.pending_over_72h : 0
    };

    return {
      range,
      current,
      previous,
      deltas,
      type_breakdown: typeBreakdown,
      queue
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {
      range,
      current: emptyVerificationOverview(),
      previous: range === 'all' ? null : emptyVerificationOverview(),
      deltas: {
        total_documents: 0,
        pending_documents: 0,
        approved_documents: 0,
        rejected_documents: 0,
        approval_rate_pct: 0,
        avg_review_time_hours: 0,
        pending_over_72h: 0
      },
      type_breakdown: [],
      queue: []
    };
  }
};

export const updateNannyDocumentStatus = async ({
  documentId,
  status,
  reviewerUserId,
  rejectionReason
}: {
  documentId: string;
  status: 'under_review' | 'approved' | 'rejected';
  reviewerUserId: string;
  rejectionReason?: string;
}) => {
  const path = `nanny_documents/${documentId}`;
  try {
    const docRef = doc(db, 'nanny_documents', documentId);
    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists()) return null;

    const existingData = existingDoc.data() as NannyDocument;
    await updateDoc(docRef, {
      status,
      rejection_reason: status === 'rejected' ? (rejectionReason?.trim() || 'Not provided') : null,
      reviewed_by: reviewerUserId,
      reviewed_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    const updated = await getDoc(docRef);
    const updatedDoc = updated.exists() ? ({ id: updated.id, ...updated.data() } as NannyDocument) : null;

    if (existingData?.nanny_id) {
      const [profileDoc, certDocsSnap] = await Promise.all([
        getDoc(doc(db, 'nanny_profiles', existingData.nanny_id)),
        getDocs(query(
          collection(db, 'nanny_documents'),
          where('nanny_id', '==', existingData.nanny_id),
          where('type', '==', 'certification'),
          where('status', '==', 'approved')
        )),
      ]);

      const profileCerts = profileDoc.exists() && Array.isArray(profileDoc.data()?.certifications)
        ? (profileDoc.data()?.certifications as string[])
        : [];

      const approvedDocNames = certDocsSnap.docs
        .map((snap) => String(snap.data()?.file_name || '').trim())
        .filter(Boolean);
      const approvedDocCertifications = certDocsSnap.docs
        .map((snap) => String(snap.data()?.certification_name || '').trim())
        .filter(Boolean);

      const normalize = (value: string) => value.toLowerCase().replace(/certificate|certification/gi, '').replace(/[^a-z0-9]+/g, ' ').trim();

      const approvedCertifications = profileCerts.filter((cert) => {
        const normalizedCert = normalize(String(cert || ''));
        if (approvedDocCertifications.some((docCert) => normalize(docCert) === normalizedCert)) {
          return true;
        }
        return approvedDocNames.some((docName) => {
          const normalizedDoc = normalize(docName);
          return normalizedDoc.includes(normalizedCert) || normalizedCert.includes(normalizedDoc);
        });
      });

      const fallbackDocNames = approvedDocNames.filter((docName) => {
        const normalizedDoc = normalize(docName);
        return !approvedCertifications.some((cert) => {
          const normalizedCert = normalize(cert);
          return normalizedDoc.includes(normalizedCert) || normalizedCert.includes(normalizedDoc);
        });
      });

      await setDoc(doc(db, 'nanny_profiles', existingData.nanny_id), {
        approved_certifications: Array.from(new Set([...approvedCertifications, ...fallbackDocNames])),
        updated_at: serverTimestamp(),
      }, { merge: true });
    }

    // Notify the nanny about the decision
    if ((status === 'approved' || status === 'rejected') && existingData?.nanny_id) {
      try {
        const docLabel = String(existingData.file_name || 'Your document').trim();
        const notifTitle = status === 'approved'
          ? 'Document approved'
          : 'Document not approved';
        const notifMessage = status === 'approved'
          ? `"${docLabel}" has been approved.`
          : `"${docLabel}" was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
        await addNannyNotification(existingData.nanny_id, notifTitle, notifMessage, '/nanny/profile');
      } catch (notifErr) {
        console.warn('[updateNannyDocumentStatus] failed to notify nanny', notifErr);
      }
    }

    return updatedDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

// --- AGENCIES ---
export const getAgencies = async (): Promise<AgencyProfile[]> => {
  const path = 'agency_profiles';
  try {
    const snapshot = await getDocs(collection(db, path));
    const agencies = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      users: null,
    } as AgencyProfile));
    return agencies;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);

    try {
      const response = await fetch(buildApiUrl('/api/agency/public-list'));
      if (!response.ok) return [];
      const payload = await response.json().catch(() => ({}));
      const agencies = Array.isArray(payload?.agencies) ? payload.agencies : [];
      return agencies.map((agency: any) => ({ ...agency, users: null })) as AgencyProfile[];
    } catch (fallbackError) {
      console.error('[getAgencies] fallback failed', fallbackError);
      return [];
    }
  }
};

export const getAgencyById = async (id: string): Promise<AgencyProfile | null> => {
  const path = `agency_profiles/${id}`;
  try {
    const agencyDoc = await getDoc(doc(db, 'agency_profiles', id));
    if (!agencyDoc.exists()) return null;
    return { id: agencyDoc.id, ...agencyDoc.data() } as AgencyProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

const AGENCY_RESOLUTION_CACHE_TTL_MS = 30_000;
const agencyResolutionCache = new Map<string, { ids: string[]; expiresAt: number }>();
const agencyResolutionInFlight = new Map<string, Promise<string[]>>();

function isAgencyResolutionDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('debug_agency_resolution') === '1';
  } catch {
    return false;
  }
}

function agencyResolutionDebugLog(...args: any[]) {
  if (isAgencyResolutionDebugEnabled()) {
    console.log(...args);
  }
}

function agencyResolutionDebugError(...args: any[]) {
  if (isAgencyResolutionDebugEnabled()) {
    console.error(...args);
  }
}

export const resolveAgencyIdsForUser = async (userId: string): Promise<string[]> => {
  if (!userId) return [];

  const cached = agencyResolutionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }

  const inFlight = agencyResolutionInFlight.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const resolver = (async () => {

  const ids = new Set<string>();
  const addId = (value: any) => {
    if (typeof value === 'string' && value.trim()) {
      ids.add(value.trim());
    }
  };

  // Candidate 1: explicit references on users document.
  // This should be first because Firestore rules also derive agency membership from this linkage.
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      addId(userDoc.data().agency_id);
      addId(userDoc.data().agency_profile_id);
    }
  } catch {
    // Continue with other resolution strategies.
  }

  // Candidate 2: legacy pattern where agency profile doc ID equals user UID
  try {
    const agencyDoc = await getDoc(doc(db, 'agency_profiles', userId));
    if (agencyDoc.exists()) addId(userId);
  } catch {
    // Continue with other resolution strategies.
  }

  // Candidate 3: recruiter seat linkage (for recruiters, not admins)
  try {
    const recruiterQuery = query(collection(db, 'agency_recruiters'), where('user_id', '==', userId));
    const recruiterSnap = await getDocs(recruiterQuery);
    if (!recruiterSnap.empty) {
      recruiterSnap.docs.forEach((seatDoc) => addId(seatDoc.data().agency_id));
      agencyResolutionDebugLog(`[DEBUG] resolveAgencyIdsForUser(${userId}): recruiter at ${recruiterSnap.size} agencies`);
    }
  } catch {
    // Continue with other resolution strategies.
  }

  // Candidate 4: Check if user is ADMIN of an agency (owner_uid field)
  try {
    const adminQuery = query(collection(db, 'agency_profiles'), where('owner_uid', '==', userId));
    const adminSnap = await getDocs(adminQuery);
    if (!adminSnap.empty) {
      adminSnap.docs.forEach((agencyDoc) => addId(agencyDoc.id));
      agencyResolutionDebugLog(`[DEBUG] resolveAgencyIdsForUser(${userId}): admin of ${adminSnap.size} agencies`);
    }
  } catch (err) {
    agencyResolutionDebugError(`[DEBUG] resolveAgencyIdsForUser(${userId}): owner_uid query failed:`, err);
  }

  // Candidate 5: other admin-id fields in agency profile docs (fallback)
  const agencyLinkFields = ['user_id', 'owner_id', 'admin_id'];
  for (const field of agencyLinkFields) {
    try {
      const linkedProfilesQuery = query(collection(db, 'agency_profiles'), where(field, '==', userId));
      const linkedProfilesSnap = await getDocs(linkedProfilesQuery);
      linkedProfilesSnap.docs.forEach((profileDoc) => addId(profileDoc.id));
    } catch {
      // Ignore this field if query is unavailable under current rules/indexes.
    }
  }

  const result = Array.from(ids);
  agencyResolutionDebugLog(`[DEBUG] resolveAgencyIdsForUser(${userId}): resolved agency IDs:`, result);
  agencyResolutionCache.set(userId, {
    ids: result,
    expiresAt: Date.now() + AGENCY_RESOLUTION_CACHE_TTL_MS,
  });
  return result;
  })();

  agencyResolutionInFlight.set(userId, resolver);
  try {
    return await resolver;
  } finally {
    agencyResolutionInFlight.delete(userId);
  }
};

export const resolveAgencyIdForUser = async (userId: string): Promise<string | null> => {
  const agencyIds = await resolveAgencyIdsForUser(userId);
  return agencyIds[0] || null;
};

export const getAgencyConversationsForUser = async (userId: string) => {
  const agencyIds = await resolveAgencyIdsForUser(userId);
  console.log(`[DEBUG] getAgencyConversationsForUser(${userId}): resolved agency IDs:`, agencyIds);
  if (agencyIds.length === 0) {
    console.log(`[DEBUG] getAgencyConversationsForUser(${userId}): no agency IDs found, returning empty`);
    return [];
  }

  const grouped = await Promise.all(agencyIds.map((id) => {
    console.log(`[DEBUG] getAgencyConversationsForUser: querying conversations for agency ${id}`);
    return getAgencyConversations(id);
  }));
  console.log(`[DEBUG] getAgencyConversationsForUser(${userId}): grouped results:`, grouped);
  const merged = grouped.flat();

  const unique = new Map<string, any>();
  merged.forEach((conversation: any) => {
    if (!conversation?.id) return;
    const existing = unique.get(conversation.id);
    if (!existing) {
      unique.set(conversation.id, conversation);
      return;
    }

    const toMillis = (value: any): number => {
      if (!value) return 0;
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const currentTs = toMillis(conversation.updated_at || conversation.created_at);
    const existingTs = toMillis(existing.updated_at || existing.created_at);
    if (currentTs > existingTs) {
      unique.set(conversation.id, conversation);
    }
  });

  const values = Array.from(unique.values());
  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return values.sort((a: any, b: any) => {
    const aUpdated = toMillis(a.updated_at || a.created_at);
    const bUpdated = toMillis(b.updated_at || b.created_at);
    return bUpdated - aUpdated;
  });
};

export const updateAgencyProfile = async (id: string, updates: any) => {
  const path = `agency_profiles/${id}`;
  try {
    const docRef = doc(db, 'agency_profiles', id);
    await setDoc(docRef, { ...updates, updated_at: serverTimestamp() }, { merge: true });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// --- FAMILIES ---
export const getFamilyProfile = async (familyId: string): Promise<FamilyProfile | null> => {
  const path = `families/${familyId}`;
  try {
    const familyDoc = await getDoc(doc(db, 'families', familyId));
    let combined: FamilyProfile | null = null;

    if (familyDoc.exists()) {
      combined = {
        id: familyDoc.id,
        ...familyDoc.data()
      } as FamilyProfile;
    } else {
      const profileDoc = await getDoc(doc(db, 'family_profiles', familyId));
      if (profileDoc.exists()) {
        combined = {
          id: profileDoc.id,
          ...profileDoc.data()
        } as FamilyProfile;
      } else {
        const fallbackQuery = query(collection(db, 'family_profiles'), where('family_id', '==', familyId));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        if (!fallbackSnapshot.empty) {
          const fallbackDoc = fallbackSnapshot.docs[0];
          combined = {
            id: fallbackDoc.id,
            ...fallbackDoc.data()
          } as FamilyProfile;
          if (combined.family_id) {
            const fallbackFamilyDoc = await getDoc(doc(db, 'families', combined.family_id));
            if (fallbackFamilyDoc.exists()) {
              combined = {
                ...combined,
                ...fallbackFamilyDoc.data(),
                id: fallbackFamilyDoc.id
              } as FamilyProfile;
            }
          }
        }
      }
    }

    if (!combined) return null;

    if (!combined.family_name && combined.name) {
      combined.family_name = combined.name;
    }
    if (!combined.name && combined.family_name) {
      combined.name = combined.family_name;
    }

    if (combined.onboarding_complete === undefined) {
      const hasChildren = Array.isArray(combined.children) && combined.children.length > 0;
      const hasLocation = !!combined.location_neighborhood || !!combined.location_borough;
      const hasContact = !!combined.phone || !!combined.email;
      combined.onboarding_complete = !!(hasChildren && hasLocation && hasContact);
    }

    return combined;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateFamilyProfile = async (familyId: string, data: { family?: any, profile?: any }) => {
  try {
    if (data.family) {
      await setDoc(doc(db, 'families', familyId), { ...data.family, updated_at: serverTimestamp() }, { merge: true });
    }
    
    if (data.profile) {
      // Merge profile fields into families document directly so there is no separate collection.
      await setDoc(doc(db, 'families', familyId), {
        ...data.profile,
        family_id: familyId,
        updated_at: serverTimestamp()
      }, { merge: true });
    }
    
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${familyId}`);
  }
};

export const saveJob = async (familyId: string, jobId: string) => {
  const path = 'saved_jobs';
  try {
    const docRef = await addDoc(collection(db, path), {
      family_id: familyId,
      job_id: jobId,
      created_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const unsaveJob = async (familyId: string, jobId: string) => {
  const path = 'saved_jobs';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId), where('job_id', '==', jobId));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getSavedJobs = async (familyId: string): Promise<any[]> => {
  const path = 'saved_jobs';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    const saved = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const jobDoc = await getDoc(doc(db, 'jobs', data.job_id));
      let jobWithAgency = null;
      if (jobDoc.exists()) {
        const jobData = jobDoc.data();
        const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
        jobWithAgency = {
          id: jobDoc.id,
          ...jobData,
          agency_profiles: agencyDoc.exists() ? agencyDoc.data() : null
        } as Job;
      }
      return { id: d.id, ...data, jobs: jobWithAgency };
    }));
    return saved;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const applyToJob = async (familyId: string, jobId: string, agencyId: string) => {
  const path = 'family_applications';
  try {
    const docRef = await addDoc(collection(db, path), {
      family_id: familyId,
      job_id: jobId,
      agency_id: agencyId,
      status: 'pending',
      created_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getFamilyApplications = async (familyId: string): Promise<any[]> => {
  const path = 'family_applications';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    const apps = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const jobDoc = await getDoc(doc(db, 'jobs', data.job_id));
      let jobWithAgency = null;
      if (jobDoc.exists()) {
        const jobData = jobDoc.data();
        const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
        jobWithAgency = {
          id: jobDoc.id,
          ...jobData,
          agency_profiles: agencyDoc.exists() ? agencyDoc.data() : null
        } as Job;
      }
      return { id: d.id, ...data, jobs: jobWithAgency };
    }));
    return apps;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getFamilyPlacementApplications = async (familyId: string): Promise<Application[]> => {
  const path = 'applications';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    const apps = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const [jobDoc, nannyDoc] = await Promise.all([
        getDoc(doc(db, 'jobs', data.job_id)),
        getDoc(doc(db, 'nanny_profiles', data.nanny_id))
      ]);

      let jobWithAgency: Job | null = null;
      if (jobDoc.exists()) {
        const jobData = jobDoc.data();
        const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
        jobWithAgency = {
          id: jobDoc.id,
          ...jobData,
          agency_profiles: agencyDoc.exists() ? agencyDoc.data() : null
        } as Job;
      }

      return {
        id: d.id,
        ...data,
        jobs: jobWithAgency,
        nanny_profiles: nannyDoc.exists() ? nannyDoc.data() : null
      } as Application;
    }));

    const toMillis = (value: any): number => {
      if (!value) return 0;
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return apps.sort((a, b) => toMillis(b.updated_at || b.created_at) - toMillis(a.updated_at || a.created_at));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getFamilyCareHistory = async (familyId: string): Promise<CareHistory[]> => {
  const path = 'care_history';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as CareHistory))
      .sort((a, b) => toMillisSafe(b.updated_at || b.end_date || b.start_date) - toMillisSafe(a.updated_at || a.end_date || a.start_date));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const followAgency = async (familyId: string, agencyId: string) => {
  const path = 'family_agency_follows';
  try {
    const existingQuery = query(
      collection(db, path),
      where('family_id', '==', familyId),
      where('agency_id', '==', agencyId)
    );
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) return existingSnap.docs[0].id;

    const docRef = await addDoc(collection(db, path), {
      family_id: familyId,
      agency_id: agencyId,
      created_at: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const unfollowAgency = async (familyId: string, agencyId: string) => {
  const path = 'family_agency_follows';
  try {
    const q = query(
      collection(db, path),
      where('family_id', '==', familyId),
      where('agency_id', '==', agencyId)
    );
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(docItem => deleteDoc(docItem.ref)));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const getFamilyFollowedAgencies = async (familyId: string): Promise<string[]> => {
  const path = 'family_agency_follows';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().agency_id as string);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addCareHistory = async (history: CareHistory) => {
  const path = 'care_history';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...history,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

const addDaysIso = (value: string, days: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const recordCareHistoryFromApplication = async (
  applicationId: string,
  placementStatus: 'active' | 'completed' = 'completed'
) => {
  const appPath = `application/${applicationId}`;
  try {
    const familyAppDoc = await getDoc(doc(db, 'family_applications', applicationId));
    const agencyAppDoc = familyAppDoc.exists() ? null : await getDoc(doc(db, 'applications', applicationId));

    if (!familyAppDoc.exists() && !agencyAppDoc?.exists()) return null;

    const fromFamilyApplication = familyAppDoc.exists();
    const app = fromFamilyApplication ? familyAppDoc.data() : agencyAppDoc!.data();
    const jobId = app.job_id;
    const nannyId = app.nanny_id;
    if (!jobId || !nannyId) return null;

    const jobDoc = await getDoc(doc(db, 'jobs', jobId));
    const jobData = jobDoc.exists() ? (jobDoc.data() as any) : null;
    const agencyId = app.agency_id || jobData?.agency_id;
    const familyId = app.family_id || jobData?.family_id || null;

    if (!familyId || !agencyId) return null;

    const existingQ = query(
      collection(db, 'care_history'),
      where('family_id', '==', familyId),
      where('job_id', '==', jobId),
      where('nanny_id', '==', nannyId)
    );
    const existingSnap = await getDocs(existingQ);
    const existingDoc = existingSnap.empty ? null : existingSnap.docs[0];
    const existingHistory = existingDoc ? (existingDoc.data() as CareHistory) : null;

    const agencyDoc = await getDoc(doc(db, 'agency_profiles', agencyId));
    const nannyDoc = await getDoc(doc(db, 'nanny_profiles', nannyId));
    const derivedStartDate = existingHistory?.start_date
      || app.start_date
      || (typeof app.active_at?.toDate === 'function' ? app.active_at.toDate().toISOString() : app.active_at)
      || new Date().toISOString();
    const weekOneReviewAvailableAt = existingHistory?.week_one_review_available_at || addDaysIso(derivedStartDate, 7);
    const completedAt = new Date().toISOString();

    const history: CareHistory = {
      family_id: familyId,
      job_id: jobId,
      agency_id: agencyId,
      nanny_id: nannyId,
      family_application_id: fromFamilyApplication ? applicationId : undefined,
      agency_application_id: fromFamilyApplication ? undefined : applicationId,
      source_inquiry_id: app.source_inquiry_id || jobData?.source_inquiry_id || undefined,
      job_title: jobData?.title,
      job_type: jobData?.job_type,
      location_borough: jobData?.location_borough,
      location_neighborhood: jobData?.location_neighborhood,
      agency_name: agencyDoc.exists() ? (agencyDoc.data() as any).company_name : undefined,
      nanny_name: nannyDoc.exists() ? `${(nannyDoc.data() as any).first_name || ''} ${(nannyDoc.data() as any).last_name || ''}`.trim() : undefined,
      placement_status: placementStatus,
      start_date: derivedStartDate,
      end_date: placementStatus === 'completed' ? (existingHistory?.end_date || completedAt) : existingHistory?.end_date,
      week_one_review_available_at: weekOneReviewAvailableAt,
      summary: app.call_note || (placementStatus === 'completed' ? 'Care placement completed.' : 'Placement started and is in progress.'),
      reviewed_agency_by_family: existingHistory?.reviewed_agency_by_family || false,
      reviewed_nanny_by_family: existingHistory?.reviewed_nanny_by_family || false,
      reviewed_agency_week_one_by_family: existingHistory?.reviewed_agency_week_one_by_family || false,
      reviewed_nanny_week_one_by_family: existingHistory?.reviewed_nanny_week_one_by_family || false,
      reviewed_agency_completion_by_family: existingHistory?.reviewed_agency_completion_by_family || false,
      reviewed_nanny_completion_by_family: existingHistory?.reviewed_nanny_completion_by_family || false,
      rating: 0,
      review: ''
    };

    if (existingDoc) {
      await updateDoc(existingDoc.ref, {
        ...history,
        updated_at: serverTimestamp(),
      });
      return { id: existingDoc.id };
    }

    return await addCareHistory(history);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, appPath);
  }
};

// --- REVIEWS ---
export type NannyReview = StructuredNannyReview;

export interface NannyReviewInput extends Partial<StructuredNannyReview> {
  nanny_id: string;
  reviewer_id: string;
  reviewer_type?: NannyReviewerType;
  reviewer_role?: NannyReviewerType;
  relationship_context?: NannyReviewRelationshipContext;
  rating?: number;
  comment?: string;
}

export interface NannyReviewSummary extends NannyReviewAggregate {
  averageRating: number;
  highlightText: string;
}

export interface AgencyReview {
  id?: string;
  agency_id: string;
  reviewer_id: string;
  reviewer_role: 'family' | 'agency' | 'nanny';
  rating: number;
  comment: string;
  created_at?: any;
}

const normalizeReviewScore = (value: unknown, fallback = 5) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(5, Math.round(numeric)));
};

const buildStructuredNannyReview = (review: NannyReviewInput): StructuredNannyReview => {
  const reviewerType = (review.reviewer_type || review.reviewer_role || 'family') as NannyReviewerType;
  const legacyRating = normalizeReviewScore(review.rating, 5);

  return normalizeStructuredNannyReview({
    ...review,
    reviewer_type: reviewerType,
    reviewer_role: reviewerType,
    relationship_context: review.relationship_context || (reviewerType === 'agency' ? 'placed' : 'engagement_completed'),
    reliability_rating: normalizeReviewScore(review.reliability_rating, legacyRating),
    communication_rating: normalizeReviewScore(review.communication_rating, legacyRating),
    punctuality: typeof review.punctuality === 'boolean' ? review.punctuality : legacyRating >= 4,
    rehire: typeof review.rehire === 'boolean' ? review.rehire : legacyRating >= 4,
    strengths: sanitizeReviewText(review.strengths || review.comment, 120),
    notes: sanitizeReviewText(review.notes || review.comment, 240),
    status: review.status || 'active',
    moderated_status: review.moderated_status || 'approved',
    visible_to_agencies: review.visible_to_agencies ?? true,
    visible_to_families: review.visible_to_families ?? true,
    internal_only: review.internal_only ?? false,
  });
};

const getAgencyNannyReviewEligibility = async (review: StructuredNannyReview) => {
  if (review.relationship_reference_type === 'application' && review.relationship_reference_id) {
    const applicationDoc = await getDoc(doc(db, 'applications', review.relationship_reference_id));
    if (!applicationDoc.exists()) {
      return { allowed: false, message: 'Application record not found.' };
    }

    const application = applicationDoc.data() as any;
    if (application.agency_id !== review.reviewer_id || application.nanny_id !== review.nanny_id) {
      return { allowed: false, message: 'This application does not match the selected nanny.' };
    }

    return { allowed: true };
  }

  if (review.relationship_reference_type === 'managed_profile' || review.relationship_context === 'managed') {
    const profile = await getNannyById(review.nanny_id);
    if (profile?.agency_id === review.reviewer_id) {
      return { allowed: true };
    }
    return { allowed: false, message: 'Only the managing agency can review this nanny from the talent pool.' };
  }

  const applicationQuery = query(collection(db, 'applications'), where('agency_id', '==', review.reviewer_id));
  const snapshot = await getDocs(applicationQuery);
  const matching = snapshot.docs.find((entry) => (entry.data() as any).nanny_id === review.nanny_id);
  if (matching) {
    return { allowed: true };
  }

  return { allowed: false, message: 'A verified agency relationship is required before submitting a review.' };
};

const getFamilyNannyReviewEligibility = async (review: StructuredNannyReview) => {
  if (!review.relationship_reference_id) {
    return { allowed: false, message: 'Completed care history is required before a family can review a nanny.' };
  }

  const careHistoryDoc = await getDoc(doc(db, 'care_history', review.relationship_reference_id));
  if (!careHistoryDoc.exists()) {
    return { allowed: false, message: 'Care history record not found.' };
  }

  const careHistory = careHistoryDoc.data() as any;
  if (careHistory.family_id !== review.reviewer_id || careHistory.nanny_id !== review.nanny_id) {
    return { allowed: false, message: 'This care history record does not match the selected nanny.' };
  }

  return { allowed: true };
};

export const getNannyReviews = async (nannyId: string): Promise<NannyReview[]> => {
  const path = 'nanny_reviews';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => normalizeStructuredNannyReview({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getNannyReviewSummary = async (
  nannyId: string,
  shiftScoreConfig?: ShiftScoreConfigOverrides
): Promise<NannyReviewSummary> => {
  const reviews = await getNannyReviews(nannyId);
  const config = resolveShiftScoreConfig(shiftScoreConfig);
  const reviewSummary = aggregateShiftScoreReviews(reviews, config.reviewWeights);
  const aggregate: NannyReviewAggregate = {
    reviewCount: reviewSummary.reviewCount,
    agencyReviewCount: reviewSummary.agencyReviewCount,
    familyReviewCount: reviewSummary.familyReviewCount,
    averageReliability: reviewSummary.averageReliability,
    averageCommunication: reviewSummary.averageCommunication,
    punctualityRate: reviewSummary.punctualityRate,
    rehireRate: reviewSummary.rehireRate,
    shiftScore: reviewSummary.shiftScore,
    strongSignals: reviewSummary.highlights,
  };

  return {
    ...aggregate,
    averageRating: aggregate.reviewCount > 0
      ? Math.round(((aggregate.averageReliability + aggregate.averageCommunication) / 2) * 10) / 10
      : 0,
    highlightText: reviewSummary.highlightText,
  };
};

export const getAgencyReviews = async (agencyId: string): Promise<AgencyReview[]> => {
  const path = 'agency_reviews';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AgencyReview));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addNannyReview = async (review: NannyReviewInput) => {
  const path = 'nanny_reviews';
  try {
    const structuredReview = buildStructuredNannyReview(review);
    const validationErrors = validateStructuredNannyReview(structuredReview);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    const eligibility = structuredReview.reviewer_type === 'agency'
      ? await getAgencyNannyReviewEligibility(structuredReview)
      : await getFamilyNannyReviewEligibility(structuredReview);

    if (!eligibility.allowed) {
      throw new Error(eligibility.message);
    }

    const duplicateQuery = query(
      collection(db, path),
      where('nanny_id', '==', structuredReview.nanny_id),
      where('reviewer_id', '==', structuredReview.reviewer_id),
      where('reviewer_type', '==', structuredReview.reviewer_type)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);
    const duplicate = duplicateSnapshot.docs.find((entry) => {
      const data = entry.data() as any;
      return (
        (data.relationship_reference_id || '') === (structuredReview.relationship_reference_id || '') &&
        (data.relationship_reference_type || '') === (structuredReview.relationship_reference_type || '')
      );
    });

    if (duplicate) {
      throw new Error('A review has already been submitted for this relationship.');
    }

    const docRef = await addDoc(collection(db, path), {
      ...structuredReview,
      reviewer_role: structuredReview.reviewer_type,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    const savedDoc = await getDoc(docRef);
    return normalizeStructuredNannyReview({ id: savedDoc.id, ...savedDoc.data() });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const addAgencyReview = async (review: AgencyReview) => {
  const path = 'agency_reviews';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...review,
      created_at: serverTimestamp()
    });
    const savedDoc = await getDoc(docRef);
    return { id: savedDoc.id, ...savedDoc.data() } as AgencyReview;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getNannyReviewStats = async (nannyId: string) => {
  const summary = await getNannyReviewSummary(nannyId);
  return {
    count: summary.reviewCount,
    avg: summary.averageRating,
    summary,
  };
};

export const getAgencyReviewStats = async (agencyId: string) => {
  const reviews = await getAgencyReviews(agencyId);
  const count = reviews.length;
  const avg = count > 0 ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / count : 0;
  return { count, avg };
};

export const submitCareHistoryReview = async ({
  careHistoryId,
  familyId,
  target,
  phase = 'completion',
  agencyId,
  nannyId,
  rating,
  comment,
  review
}: {
  careHistoryId: string;
  familyId: string;
  target: 'agency' | 'nanny';
  phase?: 'week_one' | 'completion';
  agencyId?: string;
  nannyId?: string;
  rating: number;
  comment: string;
  review?: Omit<NannyReviewInput, 'nanny_id' | 'reviewer_id' | 'reviewer_type' | 'reviewer_role' | 'relationship_reference_type' | 'relationship_reference_id'>;
}) => {
  const path = `care_history/${careHistoryId}`;
  try {
    if (target === 'agency' && agencyId) {
      await addAgencyReview({
        agency_id: agencyId,
        reviewer_id: familyId,
        reviewer_role: 'family',
        rating,
        comment
      });
      await updateDoc(doc(db, 'care_history', careHistoryId), {
        ...(phase === 'week_one'
          ? { reviewed_agency_week_one_by_family: true }
          : {
              reviewed_agency_by_family: true,
              reviewed_agency_completion_by_family: true,
            }),
        updated_at: serverTimestamp()
      });
    }

    if (target === 'nanny' && nannyId) {
      await addNannyReview({
        nanny_id: nannyId,
        reviewer_id: familyId,
        reviewer_type: 'family',
        reviewer_role: 'family',
        relationship_reference_type: 'care_history',
        relationship_reference_id: careHistoryId,
        relationship_context: review?.relationship_context || (phase === 'week_one' ? 'trial_completed' : 'engagement_completed'),
        rating,
        comment,
        ...review,
      });
      await updateDoc(doc(db, 'care_history', careHistoryId), {
        ...(phase === 'week_one'
          ? { reviewed_nanny_week_one_by_family: true }
          : {
              reviewed_nanny_by_family: true,
              reviewed_nanny_completion_by_family: true,
            }),
        updated_at: serverTimestamp()
      });
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

export const getAgencyPosts = async (agencyId: string): Promise<AgencyPost[]> => {
  const path = 'agency_posts';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AgencyPost));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addAgencyPost = async (agencyId: string, title: string, content: string) => {
  const path = 'agency_posts';
  try {
    const docRef = await addDoc(collection(db, path), {
      agency_id: agencyId,
      title,
      content,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);

    // Fallback: route through backend (admin SDK) when client-side Firestore rules deny writes.
    try {
      const callerUserId = auth.currentUser?.uid;
      if (!callerUserId || !agencyId) return;

      const headers = await buildApiHeaders({
        'x-agency-id': agencyId,
      });

      const response = await fetch(buildApiUrl('/api/agency/posts'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, content })
      });

      if (!response.ok) {
        const serverErr = await response.json().catch(() => ({}));
        console.error('[addAgencyPost] server fallback failed:', serverErr?.error || response.statusText);
        return;
      }

      const payload = await response.json();
      if (payload?.id) return { id: payload.id as string };
    } catch (fallbackError) {
      console.error('[addAgencyPost] server fallback error:', fallbackError);
    }
  }
};

// --- FORWARDING NANNY PROFILES ---
export interface ChildProfile {
  name: string;
  age: number;
  allergies?: string[];
  special_needs?: string;
  notes?: string;
}

export interface FamilyProfileItem {
  family_id: string;
  family_name?: string;
  email?: string;
  phone?: string;
  location_borough?: string;
  location_neighborhood?: string;
  children?: ChildProfile[];
  care_needs?: string;
  updated_at?: any;
}

export interface ForwardedNannyProfile {
  id?: string;
  agency_id: string;
  family_id: string;
  nanny_id: string;
  job_id: string;
  job_title: string;
  message?: string;
  nanny_snapshot: Partial<NannyProfile>;
  certifications?: string[];
  resume_url?: string;
  created_at?: any;
}

export const forwardNannyToFamily = async (forward: ForwardedNannyProfile) => {
  const path = 'nanny_forwards';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...forward,
      created_at: serverTimestamp()
    });
    const savedDoc = await getDoc(docRef);
    return { id: savedDoc.id, ...savedDoc.data() } as ForwardedNannyProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getFamilyForwards = async (familyId: string): Promise<ForwardedNannyProfile[]> => {
  const path = 'nanny_forwards';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ForwardedNannyProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getFamilies = async (): Promise<FamilyProfileItem[]> => {
  const path = 'families';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(d => ({ family_id: d.id, ...d.data() } as FamilyProfileItem));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
export type NotificationType = 'application' | 'message' | 'review' | 'system';

export interface FamilyNotification {
  id?: string;
  family_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read?: boolean;
  created_at?: any;
  updated_at?: any;
}

export const getFamilyNotifications = async (familyId: string): Promise<FamilyNotification[]> => {
  const path = 'family_notifications';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyNotification));
    // Sort by created_at descending
    return notifs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export interface AgencyInquiryPayload {
  description: string;
  schedule_type: 'date_range' | 'weekly_days';
  start_date?: string;
  end_date?: string;
  weekdays?: string[];
}

export interface AgencyInquiryConversationInput {
  familyId: string;
  agencyId: string;
  familyName: string;
  familyEmail?: string;
  familyPhone?: string;
  familyBorough?: string;
  agencyName?: string;
  inquiry: AgencyInquiryPayload;
}

export type InquiryStage = 'new' | 'communicated' | 'done';

export interface AgencyTalentPoolItem {
  id: string;
  agency_id: string;
  nanny_id: string;
  status?: string;
  invitation_status?: 'pending' | 'accepted' | 'declined' | 'left';
  agency_name?: string;
  invited_at?: any;
  responded_at?: any;
  left_at?: any;
  exclusion_note?: string;
  tags?: string[];
  latest_note?: string;
  created_at?: any;
  updated_at?: any;
  nanny_profile?: NannyProfile | null;
}

export const addFamilyNotification = async (familyId: string, title: string, message: string, link?: string) => {
  const path = 'family_notifications';
  try {
    const docRef = await addDoc(collection(db, path), {
      family_id: familyId,
      type: 'application',
      title,
      message,
      link: link || '/family/notifications',
      read: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    await queuePushNotification({
      recipientRole: 'family',
      recipientUserId: familyId,
      title,
      message,
      link: link || '/family/notifications',
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const markFamilyNotificationRead = async (notificationId: string) => {
  const path = `family_notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'family_notifications', notificationId);
    await updateDoc(docRef, { read: true, updated_at: serverTimestamp() });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const addNannyNotification = async (nannyId: string, title: string, message: string, link?: string) => {
  const path = 'nanny_notifications';
  try {
    const docRef = await addDoc(collection(db, path), {
      nanny_id: nannyId,
      type: 'application',
      title,
      message,
      link: link || '/nanny/notifications',
      read: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    await queuePushNotification({
      recipientRole: 'nanny',
      recipientUserId: nannyId,
      title,
      message,
      link: link || '/nanny/notifications',
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export interface NannyNotification {
  id?: string;
  nanny_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read?: boolean;
  created_at?: any;
  updated_at?: any;
}

export const getNannyNotifications = async (nannyId: string): Promise<NannyNotification[]> => {
  const path = 'nanny_notifications';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId));
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NannyNotification));
    // Sort by created_at descending
    return notifs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

// --- AGENCY NOTIFICATIONS ---
export interface AgencyNotification {
  id?: string;
  agency_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read?: boolean;
  created_at?: any;
  updated_at?: any;
}

export const getAgencyNotifications = async (agencyId: string): Promise<AgencyNotification[]> => {
  const path = 'agency_notifications';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AgencyNotification));
    // Sort by created_at descending
    return notifs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addAgencyNotification = async (agencyId: string, title: string, message: string, link?: string) => {
  const path = 'agency_notifications';
  try {
    const docRef = await addDoc(collection(db, path), {
      agency_id: agencyId,
      type: 'message' as NotificationType,
      title,
      message,
      link: link || '/agency/messages',
      read: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    await queuePushNotification({
      recipientRole: 'agency',
      recipientUserId: agencyId,
      title,
      message,
      link: link || '/agency/messages',
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

async function queuePushNotification(input: {
  recipientRole: 'nanny' | 'family' | 'agency' | 'agency_admin' | 'agency_recruiter';
  recipientUserId: string;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    const headers = await buildApiHeaders();
    const response = await fetch(buildApiUrl('/api/notifications/queue'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.warn('[notifications] failed to queue push job', payload?.error || response.statusText);
    }
  } catch (error) {
    console.warn('[notifications] failed to queue push job', error);
  }
}

export const markAgencyNotificationRead = async (notificationId: string) => {
  const path = `agency_notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'agency_notifications', notificationId);
    await updateDoc(docRef, { read: true, updated_at: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --- ADMIN NOTIFICATIONS ---
export interface AdminNotification {
  id?: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read?: boolean;
  created_at?: any;
  updated_at?: any;
}

export const addAdminNotification = async (adminUserId: string, title: string, message: string, link?: string) => {
  const path = 'admin_notifications';
  try {
    const docRef = await addDoc(collection(db, path), {
      user_id: adminUserId,
      type: 'system' as NotificationType,
      title,
      message,
      link: link || '/admin/verification',
      read: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getAdminNotifications = async (adminUserId: string): Promise<AdminNotification[]> => {
  const path = 'admin_notifications';
  try {
    const q = query(collection(db, path), where('user_id', '==', adminUserId));
    const snapshot = await getDocs(q);
    const notifs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AdminNotification));
    // Sort by created_at descending
    return notifs.sort((a, b) => {
      const aTime = a.created_at?.toDate?.().getTime() ?? 0;
      const bTime = b.created_at?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const markAdminNotificationRead = async (notificationId: string) => {
  const path = `admin_notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'admin_notifications', notificationId);
    await updateDoc(docRef, { read: true, updated_at: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --- AGENCY POSTS (delete) ---
export const deleteAgencyPost = async (postId: string) => {
  const path = `agency_posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'agency_posts', postId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

// --- USERS ---
export const getUsers = async () => {
  const path = 'users';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs
      .map(d => ({ id: d.id, status: 'active', ...d.data() } as User))
      .sort((a, b) => {
        const aDate = (() => {
          if (!a.created_at) return 0;
          if (typeof a.created_at?.toDate === 'function') return a.created_at.toDate().getTime();
          if (typeof a.created_at?.seconds === 'number') return a.created_at.seconds * 1000;
          const parsed = new Date(a.created_at).getTime();
          return Number.isNaN(parsed) ? 0 : parsed;
        })();
        const bDate = (() => {
          if (!b.created_at) return 0;
          if (typeof b.created_at?.toDate === 'function') return b.created_at.toDate().getTime();
          if (typeof b.created_at?.seconds === 'number') return b.created_at.seconds * 1000;
          const parsed = new Date(b.created_at).getTime();
          return Number.isNaN(parsed) ? 0 : parsed;
        })();
        return bDate - aDate;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const updateAdminUser = async (
  userId: string,
  updates: Partial<Pick<User, 'role' | 'status' | 'agency_id'>>
): Promise<User | null> => {
  const path = `users/${userId}`;
  try {
    if (!userId) return null;

    const userRef = doc(db, 'users', userId);
    const existingUserSnap = await getDoc(userRef);
    const existingUserData = existingUserSnap.exists() ? existingUserSnap.data() : {};

    const nextRole = (updates.role || existingUserData?.role || 'family') as AppUserRole;
    const requestedAgencyId = typeof updates.agency_id === 'string' ? updates.agency_id.trim() : undefined;
    const nextAgencyId = requestedAgencyId !== undefined
      ? (requestedAgencyId || null)
      : (typeof existingUserData?.agency_id === 'string' ? existingUserData.agency_id : null);

    const payload: Record<string, any> = {
      updated_at: serverTimestamp(),
    };

    if (updates.role) payload.role = updates.role;
    if (updates.status) payload.status = updates.status;
    if (requestedAgencyId !== undefined) {
      payload.agency_id = nextAgencyId;
      payload.agency_profile_id = nextAgencyId;
    }

    await updateDoc(userRef, payload);

    const recruiterSeatsQuery = query(collection(db, 'agency_recruiters'), where('user_id', '==', userId));
    const recruiterSeatsSnap = await getDocs(recruiterSeatsQuery);
    const recruiterSeats = recruiterSeatsSnap.docs;

    if (nextRole === 'agency_recruiter' && nextAgencyId) {
      const matchingSeat = recruiterSeats.find((seat) => seat.data()?.agency_id === nextAgencyId);
      const email = String(existingUserData?.email || '');
      const firstName = String(existingUserData?.first_name || '').trim() || 'Recruiter';
      const lastName = String(existingUserData?.last_name || '').trim() || 'User';

      if (matchingSeat) {
        await updateDoc(matchingSeat.ref, {
          agency_id: nextAgencyId,
          email,
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'agency_recruiters'), {
          agency_id: nextAgencyId,
          user_id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      await Promise.all(
        recruiterSeats
          .filter((seat) => seat.id !== matchingSeat?.id)
          .map((seat) => deleteDoc(seat.ref))
      );
    } else if (!recruiterSeatsSnap.empty) {
      await Promise.all(recruiterSeats.map((seat) => deleteDoc(seat.ref)));
    }

    const updated = await getDoc(userRef);
    return updated.exists() ? ({ id: updated.id, status: 'active', ...updated.data() } as User) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

export const getConversations = async (userId: string, role: 'family' | 'nanny' | 'agency') => {
  const path = 'conversations';
  if (!userId) return [];
  try {
    let q = query(collection(db, path), where('participants', 'array-contains', userId));
    const snapshot = await getDocs(q);
    const conversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const toMillis = (value: any): number => {
      if (!value) return 0;
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return conversations.sort((a: any, b: any) => {
      const aUpdated = toMillis(a.updated_at || a.created_at);
      const bUpdated = toMillis(b.updated_at || b.created_at);
      return bUpdated - aUpdated;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAgencyConversations = async (agencyId: string) => {
  const path = 'conversations';
  try {
    console.log(`[DEBUG] getAgencyConversations(${agencyId}): querying conversations`);
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
    const snapshot = await getDocs(q);
    const conversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`[DEBUG] getAgencyConversations(${agencyId}): found ${conversations.length} conversations`);

    const toMillis = (value: any): number => {
      if (!value) return 0;
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return conversations.sort((a: any, b: any) => {
      const aUpdated = toMillis(a.updated_at || a.created_at);
      const bUpdated = toMillis(b.updated_at || b.created_at);
      return bUpdated - aUpdated;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const updateInquiryStage = async (conversationId: string, stage: InquiryStage) => {
  const path = `conversations/${conversationId}`;
  try {
    const convoRef = doc(db, 'conversations', conversationId);
    await updateDoc(convoRef, {
      inquiry_stage: stage,
      updated_at: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const getAgencyTalentPool = async (agencyId: string): Promise<AgencyTalentPoolItem[]> => {
  const path = 'agency_talent_pool';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
    const snapshot = await getDocs(q);

    const items = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const nannyDoc = await getDoc(doc(db, 'nanny_profiles', data.nanny_id));
      return {
        id: d.id,
        ...data,
        invitation_status: (['pending', 'accepted', 'declined', 'left'].includes(String(data.invitation_status || '').trim().toLowerCase())
          ? String(data.invitation_status || '').trim().toLowerCase()
          : 'accepted') as 'pending' | 'accepted' | 'declined' | 'left',
        nanny_profile: nannyDoc.exists() ? ({ id: nannyDoc.id, ...nannyDoc.data() } as NannyProfile) : null
      } as AgencyTalentPoolItem;
    }));

    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addNannyToAgencyTalentPool = async (agencyId: string, nannyId: string) => {
  const headers = await buildApiHeaders({ 'x-agency-id': agencyId });
  const response = await fetch(buildApiUrl('/api/agency/talent-pool/invite'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ nannyId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to invite nanny to talent pool');
  }

  return {
    id: String(payload?.id || ''),
    invitation_status: (payload?.invitation_status || 'pending') as 'pending' | 'accepted' | 'declined' | 'left',
    alreadyExists: !!payload?.alreadyExists,
  };
};

export const getNannyTalentPools = async (): Promise<AgencyTalentPoolItem[]> => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/nanny/talent-pools'), {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load talent-pool memberships');
  }

  return Array.isArray(payload?.items)
    ? payload.items.map((item: any) => ({
      id: String(item.id || ''),
      agency_id: String(item.agency_id || ''),
      agency_name: String(item.agency_name || 'Agency'),
      nanny_id: String(item.nanny_id || ''),
      status: String(item.status || 'new'),
      invitation_status: (['pending', 'accepted', 'declined', 'left'].includes(String(item.invitation_status || '').trim().toLowerCase())
        ? String(item.invitation_status || '').trim().toLowerCase()
        : 'accepted') as 'pending' | 'accepted' | 'declined' | 'left',
      invited_at: item.invited_at,
      responded_at: item.responded_at,
      left_at: item.left_at,
      exclusion_note: typeof item.exclusion_note === 'string' ? item.exclusion_note : '',
      latest_note: typeof item.latest_note === 'string' ? item.latest_note : '',
      created_at: item.created_at,
      updated_at: item.updated_at,
    }))
    : [];
};

export const respondToTalentPoolInvite = async (itemId: string, responseStatus: 'accepted' | 'declined') => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl(`/api/nanny/talent-pools/${encodeURIComponent(itemId)}/respond`), {
    method: 'POST',
    headers,
    body: JSON.stringify({ response: responseStatus }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to respond to talent-pool invite');
  }

  return payload;
};

export const leaveTalentPool = async (itemId: string, exclusionNote: string) => {
  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl(`/api/nanny/talent-pools/${encodeURIComponent(itemId)}/leave`), {
    method: 'POST',
    headers,
    body: JSON.stringify({ exclusionNote }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to leave talent pool');
  }

  return payload;
};

export const updateAgencyTalentPoolItem = async (
  itemId: string,
  updates: {
    status?: string;
    tags?: string[];
    latest_note?: string;
  }
) => {
  const path = `agency_talent_pool/${itemId}`;
  try {
    const docRef = doc(db, 'agency_talent_pool', itemId);
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(docRef, {
      ...cleanedUpdates,
      updated_at: serverTimestamp(),
    });
    const updatedDoc = await getDoc(docRef);
    return updatedDoc.exists() ? { id: updatedDoc.id, ...updatedDoc.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Agency Subscription & Add-On API
// ─────────────────────────────────────────────────────────────────────────────

export const getAgencySubscription = async (
  agencyId: string
): Promise<AgencySubscription | null> => {
  const path = 'agency_subscriptions';
  try {
    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      orderBy('created_at', 'desc'),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as AgencySubscription;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getAgencyAddons = async (
  agencyId: string
): Promise<AgencyAddon[]> => {
  const path = 'agency_addons';
  try {
    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyAddon));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAgencyEntitlementsForAgency = async (
  agencyId: string
): Promise<AgencyEntitlements> => {
  const [subscription, addons] = await Promise.all([
    getAgencySubscription(agencyId),
    getAgencyAddons(agencyId),
  ]);

  return resolveEntitlements(subscription, addons);
};

export const getNannyApplicationQuota = async (nannyId: string): Promise<{
  isPremium: boolean;
  monthlyLimit: number | null;
  used: number;
  remaining: number | null;
}> => {
  if (!nannyId) {
    return {
      isPremium: false,
      monthlyLimit: NANNY_FREE_APPLICATION_LIMIT,
      used: 0,
      remaining: NANNY_FREE_APPLICATION_LIMIT,
    };
  }

  const [profile, snapshot] = await Promise.all([
    getNannyById(nannyId),
    getDocs(query(collection(db, 'applications'), where('nanny_id', '==', nannyId))),
  ]);

  const premiumUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : 0;
  const isPremium = premiumUntil > Date.now();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const used = snapshot.docs.filter((entry) => getTimestampMillis(entry.data().created_at) >= thirtyDaysAgo).length;
  const monthlyLimit = isPremium ? null : NANNY_FREE_APPLICATION_LIMIT;

  return {
    isPremium,
    monthlyLimit,
    used,
    remaining: monthlyLimit === null ? null : Math.max(0, monthlyLimit - used),
  };
};

export const startAgencyPlanCheckout = async ({
  agencyId,
  userId,
  planCode,
  returnUrl,
  cancelUrl,
}: {
  agencyId: string;
  userId: string;
  planCode: PlanCode;
  returnUrl: string;
  cancelUrl: string;
}) => {
  if (planCode === PLAN_CODES.FREE) {
    throw new Error('Free is the default agency tier and does not require checkout.');
  }

  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/paypal/agency-plan/checkout'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ agencyId, userId, planCode, returnUrl, cancelUrl })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to start agency checkout.');
  }
  return payload;
};

export const finalizeAgencyPlanCheckout = async ({
  agencyId,
  userId,
  planCode,
  subscriptionId,
}: {
  agencyId: string;
  userId: string;
  planCode: PlanCode;
  subscriptionId?: string;
}) => {
  if (planCode === PLAN_CODES.FREE) {
    throw new Error('Free is the default agency tier and does not require activation.');
  }

  const headers = await buildApiHeaders();
  const response = await fetch(buildApiUrl('/api/paypal/agency-plan/activate'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ agencyId, userId, planCode, subscriptionId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to activate agency plan.');
  }
  return payload;
};

/**
 * Creates or replaces the active subscription for an agency.
 * Also denormalizes plan_tier onto agency_profiles so directory pages
 * can display tier badges without N+1 subscription lookups.
 * When billing is wired (PayPal), call this after a successful payment.
 */
export const upsertAgencySubscription = async (
  agencyId: string,
  planCode: PlanCode,
  priceAtPurchase: number
): Promise<string> => {
  const path = 'agency_subscriptions';
  try {
    const now = new Date().toISOString();
    const renewal = new Date();
    renewal.setMonth(renewal.getMonth() + 1);

    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);

    let subId: string;

    if (!snap.empty) {
      const existingRef = snap.docs[0].ref;
      await updateDoc(existingRef, {
        plan_code: planCode,
        status: 'active',
        renewal_date: renewal.toISOString(),
        price_at_purchase: priceAtPurchase,
        updated_at: now,
      });
      subId = snap.docs[0].id;
    } else {
      const ref = await addDoc(collection(db, path), {
        agency_id: agencyId,
        plan_code: planCode,
        status: 'active',
        start_date: now,
        renewal_date: renewal.toISOString(),
        price_at_purchase: priceAtPurchase,
        created_at: now,
        updated_at: now,
      });
      subId = ref.id;
    }

    // Denormalize plan_tier onto agency_profiles for directory ranking
    try {
      await updateDoc(doc(db, 'agency_profiles', agencyId), {
        plan_tier: planCode,
        updated_at: now,
      });
    } catch {
      // Non-blocking: profile update may fail if user isn't the profile owner
    }

    return subId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

/**
 * Activates or deactivates an add-on for an agency.
 * active = true to enable, false to cancel.
 * Also denormalizes `sponsored` onto agency_profiles when the
 * featured_agency_boost addon changes.
 */
export const upsertAgencyAddon = async (
  agencyId: string,
  addonCode: AddonCode,
  priceAtPurchase: number,
  active: boolean
): Promise<void> => {
  const path = 'agency_addons';
  try {
    const now = new Date().toISOString();
    const renewal = new Date();
    renewal.setMonth(renewal.getMonth() + 1);

    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      where('addon_code', '==', addonCode),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);

    const status = active ? 'active' : 'cancelled';

    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        status,
        renewal_date: active ? renewal.toISOString() : snap.docs[0].data().renewal_date,
        price_at_purchase: priceAtPurchase,
        updated_at: now,
      });
    } else {
      if (!active) return;
      await addDoc(collection(db, path), {
        agency_id: agencyId,
        addon_code: addonCode,
        status: 'active',
        start_date: now,
        renewal_date: renewal.toISOString(),
        price_at_purchase: priceAtPurchase,
        created_at: now,
        updated_at: now,
      });
    }

    // Denormalize sponsored flag onto agency_profiles for directory display
    if (addonCode === 'featured_agency_boost') {
      try {
        await updateDoc(doc(db, 'agency_profiles', agencyId), {
          sponsored: active,
          updated_at: now,
        });
      } catch {
        // Non-blocking
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

/** Count active (published) job postings for an agency — used to enforce plan limits. */
export const getActiveJobCount = async (agencyId: string): Promise<number> => {
  const path = 'jobs';
  try {
    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return 0;
  }
};

/** Count nanny profiles managed by an agency — used to enforce plan limits. */
export const getAgencyNannyProfileCount = async (
  agencyId: string
): Promise<number> => {
  const path = 'nanny_profiles';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return 0;
  }
};

/** Count active recruiter seats for an agency — used to enforce plan limits. */
export const getRecruiterSeatCount = async (agencyId: string): Promise<number> => {
  const path = 'agency_recruiters';
  try {
    const q = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return 0;
  }
};

export interface AgencyRecruiterSeat {
  id: string;
  agency_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  created_at?: any;
  updated_at?: any;
}

export interface AgencyRecruiterSeatSummary {
  plan_code: string;
  seat_limit: number | null;
  active_seat_count: number;
  recruiters: AgencyRecruiterSeat[];
}

export const getAgencyRecruiterSeats = async (agencyId: string): Promise<AgencyRecruiterSeatSummary> => {
  const headers = await buildApiHeaders({ 'x-agency-id': agencyId });
  const response = await fetch(buildApiUrl('/api/agency/recruiters'), {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load recruiter seats');
  }

  return {
    plan_code: String(payload?.plan_code || ''),
    seat_limit: payload?.seat_limit === null ? null : Number(payload?.seat_limit ?? 0),
    active_seat_count: Number(payload?.active_seat_count ?? 0),
    recruiters: Array.isArray(payload?.recruiters)
      ? payload.recruiters.map((item: any) => ({
        id: String(item.id || ''),
        agency_id: String(item.agency_id || ''),
        user_id: String(item.user_id || ''),
        email: String(item.email || ''),
        first_name: String(item.first_name || ''),
        last_name: String(item.last_name || ''),
        status: item.status === 'inactive' ? 'inactive' : 'active',
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
      : [],
  };
};

export const addAgencyRecruiterSeat = async (agencyId: string, input: {
  email: string;
  first_name: string;
  last_name: string;
}): Promise<{ success: boolean; message?: string }> => {
  const headers = await buildApiHeaders({ 'x-agency-id': agencyId });
  const response = await fetch(buildApiUrl('/api/agency/recruiter'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to add recruiter');
  }

  return {
    success: !!payload?.success,
    message: typeof payload?.message === 'string' ? payload.message : undefined,
  };
};

export const removeAgencyRecruiterSeat = async (agencyId: string, recruiterId: string): Promise<{ success: boolean; message?: string }> => {
  const headers = await buildApiHeaders({ 'x-agency-id': agencyId });
  const response = await fetch(buildApiUrl(`/api/agency/recruiter/${encodeURIComponent(recruiterId)}`), {
    method: 'DELETE',
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to remove recruiter');
  }

  return {
    success: !!payload?.success,
    message: typeof payload?.message === 'string' ? payload.message : undefined,
  };
};

// Start or resume a direct conversation between a family and an agency.
// Uses a deterministic doc ID so opening the same conversation twice is idempotent.
export const startConversation = async (
  familyId: string,
  agencyId: string,
  familyName: string,
  agencyName: string
): Promise<{ id: string } | null> => {
  const path = 'conversations';
  const conversationId = `${familyId}_${agencyId}`;
  try {
    const conversationRef = doc(db, path, conversationId);
    await setDoc(conversationRef, {
      participants: [familyId, agencyId],
      family_id: familyId,
      agency_id: agencyId,
      family_name: familyName,
      agency_name: agencyName,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp()
    }, { merge: true });
    return { id: conversationId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const startAgencyNannyConversation = async (
  agencyId: string,
  nannyId: string,
  agencyName: string,
  nannyName: string
): Promise<{ id: string } | null> => {
  const path = 'conversations';
  const conversationId = `${agencyId}_${nannyId}`;
  try {
    const conversationRef = doc(db, path, conversationId);
    await setDoc(conversationRef, {
      participants: [agencyId, nannyId],
      agency_id: agencyId,
      nanny_id: nannyId,
      agency_name: agencyName || 'Agency',
      nanny_name: nannyName || 'Nanny',
      conversation_type: 'agency_nanny',
      updated_at: serverTimestamp(),
      created_at: serverTimestamp()
    }, { merge: true });
    return { id: conversationId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const createAgencyInquiryConversation = async ({
  familyId,
  agencyId,
  familyName,
  familyEmail,
  familyPhone,
  familyBorough,
  agencyName,
  inquiry
}: AgencyInquiryConversationInput) => {
  const path = 'conversations';
  try {
    const conversationId = `${familyId}_${agencyId}`;
    const conversationRef = doc(db, path, conversationId);

    const scheduleSummary = inquiry.schedule_type === 'date_range'
      ? `Date range: ${inquiry.start_date || 'TBD'} to ${inquiry.end_date || 'TBD'}`
      : `Preferred weekdays: ${(inquiry.weekdays || []).join(', ')}`;

    const introMessage = [
      `New agency inquiry from ${familyName}.`,
      familyEmail ? `Email: ${familyEmail}` : null,
      familyPhone ? `Phone: ${familyPhone}` : null,
      familyBorough ? `Borough: ${familyBorough}` : null,
      scheduleSummary,
      '',
      inquiry.description
    ].filter(Boolean).join('\n');

    await setDoc(conversationRef, {
      participants: [familyId, agencyId],
      family_id: familyId,
      agency_id: agencyId,
      family_name: familyName,
      agency_name: agencyName || 'Agency',
      family_email: familyEmail || null,
      family_phone: familyPhone || null,
      family_borough: familyBorough || null,
      inquiry_type: 'agency_intro',
      inquiry_stage: 'new',
      inquiry_schedule_type: inquiry.schedule_type,
      inquiry_start_date: inquiry.schedule_type === 'date_range' ? inquiry.start_date || null : null,
      inquiry_end_date: inquiry.schedule_type === 'date_range' ? inquiry.end_date || null : null,
      inquiry_weekdays: inquiry.schedule_type === 'weekly_days' ? (inquiry.weekdays || []) : [],
      inquiry_description_preview: inquiry.description.slice(0, 280),
      last_message: inquiry.description.slice(0, 280),
      updated_at: serverTimestamp(),
      created_at: serverTimestamp()
    }, { merge: true });

    const sent = await sendMessage(conversationId, 'family', familyId, introMessage);
    if (!sent?.id) return null;

    // Notify the agency of the new inquiry (fire and forget)
    addAgencyNotification(
      agencyId,
      `New inquiry from ${familyName}`,
      inquiry.description.slice(0, 120),
      `/agency/messages?conversation=${conversationId}`
    ).catch(() => {/* non-critical */});

    return { id: conversationId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const getMessages = async (conversationId: string) => {
  const path = `conversations/${conversationId}/messages`;
  if (!conversationId) return [];
  try {
    const q = query(collection(db, path), orderBy('created_at', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const sendMessage = async (conversationId: string, senderType: 'family' | 'agency' | 'nanny', senderId: string, message: string) => {
  const path = `conversations/${conversationId}/messages`;
  const trimmedMessage = message.trim();
  if (!conversationId || !senderId || !trimmedMessage) return null;
  try {
    const docRef = await addDoc(collection(db, path), {
      sender_id: senderId,
      sender_type: senderType,
      content: trimmedMessage,
      created_at: serverTimestamp()
    });
    
    const newDoc = await getDoc(docRef);
    const createdMessage = {
      id: newDoc.id,
      ...newDoc.data(),
      content: (newDoc.data() as any)?.content || trimmedMessage,
      created_at: (newDoc.data() as any)?.created_at || new Date().toISOString()
    };

    // Update last message in conversation (non-blocking for send success)
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        last_message: trimmedMessage,
        updated_at: serverTimestamp()
      });
    } catch (updateError) {
      handleFirestoreError(updateError, OperationType.UPDATE, `conversations/${conversationId}`);
    }

    return createdMessage;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export type FamilyRequestStatus =
  | 'submitted'
  | 'matched'
  | 'no_match'
  | 'in_progress'
  | 'accepted'
  | 'family_chosen'
  | 'closed';

export type FamilyRequestCareType = 'full-time' | 'part-time' | 'temporary';
export type FamilyRequestLiveIn = 'live-in' | 'live-out' | 'either';
export type FamilyRequestAssignmentStatus = 'new' | 'accepted' | 'declined' | 'more_details';

export interface FamilyRequestInput {
  parent_name: string;
  email: string;
  phone?: string;
  borough: string;
  neighborhood?: string;
  children_count: number;
  child_age_groups: string[];
  care_type: FamilyRequestCareType;
  live_in: FamilyRequestLiveIn;
  start_date?: string;
  schedule?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  languages?: string[];
  driver_required?: boolean;
  pet_friendly?: boolean;
  special_needs?: boolean;
  special_requirements?: string;
  notes?: string;
}

export interface FamilyRequestRecord extends FamilyRequestInput {
  id: string;
  family_id: string | null;
  status: FamilyRequestStatus;
  top_match_count?: number;
  chosen_agency_id?: string | null;
  chosen_at?: any;
  created_at?: any;
  updated_at?: any;
}

export interface AgencyCapabilityProfile {
  id: string;
  agency_id: string;
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
  featured_until?: any;
  has_priority_lead_boost?: boolean;
  priority_lead_until?: any;
  created_at?: any;
  updated_at?: any;
}

export interface FamilyRequestMatchRow {
  id: string;
  request_id: string;
  agency_id: string;
  score: number;
  base_score: number;
  sponsored_boost: number;
  tier: MatchTier;
  reasons: string[];
  breakdown: {
    location: number;
    care_type: number;
    age_group: number;
    special_requirements: number;
    budget: number;
  };
  status: FamilyRequestAssignmentStatus;
  agency_response_message?: string;
  responded_at?: any;
  created_at?: any;
  updated_at?: any;
}

const normalizeRequestStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean);
};

const requestAssignmentsCollection = 'family_request_assignments';

const getDefaultAgencyCapabilityFromProfile = (agency: AgencyProfile): AgencyCapabilityProfile => {
  const specialties = normalizeRequestStringList((agency as any).specialties || []);
  return {
    id: agency.id,
    agency_id: agency.id,
    boroughs_served: normalizeRequestStringList((agency as any).boroughs || []),
    neighborhoods_served: normalizeRequestStringList((agency as any).neighborhoods || []),
    supported_care_types: specialties.filter((s) =>
      ['full-time', 'part-time', 'temporary', 'live-in', 'live-out'].some((token) => s.includes(token))
    ),
    supported_age_groups: specialties.filter((s) =>
      ['infant', 'newborn', 'toddler', 'preschool', 'school-age', 'teen'].some((token) => s.includes(token))
    ),
    supports_live_in: specialties.some((s) => s.includes('live-in')),
    supports_live_out: specialties.some((s) => s.includes('live-out') || s.includes('part-time') || s.includes('full-time')),
    supports_special_needs: specialties.some((s) => s.includes('special needs')),
    supports_driver_requests: specialties.some((s) => s.includes('driver')),
    supported_languages: normalizeRequestStringList((agency as any).languages || []),
    budget_min: typeof (agency as any).budget_min === 'number' ? (agency as any).budget_min : null,
    budget_max: typeof (agency as any).budget_max === 'number' ? (agency as any).budget_max : null,
    is_featured: !!((agency as any).sponsored || (agency as any).isSponsored),
    has_priority_lead_boost: false,
  };
};

export const getAgencyCapabilities = async (agencyId: string): Promise<AgencyCapabilityProfile | null> => {
  const path = `agency_capabilities/${agencyId}`;
  if (!agencyId) return null;
  try {
    const capabilityDoc = await getDoc(doc(db, 'agency_capabilities', agencyId));
    if (!capabilityDoc.exists()) return null;
    return {
      id: capabilityDoc.id,
      ...(capabilityDoc.data() as any),
    } as AgencyCapabilityProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const upsertAgencyCapabilities = async (
  agencyId: string,
  payload: Partial<AgencyCapabilityProfile>
) => {
  const path = `agency_capabilities/${agencyId}`;
  if (!agencyId) return false;
  try {
    const docRef = doc(db, 'agency_capabilities', agencyId);
    await setDoc(docRef, {
      agency_id: agencyId,
      boroughs_served: normalizeRequestStringList(payload.boroughs_served || []),
      neighborhoods_served: normalizeRequestStringList(payload.neighborhoods_served || []),
      supported_care_types: normalizeRequestStringList(payload.supported_care_types || []),
      supported_age_groups: normalizeRequestStringList(payload.supported_age_groups || []),
      supports_live_in: !!payload.supports_live_in,
      supports_live_out: payload.supports_live_out !== false,
      supports_special_needs: !!payload.supports_special_needs,
      supports_driver_requests: !!payload.supports_driver_requests,
      supported_languages: normalizeRequestStringList(payload.supported_languages || []),
      budget_min: typeof payload.budget_min === 'number' ? payload.budget_min : null,
      budget_max: typeof payload.budget_max === 'number' ? payload.budget_max : null,
      is_featured: !!payload.is_featured,
      featured_until: payload.featured_until || null,
      has_priority_lead_boost: !!payload.has_priority_lead_boost,
      priority_lead_until: payload.priority_lead_until || null,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

const getAgencyAddonStatusMap = async (): Promise<Record<string, { featured: boolean; priority: boolean }>> => {
  try {
    const addonQuery = query(collection(db, 'agency_addons'), where('status', '==', 'active'));
    const addonSnap = await getDocs(addonQuery);
    const map: Record<string, { featured: boolean; priority: boolean }> = {};

    addonSnap.docs.forEach((addonDoc) => {
      const data = addonDoc.data() as any;
      const agencyId = String(data.agency_id || '');
      if (!agencyId) return;
      if (!map[agencyId]) map[agencyId] = { featured: false, priority: false };
      if (data.addon_code === 'featured_agency_boost') map[agencyId].featured = true;
      if (data.addon_code === 'priority_lead_boost') map[agencyId].priority = true;
    });

    return map;
  } catch {
    return {};
  }
};

export const rankAgenciesForFamilyRequest = async (request: FamilyRequestInput) => {
  const agencies = await getAgencies();
  if (!agencies.length) return [];

  const addonMap = await getAgencyAddonStatusMap();
  const capabilities = await Promise.all(
    agencies.map(async (agency) => {
      const capability = await getAgencyCapabilities(agency.id);
      return {
        agency,
        capability: capability || getDefaultAgencyCapabilityFromProfile(agency),
      };
    })
  );

  const ranked = capabilities.map(({ agency, capability }) => {
    const addonStatus = addonMap[agency.id] || { featured: false, priority: false };
    const normalizedCapability = {
      ...capability,
      is_featured: !!(capability.is_featured || addonStatus.featured || (agency as any).sponsored || (agency as any).isSponsored),
      has_priority_lead_boost: !!(capability.has_priority_lead_boost || addonStatus.priority),
    };

    const result = scoreAgencyForFamilyRequest(
      {
        borough: request.borough,
        neighborhood: request.neighborhood || '',
        child_age_groups: normalizeRequestStringList(request.child_age_groups || []),
        care_type: request.care_type,
        live_in: request.live_in,
        budget_min: request.budget_min ?? null,
        budget_max: request.budget_max ?? null,
        languages: normalizeRequestStringList(request.languages || []),
        driver_required: !!request.driver_required,
        special_needs: !!request.special_needs,
      },
      normalizedCapability
    );

    return {
      agency,
      capability: normalizedCapability,
      ...result,
    };
  });

  return ranked
    .filter((row) => row.score >= MATCH_THRESHOLD)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.base_score !== a.base_score) return b.base_score - a.base_score;
      if (b.sponsored_boost !== a.sponsored_boost) return b.sponsored_boost - a.sponsored_boost;
      return (a.agency.company_name || '').localeCompare(b.agency.company_name || '');
    });
};

export const submitFamilyRequestAndMatch = async (
  familyId: string | null,
  payload: FamilyRequestInput,
  maxAssignments = 8
): Promise<{ requestId: string | null; matchCount: number }> => {
  const path = 'family_requests';
  try {
    if (familyId) {
      try {
        const headers = await buildApiHeaders();
        const response = await fetch(buildApiUrl('/api/family/requests/submit'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ familyId, payload, maxAssignments }),
        });

        const serverPayload = await response.json().catch(() => ({}));
        if (response.ok) {
          return {
            requestId: serverPayload?.requestId || null,
            matchCount: Number(serverPayload?.matchCount || 0),
          };
        }

        if (response.status === 404 || response.status >= 500) {
          console.warn('[submitFamilyRequestAndMatch] backend endpoint unavailable, falling back to client write');
        } else {
          throw new Error(serverPayload?.error || 'Unable to submit request right now.');
        }
      } catch (backendError: any) {
        const msg = String(backendError?.message || '');
        const isNetworkFailure = backendError instanceof TypeError || /failed to fetch|network/i.test(msg);
        if (!isNetworkFailure && msg) {
          throw backendError;
        }
      }
    }

    if (familyId) {
      try {
        const headers = await buildApiHeaders();
        const response = await fetch(buildApiUrl('/api/family/requests/eligibility'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ familyId }),
        });

        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          if (!payload?.allowed) {
            throw new Error('Families can have one active childcare request at a time. Close your existing request before submitting another.');
          }
        } else if (response.status !== 404 && response.status < 500) {
          throw new Error(payload?.error || 'Unable to validate request eligibility.');
        }
      } catch (backendError: any) {
        const msg = String(backendError?.message || '');
        const isNetworkFailure = backendError instanceof TypeError || /failed to fetch|network/i.test(msg);
        if (!isNetworkFailure && msg) {
          throw backendError;
        }
      }

      const activeStatuses: FamilyRequestStatus[] = ['submitted', 'matched', 'in_progress', 'accepted'];
      const existingRequests = await getDocs(query(collection(db, path), where('family_id', '==', familyId)));
      const activeRequestCount = existingRequests.docs.filter((entry) => activeStatuses.includes((entry.data().status || 'submitted') as FamilyRequestStatus)).length;

      if (activeRequestCount >= FAMILY_FREE_ACTIVE_REQUEST_LIMIT) {
        throw new Error('Families can have one active childcare request at a time. Close your existing request before submitting another.');
      }
    }

    const now = Timestamp.now();
    const sanitized: FamilyRequestInput = {
      parent_name: payload.parent_name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || '',
      borough: payload.borough.trim(),
      neighborhood: payload.neighborhood?.trim() || '',
      children_count: Math.max(1, Number(payload.children_count) || 1),
      child_age_groups: normalizeRequestStringList(payload.child_age_groups || []),
      care_type: payload.care_type,
      live_in: payload.live_in,
      start_date: payload.start_date || '',
      schedule: payload.schedule || '',
      budget_min: typeof payload.budget_min === 'number' ? payload.budget_min : null,
      budget_max: typeof payload.budget_max === 'number' ? payload.budget_max : null,
      languages: normalizeRequestStringList(payload.languages || []),
      driver_required: !!payload.driver_required,
      pet_friendly: !!payload.pet_friendly,
      special_needs: !!payload.special_needs,
      special_requirements: payload.special_requirements?.trim() || '',
      notes: payload.notes?.trim() || '',
    };

    const requestRef = await addDoc(collection(db, path), {
      ...sanitized,
      family_id: familyId || null,
      status: 'submitted' as FamilyRequestStatus,
      created_at: now,
      updated_at: now,
    });

    const ranked = await rankAgenciesForFamilyRequest(sanitized);
    const selectedMatches = ranked.slice(0, Math.max(1, maxAssignments));

    await Promise.all(selectedMatches.map(async (match) => {
      const assignmentId = `${requestRef.id}_${match.agency.id}`;
      await setDoc(doc(db, requestAssignmentsCollection, assignmentId), {
        request_id: requestRef.id,
        family_id: familyId || null,
        agency_id: match.agency.id,
        score: match.score,
        base_score: match.base_score,
        sponsored_boost: match.sponsored_boost,
        tier: match.tier,
        reasons: match.reasons,
        breakdown: match.breakdown,
        status: 'new' as FamilyRequestAssignmentStatus,
        created_at: now,
        updated_at: now,
      }, { merge: true });

      addAgencyNotification(
        match.agency.id,
        `New family request in ${sanitized.borough}`,
        `${sanitized.parent_name} requested ${sanitized.care_type} care`,
        `/agency/family-requests/${assignmentId}`
      ).catch(() => {
        // notifications are best-effort
      });
    }));

    await updateDoc(doc(db, path, requestRef.id), {
      status: selectedMatches.length ? 'matched' : 'no_match',
      top_match_count: selectedMatches.length,
      updated_at: serverTimestamp(),
    });

    return { requestId: requestRef.id, matchCount: selectedMatches.length };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const getFamilyRequestById = async (requestId: string): Promise<FamilyRequestRecord | null> => {
  const path = `family_requests/${requestId}`;
  if (!requestId) return null;
  try {
    const requestDoc = await getDoc(doc(db, 'family_requests', requestId));
    if (!requestDoc.exists()) return null;
    return { id: requestDoc.id, ...(requestDoc.data() as any) } as FamilyRequestRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getFamilyRequestsForFamily = async (familyId: string): Promise<FamilyRequestRecord[]> => {
  const path = 'family_requests';
  if (!familyId) return [];
  try {
    const requestQuery = query(collection(db, path), where('family_id', '==', familyId));
    const snapshot = await getDocs(requestQuery);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) } as FamilyRequestRecord))
      .sort((a, b) => {
        const aTs = (a.created_at?.seconds || 0);
        const bTs = (b.created_at?.seconds || 0);
        return bTs - aTs;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getMatchedAgenciesForRequest = async (requestId: string) => {
  const path = requestAssignmentsCollection;
  if (!requestId) return [];
  try {
    const matchQuery = query(collection(db, path), where('request_id', '==', requestId));
    const snapshot = await getDocs(matchQuery);
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) } as FamilyRequestMatchRow));

    const agencies = await Promise.all(rows.map((row) => getAgencyById(row.agency_id)));
    return rows
      .map((row, index) => ({ ...row, agency: agencies[index] }))
      .filter((row) => !!row.agency)
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAgencyFamilyRequestInbox = async (agencyId: string): Promise<Array<FamilyRequestMatchRow & { request: FamilyRequestRecord | null }>> => {
  const path = requestAssignmentsCollection;
  if (!agencyId) return [];
  try {
    const assignmentQuery = query(collection(db, path), where('agency_id', '==', agencyId));
    const snapshot = await getDocs(assignmentQuery);
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) } as FamilyRequestMatchRow));

    const requests = await Promise.all(rows.map((row) => getFamilyRequestById(row.request_id)));
    return rows
      .map((row, index) => ({ ...row, request: requests[index] }))
      .sort((a, b) => {
        const aPending = a.status === 'new' ? 0 : 1;
        const bPending = b.status === 'new' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        if (b.score !== a.score) return b.score - a.score;
        const aTs = a.created_at?.seconds || 0;
        const bTs = b.created_at?.seconds || 0;
        return bTs - aTs;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAgencyFamilyRequestAssignment = async (assignmentId: string) => {
  const path = `${requestAssignmentsCollection}/${assignmentId}`;
  if (!assignmentId) return null;
  try {
    const assignmentDoc = await getDoc(doc(db, requestAssignmentsCollection, assignmentId));
    if (!assignmentDoc.exists()) return null;
    const assignment = { id: assignmentDoc.id, ...(assignmentDoc.data() as any) } as FamilyRequestMatchRow;

    const [request, agency] = await Promise.all([
      getFamilyRequestById(assignment.request_id),
      getAgencyById(assignment.agency_id),
    ]);

    return { ...assignment, request, agency };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const respondToFamilyRequestAssignment = async (
  assignmentId: string,
  agencyId: string,
  response: FamilyRequestAssignmentStatus,
  message?: string
) => {
  const path = `${requestAssignmentsCollection}/${assignmentId}`;
  if (!assignmentId || !agencyId) return { ok: false, conversationId: null as string | null };
  try {
    const assignment = await getAgencyFamilyRequestAssignment(assignmentId);
    if (!assignment || assignment.agency_id !== agencyId) {
      return { ok: false, conversationId: null as string | null };
    }

    await updateDoc(doc(db, requestAssignmentsCollection, assignmentId), {
      status: response,
      agency_response_message: message?.trim() || '',
      responded_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const requestData = assignment.request;
    if (!requestData) return { ok: true, conversationId: null as string | null };

    if (response === 'accepted') {
      await updateDoc(doc(db, 'family_requests', requestData.id), {
        status: 'accepted' as FamilyRequestStatus,
        updated_at: serverTimestamp(),
      });

      let conversationId: string | null = null;
      if (requestData.family_id) {
        const convo = await startConversation(
          requestData.family_id,
          agencyId,
          requestData.parent_name,
          assignment.agency?.company_name || 'Agency'
        );
        conversationId = convo?.id || null;

        if (conversationId) {
          const intro = [
            `Your family request has been accepted by ${assignment.agency?.company_name || 'the agency'}.`,
            message?.trim() ? `Agency note: ${message.trim()}` : null,
            'You can continue coordination in this thread.',
          ].filter(Boolean).join('\n');

          await sendMessage(conversationId, 'agency', agencyId, intro);
          addFamilyNotification(
            requestData.family_id,
            'Agency accepted your request',
            `${assignment.agency?.company_name || 'An agency'} accepted your childcare request.`,
            `/family/messages?conversation=${conversationId}`
          ).catch(() => {
            // non-critical
          });
        }
      }

      return { ok: true, conversationId };
    }

    if (response === 'declined') {
      addFamilyNotification(
        requestData.family_id || '',
        'Agency declined request',
        `${assignment.agency?.company_name || 'An agency'} declined your request. We'll keep matching you with others.`,
        `/family/requests/${requestData.id}`
      ).catch(() => {
        // non-critical
      });
    }

    if (response === 'more_details') {
      let conversationId: string | null = null;
      if (requestData.family_id) {
        const convo = await startConversation(
          requestData.family_id,
          agencyId,
          requestData.parent_name,
          assignment.agency?.company_name || 'Agency'
        );
        conversationId = convo?.id || null;

        if (conversationId) {
          const intro = [
            `${assignment.agency?.company_name || 'An agency'} would like more details about your childcare request.`,
            message?.trim() ? `Message: ${message.trim()}` : 'Please reply with any additional information that may help us find the right match.',
          ].filter(Boolean).join('\n');

          await sendMessage(conversationId, 'agency', agencyId, intro);
          addFamilyNotification(
            requestData.family_id,
            'Agency requested more details',
            `${assignment.agency?.company_name || 'An agency'} has a question about your childcare request.`,
            `/family/messages?conversation=${conversationId}`
          ).catch(() => {});
        }
      }

      return { ok: true, conversationId };
    }

    return { ok: true, conversationId: null as string | null };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return { ok: false, conversationId: null as string | null };
  }
};

export const chooseFamilyRequestAgency = async (
  requestId: string,
  chosenAssignmentId: string,
  familyId: string
): Promise<{ ok: boolean; chosenAgencyId: string | null }> => {
  const path = `family_requests/${requestId}`;
  if (!requestId || !chosenAssignmentId || !familyId) return { ok: false, chosenAgencyId: null };
  try {
    // Verify ownership
    const requestDoc = await getDoc(doc(db, 'family_requests', requestId));
    if (!requestDoc.exists()) return { ok: false, chosenAgencyId: null };
    const requestData = { id: requestDoc.id, ...(requestDoc.data() as any) } as FamilyRequestRecord;
    if (requestData.family_id !== familyId) return { ok: false, chosenAgencyId: null };
    if (requestData.chosen_agency_id) return { ok: false, chosenAgencyId: requestData.chosen_agency_id };

    // Get the chosen assignment
    const chosenAssignmentDoc = await getDoc(doc(db, requestAssignmentsCollection, chosenAssignmentId));
    if (!chosenAssignmentDoc.exists()) return { ok: false, chosenAgencyId: null };
    const chosenAssignment = { id: chosenAssignmentDoc.id, ...(chosenAssignmentDoc.data() as any) } as FamilyRequestMatchRow;
    const chosenAgencyId = chosenAssignment.agency_id;

    // Get chosen agency name
    const chosenAgency = await getAgencyById(chosenAgencyId);
    const chosenAgencyName = chosenAgency?.company_name || 'An agency';

    // Mark the request as family_chosen
    await updateDoc(doc(db, 'family_requests', requestId), {
      status: 'family_chosen' as FamilyRequestStatus,
      chosen_agency_id: chosenAgencyId,
      chosen_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    // Get all other assignments for this request
    const allAssignmentsQuery = query(collection(db, requestAssignmentsCollection), where('request_id', '==', requestId));
    const allAssignmentsSnap = await getDocs(allAssignmentsQuery);
    const allAssignments = allAssignmentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as FamilyRequestMatchRow));

    // Notify unchosen agencies that responded (accepted or more_details)
    const notifyOthers = allAssignments.filter(
      (a) => a.agency_id !== chosenAgencyId && (a.status === 'accepted' || a.status === 'more_details')
    );
    await Promise.all(
      notifyOthers.map((a) =>
        addAgencyNotification(
          a.agency_id,
          'Family chose a different agency',
          'A family you responded to has selected another agency for their care request. Thank you for your interest.',
          '/agency/family-requests'
        ).catch(() => {})
      )
    );

    // Notify the chosen agency
    addAgencyNotification(
      chosenAgencyId,
      'You were selected by a family! 🎉',
      `A family has chosen ${chosenAgencyName} for their care request. Post a job to the nanny marketplace so nannies can apply.`,
      `/agency/family-requests/${chosenAssignmentId}`
    ).catch(() => {});

    return { ok: true, chosenAgencyId };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return { ok: false, chosenAgencyId: null };
  }
};

export const setAgencyFeaturedStatus = async (
  agencyId: string,
  isFeatured: boolean,
  hasPriorityLeadBoost: boolean
) => {
  return upsertAgencyCapabilities(agencyId, {
    is_featured: isFeatured,
    has_priority_lead_boost: hasPriorityLeadBoost,
  });
};
