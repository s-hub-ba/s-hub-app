import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
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
    // 1. Create user in auth (mocked ID for MVP)
    const newUserId = crypto.randomUUID(); 
    
    // 2. Add to agency_recruiters
    await supabaseAdmin.from('agency_recruiters').insert({
      agency_id,
      user_id: newUserId,
      status: 'active'
    });
    
    // 3. Update subscription pricing
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('agency_id', agency_id)
      .single();
      
    if (sub) {
      const newCount = sub.recruiter_count + 1;
      const newTotal = calculateSubscriptionPrice(newCount);
      
      await supabaseAdmin
        .from('subscriptions')
        .update({ recruiter_count: newCount, total_price: newTotal, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
        
      // TODO: Call PayPal/Stripe API to update the live subscription amount
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
    await supabaseAdmin
      .from('agency_recruiters')
      .delete()
      .match({ agency_id, user_id: recruiter_user_id });
    
    // 2. Update subscription pricing
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('agency_id', agency_id)
      .single();
      
    if (sub && sub.recruiter_count > 1) {
      const newCount = sub.recruiter_count - 1;
      const newTotal = calculateSubscriptionPrice(newCount);
      
      await supabaseAdmin
        .from('subscriptions')
        .update({ recruiter_count: newCount, total_price: newTotal, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
        
      // TODO: Call PayPal/Stripe API to reduce the live subscription amount
      console.log(`[Billing] Agency ${agency_id} price decreased to $${newTotal}/mo`);
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
  
  const { data, error } = await supabaseAdmin
    .from('invite_links')
    .insert({ agency_id, code })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ 
    success: true, 
    invite_link: `https://shiftmeup.com/join/${code}`,
    code 
  });
});

export default router;
