import { Router } from 'express';
import { db, auth, normalizeFirebaseAdminError } from '../firebase.js';
import { buildNannyCvid } from '../services/nannyIdentity.ts';
import {
  aggregateShiftScoreReviews,
  combineShiftScoreSignals,
  computeProfileSignalScore,
  resolveShiftScoreConfig,
} from '../../src/lib/shiftScore.ts';

const router = Router();
const NANNY_FREE_APPLICATION_LIMIT = 5;
const FREE_GROWTH_TASK_POINTS: Record<string, number> = {
  'free-apply-3': 15,
  'free-refresh-calendar': 10,
  'free-fast-reply': 10,
  'free-profile-proof': 8,
};
const MANUAL_TASK_IDS = ['free-refresh-calendar', 'free-fast-reply', 'free-profile-proof'];
const PREMIUM_WEEKLY_TASK_POINTS = 20;

const getHeaderValue = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
};

const getBearerToken = (req: any): string => {
  const authHeader = getHeaderValue(req.headers?.authorization);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
};

// Middleware to verify nanny user (stub for MVP)
const requireNannyAuth = async (req: any, res: any, next: any) => {
  const fallbackUserId = getHeaderValue(req.headers['x-user-id']);
  const token = getBearerToken(req);
  let userId = '';

  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = String(decoded.uid || '');
    } catch (error) {
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
    const role = String(userDoc.data()?.role || '').trim();
    if (role !== 'nanny') {
      const nannyProfileDoc = await db.collection('nanny_profiles').doc(userId).get();
      if (!nannyProfileDoc.exists) {
        return res.status(403).json({ error: 'Forbidden - nanny access only' });
      }
    }
    req.userId = userId;
    next();
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message });
  }
};

const isPremiumNanny = async (nannyId: string) => {
  const profileDoc = await db.collection('nanny_profiles').doc(nannyId).get();
  if (!profileDoc.exists) return false;

  const premiumUntil = profileDoc.data()?.premium_until;
  if (!premiumUntil) return false;
  const premiumUntilMs = new Date(String(premiumUntil)).getTime();
  return Number.isFinite(premiumUntilMs) && premiumUntilMs > Date.now();
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getIsoWeekKey = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getCurrentWeekKey = () => getIsoWeekKey(new Date());

const getWeekRangeFromKey = (weekKeyRaw: unknown) => {
  const weekKey = String(weekKeyRaw || '').trim();
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) {
    const fallbackKey = getCurrentWeekKey();
    return getWeekRangeFromKey(fallbackKey);
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    const fallbackKey = getCurrentWeekKey();
    return getWeekRangeFromKey(fallbackKey);
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return {
    weekKey,
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
};

const getPremiumTaskId = (weekKey: string) => `premium-course-${weekKey}`;

const getGrowthProgressDocRef = (nannyId: string, weekKey: string) =>
  db.collection('nanny_growth_progress').doc(`${nannyId}_${weekKey}`);

const normalizeManualTaskIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || '').trim())
    .filter((entry) => MANUAL_TASK_IDS.includes(entry));
};

const calculateGrowthPoints = ({
  completedTaskIds,
  isPremium,
  weekKey,
}: {
  completedTaskIds: string[];
  isPremium: boolean;
  weekKey: string;
}) => {
  const premiumTaskId = getPremiumTaskId(weekKey);
  const availableBase = Object.values(FREE_GROWTH_TASK_POINTS).reduce((sum, value) => sum + value, 0);
  const available = availableBase + (isPremium ? PREMIUM_WEEKLY_TASK_POINTS : 0);

  let earned = 0;
  for (const [taskId, points] of Object.entries(FREE_GROWTH_TASK_POINTS)) {
    if (completedTaskIds.includes(taskId)) earned += points;
  }
  if (isPremium && completedTaskIds.includes(premiumTaskId)) {
    earned += PREMIUM_WEEKLY_TASK_POINTS;
  }

  const progressPct = available > 0 ? Math.min(100, Math.round((earned / available) * 100)) : 0;
  return { earned, available, progressPct };
};

