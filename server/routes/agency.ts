import { Router } from 'express';
import { db, auth } from '../firebase.js';
import { PLAN_CODES, PLAN_JOB_LIMITS, PLAN_RECRUITER_LIMITS, calculateSubscriptionPrice } from '../services/billing.js';

const router = Router();

const getHeaderValue = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
};

const getBearerToken = (req: any): string => {
  const authHeader = getHeaderValue(req.headers?.authorization);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
};

// Middleware to verify agency-scoped request identity.
const requireAgencyOwner = async (req: any, res: any, next: any) => {
  const rawAgencyId = req.headers['x-agency-id'];
  const agencyId = Array.isArray(rawAgencyId) ? rawAgencyId[0] : rawAgencyId;
  const fallbackUserId = getHeaderValue(req.headers['x-user-id']);
  const token = getBearerToken(req);

  let callerUserId = '';
  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      callerUserId = String(decoded.uid || '');
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized: invalid auth token' });
    }
  } else if (process.env.NODE_ENV !== 'production') {
    callerUserId = fallbackUserId;
  }

  req.agency_id = agencyId;
  req.user_id = callerUserId;
  if (!agencyId || !callerUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const generateUniqueInviteCode = async () => {
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10);
    const existing = await db.collection('invite_links').doc(code).get();
    if (!existing.exists) return code;
  }
  throw new Error('Failed to generate unique invite code');
};

const resolveAgencyPlanCode = async (agencyId: string) => {
  const subscriptionSnapshot = await db.collection('agency_subscriptions')
    .where('agency_id', '==', agencyId)
    .get();

  if (subscriptionSnapshot.empty) return PLAN_CODES.FREE;

  const subscription = subscriptionSnapshot.docs
    .map((docSnap) => docSnap.data() || {})
    .sort((a, b) => {
      const aTime = new Date(String(a.created_at || a.updated_at || 0)).getTime();
      const bTime = new Date(String(b.created_at || b.updated_at || 0)).getTime();
      return bTime - aTime;
    })[0] || {};
  const planCode = typeof subscription.plan_code === 'string' ? subscription.plan_code : PLAN_CODES.FREE;
  const isActive = subscription.status === 'active' || subscription.status === 'trial';
  return isActive ? planCode : PLAN_CODES.FREE;
};

const normalizeTalentPoolInvitationStatus = (value: unknown): 'pending' | 'accepted' | 'declined' | 'left' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'accepted' || normalized === 'declined' || normalized === 'left') {
    return normalized;
  }
  return 'accepted';
};

const getAgencyDisplayName = async (agencyId: string) => {
  if (!agencyId) return 'Agency';
  const snap = await db.collection('agency_profiles').doc(agencyId).get();
  if (!snap.exists) return 'Agency';
  const data = snap.data() || {};
  return String(data.company_name || data.name || 'Agency');
};

type AgencyAccessContext = {
  isAgencyAdmin: boolean;
  isRecruiter: boolean;
  canActForAgency: boolean;
};

const getAgencyAccessContext = async (
  agencyId: string,
  callerUserId: string,
): Promise<AgencyAccessContext> => {
  if (!agencyId || !callerUserId) {
    return { isAgencyAdmin: false, isRecruiter: false, canActForAgency: false };
  }

  // Legacy owner pattern: agency profile doc id equals owner uid.
  const isLegacyOwner = callerUserId === agencyId;

  let isAgencyAdminFromUserDoc = false;
  try {
    const userDoc = await db.collection('users').doc(callerUserId).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      const role = String(data.role || '');
      const linkedAgencyId = String(data.agency_id || data.agency_profile_id || '');
      isAgencyAdminFromUserDoc = (role === 'agency_admin' || role === 'agency') && linkedAgencyId === agencyId;
    }
  } catch {
    // Non-fatal; recruiter check below still allows scoped access.
  }

  const recruiterSnap = await db.collection('agency_recruiters')
    .where('agency_id', '==', agencyId)
    .where('user_id', '==', callerUserId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  const isRecruiter = !recruiterSnap.empty;
  const isAgencyAdmin = isLegacyOwner || isAgencyAdminFromUserDoc;

  return {
    isAgencyAdmin,
    isRecruiter,
    canActForAgency: isAgencyAdmin || isRecruiter,
  };
};

