import { Router } from 'express';
import { db, auth } from '../firebase.js';

const router = Router();
const FAMILY_FREE_ACTIVE_REQUEST_LIMIT = 1;
const MATCH_THRESHOLD = 60;
const SPONSORED_BOOST_MAX = 12;

type FamilyRequestPayload = {
  parent_name: string;
  email: string;
  phone?: string;
  borough: string;
  neighborhood?: string;
  children_count: number;
  child_age_groups: string[];
  care_type: 'full-time' | 'part-time' | 'occasional' | 'last-minute';
  live_in: 'live-in' | 'live-out' | 'either';
  start_date?: string;
  end_date?: string;
  is_flexible?: boolean;
  schedule?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  languages?: string[];
  driver_required?: boolean;
  pet_friendly?: boolean;
  special_needs?: boolean;
  special_requirements?: string;
  notes?: string;
};

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const normalizeCareType = (value: unknown): FamilyRequestPayload['care_type'] => {
  const normalized = normalize(value);
  if (normalized === 'part-time' || normalized === 'part time') return 'part-time';
  if (normalized === 'last-minute' || normalized === 'last minute') return 'last-minute';
  if (normalized === 'occasional' || normalized === 'temporary') return 'occasional';
  return 'full-time';
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalize(item))
    .filter(Boolean);
};

const toSet = (value: string[]) => new Set((value || []).map((item) => normalize(item)).filter(Boolean));

const countOverlap = (a: Set<string>, b: Set<string>) => {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count += 1;
  }
  return count;
};

const getDefaultAgencyCapability = (agencyId: string, agencyProfile: any) => {
  const specialties = normalizeStringList(agencyProfile?.specialties || []);
  return {
    agency_id: agencyId,
    boroughs_served: normalizeStringList(agencyProfile?.boroughs || []),
    neighborhoods_served: normalizeStringList(agencyProfile?.neighborhoods || []),
    supported_care_types: specialties.filter((item) =>
      ['full-time', 'part-time', 'temporary', 'occasional', 'last-minute', 'last minute', 'live-in', 'live-out'].some((token) => item.includes(token))
    ),
    supported_age_groups: specialties.filter((item) =>
      ['infant', 'newborn', 'toddler', 'preschool', 'school-age', 'teen'].some((token) => item.includes(token))
    ),
    supports_live_in: specialties.some((item) => item.includes('live-in')),
    supports_live_out: specialties.some((item) => item.includes('live-out') || item.includes('part-time') || item.includes('full-time')),
    supports_special_needs: specialties.some((item) => item.includes('special needs')),
    supports_driver_requests: specialties.some((item) => item.includes('driver')),
    supported_languages: normalizeStringList(agencyProfile?.languages || []),
    budget_min: typeof agencyProfile?.budget_min === 'number' ? agencyProfile.budget_min : null,
    budget_max: typeof agencyProfile?.budget_max === 'number' ? agencyProfile.budget_max : null,
    is_featured: !!(agencyProfile?.sponsored || agencyProfile?.isSponsored),
    has_priority_lead_boost: false,
  };
};

