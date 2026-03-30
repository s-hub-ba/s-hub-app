// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
// Provider-agnostic scheduling notification layer.
// MVP: enqueue Firestore jobs for async workers / cron to process.
// Future: plug in FCM, email provider, SMS provider.
// ─────────────────────────────────────────────────────────────────────────────

import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import type { UserRole } from './scheduling.ts';

export type SchedulingNotificationTrigger =
  | 'shift_offered'
  | 'offer_accepted'
  | 'offer_declined'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'reminder_30m'
  | 'reschedule_requested';

export interface EnqueueNotificationInput {
  eventId: string;
  trigger: SchedulingNotificationTrigger;
  recipientUserId: string;
  recipientRole: UserRole;
  scheduledAt?: Date;
  title: string;
  body: string;
  data?: Record<string, string>;
  channel?: 'in_app' | 'email' | 'fcm';
}

export async function enqueueNotification(input: EnqueueNotificationInput): Promise<string> {
  const now = Timestamp.now();
  const ref = await db.collection('notification_jobs').add({
    eventId: input.eventId,
    trigger: input.trigger,
    recipientUserId: input.recipientUserId,
    recipientRole: input.recipientRole,
    channel: input.channel ?? 'in_app',
    status: 'pending',
    scheduledAt: Timestamp.fromDate(input.scheduledAt ?? new Date()),
    sentAt: null,
    payload: {
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    },
    audit: {
      createdAt: now,
      updatedAt: now,
    },
  });
  return ref.id;
}

export async function enqueueReminderBundle(options: {
  eventId: string;
  eventStart: Date;
  recipientUserId: string;
  recipientRole: UserRole;
  remind24h?: boolean;
  remind2h?: boolean;
  remind30m?: boolean;
}): Promise<void> {
  const jobs: Promise<string>[] = [];

  if (options.remind24h) {
    const when = new Date(options.eventStart.getTime() - 24 * 60 * 60 * 1000);
    if (when > new Date()) {
      jobs.push(enqueueNotification({
        eventId: options.eventId,
        trigger: 'reminder_24h',
        recipientUserId: options.recipientUserId,
        recipientRole: options.recipientRole,
        scheduledAt: when,
        title: 'Upcoming shift tomorrow',
        body: 'You have a scheduled event in 24 hours.',
      }));
    }
  }

  if (options.remind2h) {
    const when = new Date(options.eventStart.getTime() - 2 * 60 * 60 * 1000);
    if (when > new Date()) {
      jobs.push(enqueueNotification({
        eventId: options.eventId,
        trigger: 'reminder_2h',
        recipientUserId: options.recipientUserId,
        recipientRole: options.recipientRole,
        scheduledAt: when,
        title: 'Shift starts soon',
        body: 'You have a scheduled event in 2 hours.',
      }));
    }
  }

  if (options.remind30m) {
    const when = new Date(options.eventStart.getTime() - 30 * 60 * 1000);
    if (when > new Date()) {
      jobs.push(enqueueNotification({
        eventId: options.eventId,
        trigger: 'reminder_30m',
        recipientUserId: options.recipientUserId,
        recipientRole: options.recipientRole,
        scheduledAt: when,
        title: 'Shift starts in 30 minutes',
        body: 'Your scheduled event is coming up shortly.',
      }));
    }
  }

  await Promise.all(jobs);
}
