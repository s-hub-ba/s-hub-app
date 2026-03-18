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
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';

// --- Types ---
export interface User {
  id: string;
  email: string;
  role: 'nanny' | 'family' | 'agency';
  created_at: any;
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
  created_at: any;
  updated_at: any;
  agency_profiles?: any;
}

export interface Application {
  id: string;
  job_id: string;
  nanny_id: string;
  agency_id: string;
  status: 'applied' | 'reviewing' | 'interviewing' | 'hired' | 'rejected';
  cover_letter: string;
  call_status?: 'pending_nanny' | 'confirmed' | 'declined' | null;
  call_scheduled_for?: string | null;
  call_timezone?: string | null;
  call_note?: string | null;
  call_proposed_by?: 'agency' | 'nanny' | null;
  call_proposed_at?: any;
  call_confirmed_at?: any;
  call_declined_at?: any;
  created_at: any;
  updated_at: any;
  jobs?: Job | null;
  nanny_profiles?: any;
}

export interface NannyProfile {
  id: string;
  first_name: string;
  last_name: string;
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

export interface ShiftScoreResult {
  score: number;
  details: {
    completedFields: number;
    totalFields: number;
    activityBonus: number;
    familyRatingBonus: number;
    agencyRatingBonus: number;
    familyRatingAvg: number;
    agencyRatingAvg: number;
    familyRatingCount: number;
    agencyRatingCount: number;
  };
}

export interface JobCompatibilityResult {
  score: number;
  tier: 'excellent' | 'good' | 'fair' | 'low';
  reasons: string[];
}

export const computeShiftScore = (
  profile: Partial<NannyProfile> | null,
  applicationCount = 0,
  familyRatingAvg = 0,
  familyRatingCount = 0,
  agencyRatingAvg = 0,
  agencyRatingCount = 0
): ShiftScoreResult => {
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
  const baseScore = Math.round((completedFields / totalFields) * 70);

  const expBonus = (profile?.years_experience ?? 0) >= 3 ? 5 : 0;
  const certBonus = (profile?.certifications?.length ?? 0) > 0 ? 5 : 0;
  const activityBonus = Math.min(10, applicationCount * 2);

  const familyRatingBonus = familyRatingCount > 0 ? Math.round((familyRatingAvg / 5) * 10) : 0;
  const agencyRatingBonus = agencyRatingCount > 0 ? Math.round((agencyRatingAvg / 5) * 10) : 0;

  const score = Math.min(100, baseScore + expBonus + certBonus + activityBonus + familyRatingBonus + agencyRatingBonus);

  return {
    score,
    details: {
      completedFields,
      totalFields,
      activityBonus,
      familyRatingBonus,
      agencyRatingBonus,
      familyRatingAvg,
      agencyRatingAvg,
      familyRatingCount,
      agencyRatingCount
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
  start_date?: string;
  end_date?: string;
  summary?: string;
  reviewed_agency_by_family?: boolean;
  reviewed_nanny_by_family?: boolean;
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
    const docRef = await addDoc(collection(db, path), {
      ...jobData,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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
    await updateDoc(docRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
      return {
        id: d.id,
        ...appData,
        jobs: jobDoc.exists() ? { id: jobDoc.id, ...jobDoc.data() } as Job : null,
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
      return {
        id: d.id,
        ...appData,
        jobs: jobDoc.exists() ? { id: jobDoc.id, ...jobDoc.data() } as Job : null
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
    // Need agency_id for filtering in getApplicationsForAgency
    const jobDoc = await getDoc(doc(db, 'jobs', jobId));
    const agencyId = jobDoc.exists() ? jobDoc.data().agency_id : null;

    const docRef = await addDoc(collection(db, path), {
      job_id: jobId,
      nanny_id: nannyId,
      agency_id: agencyId,
      cover_letter: coverLetter || '',
      status: 'applied',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateApplicationStatus = async (id: string, status: string) => {
  const path = `applications/${id}`;
  try {
    const docRef = doc(db, 'applications', id);
    await updateDoc(docRef, { status, updated_at: serverTimestamp() });
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

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
  nannyId: string;
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

    await addNannyNotification(
      nannyId,
      'Call proposed',
      `${agencyName || 'An agency'} proposed a call for ${new Date(scheduledFor).toLocaleString()}.`,
      '/nanny/applications'
    );

    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return null;
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

// --- NANNIES ---
export const getNannies = async (): Promise<NannyProfile[]> => {
  const path = 'nanny_profiles';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NannyProfile));
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

// --- AGENCIES ---
export const getAgencies = async (): Promise<AgencyProfile[]> => {
  const path = 'agency_profiles';
  try {
    const snapshot = await getDocs(collection(db, path));
    const agencies = await Promise.all(snapshot.docs.map(async (d) => {
      const agencyData = d.data();
      const userDoc = await getDoc(doc(db, 'users', d.id));
      return {
        id: d.id,
        ...agencyData,
        users: userDoc.exists() ? userDoc.data() : null
      } as AgencyProfile;
    }));
    return agencies;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
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

export const resolveAgencyIdForUser = async (userId: string): Promise<string | null> => {
  if (!userId) return null;

  const agencyDoc = await getDoc(doc(db, 'agency_profiles', userId));
  if (agencyDoc.exists()) return userId;

  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    const directAgencyId = userDoc.data().agency_id;
    if (typeof directAgencyId === 'string' && directAgencyId) return directAgencyId;
  }

  const recruiterQuery = query(collection(db, 'agency_recruiters'), where('user_id', '==', userId));
  const recruiterSnap = await getDocs(recruiterQuery);
  if (!recruiterSnap.empty) {
    const activeSeat = recruiterSnap.docs.find((d) => d.data().status === 'active');
    const seat = activeSeat || recruiterSnap.docs[0];
    const agencyId = seat.data().agency_id;
    if (typeof agencyId === 'string' && agencyId) return agencyId;
  }

  return null;
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

export const getFamilyCareHistory = async (familyId: string): Promise<CareHistory[]> => {
  const path = 'care_history';
  try {
    const q = query(collection(db, path), where('family_id', '==', familyId), orderBy('end_date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CareHistory));
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

export const recordCareHistoryFromApplication = async (applicationId: string) => {
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
    if (!existingSnap.empty) {
      return { id: existingSnap.docs[0].id };
    }

    const agencyDoc = await getDoc(doc(db, 'agency_profiles', agencyId));
    const nannyDoc = await getDoc(doc(db, 'nanny_profiles', nannyId));

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
      start_date: app.start_date || '',
      end_date: new Date().toISOString(),
      summary: app.call_note || 'Care placement completed.',
      reviewed_agency_by_family: false,
      reviewed_nanny_by_family: false,
      rating: 0,
      review: ''
    };

    return await addCareHistory(history);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, appPath);
  }
};

// --- REVIEWS ---
export interface NannyReview {
  id?: string;
  nanny_id: string;
  reviewer_id: string;
  reviewer_role: 'family' | 'agency' | 'nanny';
  rating: number;
  comment: string;
  created_at?: any;
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

export const getNannyReviews = async (nannyId: string): Promise<NannyReview[]> => {
  const path = 'nanny_reviews';
  try {
    const q = query(collection(db, path), where('nanny_id', '==', nannyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NannyReview));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
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

export const addNannyReview = async (review: NannyReview) => {
  const path = 'nanny_reviews';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...review,
      created_at: serverTimestamp()
    });
    const savedDoc = await getDoc(docRef);
    return { id: savedDoc.id, ...savedDoc.data() } as NannyReview;
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
  const reviews = await getNannyReviews(nannyId);
  const count = reviews.length;
  const avg = count > 0 ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / count : 0;
  return { count, avg };
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
  agencyId,
  nannyId,
  rating,
  comment
}: {
  careHistoryId: string;
  familyId: string;
  target: 'agency' | 'nanny';
  agencyId?: string;
  nannyId?: string;
  rating: number;
  comment: string;
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
        reviewed_agency_by_family: true,
        updated_at: serverTimestamp()
      });
    }

    if (target === 'nanny' && nannyId) {
      await addNannyReview({
        nanny_id: nannyId,
        reviewer_id: familyId,
        reviewer_role: 'family',
        rating,
        comment
      });
      await updateDoc(doc(db, 'care_history', careHistoryId), {
        reviewed_nanny_by_family: true,
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

      const response = await fetch('/api/agency/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agency-id': agencyId,
          'x-user-id': callerUserId
        },
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
    const q = query(collection(db, path), where('family_id', '==', familyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyNotification));
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
    const q = query(collection(db, path), where('nanny_id', '==', nannyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NannyNotification));
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
    const q = query(collection(db, path), where('agency_id', '==', agencyId), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AgencyNotification));
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
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const markAgencyNotificationRead = async (notificationId: string) => {
  const path = `agency_notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'agency_notifications', notificationId);
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const getConversations = async (userId: string, role: 'family' | 'nanny' | 'agency') => {
  const path = 'conversations';
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
  }
};

export const getAgencyConversations = async (agencyId: string) => {
  const path = 'conversations';
  try {
    const q = query(collection(db, path), where('agency_id', '==', agencyId));
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
  const path = 'agency_talent_pool';
  try {
    const existingQ = query(
      collection(db, path),
      where('agency_id', '==', agencyId),
      where('nanny_id', '==', nannyId)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      return { id: existingSnap.docs[0].id };
    }

    const docRef = await addDoc(collection(db, path), {
      agency_id: agencyId,
      nanny_id: nannyId,
      status: 'new',
      tags: [],
      latest_note: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
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
  try {
    const q = query(collection(db, path), orderBy('created_at', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const sendMessage = async (conversationId: string, senderType: 'family' | 'agency' | 'nanny', senderId: string, message: string) => {
  const path = `conversations/${conversationId}/messages`;
  try {
    const docRef = await addDoc(collection(db, path), {
      sender_id: senderId,
      sender_type: senderType,
      content: message,
      created_at: serverTimestamp()
    });
    
    const newDoc = await getDoc(docRef);
    const createdMessage = { id: newDoc.id, ...newDoc.data() };

    // Update last message in conversation (non-blocking for send success)
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        last_message: message,
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
