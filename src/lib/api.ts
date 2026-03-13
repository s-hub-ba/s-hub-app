import { supabase } from './supabase';

// --- JOBS ---
export const getJobs = async (agencyId?: string) => {
  let query = supabase.from('jobs').select('*, agency_profiles(company_name)').order('created_at', { ascending: false });
  if (agencyId) {
    query = query.eq('agency_id', agencyId);
  } else {
    query = query.eq('status', 'published');
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getJobById = async (id: string) => {
  const { data, error } = await supabase.from('jobs').select('*, agency_profiles(company_name)').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createJob = async (jobData: any) => {
  const { data, error } = await supabase.from('jobs').insert([jobData]).select().single();
  if (error) throw error;
  return data;
};

export const updateJob = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteJob = async (id: string) => {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
  return true;
};

// --- APPLICATIONS ---
export const getApplicationsForAgency = async (agencyId: string) => {
  // We need to join with jobs to filter by agency_id
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs!inner(*), nanny_profiles(first_name, last_name, profile_photo_url)')
    .eq('jobs.agency_id', agencyId);
  if (error) throw error;
  return data;
};

export const getApplicationsForNanny = async (nannyId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs(*)')
    .eq('nanny_id', nannyId);
  if (error) throw error;
  return data;
};

export const createApplication = async (jobId: string, nannyId: string, coverLetter?: string) => {
  const { data, error } = await supabase
    .from('applications')
    .insert([{ job_id: jobId, nanny_id: nannyId, cover_letter: coverLetter }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateApplicationStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// --- NANNIES ---
export const getNannies = async () => {
  const { data, error } = await supabase.from('nanny_profiles').select('*');
  if (error) throw error;
  return data;
};

export const getNannyById = async (id: string) => {
  const { data, error } = await supabase.from('nannies').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const updateNannyProfile = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('nannies').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// --- AGENCIES ---
export const getAgencies = async () => {
  const { data, error } = await supabase.from('agency_profiles').select('*, users(email, created_at)');
  if (error) throw error;
  return data;
};

export const getAgencyById = async (id: string) => {
  const { data, error } = await supabase.from('agency_profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const updateAgencyProfile = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('agencies').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// --- FAMILIES ---
export const getFamilyProfile = async (familyId: string) => {
  const { data, error } = await supabase
    .from('families')
    .select('*, family_profiles(*)')
    .eq('id', familyId)
    .maybeSingle();
    
  if (error) throw error;
  
  if (data) {
    // Flatten the response for the frontend
    const profileData = Array.isArray(data.family_profiles) 
      ? data.family_profiles[0] || {}
      : data.family_profiles || {};
      
    return {
      ...data,
      ...profileData
    };
  }
  
  return data;
};

export const updateFamilyProfile = async (familyId: string, data: { family?: any, profile?: any }) => {
  if (data.family) {
    const { error: familyError } = await supabase.from('families').update(data.family).eq('id', familyId);
    if (familyError) throw familyError;
  }
  
  if (data.profile) {
    const { data: profileData, error: profileError } = await supabase
      .from('family_profiles')
      .upsert([{ family_id: familyId, ...data.profile }], { onConflict: 'family_id' })
      .select()
      .single();
    if (profileError) throw profileError;
    return profileData;
  }
  
  return true;
};

export const saveJob = async (familyId: string, jobId: string) => {
  const { data, error } = await supabase.from('saved_jobs').insert([{ family_id: familyId, job_id: jobId }]);
  if (error) throw error;
  return data;
};

export const unsaveJob = async (familyId: string, jobId: string) => {
  const { error } = await supabase.from('saved_jobs').delete().match({ family_id: familyId, job_id: jobId });
  if (error) throw error;
  return true;
};

export const getSavedJobs = async (familyId: string) => {
  const { data, error } = await supabase.from('saved_jobs').select('*, jobs(*, agency_profiles(company_name))').eq('family_id', familyId);
  if (error) throw error;
  return data;
};

export const applyToJob = async (familyId: string, jobId: string, agencyId: string) => {
  const { data, error } = await supabase.from('family_applications').insert([{ family_id: familyId, job_id: jobId, agency_id: agencyId }]);
  if (error) throw error;
  return data;
};

export const getFamilyApplications = async (familyId: string) => {
  const { data, error } = await supabase.from('family_applications').select('*, jobs(*, agency_profiles(company_name))').eq('family_id', familyId);
  if (error) throw error;
  return data;
};

// --- USERS ---
export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
};
export const getConversations = async (familyId: string) => {
  const { data, error } = await supabase.from('conversations').select('*').eq('family_id', familyId);
  if (error) throw error;
  return data;
};

export const getMessages = async (conversationId: string) => {
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const sendMessage = async (conversationId: string, senderType: 'family' | 'agency', senderId: string, message: string) => {
  const { data, error } = await supabase.from('messages').insert([{ conversation_id: conversationId, sender_type: senderType, sender_id: senderId, message }]).select().single();
  if (error) throw error;
  return data;
};
