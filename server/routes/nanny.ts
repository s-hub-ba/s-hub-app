import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

// POST /api/nanny/register - Register a nanny (handles invite links)
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, invite_code } = req.body;
  
  try {
    let agency_id = null;
    let premium_until = null;
    
    // 1. Process Invite Code if provided
    if (invite_code) {
      const { data: link } = await supabaseAdmin
        .from('invite_links')
        .select('agency_id')
        .eq('code', invite_code)
        .single();
        
      if (link) {
        agency_id = link.agency_id;
        
        // Grant 3 months of Premium access
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        premium_until = date.toISOString();
      }
    }
    
    // 2. Create Auth User (Mocked for MVP)
    const newUserId = crypto.randomUUID();
    
    // 3. Insert into users, profiles, and nannies
    await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'nanny'
    });
    
    await supabaseAdmin.from('profiles').insert({
      id: newUserId,
      first_name,
      last_name
    });
    
    await supabaseAdmin.from('nannies').insert({
      id: newUserId,
      agency_id,
      premium_until,
      status: 'active'
    });
    
    res.json({ 
      success: true, 
      message: 'Nanny registered successfully',
      agency_assigned: !!agency_id,
      premium_granted: !!premium_until
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
