import { Router } from 'express';
import { db, auth } from '../firebase.js';
import { buildNannyCvid } from '../services/nannyIdentity.js';

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

/**
 * Helper to normalize old CVID format into strict 6-digit numeric format.
 * Extracts the last 6 digits from any string (handles old alphanumeric format).
 */
function normalizeCvid(value: unknown): string | null {
  const digitsOnly = String(value).replace(/\D/g, '');
  return digitsOnly.length < 6 ? null : digitsOnly.slice(-6);
}

/**
 * Middleware to verify admin user.
 */
const requireAdmin = async (req: any, res: any, next: any) => {
  let userId = '';
  const token = getBearerToken(req);

  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = String(decoded.uid || '');
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized - invalid auth token' });
    }
  } else if (process.env.NODE_ENV !== 'production') {
    userId = getHeaderValue(req.headers['x-user-id']);
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'Forbidden - user not found' });
    }

    const userData = userDoc.data();
    if (!['admin', 'superadmin'].includes(userData?.role)) {
      return res.status(403).json({ error: 'Forbidden - admin access only' });
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/admin/migrations/backfill-cvids
 *
 * Migration endpoint to backfill/rewrite existing CVIDs into strict 6-digit numeric format.
 *
 * Returns:
 * {
 *   success: boolean,
 *   summary: {
 *     totalProcessed: number,
 *     normalized: number (old format → new numeric),
 *     regenerated: number (missing/invalid → generated fresh),
 *     skipped: number (already valid),
 *     totalUpdated: number,
 *     errors: number
 *   },
 *   details: {
 *     errors: Array<{ nannyId, firstName, lastName, error }>
 *   }
 * }
 */
router.post('/migrations/backfill-cvids', requireAdmin, async (req: any, res: any) => {
  try {
    const summary = {
      totalProcessed: 0,
      normalized: 0,
      regenerated: 0,
      skipped: 0,
      totalUpdated: 0,
      errors: 0,
    };

    const errorDetails: Array<{
      nannyId: string;
      firstName: string;
      lastName: string;
      error: string;
    }> = [];

    // Query all nanny_profiles
    const snapshot = await db.collection('nanny_profiles').get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        summary: { ...summary, message: 'No nanny profiles found' },
        details: { errors: errorDetails },
      });
    }

    // Batch update for efficiency (Firestore allows up to 500 per batch)
    const batch = db.batch();
    let batchSize = 0;
    const MAX_BATCH_SIZE = 500;
    const batches: Parameters<typeof batch['commit']>[] = [];

    for (const doc of snapshot.docs) {
      summary.totalProcessed += 1;
      const nannyId = doc.id;
      const data = doc.data();
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';
      const existingCvid = data.cvid;

      try {
        let newCvid: string;
        const normalized = existingCvid ? normalizeCvid(existingCvid) : null;
        const isValidNumeric = normalized ? String(normalized).match(/^\d{6}$/) : null;

        if (isValidNumeric) {
          // Already in valid 6-digit numeric format
          summary.skipped += 1;
        } else if (normalized && normalized.length === 6) {
          // Old format (alphanumeric) can be normalized to last 6 digits
          newCvid = normalized;
          batch.update(doc.ref, { cvid: newCvid });
          summary.normalized += 1;
          summary.totalUpdated += 1;
        } else {
          // Missing, empty, or unrecognizable format; regenerate fresh
          newCvid = buildNannyCvid(nannyId, firstName, lastName);
          batch.update(doc.ref, { cvid: newCvid });
          summary.regenerated += 1;
          summary.totalUpdated += 1;
        }

        batchSize += 1;

        // Commit batch if it reaches max size
        if (batchSize >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchSize = 0;
        }
      } catch (error: any) {
        summary.errors += 1;
        errorDetails.push({
          nannyId,
          firstName,
          lastName,
          error: error.message || String(error),
        });
      }
    }

    // Commit remaining batch
    if (batchSize > 0) {
      await batch.commit();
    }

    res.json({
      success: summary.errors === 0,
      summary,
      details: {
        errors: errorDetails,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Migration failed',
    });
  }
});

/**
 * GET /api/admin/migrations/cvid-status
 *
 * Endpoint to check CVID format status across all nanny profiles.
 * Useful for auditing before running backfill.
 *
 * Returns:
 * {
 *   summary: {
 *     totalProfiles: number,
 *     validNumeric: number (already 6 digits),
 *     oldFormat: number (has digits but not pure numeric),
 *     missing: number (no cvid field),
 *     invalid: number (invalid format)
 *   },
 *   samples: {
 *     valid: Array<{ id, cvid }>,
 *     oldFormat: Array<{ id, cvid }>,
 *     missing: Array<{ id, firstName, lastName }>,
 *     invalid: Array<{ id, cvid }>
 *   }
 * }
 */
router.get('/migrations/cvid-status', requireAdmin, async (req: any, res: any) => {
  try {
    const snapshot = await db.collection('nanny_profiles').get();

    const status = {
      totalProfiles: 0,
      validNumeric: 0,
      oldFormat: 0,
      missing: 0,
      invalid: 0,
    };

    const samples = {
      valid: [] as Array<{ id: string; cvid: string }>,
      oldFormat: [] as Array<{ id: string; cvid: string }>,
      missing: [] as Array<{ id: string; firstName: string; lastName: string }>,
      invalid: [] as Array<{ id: string; cvid: string }>,
    };

    for (const doc of snapshot.docs) {
      status.totalProfiles += 1;
      const nannyId = doc.id;
      const data = doc.data();
      const cvid = data.cvid;
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';

      if (!cvid) {
        status.missing += 1;
        if (samples.missing.length < 5) {
          samples.missing.push({ id: nannyId, firstName, lastName });
        }
      } else {
        const normalized = normalizeCvid(cvid);
        const isValidNumeric = String(cvid).match(/^\d{6}$/);

        if (isValidNumeric) {
          status.validNumeric += 1;
          if (samples.valid.length < 5) {
            samples.valid.push({ id: nannyId, cvid });
          }
        } else if (normalized && normalized.length === 6) {
          status.oldFormat += 1;
          if (samples.oldFormat.length < 5) {
            samples.oldFormat.push({ id: nannyId, cvid });
          }
        } else {
          status.invalid += 1;
          if (samples.invalid.length < 5) {
            samples.invalid.push({ id: nannyId, cvid });
          }
        }
      }
    }

    res.json({
      summary: status,
      samples,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to check CVID status',
    });
  }
});

export default router;
