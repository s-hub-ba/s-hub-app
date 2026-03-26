import { Router } from 'express';
import { db, auth } from '../firebase.js';
import { calculateSubscriptionPrice } from '../services/billing.js';

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

// POST /api/agency/recruiter - Add a recruiter seat
router.post('/recruiter', requireAgencyOwner, async (req: any, res: any) => {
  const { email, first_name, last_name } = req.body;
  const agency_id = req.agency_id;

  if (!agency_id || !email || !first_name || !last_name) {
    return res.status(400).json({ error: 'agency_id, email, first_name, and last_name are required' });
  }

  try {
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

    await db.collection('agency_recruiters').add({
      agency_id,
      user_id: newUserId,
      email,
      first_name,
      last_name,
      status: 'active',
      created_at: new Date().toISOString()
    });

    // 3. Update or initialize subscription pricing
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
    } else {
      const newCount = 1;
      const newTotal = calculateSubscriptionPrice(newCount);
      await db.collection('subscriptions').add({
        agency_id,
        recruiter_count: newCount,
        total_price: newTotal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      console.log(`[Billing] Agency ${agency_id} subscription created: $${newTotal}/mo`);
    }

    res.json({ success: true, message: 'Recruiter added and billing updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/agency/recruiter/:id - Remove a recruiter seat
router.delete('/recruiter/:id', requireAgencyOwner, async (req: any, res: any) => {
  const { id: recruiterId } = req.params;
  const agency_id = req.agency_id;

  if (!agency_id || !recruiterId) {
    return res.status(400).json({ error: 'Missing agency_id or recruiter id' });
  }

  try {
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

    await Promise.all(docsToDelete.map(d => d.ref.delete()));

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

    res.json({ success: true, message: 'Recruiter removed and billing updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agency/invite-link - Generate a nanny invite link
router.post('/invite-link', requireAgencyOwner, async (req: any, res: any) => {
  const agency_id = req.agency_id;

  try {
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
    const callerIsAgencyOwner = callerUserId === agency_id;

    let callerIsRecruiterForAgency = false;
    if (!callerIsAgencyOwner) {
      const recruiterSnap = await db.collection('agency_recruiters')
        .where('agency_id', '==', agency_id)
        .where('user_id', '==', callerUserId)
        .limit(1)
        .get();
      callerIsRecruiterForAgency = !recruiterSnap.empty;
    }

    if (!callerIsAgencyOwner && !callerIsRecruiterForAgency) {
      return res.status(403).json({ error: 'Forbidden: user does not belong to this agency' });
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

export default router;