const resolveGrowthStateForWeek = async ({
  nannyId,
  weekKey,
  isPremium,
}: {
  nannyId: string;
  weekKey: string;
  isPremium: boolean;
}) => {
  const { startMs, endMs } = getWeekRangeFromKey(weekKey);
  const premiumTaskId = getPremiumTaskId(weekKey);

  const [appsSnap, progressSnap] = await Promise.all([
    db.collection('applications').where('nanny_id', '==', nannyId).get(),
    getGrowthProgressDocRef(nannyId, weekKey).get(),
  ]);

  const applicationsThisWeek = appsSnap.docs.filter((docSnap) => {
    const createdAtMs = toMillis(docSnap.data()?.created_at);
    return createdAtMs >= startMs && createdAtMs < endMs;
  }).length;

  const autoCompletedTaskIds = applicationsThisWeek >= 3 ? ['free-apply-3'] : [];
  const manualCompletedTaskIds = normalizeManualTaskIds(progressSnap.data()?.manual_completed_task_ids);
  const rawCompleted = [...autoCompletedTaskIds, ...manualCompletedTaskIds];

  if (isPremium && progressSnap.data()?.quiz?.passed === true) {
    rawCompleted.push(premiumTaskId);
  }

  const completedTaskIds = Array.from(new Set(rawCompleted));
  const points = calculateGrowthPoints({ completedTaskIds, isPremium, weekKey });

  return {
    applicationsThisWeek,
    autoCompletedTaskIds,
    manualCompletedTaskIds,
    completedTaskIds,
    premiumTaskId,
    quiz: progressSnap.data()?.quiz || null,
    points,
  };
};

const computeAndPersistOfficialShiftScore = async (nannyId: string, weekKeyInput?: string) => {
  const weekKey = weekKeyInput && /^(\d{4})-W(\d{2})$/.test(weekKeyInput) ? weekKeyInput : getCurrentWeekKey();
  const [profileDoc, appsSnap, docsSnap, reviewsSnap, isPremium] = await Promise.all([
    db.collection('nanny_profiles').doc(nannyId).get(),
    db.collection('applications').where('nanny_id', '==', nannyId).get(),
    db.collection('nanny_documents').where('nanny_id', '==', nannyId).get(),
    db.collection('nanny_reviews').where('nanny_id', '==', nannyId).get(),
    isPremiumNanny(nannyId),
  ]);

  if (!profileDoc.exists) {
    throw new Error('Nanny profile not found');
  }

  const profile = profileDoc.data() || {};
  const applicationCount = appsSnap.size;
  const verifiedDocumentCount = docsSnap.docs.filter((docSnap) => docSnap.data()?.status === 'approved').length;
  const reviews = reviewsSnap.docs.map((docSnap) => ({
    reviewer_type: (docSnap.data()?.reviewer_type || docSnap.data()?.reviewer_role || 'family') as 'agency' | 'family',
    reliability_rating: Number(docSnap.data()?.reliability_rating || 0),
    communication_rating: Number(docSnap.data()?.communication_rating || 0),
    punctuality: Boolean(docSnap.data()?.punctuality),
    rehire: Boolean(docSnap.data()?.rehire),
    status: docSnap.data()?.status,
    moderated_status: docSnap.data()?.moderated_status,
  }));

  const config = resolveShiftScoreConfig();
  const completedFields = [
    !!profile?.first_name,
    !!profile?.last_name,
    !!profile?.phone_number,
    !!profile?.bio,
    !!profile?.location_borough,
    !!profile?.years_experience,
    Array.isArray(profile?.certifications) && profile.certifications.length > 0,
    !!profile?.availability && Object.keys(profile.availability || {}).length > 0,
    !!profile?.expected_pay_min,
    !!profile?.expected_pay_max,
  ].filter(Boolean).length;
  const totalFields = 10;

  const profileScore = computeProfileSignalScore(
    completedFields,
    totalFields,
    Number(profile?.years_experience || 0),
    Array.isArray(profile?.certifications) ? profile.certifications.length : 0,
    verifiedDocumentCount,
    applicationCount,
    config.profileWeights,
  );

  const reviewSummary = aggregateShiftScoreReviews(reviews, config.reviewWeights);
  const reviewScore = reviewSummary.reviewCount > 0 ? reviewSummary.shiftScore : 0;
  const baseScore = combineShiftScoreSignals(
    profileScore,
    reviewScore,
    reviewSummary.reviewCount > 0,
    config.blendWeights,
  );

  const growth = await resolveGrowthStateForWeek({ nannyId, weekKey, isPremium });
  const growthBonus = round1((growth.points.earned / Math.max(1, growth.points.available)) * 1.2);
  const officialScore = round1(Math.min(5, baseScore + growthBonus));

  await db.collection('nanny_profiles').doc(nannyId).set({
    shift_score: officialScore,
    shift_score_base: baseScore,
    shift_score_growth_bonus: growthBonus,
    shift_score_growth_points_week: growth.points.earned,
    shift_score_growth_points_available_week: growth.points.available,
    shift_score_growth_week_key: weekKey,
    shift_score_updated_at: new Date().toISOString(),
  }, { merge: true });

  return {
    score: officialScore,
    details: {
      completedFields,
      totalFields,
      documentBonus: Math.min(config.profileWeights.documentBonusCap, verifiedDocumentCount * config.profileWeights.documentBonusPerVerifiedDoc),
      verifiedDocumentCount,
      activityBonus: Math.min(config.profileWeights.activityBonusCap, applicationCount * config.profileWeights.activityBonusPerApplication),
      profileScore,
      reviewScore,
      reviewCount: reviewSummary.reviewCount,
      averageReliability: reviewSummary.averageReliability,
      averageCommunication: reviewSummary.averageCommunication,
      punctualityRate: reviewSummary.punctualityRate,
      rehireRate: reviewSummary.rehireRate,
      growthBonus,
      growthPointsEarned: growth.points.earned,
      growthPointsAvailable: growth.points.available,
      growthWeekKey: weekKey,
    },
  };
};

