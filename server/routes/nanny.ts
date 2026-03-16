import { Router } from 'express';
import { db, auth } from '../firebase.js';

const router = Router();

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

export default router;
