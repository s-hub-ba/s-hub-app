import { Router } from 'express';
import { db, auth } from '../firebase.js';

const router = Router();
const NANNY_FREE_APPLICATION_LIMIT = 5;

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
    if (!userDoc.exists || userDoc.data()?.role !== 'nanny') {
      return res.status(403).json({ error: 'Forbidden - nanny access only' });
    }
    req.userId = userId;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
    
    // 3. Insert into users and nanny_profiles
    await db.collection('users').doc(newUserId).set({
      email,
      role: 'nanny',
      created_at: new Date().toISOString()
    });
    
    await db.collection('nanny_profiles').doc(newUserId).set({
      first_name,
      last_name,
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
      uid: newUserId
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
    return res.json({ id: created.id, ...(created.data() || {}) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create application' });
  }
});

export default router;
