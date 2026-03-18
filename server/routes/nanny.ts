import { Router } from 'express';
import { db, auth } from '../firebase.js';

const router = Router();

// Middleware to verify nanny user (stub for MVP)
const requireNannyAuth = async (req: any, res: any, next: any) => {
  const rawUserId = req.headers['x-user-id'];
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized - missing x-user-id header' });
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

export default router;