const scoreAgency = (request: FamilyRequestPayload, capability: any) => {
  const requestBorough = normalize(request.borough);
  const requestNeighborhood = normalize(request.neighborhood);
  const servedBoroughs = toSet(capability?.boroughs_served || []);
  const servedNeighborhoods = toSet(capability?.neighborhoods_served || []);

  let location = 0;
  if (requestBorough && servedBoroughs.has(requestBorough)) location += 24;
  if (requestNeighborhood && servedNeighborhoods.has(requestNeighborhood)) location += 16;
  location = Math.min(40, location);

  const supportedCareTypes = toSet(capability?.supported_care_types || []);
  const requestCareType = normalizeCareType(request.care_type);
  const supportsOccasional = supportedCareTypes.has('occasional') || supportedCareTypes.has('temporary');
  const supportsLastMinute = supportedCareTypes.has('last-minute') || supportedCareTypes.has('last minute');
  const careType = supportedCareTypes.has(requestCareType)
    || (requestCareType === 'occasional' && supportsOccasional)
    || (requestCareType === 'last-minute' && supportsLastMinute)
    ? 20
    : 0;

  const requestAges = toSet(normalizeStringList(request.child_age_groups || []));
  const supportedAges = toSet(capability?.supported_age_groups || []);
  const ageOverlap = countOverlap(requestAges, supportedAges);
  const ageGroup = requestAges.size > 0 ? Math.round((ageOverlap / requestAges.size) * 15) : 0;

  let specialRequirements = 0;
  if (request.special_needs) {
    if (capability?.supports_special_needs) specialRequirements += 9;
  } else {
    specialRequirements += 6;
  }
  if (request.driver_required) {
    if (capability?.supports_driver_requests) specialRequirements += 4;
  } else {
    specialRequirements += 2;
  }
  if (request.live_in === 'live-in' && capability?.supports_live_in) specialRequirements += 2;
  if (request.live_in === 'live-out' && capability?.supports_live_out) specialRequirements += 2;
  if (request.live_in === 'either' && (capability?.supports_live_in || capability?.supports_live_out)) specialRequirements += 1;

  const requestLanguages = toSet(normalizeStringList(request.languages || []));
  const supportedLanguages = toSet(capability?.supported_languages || []);
  if (requestLanguages.size > 0 && countOverlap(requestLanguages, supportedLanguages) > 0) {
    specialRequirements += 2;
  }
  specialRequirements = Math.min(15, specialRequirements);

  const reqMin = request.budget_min ?? null;
  const reqMax = request.budget_max ?? null;
  const agencyMin = capability?.budget_min ?? null;
  const agencyMax = capability?.budget_max ?? null;
  let budget = 0;
  if (reqMin !== null || reqMax !== null) {
    const overlapLow = Math.max(reqMin ?? 0, agencyMin ?? 0);
    const overlapHigh = Math.min(reqMax ?? Number.MAX_SAFE_INTEGER, agencyMax ?? Number.MAX_SAFE_INTEGER);
    if (overlapHigh >= overlapLow) budget = 10;
    else if (agencyMin !== null && reqMax !== null && agencyMin <= reqMax + 5) budget = 5;
    else if (agencyMax !== null && reqMin !== null && agencyMax >= reqMin - 5) budget = 5;
  } else {
    budget = 6;
  }

  const baseScore = Math.min(100, location + careType + ageGroup + specialRequirements + budget);
  const eligibleForBoost = baseScore >= MATCH_THRESHOLD;
  const hasBoost = !!capability?.is_featured || !!capability?.has_priority_lead_boost;
  const sponsoredBoost = eligibleForBoost && hasBoost ? SPONSORED_BOOST_MAX : 0;
  const score = Math.min(100, baseScore + sponsoredBoost);

  const reasons: string[] = [];
  if (location > 0) reasons.push('Location compatibility');
  if (careType > 0) reasons.push('Supports requested care type');
  if (ageGroup > 0) reasons.push('Experience with requested age groups');
  if (specialRequirements > 0) reasons.push('Supports your placement requirements');

  return {
    score,
    base_score: baseScore,
    sponsored_boost: sponsoredBoost,
    tier: score >= 85 ? 'best_match' : score >= 70 ? 'great_match' : score >= MATCH_THRESHOLD ? 'possible_match' : 'below_threshold',
    reasons: reasons.slice(0, 4),
    breakdown: {
      location,
      care_type: careType,
      age_group: ageGroup,
      special_requirements: specialRequirements,
      budget,
    },
  };
};

