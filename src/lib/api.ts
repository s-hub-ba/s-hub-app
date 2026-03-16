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
  created_at: any;
  updated_at?: any;
}

export interface AgencyProfile {
  id: string;
  company_name: string;
  contact_name: string;
  website?: string;
  location?: string;
  bio?: string;
  created_at: any;
  updated_at?: any;
  users?: any;
}

export interface FamilyProfile {
  id: string;
  family_name: string;
  email: string;
  phone?: string;
  location_borough?: string;
  location_neighborhood?: string;
  bio?: string;
  created_at: any;
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
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
    const jobs = await Promise.all(snapshot.docs.map(async (d) => {
      const jobData = d.data();
      // Join with agency profile
      const agencyDoc = await getDoc(doc(db, 'agency_profiles', jobData.agency_id));
      return { 
        id: d.id, 
        ...jobData, 
        agency_profiles: agencyDoc.exists() ? agencyDoc.data() : { company_name: 'Agency' }
      } as Job;
    }));
    return jobs;
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
    if (!familyDoc.exists()) return null;
    
    const profileDoc = await getDoc(doc(db, 'family_profiles', familyId));
    const profileData = profileDoc.exists() ? profileDoc.data() : {};
    
    return {
      id: familyDoc.id,
      ...familyDoc.data(),
      ...profileData
    } as FamilyProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateFamilyProfile = async (familyId: string, data: { family?: any, profile?: any }) => {
  try {
    if (data.family) {
      const familyPath = `families/${familyId}`;
      await setDoc(doc(db, 'families', familyId), { ...data.family, updated_at: serverTimestamp() }, { merge: true });
    }
    
    if (data.profile) {
      const profilePath = `family_profiles/${familyId}`;
      await setDoc(doc(db, 'family_profiles', familyId), { 
        family_id: familyId, 
        ...data.profile, 
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
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
    
    // Update last message in conversation
    await updateDoc(doc(db, 'conversations', conversationId), {
      last_message: message,
      updated_at: serverTimestamp()
    });
    
    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};