// GET /api/agency/public-list - Public directory list for unauthenticated visitors
router.get('/public-list', async (_req: any, res: any) => {
  try {
    const snapshot = await db.collection('agency_profiles').get();
    const agencies = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        company_name: data.company_name || data.name || 'Agency',
        name: data.name || data.company_name || 'Agency',
        logo: data.logo || null,
        boroughs: Array.isArray(data.boroughs) ? data.boroughs : [],
        specialties: Array.isArray(data.specialties) ? data.specialties : [],
        description: data.description || data.bio || '',
        bio: data.bio || data.description || '',
        plan_tier: data.plan_tier || null,
        sponsored: !!data.sponsored,
        isSponsored: !!data.isSponsored,
        isVerified: data.isVerified ?? data.is_verified ?? false,
      };
    });

    return res.json({ agencies });
  } catch (error: any) {
    console.error('[agency/public-list] error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load agencies' });
  }
});

// POST /api/agency/jobs - Create a job via backend with plan enforcement
router.post('/jobs', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');
  const payload = req.body || {};

  if (!agency_id || !callerUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!payload.title || !payload.description) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.canActForAgency) {
      return res.status(403).json({ error: 'Forbidden: user does not belong to this agency' });
    }

    const planCode = await resolveAgencyPlanCode(agency_id);
    const shouldCountAgainstLimit = (payload.status || 'published') === 'published';

    if (shouldCountAgainstLimit) {
      const activeJobSnapshot = await db.collection('jobs')
        .where('agency_id', '==', agency_id)
        .where('status', '==', 'published')
        .get();

      const jobLimit = PLAN_JOB_LIMITS[planCode as keyof typeof PLAN_JOB_LIMITS] ?? 0;
      if (jobLimit !== null && activeJobSnapshot.size >= jobLimit) {
        return res.status(403).json({
          error: planCode === PLAN_CODES.FREE
            ? 'Free agencies can create a profile and receive family requests, but job posting starts on the Starter plan.'
            : `Your current plan allows ${jobLimit} active job posting${jobLimit === 1 ? '' : 's'}. Upgrade to publish more jobs.`,
          code: 'JOB_LIMIT_REACHED',
        });
      }
    }

    const nowIso = new Date().toISOString();
    const docRef = await db.collection('jobs').add({
      ...payload,
      agency_id,
      created_at: nowIso,
      updated_at: nowIso,
    });

    const created = await docRef.get();
    return res.json({ id: created.id, ...(created.data() || {}) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create job' });
  }
});

