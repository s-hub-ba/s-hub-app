import { Timestamp } from 'firebase-admin/firestore';
import { db, messaging } from '../firebase.js';
import { processPlacementEndingSoonNotifications } from './placementEndingNotifier.ts';

let isRunning = false;
let lastPlacementEndingSweepAt = 0;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 5_000;
const BACKOFF_MULTIPLIER = 2; // attempts: 5s, 10s, 20s

const STATUS_PENDING = 'pending';
const STATUS_SENT = 'sent';
const STATUS_FAILED = 'failed';
const STATUS_RETRY = 'retry';
const PLACEMENT_ENDING_SWEEP_MIN_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.PLACEMENT_ENDING_SWEEP_INTERVAL_MS || 60 * 60 * 1000),
);

// ─── Role routing maps ────────────────────────────────────────────────────────

const COLLECTION_BY_ROLE: Record<string, string> = {
  nanny: 'nanny_notifications',
  family: 'family_notifications',
  agency: 'agency_notifications',
  agency_admin: 'agency_notifications',
  agency_recruiter: 'agency_notifications',
};

const FIELD_BY_ROLE: Record<string, string> = {
  nanny: 'nanny_id',
  family: 'family_id',
  agency: 'agency_id',
  agency_admin: 'agency_id',
  agency_recruiter: 'agency_id',
};

// Collection that holds the profile for each role — used to validate the
// recipient actually exists before we attempt delivery.
const PROFILE_COLLECTION_BY_ROLE: Record<string, string> = {
  nanny: 'nanny_profiles',
  family: 'families',
  agency: 'agency_profiles',
  agency_admin: 'agency_profiles',
  agency_recruiter: 'agency_profiles',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextRetryTime(attemptCount: number): Timestamp {
  const backoffMs = BASE_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attemptCount - 1);
  return Timestamp.fromDate(new Date(Date.now() + backoffMs));
}

function resolveLink(payload: any, role: string): string {
  if (payload?.data?.link) return String(payload.data.link);
  if (role === 'nanny') return '/nanny/calendar';
  if (role === 'family') return '/family/calendar';
  return '/agency/calendar';
}

async function validateRecipientExists(recipientId: string, role: string): Promise<boolean> {
  const profileCollection = PROFILE_COLLECTION_BY_ROLE[role];
  if (!profileCollection) return false;
  try {
    const snap = await db.doc(`${profileCollection}/${recipientId}`).get();
    if (snap.exists) return true;

    // Some agency notifications may use member UID while still scoped to agency role.
    if (role === 'agency' || role === 'agency_admin' || role === 'agency_recruiter') {
      const userSnap = await db.doc(`users/${recipientId}`).get();
      return userSnap.exists;
    }

    return false;
  } catch {
    // Assume valid if Firestore access fails — let the write attempt surface the real issue.
    return true;
  }
}

async function getUserFcmTokens(userId: string): Promise<string[]> {
  try {
    const snap = await db
      .collection('user_fcm_tokens')
      .where('user_id', '==', userId)
      .where('active', '==', true)
      .get();

    return snap.docs
      .map(d => d.data().fcm_token)
      .filter((t: any): t is string => typeof t === 'string' && t.length > 0);
  } catch (error) {
    console.error(`[notification-worker] Error fetching FCM tokens for ${userId}:`, error);
    return [];
  }
}

async function getFcmTokensForRecipient(recipientId: string, role: string): Promise<string[]> {
  if (!recipientId) return [];

  // Agency notifications are addressed to agency profile IDs in scheduling jobs.
  // For push delivery, tokens are user-scoped and may also be mapped to agency_ids.
  if (role === 'agency' || role === 'agency_admin' || role === 'agency_recruiter') {
    try {
      const [byAgencySnap, byUserSnap] = await Promise.all([
        db
          .collection('user_fcm_tokens')
          .where('agency_ids', 'array-contains', recipientId)
          .where('active', '==', true)
          .get(),
        db
          .collection('user_fcm_tokens')
          .where('user_id', '==', recipientId)
          .where('active', '==', true)
          .get(),
      ]);

      const tokens = new Set<string>();
      for (const snap of [byAgencySnap, byUserSnap]) {
        snap.docs.forEach((d) => {
          const token = d.data().fcm_token;
          if (typeof token === 'string' && token.length > 0) {
            tokens.add(token);
          }
        });
      }
      return Array.from(tokens);
    } catch (error) {
      console.error(
        `[notification-worker] Error fetching agency FCM tokens for ${recipientId}:`,
        error
      );
      return [];
    }
  }

  return getUserFcmTokens(recipientId);
}

