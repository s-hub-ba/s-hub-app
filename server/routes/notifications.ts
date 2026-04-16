import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, db } from '../firebase.js';

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

const ALLOWED_RECIPIENT_ROLES = new Set([
  'nanny',
  'family',
  'agency',
  'agency_admin',
  'agency_recruiter',
]);

const requireAuthenticatedUser = async (req: any, res: any, next: any) => {
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

  req.userId = userId;
  next();
};

router.post('/queue', requireAuthenticatedUser, async (req: any, res: any) => {
  const recipientRole = String(req.body?.recipientRole || '').trim();
  const recipientUserId = String(req.body?.recipientUserId || '').trim();
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.message || '').trim();
  const link = String(req.body?.link || '').trim();
  const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};

  if (!ALLOWED_RECIPIENT_ROLES.has(recipientRole)) {
    return res.status(400).json({ error: 'Invalid recipientRole' });
  }
  if (!recipientUserId || !title || !body) {
    return res.status(400).json({ error: 'recipientUserId, title, and message are required' });
  }

  const now = Timestamp.now();

  try {
    const ref = await db.collection('notification_jobs').add({
      eventId: req.body?.eventId || `manual-${Date.now()}`,
      trigger: 'direct_notification',
      recipientUserId,
      recipientRole,
      channel: 'in_app',
      status: 'pending',
      scheduledAt: now,
      sentAt: null,
      payload: {
        title,
        body,
        data: {
          ...(data as Record<string, string>),
          ...(link ? { link } : {}),
          skipInApp: '1',
        },
      },
      audit: {
        createdAt: now,
        updatedAt: now,
      },
      createdBy: String(req.userId || ''),
    });

    return res.json({ success: true, id: ref.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to queue notification job' });
  }
});

export default router;