// POST /api/nanny/register - Register a nanny (handles invite links)
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, invite_code } = req.body;
  
  try {
    let agency_id = null;
    let premium_until = null;
    
    // 1. Process Invite Code if provided
    if (invite_code) {
      const inviteDoc = await db.collection('invite_links').doc(invite_code).get();
        
      if (inviteDoc.exists) {
        agency_id = inviteDoc.data()?.agency_id;
        
        // Grant 3 months of Premium access
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        premium_until = date.toISOString();
      }
    }
    
    // 2. Create Auth User
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `${first_name} ${last_name}`
    });
    
    const newUserId = userRecord.uid;
    const cvid = buildNannyCvid(newUserId, first_name, last_name);
    
    // 3. Insert into users and nanny_profiles
    await db.collection('users').doc(newUserId).set({
      email,
      role: 'nanny',
      nanny_id: newUserId,
      created_at: new Date().toISOString()
    });
    
    await db.collection('nanny_profiles').doc(newUserId).set({
      first_name,
      last_name,
      cvid,
      agency_id,
      premium_until,
      status: 'active',
      created_at: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'Nanny registered successfully',
      agency_assigned: !!agency_id,
      premium_granted: !!premium_until,
      uid: newUserId,
      cvid
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/nanny/profile - Get current nanny profile
router.get('/profile', requireNannyAuth, async (req, res) => {
  const nannyId = (req as any).userId;
  try {
    const profileDoc = await db.collection('nanny_profiles').doc(nannyId).get();
    const userDoc = await db.collection('users').doc(nannyId).get();

    if (!profileDoc.exists) {
      return res.status(404).json({ error: 'Nanny profile not found' });
    }

    return res.json({
      id: nannyId,
      email: userDoc.exists ? userDoc.data()?.email : null,
      ...profileDoc.data()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/nanny/profile - Update current nanny profile
router.put('/profile', requireNannyAuth, async (req, res) => {
  const nannyId = (req as any).userId;
  const updates = req.body;

  try {
    const profileRef = db.collection('nanny_profiles').doc(nannyId);
    await profileRef.set({ ...updates, updated_at: new Date().toISOString() }, { merge: true });

    // Keep the user role in sync (optional fields)
    if (updates.email || updates.role) {
      const userRef = db.collection('users').doc(nannyId);
      await userRef.set({
        ...(updates.email ? { email: updates.email } : {}),
        ...(updates.role ? { role: updates.role } : {}),
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    const updatedProfile = await profileRef.get();
    await computeAndPersistOfficialShiftScore(nannyId);
    return res.json({ id: nannyId, ...updatedProfile.data() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/nanny/applications - Create nanny job application with server-side quota enforcement
router.post('/applications', requireNannyAuth, async (req, res) => {
  const callerNannyId = String((req as any).userId || '');
  const { jobId, nannyId, coverLetter } = req.body || {};

  if (!callerNannyId || !jobId || !nannyId) {
    return res.status(400).json({ error: 'jobId and nannyId are required' });
  }

  if (callerNannyId !== String(nannyId)) {
    return res.status(403).json({ error: 'Forbidden: cannot submit applications for another nanny' });
  }

  try {
    const duplicateSnapshot = await db.collection('applications')
      .where('nanny_id', '==', callerNannyId)
      .where('job_id', '==', String(jobId))
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      return res.status(409).json({ error: 'You already applied to this job.' });
    }

    const premium = await isPremiumNanny(callerNannyId);
    if (!premium) {
      const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const existingApps = await db.collection('applications')
        .where('nanny_id', '==', callerNannyId)
        .get();

      const usedInWindow = existingApps.docs.filter((docSnap) => {
        const createdAt = docSnap.data()?.created_at;
        const createdAtMs = new Date(String(createdAt || 0)).getTime();
        return Number.isFinite(createdAtMs) && createdAtMs >= thirtyDaysAgoMs;
      }).length;

      if (usedInWindow >= NANNY_FREE_APPLICATION_LIMIT) {
        return res.status(403).json({
          error: `You have used all ${NANNY_FREE_APPLICATION_LIMIT} free applications for the last 30 days. Upgrade to premium to apply without limits.`,
          code: 'NANNY_APPLICATION_LIMIT_REACHED',
        });
      }
    }

    const jobDoc = await db.collection('jobs').doc(String(jobId)).get();
    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const jobData = jobDoc.data() || {};
    const nowIso = new Date().toISOString();
    const docRef = await db.collection('applications').add({
      job_id: String(jobId),
      nanny_id: callerNannyId,
      agency_id: jobData.agency_id || null,
      family_id: jobData.family_id || null,
      cover_letter: String(coverLetter || ''),
      status: 'applied',
      status_history: [{ status: 'applied', actor_role: 'nanny', at: nowIso }],
      created_at: nowIso,
      updated_at: nowIso,
    });

    const created = await docRef.get();
    await computeAndPersistOfficialShiftScore(callerNannyId);
    return res.json({ id: created.id, ...(created.data() || {}) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create application' });
  }
});

router.get('/growth-progress', requireNannyAuth, async (req: any, res: any) => {
  const nannyId = String(req.userId || '');
  const weekKey = getWeekRangeFromKey(req.query?.week).weekKey;

  try {
    const isPremium = await isPremiumNanny(nannyId);
    const growth = await resolveGrowthStateForWeek({ nannyId, weekKey, isPremium });
    const shiftScore = await computeAndPersistOfficialShiftScore(nannyId, weekKey);

    return res.json({
      weekKey,
      isPremium,
      applicationsThisWeek: growth.applicationsThisWeek,
      completedTaskIds: growth.completedTaskIds,
      autoCompletedTaskIds: growth.autoCompletedTaskIds,
      manualCompletedTaskIds: growth.manualCompletedTaskIds,
      premiumTaskId: growth.premiumTaskId,
      quiz: growth.quiz,
      points: growth.points,
      officialShiftScore: shiftScore.score,
      officialShiftScoreDetails: shiftScore.details,
    });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to load growth progress' });
  }
});

router.patch('/growth-progress/task', requireNannyAuth, async (req: any, res: any) => {
  const nannyId = String(req.userId || '');
  const weekKey = getWeekRangeFromKey(req.body?.weekKey).weekKey;
  const taskId = String(req.body?.taskId || '').trim();
  const completed = Boolean(req.body?.completed);

  if (!MANUAL_TASK_IDS.includes(taskId)) {
    return res.status(400).json({ error: 'Only manual free tasks can be updated directly.' });
  }

  try {
    const docRef = getGrowthProgressDocRef(nannyId, weekKey);
    const existing = await docRef.get();
    const currentManual = normalizeManualTaskIds(existing.data()?.manual_completed_task_ids);
    const nextManual = completed
      ? Array.from(new Set([...currentManual, taskId]))
      : currentManual.filter((entry) => entry !== taskId);

    await docRef.set({
      nanny_id: nannyId,
      week_key: weekKey,
      manual_completed_task_ids: nextManual,
      updated_at: new Date().toISOString(),
      created_at: existing.exists ? (existing.data()?.created_at || new Date().toISOString()) : new Date().toISOString(),
    }, { merge: true });

    const isPremium = await isPremiumNanny(nannyId);
    const growth = await resolveGrowthStateForWeek({ nannyId, weekKey, isPremium });
    const shiftScore = await computeAndPersistOfficialShiftScore(nannyId, weekKey);

    return res.json({
      success: true,
      weekKey,
      completedTaskIds: growth.completedTaskIds,
      autoCompletedTaskIds: growth.autoCompletedTaskIds,
      manualCompletedTaskIds: growth.manualCompletedTaskIds,
      points: growth.points,
      officialShiftScore: shiftScore.score,
    });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to update growth task' });
  }
});

router.post('/growth-progress/weekly-quiz', requireNannyAuth, async (req: any, res: any) => {
  const nannyId = String(req.userId || '');
  const weekKey = getWeekRangeFromKey(req.body?.weekKey).weekKey;
  const selectedAnswer = Number(req.body?.selectedAnswer);
  const passed = Boolean(req.body?.passed);
  const courseId = String(req.body?.courseId || '').trim();

  if (!Number.isFinite(selectedAnswer)) {
    return res.status(400).json({ error: 'selectedAnswer is required.' });
  }

  try {
    const premium = await isPremiumNanny(nannyId);
    if (!premium) {
      return res.status(403).json({ error: 'Weekly coaching quiz is a premium feature.' });
    }

    const docRef = getGrowthProgressDocRef(nannyId, weekKey);
    const existing = await docRef.get();
    const alreadyPassed = existing.data()?.quiz?.passed === true;
    const currentManual = normalizeManualTaskIds(existing.data()?.manual_completed_task_ids);
    const premiumTaskId = getPremiumTaskId(weekKey);

    if (alreadyPassed) {
      const growth = await resolveGrowthStateForWeek({ nannyId, weekKey, isPremium: true });
      const shiftScore = await computeAndPersistOfficialShiftScore(nannyId, weekKey);
      return res.json({
        success: true,
        alreadyCompleted: true,
        weekKey,
        completedTaskIds: growth.completedTaskIds,
        points: growth.points,
        officialShiftScore: shiftScore.score,
      });
    }

    await docRef.set({
      nanny_id: nannyId,
      week_key: weekKey,
      manual_completed_task_ids: currentManual,
      quiz: {
        courseId,
        selectedAnswer,
        passed,
        submitted_at: new Date().toISOString(),
        completed_task_id: passed ? premiumTaskId : null,
      },
      updated_at: new Date().toISOString(),
      created_at: existing.exists ? (existing.data()?.created_at || new Date().toISOString()) : new Date().toISOString(),
    }, { merge: true });

    const growth = await resolveGrowthStateForWeek({ nannyId, weekKey, isPremium: true });
    const shiftScore = await computeAndPersistOfficialShiftScore(nannyId, weekKey);

    return res.json({
      success: true,
      weekKey,
      passed,
      completedTaskIds: growth.completedTaskIds,
      autoCompletedTaskIds: growth.autoCompletedTaskIds,
      points: growth.points,
      officialShiftScore: shiftScore.score,
    });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to submit weekly quiz' });
  }
});

router.get('/shift-score', requireNannyAuth, async (req: any, res: any) => {
  const nannyId = String(req.userId || '');
  const weekKey = getWeekRangeFromKey(req.query?.week).weekKey;

  try {
    const result = await computeAndPersistOfficialShiftScore(nannyId, weekKey);
    return res.json({
      weekKey,
      score: result.score,
      details: result.details,
    });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to compute shift score' });
  }
});

// ── FCM Push Token Management ────────────────────────────────────────────
router.post('/fcm-token', requireNannyAuth, async (req: any, res: any) => {
  try {
    const { fcm_token, device_name, os, app_version } = req.body as Record<string, string>;
    if (!fcm_token?.trim()) return res.status(400).json({ error: 'fcm_token is required' });
    const { registerFcmToken } = await import('../services/fcmTokenManager.js');
    await registerFcmToken(req.userId, fcm_token.trim(), { deviceName: device_name, os, appVersion: app_version });
    return res.json({ success: true });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to register FCM token' });
  }
});

router.delete('/fcm-token/:fcmToken', requireNannyAuth, async (req: any, res: any) => {
  try {
    const fcmToken = decodeURIComponent(req.params.fcmToken || '');
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken param is required' });
    const { unregisterFcmToken } = await import('../services/fcmTokenManager.js');
    await unregisterFcmToken(req.userId, fcmToken);
    return res.json({ success: true });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to unregister FCM token' });
  }
});

router.post('/fcm-tokens/logout', requireNannyAuth, async (req: any, res: any) => {
  try {
    const { deactivateAllFcmTokens } = await import('../services/fcmTokenManager.js');
    await deactivateAllFcmTokens(req.userId);
    return res.json({ success: true });
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to deactivate FCM tokens' });
  }
});

router.get('/fcm-tokens/status', requireNannyAuth, async (req: any, res: any) => {
  try {
    const { getUserFcmTokenStats } = await import('../services/fcmTokenManager.js');
    const stats = await getUserFcmTokenStats(req.userId);
    return res.json(stats);
  } catch (error: any) {
    const normalized = normalizeFirebaseAdminError(error);
    return res.status(normalized.status).json({ error: normalized.message || 'Failed to get FCM token stats' });
  }
});

export default router;