async function sendFcmPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high', ttl: 86_400 },
    apns: { headers: { 'apns-priority': '10' } },
    webpush: { headers: { TTL: '86400' } },
  });

  // Deactivate any tokens that are permanently invalid.
  const invalidTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    const code = res.error?.code;
    if (
      code === 'messaging/invalid-registration-token'
      || code === 'messaging/registration-token-not-registered'
    ) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length > 0) {
    await Promise.all(
      invalidTokens.map(token =>
        db
          .collection('user_fcm_tokens')
          .where('fcm_token', '==', token)
          .get()
          .then(snap => Promise.all(snap.docs.map(d => d.ref.update({ active: false }))))
          .catch(err =>
            console.error(`[notification-worker] Failed to deactivate stale token ${token}:`, err)
          )
      )
    );
  }

  console.log(
    `[notification-worker] FCM multicast: ${response.successCount} success, ` +
    `${response.failureCount} failed, ${invalidTokens.length} tokens deactivated`
  );
}

// ─── Core delivery ────────────────────────────────────────────────────────────

async function deliverJob(doc: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
  const jobId = doc.id;
  const data = doc.data() as any;
  const now = Timestamp.now();

  const role = String(data.recipientRole || 'family');
  const recipientId = String(data.recipientUserId || '');
  const title = String(data.payload?.title || 'Schedule update');
  const message = String(data.payload?.body || 'You have a scheduling update.');
  const link = resolveLink(data.payload, role);
  const skipInApp = String(data.payload?.data?.skipInApp || '') === '1';
  const attemptCount = Number(data.attempt_count || 0) + 1;

  // ── Validation ──────────────────────────────────────────────────────────────

  if (!recipientId) {
    console.error(`[notification-worker] Job ${jobId}: Missing recipientUserId`);
    await doc.ref.update({
      status: STATUS_FAILED,
      failure_reason: 'Missing recipientUserId',
      attempt_count: attemptCount,
      'audit.updatedAt': now,
    });
    return;
  }

  const notificationCollection = COLLECTION_BY_ROLE[role] ?? 'agency_notifications';
  const recipientField = FIELD_BY_ROLE[role] ?? 'agency_id';

  // Unknown role: fail fast rather than writing to wrong collection.
  if (!COLLECTION_BY_ROLE[role]) {
    console.error(`[notification-worker] Job ${jobId}: Unknown role "${role}"`);
    await doc.ref.update({
      status: STATUS_FAILED,
      failure_reason: `Unknown recipientRole: ${role}`,
      attempt_count: attemptCount,
      'audit.updatedAt': now,
    });
    return;
  }

  const recipientExists = await validateRecipientExists(recipientId, role);
  if (!recipientExists) {
    console.warn(
      `[notification-worker] Job ${jobId}: Recipient ${role}/${recipientId} does not exist`
    );
    await doc.ref.update({
      status: STATUS_FAILED,
      failure_reason: `Recipient ${role}/${recipientId} not found`,
      attempt_count: attemptCount,
      'audit.updatedAt': now,
    });
    return;
  }

  // ── Delivery ────────────────────────────────────────────────────────────────

  try {
    // 1. In-app notification (unless explicitly skipped by producer)
    if (!skipInApp) {
      await db.collection(notificationCollection).add({
        [recipientField]: recipientId,
        type: 'system',
        title,
        message,
        link,
        read: false,
        created_at: now,
        updated_at: now,
      });
      console.log(
        `[notification-worker] Job ${jobId}: In-app delivered → ${notificationCollection}/${recipientId}`
      );
    }

    // 2. FCM push (best-effort — never blocks in-app delivery)
    const fcmTokens = await getFcmTokensForRecipient(recipientId, role);
    if (fcmTokens.length > 0) {
      await sendFcmPush(fcmTokens, title, message, {
        link,
        jobId,
        trigger: String(data.trigger || ''),
      });
    } else {
      console.log(
        `[notification-worker] Job ${jobId}: No active FCM tokens for ${role}/${recipientId}`
      );
    }

    // 3. Mark sent
    await doc.ref.update({
      status: STATUS_SENT,
      sentAt: now,
      attempt_count: attemptCount,
      'audit.updatedAt': now,
    });
    console.log(`[notification-worker] Job ${jobId}: Sent (attempt ${attemptCount})`);
  } catch (error: any) {
    const errMsg = String(error?.message || 'Unknown error').slice(0, 500);

    if (attemptCount < MAX_RETRIES) {
      const nextRetry = getNextRetryTime(attemptCount);
      const backoffMs = BASE_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attemptCount - 1);
      console.warn(
        `[notification-worker] Job ${jobId}: Attempt ${attemptCount} failed, ` +
        `retry in ${backoffMs}ms: ${errMsg}`
      );
      await doc.ref.update({
        status: STATUS_RETRY,
        scheduledAt: nextRetry,
        attempt_count: attemptCount,
        last_error: errMsg,
        'audit.updatedAt': now,
      });
    } else {
      console.error(
        `[notification-worker] Job ${jobId}: Permanently failed after ${MAX_RETRIES} attempts: ${errMsg}`
      );
      await doc.ref.update({
        status: STATUS_FAILED,
        failure_reason: errMsg,
        attempt_count: attemptCount,
        'audit.updatedAt': now,
      });
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function processPendingNotificationJobs(limit = 25): Promise<number> {
  const now = Timestamp.now();

  try {
    const snap = await db
      .collection('notification_jobs')
      .where('status', 'in', [STATUS_PENDING, STATUS_RETRY])
      .where('scheduledAt', '<=', now)
      .limit(limit)
      .get();

    if (snap.empty) return 0;

    console.log(`[notification-worker] Processing ${snap.size} job(s)`);
    let processed = 0;

    for (const doc of snap.docs) {
      try {
        await deliverJob(doc);
        processed += 1;
      } catch (error: any) {
        // Catch-all: deliverJob handles its own errors. This guard catches truly unexpected throws.
        console.error(
          `[notification-worker] Unhandled error for job ${doc.id}:`,
          error?.message || error
        );
      }
    }

    return processed;
  } catch (error) {
    console.error('[notification-worker] Fatal error in processPendingNotificationJobs:', error);
    return 0;
  }
}

export function startNotificationWorker(options?: { intervalMs?: number }) {
  const intervalMs = Math.max(
    15_000,
    options?.intervalMs ?? Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 30_000)
  );
  const enabled = process.env.DISABLE_NOTIFICATION_WORKER !== 'true';

  if (!enabled) {
    console.log('[notification-worker] Disabled via DISABLE_NOTIFICATION_WORKER');
    return { stop: () => {} };
  }

  console.log(`[notification-worker] Starting; interval=${intervalMs}ms, maxRetries=${MAX_RETRIES}`);

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await processPendingNotificationJobs();

      const nowMs = Date.now();
      if (nowMs - lastPlacementEndingSweepAt >= PLACEMENT_ENDING_SWEEP_MIN_INTERVAL_MS) {
        try {
          const created = await processPlacementEndingSoonNotifications();
          if (created > 0) {
            console.log(`[notification-worker] Placement-ending sweep queued ${created} job(s)`);
          }
          lastPlacementEndingSweepAt = nowMs;
        } catch (sweepError) {
          console.error('[notification-worker] Placement-ending sweep error:', sweepError);
        }
      }
    } catch (error) {
      console.error('[notification-worker] Tick error:', error);
    } finally {
      isRunning = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      console.log('[notification-worker] Stopped');
    },
  };
}

