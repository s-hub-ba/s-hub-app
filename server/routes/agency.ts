import { Router } from 'express';
import { db, auth } from '../firebase.js';
import { calculateSubscriptionPrice } from '../services/billing.js';

const router = Router();

// Middleware to verify agency owner (Stubbed for MVP)
const requireAgencyOwner = (req: any, res: any, next: any) => {
  // In production, verify JWT and ensure role === 'agency_admin'
  req.agency_id = req.headers['x-agency-id']; 
  if (!req.agency_id) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// POST /api/agency/recruiter - Add a recruiter seat
router.post('/recruiter', requireAgencyOwner, async (req: any, res: any) => {
  const { email, first_name, last_name } = req.body;
  const agency_id = req.agency_id;
  
  try {
    // 1. Create user in auth
    const userRecord = await auth.createUser({
      email,
      displayName: `${first_name} ${last_name}`
    });
    const newUserId = userRecord.uid;
    
    // 2. Add to agency_recruiters
    await db.collection('agency_recruiters').add({
      agency_id,
      user_id: newUserId,
      status: 'active',
      created_at: new Date().toISOString()
    });
    
    // 3. Update subscription pricing
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
    
    res.json({ success: true, message: 'Recruiter added and billing updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/agency/recruiter/:id - Remove a recruiter seat
router.delete('/recruiter/:id', requireAgencyOwner, async (req: any, res: any) => {
  const { id: recruiter_user_id } = req.params;
  const agency_id = req.agency_id;
  
  try {
    // 1. Remove from agency_recruiters
    const recruiterSnapshot = await db.collection('agency_recruiters')
      .where('agency_id', '==', agency_id)
      .where('user_id', '==', recruiter_user_id)
      .get();
    
    await Promise.all(recruiterSnapshot.docs.map(d => d.ref.delete()));
    
    // 2. Update subscription pricing
    const subSnapshot = await db.collection('subscriptions').where('agency_id', '==', agency_id).limit(1).get();
      
    if (!subSnapshot.empty) {
      const subDoc = subSnapshot.docs[0];
      const sub = subDoc.data();
      if (sub.recruiter_count > 1) {
        const newCount = sub.recruiter_count - 1;
        const newTotal = calculateSubscriptionPrice(newCount);
        
        await subDoc.ref.update({ 
          recruiter_count: newCount, 
          total_price: newTotal, 
          updated_at: new Date().toISOString() 
        });
          
        console.log(`[Billing] Agency ${agency_id} price decreased to $${newTotal}/mo`);
      }
    }
    
    res.json({ success: true, message: 'Recruiter removed and billing updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agency/invite-link - Generate a nanny invite link
router.post('/invite-link', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = req.agency_id;
  
  // Generate a short unique code
  const code = Math.random().toString(36).substring(2, 10);
  
  try {
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

export default router;