const sanitizeFamilyPayload = (payload: FamilyRequestPayload): FamilyRequestPayload => ({
  parent_name: String(payload.parent_name || '').trim(),
  email: String(payload.email || '').trim().toLowerCase(),
  phone: String(payload.phone || '').trim(),
  borough: String(payload.borough || '').trim(),
  neighborhood: String(payload.neighborhood || '').trim(),
  children_count: Math.max(1, Number(payload.children_count) || 1),
  child_age_groups: normalizeStringList(payload.child_age_groups || []),
  care_type: normalizeCareType(payload.care_type),
  live_in: payload.live_in,
  start_date: String(payload.start_date || ''),
  end_date: String(payload.end_date || ''),
  is_flexible: !!payload.is_flexible,
  schedule: String(payload.schedule || ''),
  budget_min: typeof payload.budget_min === 'number' ? Math.max(0, payload.budget_min) : null,
  budget_max: typeof payload.budget_max === 'number' ? Math.max(0, payload.budget_max) : null,
  languages: normalizeStringList(payload.languages || []),
  driver_required: !!payload.driver_required,
  pet_friendly: !!payload.pet_friendly,
  special_needs: !!payload.special_needs,
  special_requirements: String(payload.special_requirements || '').trim(),
  notes: String(payload.notes || '').trim(),
});

const getHeaderValue = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
};

const getBearerToken = (req: any): string => {
  const authHeader = getHeaderValue(req.headers?.authorization);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
};

const parseDateAtBoundary = (value: unknown, boundary: 'start' | 'end'): Date | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const suffix = boundary === 'end' ? 'T23:59:59.999' : 'T00:00:00.000';
    const parsedDay = new Date(`${normalized}${suffix}`);
    return Number.isNaN(parsedDay.getTime()) ? null : parsedDay;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRequestExpiryDate = (request: any): Date | null => {
  const careType = normalizeCareType(request?.care_type);
  const endDate = parseDateAtBoundary(request?.end_date, 'end');
  const startDate = parseDateAtBoundary(request?.start_date, 'end');

  if (careType === 'occasional' || careType === 'last-minute') {
    return endDate || startDate;
  }

  return endDate;
};

const isFamilyRequestStillActive = (request: any, now: Date): boolean => {
  const activeStatuses = new Set(['submitted', 'matched', 'in_progress', 'accepted', 'family_chosen']);
  const status = String(request?.status || 'submitted');
  if (!activeStatuses.has(status)) return false;

  const expiry = getRequestExpiryDate(request);
  if (!expiry) return true;
  return expiry.getTime() >= now.getTime();
};

const autoCloseExpiredFamilyRequests = async (snapshot: any, now: Date) => {
  const expiredDocs = snapshot.docs.filter((docSnap: any) => {
    const data = docSnap.data() || {};
    return !isFamilyRequestStillActive(data, now)
      && ['submitted', 'matched', 'in_progress', 'accepted', 'family_chosen'].includes(String(data?.status || ''));
  });

  if (expiredDocs.length === 0) return;

  const nowIso = now.toISOString();
  await Promise.all(expiredDocs.map((docSnap: any) => docSnap.ref.set({
    status: 'closed',
    closed_reason: 'date_elapsed',
    updated_at: nowIso,
  }, { merge: true })));
};

const requireFamilyAuth = async (req: any, res: any, next: any) => {
  const fallbackUserId = getHeaderValue(req.headers['x-user-id']);
  const token = getBearerToken(req);
  let userId = '';

  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = String(decoded.uid || '');
    } catch {
      return res.status(401).json({ error: 'Unauthorized - invalid auth token' });
    }
  } else if (process.env.NODE_ENV !== 'production') {
    userId = fallbackUserId;
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'family') {
      return res.status(403).json({ error: 'Forbidden - family access only' });
    }

    req.userId = userId;
    return next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/family/requests/eligibility - Verify family can create a new active request
