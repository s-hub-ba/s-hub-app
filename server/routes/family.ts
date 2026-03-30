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
  care_type: 'full-time' | 'part-time' | 'temporary';
  live_in: 'live-in' | 'live-out' | 'either';
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
};

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

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
      ['full-time', 'part-time', 'temporary', 'live-in', 'live-out'].some((token) => item.includes(token))
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
  const careType = supportedCareTypes.has(normalize(request.care_type)) ? 20 : 0;

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
  care_type: payload.care_type,
  live_in: payload.live_in,
  start_date: String(payload.start_date || ''),
  schedule: String(payload.schedule || ''),
  budget_min: typeof payload.budget_min === 'number' ? payload.budget_min : null,
  budget_max: typeof payload.budget_max === 'number' ? payload.budget_max : null,
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
    const activeStatuses = new Set(['submitted', 'matched', 'in_progress', 'accepted']);
    const snapshot = await db.collection('family_requests')
      .where('family_id', '==', familyId)
      .get();

    const activeRequestCount = snapshot.docs.filter((docSnap) => activeStatuses.has(String(docSnap.data()?.status || 'submitted'))).length;
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
    const activeStatuses = new Set(['submitted', 'matched', 'in_progress', 'accepted']);
    const existing = await db.collection('family_requests').where('family_id', '==', familyId).get();
    const activeCount = existing.docs.filter((docSnap) => activeStatuses.has(String(docSnap.data()?.status || 'submitted'))).length;

    if (activeCount >= FAMILY_FREE_ACTIVE_REQUEST_LIMIT) {
      return res.status(403).json({
        error: 'Families can have one active childcare request at a time. Close your existing request before submitting another.',
        code: 'FAMILY_ACTIVE_REQUEST_LIMIT_REACHED',
      });
    }

    const sanitized = sanitizeFamilyPayload(payload);
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
