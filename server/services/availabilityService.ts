// ─────────────────────────────────────────────────────────────────────────────
// Availability Service
// Nanny-specific layer on top of the shared scheduling engine.
// Keeps availability concepts separate from offers/bookings while storing them
// in the unified schedule_events collection.
// ─────────────────────────────────────────────────────────────────────────────

import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { createScheduleEvent } from './scheduling.ts';

export async function createAvailabilityWindow(input: {
  nannyId: string;
  userId: string;
  startAt: Date;
  endAt: Date;
  timezone?: string;
  title?: string;
  recurrence?: any;
  reminderSettings?: any;
}) {
  return createScheduleEvent({
    type: 'availability',
    title: input.title ?? 'Available',
    startAt: input.startAt,
    endAt: input.endAt,
    timezone: input.timezone ?? 'America/New_York',
    createdBy: input.userId,
    createdByRole: 'nanny',
    nannyId: input.nannyId,
    recurrence: input.recurrence,
    reminderSettings: input.reminderSettings,
    metadata: { source: 'nanny_availability' },
  });
}

export async function getAvailabilityForRange(
  nannyId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const snap = await db
    .collection('schedule_events')
    .where('nannyId', '==', nannyId)
    .where('type', '==', 'availability')
    .where('status', '==', 'available')
    .where('startAt', '>=', Timestamp.fromDate(rangeStart))
    .where('startAt', '<=', Timestamp.fromDate(rangeEnd))
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