// POST /api/agency/talent-pool/invite - Invite a nanny into an agency talent pool
router.post('/talent-pool/invite', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');
  const nannyId = String(req.body?.nannyId || '').trim();

  if (!agency_id || !callerUserId || !nannyId) {
    return res.status(400).json({ error: 'agency_id and nannyId are required' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.canActForAgency) {
      return res.status(403).json({ error: 'Forbidden: user does not belong to this agency' });
    }

    const existingSameAgencySnap = await db.collection('agency_talent_pool')
      .where('agency_id', '==', agency_id)
      .where('nanny_id', '==', nannyId)
      .limit(1)
      .get();

    const allMembershipsSnap = await db.collection('agency_talent_pool')
      .where('nanny_id', '==', nannyId)
      .get();

    const activeMembershipCount = allMembershipsSnap.docs.filter((docSnap) => {
      const data = docSnap.data() || {};
      const status = normalizeTalentPoolInvitationStatus(data.invitation_status);
      return status === 'pending' || status === 'accepted';
    }).length;

    const existingSameAgency = existingSameAgencySnap.empty ? null : existingSameAgencySnap.docs[0];
    const existingSameAgencyStatus = normalizeTalentPoolInvitationStatus(existingSameAgency?.data()?.invitation_status);
    const existingCountsAgainstLimit = !!existingSameAgency && (existingSameAgencyStatus === 'pending' || existingSameAgencyStatus === 'accepted');

    if (!existingCountsAgainstLimit && activeMembershipCount >= 5) {
      return res.status(403).json({
        error: 'This nanny is already in 5 active talent pools and cannot be invited to more right now.',
        code: 'TALENT_POOL_LIMIT_REACHED',
      });
    }

    const nowIso = new Date().toISOString();
    let talentPoolId = '';

    if (existingSameAgency) {
      if (existingSameAgencyStatus === 'pending' || existingSameAgencyStatus === 'accepted') {
        return res.json({ id: existingSameAgency.id, alreadyExists: true, invitation_status: existingSameAgencyStatus });
      }

      await existingSameAgency.ref.set({
        invitation_status: 'pending',
        invited_at: nowIso,
        responded_at: null,
        left_at: null,
        exclusion_note: '',
        latest_note: '',
        updated_at: nowIso,
      }, { merge: true });
      talentPoolId = existingSameAgency.id;
    } else {
      const createdRef = await db.collection('agency_talent_pool').add({
        agency_id,
        nanny_id: nannyId,
        status: 'invited',
        invitation_status: 'pending',
        tags: [],
        latest_note: '',
        exclusion_note: '',
        invited_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
      talentPoolId = createdRef.id;
    }

    const agencyName = await getAgencyDisplayName(agency_id);
    await db.collection('nanny_notifications').add({
      nanny_id: nannyId,
      type: 'application',
      title: 'Talent pool invitation',
      message: `${agencyName} invited you to join their talent pool.`,
      link: '/nanny/talent-pools',
      read: false,
      created_at: nowIso,
      updated_at: nowIso,
    });

    await db.collection('notification_jobs').add({
      eventId: `talent-pool-invite-${talentPoolId}`,
      trigger: 'direct_notification',
      recipientUserId: nannyId,
      recipientRole: 'nanny',
      channel: 'in_app',
      status: 'pending',
      scheduledAt: new Date(),
      sentAt: null,
      payload: {
        title: 'Talent pool invitation',
        body: `${agencyName} invited you to join their talent pool.`,
        data: {
          link: '/nanny/talent-pools',
          skipInApp: '1',
        },
      },
      audit: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return res.json({ id: talentPoolId, invitation_status: 'pending' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to invite nanny to talent pool' });
  }
});

// GET /api/agency/recruiters - List recruiter seats for agency admin panel
router.get('/recruiters', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');

  if (!agency_id || !callerUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.isAgencyAdmin) {
      return res.status(403).json({ error: 'Forbidden: only agency admins can manage team seats' });
    }

    const [planCode, recruiterSnap] = await Promise.all([
      resolveAgencyPlanCode(agency_id),
      db.collection('agency_recruiters')
        .where('agency_id', '==', agency_id)
        .get(),
    ]);

    const seatLimit = PLAN_RECRUITER_LIMITS[planCode as keyof typeof PLAN_RECRUITER_LIMITS] ?? 0;
    const recruiters = recruiterSnap.docs
      .map((docSnap): Record<string, any> => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }))
      .sort((a, b) => {
        const aTime = new Date(String(a.created_at || 0)).getTime();
        const bTime = new Date(String(b.created_at || 0)).getTime();
        return bTime - aTime;
      });

    const activeSeatCount = recruiters.filter((item) => item.status === 'active').length;

    return res.json({
      plan_code: planCode,
      seat_limit: seatLimit,
      active_seat_count: activeSeatCount,
      recruiters,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load recruiter seats' });
  }
});

// POST /api/agency/recruiter - Add a recruiter seat
router.post('/recruiter', requireAgencyOwner, async (req: any, res: any) => {
  const { email, first_name, last_name } = req.body;
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');

  if (!agency_id || !callerUserId || !email || !first_name || !last_name) {
    return res.status(400).json({ error: 'agency_id, email, first_name, and last_name are required' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.isAgencyAdmin) {
      return res.status(403).json({ error: 'Forbidden: only agency admins can manage team seats' });
    }

    const planCode = await resolveAgencyPlanCode(agency_id);
    const recruiterLimit = PLAN_RECRUITER_LIMITS[planCode as keyof typeof PLAN_RECRUITER_LIMITS] ?? 0;
    const currentRecruiterSnapshot = await db.collection('agency_recruiters')
      .where('agency_id', '==', agency_id)
      .where('status', '==', 'active')
      .get();

    if (recruiterLimit !== null && currentRecruiterSnapshot.size >= recruiterLimit) {
      return res.status(403).json({
        error: planCode === PLAN_CODES.FREE
          ? 'Free agencies include the owner account only. Upgrade to Starter or above to add recruiter seats.'
          : `Your current plan includes ${recruiterLimit} recruiter seat${recruiterLimit === 1 ? '' : 's'}. Upgrade to add more recruiters.`,
        code: 'RECRUITER_LIMIT_REACHED',
      });
    }

    // Prevent duplicate recruiter seat for this agency by email
    const existingRecruiterSnapshot = await db.collection('agency_recruiters')
      .where('agency_id', '==', agency_id)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingRecruiterSnapshot.empty) {
      return res.status(409).json({ error: 'Recruiter already exists in this agency' });
    }

    let existingAuthUser;
    try {
      existingAuthUser = await auth.getUserByEmail(email);
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    if (existingAuthUser) {
      return res.status(409).json({ error: 'Email is already used for another account' });
    }

    const password = Math.random().toString(36).slice(-12);
    const userRecord = await auth.createUser({
      email,
      displayName: `${first_name} ${last_name}`,
      password
    });

    const newUserId = userRecord.uid;

    const nowIso = new Date().toISOString();

    await db.collection('users').doc(newUserId).set({
      email,
      role: 'agency_recruiter',
      status: 'active',
      agency_id,
      first_name,
      last_name,
      created_at: nowIso,
      updated_at: nowIso,
    }, { merge: true });

    await db.collection('agency_recruiters').add({
      agency_id,
      user_id: newUserId,
      email,
      first_name,
      last_name,
      status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // Legacy billing sync: only update existing seat-priced subscriptions.
    const subSnapshot = await db.collection('subscriptions').where('agency_id', '==', agency_id).limit(1).get();

    if (!subSnapshot.empty) {
      const subDoc = subSnapshot.docs[0];
      const sub = subDoc.data();
      const newCount = (sub.recruiter_count || 0) + 1;
      const newTotal = calculateSubscriptionPrice(newCount);

      await subDoc.ref.update({
        recruiter_count: newCount,
        total_price: newTotal,
        updated_at: new Date().toISOString()
      });

      console.log(`[Billing] Agency ${agency_id} price increased to $${newTotal}/mo`);
    }

    res.json({ success: true, message: 'Recruiter added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/agency/recruiter/:id - Remove a recruiter seat
router.delete('/recruiter/:id', requireAgencyOwner, async (req: any, res: any) => {
  const { id: recruiterId } = req.params;
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');

  if (!agency_id || !callerUserId || !recruiterId) {
    return res.status(400).json({ error: 'Missing agency_id or recruiter id' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.isAgencyAdmin) {
      return res.status(403).json({ error: 'Forbidden: only agency admins can manage team seats' });
    }

    // Remove by doc ID first, then fallback to user_id match
    let recruiterSnapshot = await db.collection('agency_recruiters').doc(recruiterId).get();
    let docsToDelete = [];

    if (recruiterSnapshot.exists && recruiterSnapshot.data()?.agency_id === agency_id) {
      docsToDelete = [recruiterSnapshot];
    } else {
      const querySnapshot = await db.collection('agency_recruiters')
        .where('agency_id', '==', agency_id)
        .where('user_id', '==', recruiterId)
        .get();
      docsToDelete = querySnapshot.docs;
    }

    if (docsToDelete.length === 0) {
      return res.status(404).json({ error: 'Recruiter record not found for this agency' });
    }

    const recruiterUserIds = docsToDelete
      .map((docSnap: any) => String(docSnap.data()?.user_id || ''))
      .filter(Boolean);

    await Promise.all(docsToDelete.map(d => d.ref.delete()));

    await Promise.all(recruiterUserIds.map(async (uid: string) => {
      await db.collection('users').doc(uid).set({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }));

    // Re-calculate recruiter_count based on current active seats
    const remainingSnapshot = await db.collection('agency_recruiters')
      .where('agency_id', '==', agency_id)
      .where('status', '==', 'active')
      .get();

    const newCount = remainingSnapshot.size;
    const newTotal = calculateSubscriptionPrice(newCount);

    const subSnapshot = await db.collection('subscriptions').where('agency_id', '==', agency_id).limit(1).get();
    if (!subSnapshot.empty) {
      const subDoc = subSnapshot.docs[0];
      await subDoc.ref.update({
        recruiter_count: newCount,
        total_price: newTotal,
        updated_at: new Date().toISOString()
      });
      console.log(`[Billing] Agency ${agency_id} price updated to $${newTotal}/mo`);
    }

    res.json({ success: true, message: 'Recruiter removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agency/invite-link - Generate a nanny invite link
router.post('/invite-link', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = String(req.agency_id || '');
  const callerUserId = String(req.user_id || '');

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.isAgencyAdmin) {
      return res.status(403).json({ error: 'Forbidden: only agency admins can generate invite links' });
    }

    const code = await generateUniqueInviteCode();

    await db.collection('invite_links').doc(code).set({
      agency_id,
      code,
      created_at: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      invite_link: `https://shiftmeup.com/join/${code}`,
      code 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agency/posts - Create an agency post via server (admin SDK bypasses client rules)
router.post('/posts', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = req.agency_id as string;
  const { title, content } = req.body || {};
  const callerUserId = req.user_id as string;

  if (!agency_id || !callerUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !content || String(title).trim().length === 0 || String(content).trim().length === 0) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  try {
    const access = await getAgencyAccessContext(agency_id, callerUserId);
    if (!access.isAgencyAdmin) {
      return res.status(403).json({ error: 'Forbidden: only agency admins can publish agency posts' });
    }

    const docRef = await db.collection('agency_posts').add({
      agency_id,
      title: String(title).trim(),
      content: String(content).trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: callerUserId
    });

    return res.json({ id: docRef.id });
  } catch (error: any) {
    console.error('[agency/posts] error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

// POST /api/agency/inquiry - Create or update a family-agency conversation and add inquiry message
router.post('/inquiry', async (req: any, res: any) => {
  const {
    familyId,
    agencyId,
    familyName,
    familyEmail,
    familyPhone,
    familyBorough,
    agencyName,
    inquiry
  } = req.body || {};

  const callerUserId = Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'];
  if (!familyId || !agencyId || !inquiry?.description || !inquiry?.schedule_type) {
    return res.status(400).json({ error: 'Missing required inquiry fields' });
  }

  if (callerUserId && callerUserId !== familyId) {
    return res.status(403).json({ error: 'Caller does not match family id' });
  }

  // Stable deterministic ID avoids compound query and composite index requirement
  const conversationId = `${familyId}_${agencyId}`;

  try {
    console.log('[inquiry] family:', familyId, 'agency:', agencyId);

    const scheduleSummary = inquiry.schedule_type === 'date_range'
      ? `Date range: ${inquiry.start_date || 'TBD'} to ${inquiry.end_date || 'TBD'}`
      : `Preferred weekdays: ${(inquiry.weekdays || []).join(', ')}`;

    const introMessage = [
      `New agency inquiry from ${familyName || 'Family'}.`,
      familyEmail ? `Email: ${familyEmail}` : null,
      familyPhone ? `Phone: ${familyPhone}` : null,
      familyBorough ? `Borough: ${familyBorough}` : null,
      scheduleSummary,
      '',
      String(inquiry.description)
    ].filter(Boolean).join('\n');

    const conversationRef = db.collection('conversations').doc(conversationId);

    await conversationRef.set({
      participants: [familyId, agencyId],
      family_id: familyId,
      agency_id: agencyId,
      family_name: familyName || 'Family',
      agency_name: agencyName || 'Agency',
      family_email: familyEmail || null,
      family_phone: familyPhone || null,
      family_borough: familyBorough || null,
      inquiry_type: 'agency_intro',
      inquiry_schedule_type: inquiry.schedule_type,
      inquiry_start_date: inquiry.schedule_type === 'date_range' ? inquiry.start_date || null : null,
      inquiry_end_date: inquiry.schedule_type === 'date_range' ? inquiry.end_date || null : null,
      inquiry_weekdays: inquiry.schedule_type === 'weekly_days' ? (inquiry.weekdays || []) : [],
      inquiry_description_preview: String(inquiry.description).slice(0, 280),
      last_message: String(inquiry.description).slice(0, 280),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, { merge: true });

    await conversationRef.collection('messages').add({
      sender_id: familyId,
      sender_type: 'family',
      content: introMessage,
      created_at: new Date().toISOString()
    });

    return res.json({ id: conversationId });
  } catch (error: any) {
    console.error('[inquiry] error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create inquiry' });
  }
});

// ── FCM Push Token Management ────────────────────────────────────────────
router.post('/fcm-token', requireAgencyOwner, async (req: any, res: any) => {
  try {
    const { fcm_token, device_name, os, app_version } = req.body as Record<string, string>;
    if (!fcm_token?.trim()) return res.status(400).json({ error: 'fcm_token is required' });
    const { registerFcmToken } = await import('../services/fcmTokenManager.js');
    await registerFcmToken(req.user_id, fcm_token.trim(), {
      deviceName: device_name,
      os,
      appVersion: app_version,
      agencyId: req.agency_id,
    });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to register FCM token' });
  }
});

router.delete('/fcm-token/:fcmToken', requireAgencyOwner, async (req: any, res: any) => {
  try {
    const fcmToken = decodeURIComponent(req.params.fcmToken || '');
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken param is required' });
    const { unregisterFcmToken } = await import('../services/fcmTokenManager.js');
    await unregisterFcmToken(req.user_id, fcmToken);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to unregister FCM token' });
  }
});

router.post('/fcm-tokens/logout', requireAgencyOwner, async (req: any, res: any) => {
  try {
    const { deactivateAllFcmTokens } = await import('../services/fcmTokenManager.js');
    await deactivateAllFcmTokens(req.user_id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to deactivate FCM tokens' });
  }
});

router.get('/fcm-tokens/status', requireAgencyOwner, async (req: any, res: any) => {
  try {
    const { getUserFcmTokenStats } = await import('../services/fcmTokenManager.js');
    const stats = await getUserFcmTokenStats(req.user_id);
    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to get FCM token stats' });
  }
});

export default router;