router.post('/requests/eligibility', requireFamilyAuth, async (req: any, res: any) => {
  const callerFamilyId = String(req.userId || '');
  const familyId = String(req.body?.familyId || callerFamilyId || '');

  if (!familyId) {
    return res.status(400).json({ error: 'familyId is required' });
  }

  if (familyId !== callerFamilyId) {
    return res.status(403).json({ error: 'Forbidden: cannot check eligibility for another family' });
  }

  try {
    const now = new Date();
    const snapshot = await db.collection('family_requests')
      .where('family_id', '==', familyId)
      .get();

    await autoCloseExpiredFamilyRequests(snapshot, now);

    const activeRequestCount = snapshot.docs.filter((docSnap) => isFamilyRequestStillActive(docSnap.data() || {}, now)).length;
    const allowed = activeRequestCount < FAMILY_FREE_ACTIVE_REQUEST_LIMIT;

    return res.json({
      allowed,
      activeRequestCount,
      limit: FAMILY_FREE_ACTIVE_REQUEST_LIMIT,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to evaluate family request eligibility' });
  }
});

// POST /api/family/requests/submit - Server-side request create + matching + assignment writes
router.post('/requests/submit', requireFamilyAuth, async (req: any, res: any) => {
  const callerFamilyId = String(req.userId || '');
  const familyId = String(req.body?.familyId || callerFamilyId || '');
  const payload = (req.body?.payload || {}) as FamilyRequestPayload;
  const maxAssignmentsRaw = Number(req.body?.maxAssignments || 8);
  const maxAssignments = Math.max(1, Number.isFinite(maxAssignmentsRaw) ? Math.floor(maxAssignmentsRaw) : 8);

  if (!familyId) {
    return res.status(400).json({ error: 'familyId is required' });
  }

  if (familyId !== callerFamilyId) {
    return res.status(403).json({ error: 'Forbidden: cannot submit requests for another family' });
  }

  if (!payload?.parent_name || !payload?.email || !payload?.borough || !payload?.care_type || !payload?.live_in) {
    return res.status(400).json({ error: 'Missing required request fields' });
  }

  try {
    const now = new Date();
    const existing = await db.collection('family_requests').where('family_id', '==', familyId).get();
    await autoCloseExpiredFamilyRequests(existing, now);
    const activeCount = existing.docs.filter((docSnap) => isFamilyRequestStillActive(docSnap.data() || {}, now)).length;

    if (activeCount >= FAMILY_FREE_ACTIVE_REQUEST_LIMIT) {
      return res.status(403).json({
        error: 'Families can have one active childcare request at a time. Close your existing request before submitting another.',
        code: 'FAMILY_ACTIVE_REQUEST_LIMIT_REACHED',
      });
    }

    const sanitized = sanitizeFamilyPayload(payload);
    if (sanitized.budget_min != null && sanitized.budget_max != null && sanitized.budget_max < sanitized.budget_min) {
      return res.status(400).json({ error: 'Budget max must be greater than or equal to budget min.' });
    }
    const nowIso = new Date().toISOString();

    const requestRef = await db.collection('family_requests').add({
      ...sanitized,
      family_id: familyId,
      status: 'submitted',
      created_at: nowIso,
      updated_at: nowIso,
    });

    const agenciesSnapshot = await db.collection('agency_profiles').get();
    const addonsSnapshot = await db.collection('agency_addons').where('status', '==', 'active').get();

    const addonMap: Record<string, { featured: boolean; priority: boolean }> = {};
    addonsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const agencyId = String(data.agency_id || '');
      if (!agencyId) return;
      if (!addonMap[agencyId]) addonMap[agencyId] = { featured: false, priority: false };
      if (data.addon_code === 'featured_agency_boost') addonMap[agencyId].featured = true;
      if (data.addon_code === 'priority_lead_boost') addonMap[agencyId].priority = true;
    });

    const ranked = await Promise.all(agenciesSnapshot.docs.map(async (agencyDoc) => {
      const agencyId = agencyDoc.id;
      const agencyData = agencyDoc.data() || {};
      const capabilityDoc = await db.collection('agency_capabilities').doc(agencyId).get();
      const capability = capabilityDoc.exists
        ? { ...(capabilityDoc.data() || {}), agency_id: agencyId }
        : getDefaultAgencyCapability(agencyId, agencyData);
      const capabilityData: any = capability;

      const addonStatus = addonMap[agencyId] || { featured: false, priority: false };
      const normalizedCapability = {
        ...capabilityData,
        is_featured: !!(capabilityData?.is_featured || addonStatus.featured || agencyData?.sponsored || agencyData?.isSponsored),
        has_priority_lead_boost: !!(capabilityData?.has_priority_lead_boost || addonStatus.priority),
      };

      const result = scoreAgency(sanitized, normalizedCapability);
      return {
        agencyId,
        agencyName: String(agencyData.company_name || agencyData.name || 'Agency'),
        ...result,
      };
    }));

    const eligible = ranked
      .filter((item) => item.score >= MATCH_THRESHOLD)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.base_score !== a.base_score) return b.base_score - a.base_score;
        if (b.sponsored_boost !== a.sponsored_boost) return b.sponsored_boost - a.sponsored_boost;
        return a.agencyName.localeCompare(b.agencyName);
      })
      .slice(0, maxAssignments);

    await Promise.all(eligible.map(async (match) => {
      const assignmentId = `${requestRef.id}_${match.agencyId}`;
      await db.collection('family_request_assignments').doc(assignmentId).set({
        request_id: requestRef.id,
        family_id: familyId,
        agency_id: match.agencyId,
        score: match.score,
        base_score: match.base_score,
        sponsored_boost: match.sponsored_boost,
        tier: match.tier,
        reasons: match.reasons,
        breakdown: match.breakdown,
        status: 'new',
        created_at: nowIso,
        updated_at: nowIso,
      }, { merge: true });

      await db.collection('agency_notifications').add({
        agency_id: match.agencyId,
        type: 'message',
        title: `New family request in ${sanitized.borough}`,
        message: `${sanitized.parent_name} requested ${sanitized.care_type} care`,
        link: `/agency/family-requests/${assignmentId}`,
        read: false,
        created_at: nowIso,
        updated_at: nowIso,
      });

      await db.collection('notification_jobs').add({
        eventId: `family-request-${assignmentId}`,
        trigger: 'direct_notification',
        recipientUserId: match.agencyId,
        recipientRole: 'agency',
        channel: 'in_app',
        status: 'pending',
        scheduledAt: new Date(),
        sentAt: null,
        payload: {
          title: `New family request in ${sanitized.borough}`,
          body: `${sanitized.parent_name} requested ${sanitized.care_type} care`,
          data: {
            link: `/agency/family-requests/${assignmentId}`,
            skipInApp: '1',
          },
        },
        audit: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }));

    await requestRef.update({
      status: eligible.length > 0 ? 'matched' : 'no_match',
      top_match_count: eligible.length,
      updated_at: new Date().toISOString(),
    });

    return res.json({ requestId: requestRef.id, matchCount: eligible.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to submit family request' });
  }
});

const closeFamilyRequestById = async (requestId: string, familyId: string) => {
  const requestRef = db.collection('family_requests').doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    return { status: 404 as const, body: { error: 'Care request not found.' } };
  }

  const requestData = requestSnap.data() || {};
  if (String(requestData.family_id || '') !== familyId) {
    return { status: 403 as const, body: { error: 'Forbidden: request does not belong to this family' } };
  }

  const assignmentsSnap = await db.collection('family_request_assignments')
    .where('request_id', '==', requestId)
    .where('family_id', '==', familyId)
    .get();

  const assignments = assignmentsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() || {}),
  } as any));

  const activeAssignments = assignments.filter((assignment) =>
    assignment.status === 'new' || assignment.status === 'accepted' || assignment.status === 'more_details'
  );

  const nowIso = new Date().toISOString();
  await Promise.all(activeAssignments.map((assignment) => {
    const agencyId = String(assignment.agency_id || '').trim();
    if (!agencyId) return Promise.resolve();
    return db.collection('agency_notifications').add({
      agency_id: agencyId,
      type: 'message',
      title: 'Family request closed',
      message: 'The family deleted this care request before moving forward.',
      link: '/agency/family-requests',
      read: false,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }));

  const batch = db.batch();
  assignmentsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  batch.delete(requestRef);
  await batch.commit();

  return { status: 200 as const, body: { ok: true, notified: activeAssignments.length } };
};

const resolveCloseRequestPayload = (req: any) => {
  const requestId = String(req.params?.requestId || req.body?.requestId || '').trim();
  const callerFamilyId = String(req.userId || '').trim();
  const familyId = String(req.body?.familyId || req.query?.familyId || callerFamilyId || '').trim();
  return { requestId, callerFamilyId, familyId };
};

const handleCloseFamilyRequest = async (req: any, res: any) => {
  const { requestId, callerFamilyId, familyId } = resolveCloseRequestPayload(req);

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required' });
  }

  if (!familyId) {
    return res.status(400).json({ error: 'familyId is required' });
  }

  if (familyId !== callerFamilyId) {
    return res.status(403).json({ error: 'Forbidden: cannot close requests for another family' });
  }

  try {
    const result = await closeFamilyRequestById(requestId, familyId);
    return res.status(result.status).json(result.body);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to close care request' });
  }
};

