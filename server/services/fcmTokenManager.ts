import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';

export interface FcmTokenRecord {
  user_id: string;
  fcm_token: string;
  active: boolean;
  device_name: string;
  os: string;
  app_version: string;
  registered_at: Timestamp;
  last_seen_at: Timestamp;
  deactivated_at?: Timestamp;
}

/**
 * Register or refresh an FCM token for a user.
 * If the token already exists, updates last_seen_at.
 * If it's a new token, creates the record.
 */
export async function registerFcmToken(
  userId: string,
  fcmToken: string,
  deviceInfo?: { deviceName?: string; os?: string; appVersion?: string }
): Promise<void> {
  if (!userId || !fcmToken) {
    throw new Error('userId and fcmToken are required');
  }

  const now = Timestamp.now();
  const existing = await db
    .collection('user_fcm_tokens')
    .where('user_id', '==', userId)
    .where('fcm_token', '==', fcmToken)
    .limit(1)
    .get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ active: true, last_seen_at: now });
    return;
  }

  await db.collection('user_fcm_tokens').add({
    user_id: userId,
    fcm_token: fcmToken,
    active: true,
    device_name: deviceInfo?.deviceName?.trim() || 'Unknown Device',
    os: deviceInfo?.os?.trim() || 'Unknown',
    app_version: deviceInfo?.appVersion?.trim() || 'Unknown',
    registered_at: now,
    last_seen_at: now,
  } satisfies Omit<FcmTokenRecord, 'deactivated_at'>);
}

/**
 * Remove a specific FCM token (e.g. user revoked permission on a single device).
 */
export async function unregisterFcmToken(userId: string, fcmToken: string): Promise<void> {
  if (!userId || !fcmToken) {
    throw new Error('userId and fcmToken are required');
  }

  const snap = await db
    .collection('user_fcm_tokens')
    .where('user_id', '==', userId)
    .where('fcm_token', '==', fcmToken)
    .get();

  await Promise.all(snap.docs.map(doc => doc.ref.delete()));
}

/**
 * Deactivate all tokens for a user (called on logout / account suspension).
 */
export async function deactivateAllFcmTokens(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('userId is required');
  }

  const snap = await db
    .collection('user_fcm_tokens')
    .where('user_id', '==', userId)
    .get();

  if (snap.empty) return;

  const now = Timestamp.now();
  await Promise.all(snap.docs.map(doc => doc.ref.update({ active: false, deactivated_at: now })));
}

/**
 * Return a summary of FCM token state for a user.
 */
export async function getUserFcmTokenStats(userId: string): Promise<{
  total: number;
  active: number;
  devices: Array<{ deviceName: string; os: string; appVersion: string; registeredAt: Timestamp }>;
}> {
  if (!userId) {
    return { total: 0, active: 0, devices: [] };
  }

  const snap = await db
    .collection('user_fcm_tokens')
    .where('user_id', '==', userId)
    .get();

  const docs = snap.docs.map(d => d.data() as FcmTokenRecord);
  return {
    total: docs.length,
    active: docs.filter(d => d.active).length,
    devices: docs.map(d => ({
      deviceName: d.device_name || 'Unknown',
      os: d.os || 'Unknown',
      appVersion: d.app_version || 'Unknown',
      registeredAt: d.registered_at,
    })),
  };
}