// POST /api/family/care-history/sync - Create or update care_history from a placement application.
router.post('/care-history/sync', requireFamilyAuth, async (req: any, res: any) => {
  const callerFamilyId = String(req.userId || '').trim();
  const applicationId = String(req.body?.applicationId || '').trim();
  const placementStatusRaw = String(req.body?.placementStatus || 'completed').trim().toLowerCase();
  const placementStatus: 'active' | 'completed' = placementStatusRaw === 'active' ? 'active' : 'completed';

  if (!applicationId) {
    return res.status(400).json({ error: 'applicationId is required' });
  }

  const toIso = (value: any): string | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    }
    if (typeof value?.seconds === 'number') {
      const date = new Date(value.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const addDaysIso = (value: string, days: number) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };

  try {
    const familyAppDoc = await db.collection('family_applications').doc(applicationId).get();
    const agencyAppDoc = familyAppDoc.exists ? null : await db.collection('applications').doc(applicationId).get();

    if (!familyAppDoc.exists && !agencyAppDoc?.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const fromFamilyApplication = familyAppDoc.exists;
    const app = (fromFamilyApplication ? familyAppDoc.data() : agencyAppDoc!.data()) as any;
    const jobId = String(app?.job_id || '').trim();
    const nannyId = String(app?.nanny_id || '').trim();
    if (!jobId || !nannyId) {
      return res.status(400).json({ error: 'Application is missing job or nanny data' });
    }

    const jobDoc = await db.collection('jobs').doc(jobId).get();
    const jobData = jobDoc.exists ? (jobDoc.data() as any) : null;
    const agencyId = String(app?.agency_id || jobData?.agency_id || '').trim();
    const familyId = String(app?.family_id || jobData?.family_id || '').trim();

    if (!agencyId || !familyId) {
      return res.status(400).json({ error: 'Unable to resolve family or agency for this application' });
    }

    if (familyId !== callerFamilyId) {
      return res.status(403).json({ error: 'Forbidden: application does not belong to this family' });
    }

    const existingSnap = await db.collection('care_history')
      .where('family_id', '==', familyId)
      .where('job_id', '==', jobId)
      .where('nanny_id', '==', nannyId)
      .limit(1)
      .get();

    const existingDoc = existingSnap.empty ? null : existingSnap.docs[0];
    const existingHistory = existingDoc ? (existingDoc.data() as any) : null;

    const agencyDoc = await db.collection('agency_profiles').doc(agencyId).get();
    const nannyDoc = await db.collection('nanny_profiles').doc(nannyId).get();
    const derivedStartDate =
      existingHistory?.start_date
      || toIso(app?.start_date)
      || toIso(app?.active_at)
      || new Date().toISOString();
    const weekOneReviewAvailableAt = existingHistory?.week_one_review_available_at || addDaysIso(derivedStartDate, 7);
    const completedAt = new Date().toISOString();

    const history = {
      family_id: familyId,
      job_id: jobId,
      agency_id: agencyId,
      nanny_id: nannyId,
      family_application_id: fromFamilyApplication ? applicationId : undefined,
      agency_application_id: fromFamilyApplication ? undefined : applicationId,
      source_inquiry_id: app?.source_inquiry_id || jobData?.source_inquiry_id || undefined,
      job_title: jobData?.title,
      job_type: jobData?.job_type,
      location_borough: jobData?.location_borough,
      location_neighborhood: jobData?.location_neighborhood,
      agency_name: agencyDoc.exists ? String((agencyDoc.data() as any)?.company_name || '') : undefined,
      nanny_name: nannyDoc.exists
        ? `${String((nannyDoc.data() as any)?.first_name || '').trim()} ${String((nannyDoc.data() as any)?.last_name || '').trim()}`.trim()
        : undefined,
      placement_status: placementStatus,
      start_date: derivedStartDate,
      end_date: placementStatus === 'completed' ? (existingHistory?.end_date || completedAt) : existingHistory?.end_date,
      week_one_review_available_at: weekOneReviewAvailableAt,
      summary: String(app?.call_note || (placementStatus === 'completed' ? 'Care placement completed.' : 'Placement started and is in progress.')),
      reviewed_agency_by_family: !!existingHistory?.reviewed_agency_by_family,
      reviewed_nanny_by_family: !!existingHistory?.reviewed_nanny_by_family,
      reviewed_agency_week_one_by_family: !!existingHistory?.reviewed_agency_week_one_by_family,
      reviewed_nanny_week_one_by_family: !!existingHistory?.reviewed_nanny_week_one_by_family,
      reviewed_agency_completion_by_family: !!existingHistory?.reviewed_agency_completion_by_family,
      reviewed_nanny_completion_by_family: !!existingHistory?.reviewed_nanny_completion_by_family,
      rating: Number(existingHistory?.rating || 0),
      review: String(existingHistory?.review || ''),
      updated_at: new Date().toISOString(),
    };

    if (existingDoc) {
      await existingDoc.ref.set(history, { merge: true });
      return res.json({ ok: true, id: existingDoc.id, synced: true, existing: true });
    }

    const createdRef = await db.collection('care_history').add({
      ...history,
      created_at: new Date().toISOString(),
    });
    return res.json({ ok: true, id: createdRef.id, synced: true, existing: false });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to sync care history' });
  }
});

// Preferred route used by the frontend.
router.post('/requests/:requestId/close', requireFamilyAuth, handleCloseFamilyRequest);
// Compatibility alias for older clients or cached bundles.
router.post('/requests/close/:requestId', requireFamilyAuth, handleCloseFamilyRequest);
// REST-style compatibility for clients using DELETE.
router.delete('/requests/:requestId', requireFamilyAuth, handleCloseFamilyRequest);

// ── FCM Push Token Management ────────────────────────────────────────────
router.post('/fcm-token', requireFamilyAuth, async (req: any, res: any) => {
  try {
    const { fcm_token, device_name, os, app_version } = req.body as Record<string, string>;
    if (!fcm_token?.trim()) return res.status(400).json({ error: 'fcm_token is required' });
    const { registerFcmToken } = await import('../services/fcmTokenManager.js');
    await registerFcmToken(req.userId, fcm_token.trim(), { deviceName: device_name, os, appVersion: app_version });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to register FCM token' });
  }
});

router.delete('/fcm-token/:fcmToken', requireFamilyAuth, async (req: any, res: any) => {
  try {
    const fcmToken = decodeURIComponent(req.params.fcmToken || '');
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken param is required' });
    const { unregisterFcmToken } = await import('../services/fcmTokenManager.js');
    await unregisterFcmToken(req.userId, fcmToken);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to unregister FCM token' });
  }
});

router.post('/fcm-tokens/logout', requireFamilyAuth, async (req: any, res: any) => {
  try {
    const { deactivateAllFcmTokens } = await import('../services/fcmTokenManager.js');
    await deactivateAllFcmTokens(req.userId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to deactivate FCM tokens' });
  }
});

router.get('/fcm-tokens/status', requireFamilyAuth, async (req: any, res: any) => {
  try {
    const { getUserFcmTokenStats } = await import('../services/fcmTokenManager.js');
    const stats = await getUserFcmTokenStats(req.userId);
    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to get FCM token stats' });
  }
});

export default router;
