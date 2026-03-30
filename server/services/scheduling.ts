// ─────────────────────────────────────────────────────────────────────────────
// Scheduling Service (server-side)
// Core Firestore interaction layer for schedule_events.
// All business-critical writes flow through here — NEVER directly from client.
// ─────────────────────────────────────────────────────────────────────────────

import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { validateStatusTransition, getInitialStatus } from './statusTransitions.ts';
import { expandRecurrence } from './recurrenceExpansion.ts';
import { detectNannyConflicts, detectFamilyConflicts } from './conflictDetection.ts';
import { encryptLocationExact, decryptLocationExact } from './locationCrypto.ts';
import { enqueueNotification, enqueueReminderBundle } from './notificationService.ts';
import { buildNannyCvid } from './nannyIdentity.ts';

// ─── Type imports (server copy — mirrors src/features/scheduling/types) ───────
// We duplicate a minimal subset here to avoid Vite/ESM frontend imports on server.

export type EventType =
  | 'availability'
  | 'blocked_time'
  | 'shift_offer'
  | 'booking_request'
  | 'booking_confirmed'
  | 'interview';

export type EventStatus =
  | 'draft' | 'available' | 'pending' | 'offered' | 'accepted'
  | 'declined' | 'confirmed' | 'cancelled' | 'completed';

export type UserRole = 'nanny' | 'agency' | 'agency_admin' | 'agency_recruiter' | 'family' | 'admin' | 'superadmin';

export interface RecurrenceRule {
  enabled: boolean;
  frequency?: 'daily' | 'weekly';
  interval?: number;
  daysOfWeek?: number[];
  endsOn?: Timestamp | null;
  occurrences?: number | null;
}

export interface CreateEventInput {
  type: EventType;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  createdBy: string;
  createdByRole: UserRole;
  nannyId?: string;
  agencyId?: string;
  familyId?: string;
  childId?: string;
  locationGeneral?: string;
  locationExact?: string;
  notesInternal?: string;
  notesVisible?: string;
  recurrence?: RecurrenceRule;
  visibility?: 'private' | 'role_based';
  metadata?: {
    payRate?: number;
    currency?: string;
    urgency?: 'low' | 'normal' | 'high';
    source?: 'agency_created' | 'family_requested' | 'nanny_availability';
  };
  reminderSettings?: {
    enabled: boolean;
    remind24h?: boolean;
    remind2h?: boolean;
    remind30m?: boolean;
  };
}

export interface UpdateEventBodyInput {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date;
  timezone?: string;
  locationGeneral?: string | null;
  locationExact?: string | null;
  notesVisible?: string | null;
  reminderSettings?: {
    enabled: boolean;
    remind24h?: boolean;
    remind2h?: boolean;
    remind30m?: boolean;
  } | null;
  metadata?: {
    payRate?: number;
    currency?: string;
    urgency?: 'low' | 'normal' | 'high';
    source?: 'agency_created' | 'family_requested' | 'nanny_availability';
  } | null;
  recurrence?: RecurrenceRule | null;
}

export type UpdateScope = 'single' | 'series';

const COLLECTION = 'schedule_events';
const AUDIT_COLLECTION = 'schedule_audit_logs';
const DEFAULT_TZ = 'America/New_York';

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns events for a given nanny within a date range.
 * Used for conflict detection and calendar view.
 */
export async function getNannyEventsInRange(
  nannyId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<any[]> {
  const snap = await db
    .collection(COLLECTION)
    .where('nannyId', '==', nannyId)
    .where('startAt', '>=', Timestamp.fromDate(rangeStart))
    .where('startAt', '<=', Timestamp.fromDate(rangeEnd))
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Returns events for a given family within a date range.
 */
export async function getFamilyEventsInRange(
  familyId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<any[]> {
  const snap = await db
    .collection(COLLECTION)
    .where('familyId', '==', familyId)
    .where('startAt', '>=', Timestamp.fromDate(rangeStart))
    .where('startAt', '<=', Timestamp.fromDate(rangeEnd))
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Returns events for a given agency within a date range.
 */
export async function getAgencyEventsInRange(
  agencyId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<any[]> {
  const snap = await db
    .collection(COLLECTION)
    .where('agencyId', '==', agencyId)
    .where('startAt', '>=', Timestamp.fromDate(rangeStart))
    .where('startAt', '<=', Timestamp.fromDate(rangeEnd))
    .get();

  const agencyEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const talentPoolNannyIds = await getAgencyTalentPoolNannyIds(agencyId);

  if (talentPoolNannyIds.length === 0) {
    return attachNannyProfiles(agencyEvents);
  }

  const availabilityGroups = await Promise.all(
    talentPoolNannyIds.map(async (nannyId) => {
      const availabilitySnap = await db
        .collection(COLLECTION)
        .where('nannyId', '==', nannyId)
        .where('startAt', '>=', Timestamp.fromDate(rangeStart))
        .where('startAt', '<=', Timestamp.fromDate(rangeEnd))
        .get();

      const availabilityEvents: Record<string, any>[] = availabilitySnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
        .filter((event) => event.type === 'availability' && event.status !== 'cancelled' && event.status !== 'declined');

      return availabilityEvents;
    }),
  );

  const merged = new Map<string, any>();
  [...agencyEvents, ...availabilityGroups.flat()].forEach((event) => {
    merged.set(event.id, event);
  });

  return attachNannyProfiles(Array.from(merged.values()));
}

async function getAgencyTalentPoolNannyIds(agencyId: string): Promise<string[]> {
  const snap = await db
    .collection('agency_talent_pool')
    .where('agency_id', '==', agencyId)
    .get();

  return Array.from(new Set(
    snap.docs
      .map((doc) => String(doc.data()?.nanny_id || ''))
      .filter(Boolean),
  ));
}

async function attachNannyProfiles(events: any[]): Promise<any[]> {
  const nannyIds = Array.from(new Set(
    events
      .map((event) => String(event.nannyId || ''))
      .filter(Boolean),
  ));

  if (nannyIds.length === 0) return events;

  const profiles = await Promise.all(
    nannyIds.map(async (nannyId) => {
      const snap = await db.collection('nanny_profiles').doc(nannyId).get();
      if (!snap.exists) return null;
      return [nannyId, { id: snap.id, ...snap.data() }] as const;
    }),
  );

  const profileEntries = profiles.filter(Boolean) as Array<readonly [string, Record<string, any>]>;
  const profileMap = new Map<string, Record<string, any>>(profileEntries);

  return events.map((event) => ({
    ...event,
    nannyProfile: event.nannyId ? profileMap.get(String(event.nannyId)) ?? null : null,
  }));
}

// ─── Conflict check wrappers ──────────────────────────────────────────────────

export async function assertNoNannyConflict(
  nannyId: string,
  startAt: Date,
  endAt: Date,
  excludeEventIds?: string | string[],
) {
  // Query a broad window: same day ±1 to catch boundary events safely
  const windowStart = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  const existing = await getNannyEventsInRange(nannyId, windowStart, windowEnd);
  const flat = existing.map((e) => ({
    id: e.id,
    title: e.title ?? '',
    start: (e.startAt as Timestamp).toDate().toISOString(),
    end: (e.endAt as Timestamp).toDate().toISOString(),
    status: e.status,
    type: e.type,
  }));

  const excludedIds = Array.isArray(excludeEventIds)
    ? excludeEventIds
    : excludeEventIds
      ? [excludeEventIds]
      : [];

  const result = detectNannyConflicts(
    startAt.toISOString(),
    endAt.toISOString(),
    flat.filter((event) => !excludedIds.includes(event.id)),
  );

  if (result.hasConflict) {
    throw new Error(
      `Scheduling conflict: ${result.conflicts.map((c) => c.message).join('; ')}`,
    );
  }
}

export async function assertNoFamilyConflict(
  familyId: string,
  startAt: Date,
  endAt: Date,
  excludeEventIds?: string | string[],
) {
  const windowStart = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  const existing = await getFamilyEventsInRange(familyId, windowStart, windowEnd);
  const flat = existing.map((e) => ({
    id: e.id,
    title: e.title ?? '',
    start: (e.startAt as Timestamp).toDate().toISOString(),
    end: (e.endAt as Timestamp).toDate().toISOString(),
    status: e.status,
    type: e.type,
  }));

  const excludedIds = Array.isArray(excludeEventIds)
    ? excludeEventIds
    : excludeEventIds
      ? [excludeEventIds]
      : [];

  const result = detectFamilyConflicts(
    startAt.toISOString(),
    endAt.toISOString(),
    flat.filter((event) => !excludedIds.includes(event.id)),
  );

  if (result.hasConflict) {
    throw new Error(
      `Scheduling conflict for family: ${result.conflicts.map((c) => c.message).join('; ')}`,
    );
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a ScheduleEvent document (and child instances for recurring events).
 * Returns the IDs of all created documents: [parentId, ...childIds].
 */
export async function createScheduleEvent(input: CreateEventInput): Promise<string[]> {
  const {
    type, title, startAt, endAt, recurrence,
    nannyId, familyId, agencyId,
  } = input;

  const initialStatus = getInitialStatus(type);

  // ── Conflict check on confirmed/active types ──
  if (
    (type === 'booking_confirmed' || type === 'shift_offer' || type === 'booking_request')
    && nannyId
    && (initialStatus === 'confirmed' || initialStatus === 'accepted')
  ) {
    await assertNoNannyConflict(nannyId, startAt, endAt);
  }

  const now = Timestamp.now();
  const tz = input.timezone || DEFAULT_TZ;

  // ── Build base document ──
  const baseDoc: Record<string, any> = {
    type,
    title: String(title).trim().slice(0, 200),
    description: input.description ?? null,
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    timezone: tz,
    status: initialStatus,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole,
    nannyId: nannyId ?? null,
    agencyId: agencyId ?? null,
    familyId: familyId ?? null,
    childId: input.childId ?? null,
    locationGeneral: input.locationGeneral ?? null,
    locationExact: null,
    locationExactEncrypted: encryptLocationExact(input.locationExact ?? null),
    exactLocationUnlocked: false,
    notesInternal: input.notesInternal ?? null,
    notesVisible: input.notesVisible ?? null,
    visibility: input.visibility ?? 'role_based',
    metadata: input.metadata ?? null,
    reminderSettings: input.reminderSettings ?? null,
    recurrence: recurrence ?? null,
    parentEventId: null,
    instanceIndex: null,
    audit: {
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  };

  // ── Write parent document ──
  const parentRef = await db.collection(COLLECTION).add(baseDoc);
  const createdIds: string[] = [parentRef.id];

  // ── Expand and write recurring child instances ──
  if (recurrence?.enabled && recurrence.frequency) {
    const instances = expandRecurrence(startAt, endAt, recurrence);
    const batch = db.batch();

    for (const inst of instances) {
      const childRef = db.collection(COLLECTION).doc();
      batch.set(childRef, {
        ...baseDoc,
        startAt: Timestamp.fromDate(inst.startAt),
        endAt: Timestamp.fromDate(inst.endAt),
        recurrence: null,   // children don't inherit the rule; parent is canonical
        parentEventId: parentRef.id,
        instanceIndex: inst.instanceIndex,
        audit: { createdAt: now, updatedAt: now, deletedAt: null },
      });
      createdIds.push(childRef.id);
    }

    await batch.commit();
  }

  // ── Audit log ──
  await writeAuditLog({
    eventId: parentRef.id,
    actorId: input.createdBy,
    actorRole: input.createdByRole,
    action: 'created',
    toStatus: initialStatus,
  });

  // ── Enqueue reminder notifications if enabled ──
  if (input.reminderSettings?.enabled) {
    const reminderRecipient = nannyId
      ? { id: nannyId, role: 'nanny' as UserRole }
      : familyId
        ? { id: familyId, role: 'family' as UserRole }
        : agencyId
          ? { id: agencyId, role: 'agency' as UserRole }
          : null;

    if (reminderRecipient) {
      await enqueueReminderBundle({
        eventId: parentRef.id,
        eventStart: startAt,
        recipientUserId: reminderRecipient.id,
        recipientRole: reminderRecipient.role,
        remind24h: input.reminderSettings.remind24h,
        remind2h: input.reminderSettings.remind2h,
        remind30m: input.reminderSettings.remind30m,
      });
    }
  }

  await enqueueCreateNotifications({
    eventId: parentRef.id,
    input,
  });

  return createdIds;
}

// ─── Status transition ────────────────────────────────────────────────────────

/**
 * Transitions a single schedule event to a new status.
 * Enforces the transition matrix and conflict rules.
 */
export async function transitionEventStatus(
  eventId: string,
  nextStatus: EventStatus,
  actorId: string,
  actorRole: UserRole,
  reason?: string,
): Promise<void> {
  const docRef = db.collection(COLLECTION).doc(eventId);
  const snap = await docRef.get();

  if (!snap.exists) throw new Error(`Event ${eventId} not found`);

  const data = snap.data()!;
  const currentStatus = data.status as EventStatus;
  const eventType = data.type as EventType;

  const validation = validateStatusTransition(currentStatus, nextStatus, eventType);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid status transition');
  }

  // ── Conflict check when confirming/accepting a nanny event ──
  if (
    (nextStatus === 'confirmed' || nextStatus === 'accepted')
    && data.nannyId
    && (eventType === 'shift_offer' || eventType === 'booking_request' || eventType === 'booking_confirmed')
  ) {
    const startAt = (data.startAt as Timestamp).toDate();
    const endAt = (data.endAt as Timestamp).toDate();
    await assertNoNannyConflict(data.nannyId as string, startAt, endAt, eventId);
    if (data.familyId) {
      await assertNoFamilyConflict(data.familyId as string, startAt, endAt, eventId);
    }
  }

  const now = Timestamp.now();

  await docRef.update({
    status: nextStatus,
    // Unlock exact location when a booking is confirmed
    ...(nextStatus === 'confirmed' ? { exactLocationUnlocked: true } : {}),
    'audit.updatedAt': now,
  });

  await writeAuditLog({
    eventId,
    actorId,
    actorRole,
    action: nextStatus as any,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    reason,
  });

  await enqueueTransitionNotifications({
    eventId,
    eventData: data,
    nextStatus,
  });
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

export async function rescheduleEvent(
  eventId: string,
  newStart: Date,
  newEnd: Date,
  actorId: string,
  actorRole: UserRole,
  reason?: string,
): Promise<void> {
  const docRef = db.collection(COLLECTION).doc(eventId);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error(`Event ${eventId} not found`);

  const data = snap.data()!;

  // Confirmed nanny events need conflict check on new window
  if (data.nannyId && (data.status === 'confirmed' || data.status === 'accepted')) {
    await assertNoNannyConflict(data.nannyId as string, newStart, newEnd, eventId);
  }
  if (data.familyId && (data.status === 'confirmed' || data.status === 'accepted')) {
    await assertNoFamilyConflict(data.familyId as string, newStart, newEnd, eventId);
  }

  const now = Timestamp.now();
  await docRef.update({
    startAt: Timestamp.fromDate(newStart),
    endAt: Timestamp.fromDate(newEnd),
    'audit.updatedAt': now,
  });

  await writeAuditLog({
    eventId,
    actorId,
    actorRole,
    action: 'rescheduled',
    fromStatus: data.status,
    toStatus: data.status,
    reason,
  });

  await enqueueRescheduleNotifications({
    eventId,
    eventData: data,
  });
}

export async function updateScheduleEventBody(
  eventId: string,
  updates: UpdateEventBodyInput,
  actorId: string,
  actorRole: UserRole,
  scope: UpdateScope = 'single',
): Promise<{ updatedIds: string[]; scope: UpdateScope }> {
  const targetRef = db.collection(COLLECTION).doc(eventId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new Error(`Event ${eventId} not found`);

  const targetData = targetSnap.data()!;
  const seriesParentId = targetData.parentEventId || eventId;
  const affectedDocs = await loadAffectedDocuments(eventId, scope, seriesParentId);
  const affectedIds = affectedDocs.map((doc) => doc.id);

  if (updates.recurrence !== undefined && scope !== 'series') {
    throw new Error('Recurrence can only be edited with update scope "series"');
  }

  const targetStart = (targetData.startAt as Timestamp).toDate();
  const targetEnd = (targetData.endAt as Timestamp).toDate();
  const startDeltaMs = updates.startAt ? updates.startAt.getTime() - targetStart.getTime() : 0;
  const endDeltaMs = updates.endAt ? updates.endAt.getTime() - targetEnd.getTime() : 0;

  for (const item of affectedDocs) {
    const current = item.data;
    const currentStart = (current.startAt as Timestamp).toDate();
    const currentEnd = (current.endAt as Timestamp).toDate();
    const nextStart = updates.startAt ? new Date(currentStart.getTime() + startDeltaMs) : currentStart;
    const nextEnd = updates.endAt ? new Date(currentEnd.getTime() + endDeltaMs) : currentEnd;

    if (current.nannyId && (current.status === 'confirmed' || current.status === 'accepted')) {
      await assertNoNannyConflict(current.nannyId as string, nextStart, nextEnd, affectedIds);
    }
    if (current.familyId && (current.status === 'confirmed' || current.status === 'accepted')) {
      await assertNoFamilyConflict(current.familyId as string, nextStart, nextEnd, affectedIds);
    }
  }

  const now = Timestamp.now();
  const batch = db.batch();

  for (const item of affectedDocs) {
    const current = item.data;
    const currentStart = (current.startAt as Timestamp).toDate();
    const currentEnd = (current.endAt as Timestamp).toDate();
    const nextStart = updates.startAt ? new Date(currentStart.getTime() + startDeltaMs) : currentStart;
    const nextEnd = updates.endAt ? new Date(currentEnd.getTime() + endDeltaMs) : currentEnd;

    const patch = buildBodyUpdatePatch(current, updates, {
      nextStart,
      nextEnd,
      now,
      isSeriesParent: item.id === seriesParentId,
      scope,
    });
    batch.update(item.ref, patch);
  }

  await batch.commit();

  await writeAuditLog({
    eventId,
    actorId,
    actorRole,
    action: scope === 'series' ? 'rescheduled' : 'status_changed',
    reason: `body_updated:${scope}`,
  });

  return { updatedIds: affectedIds, scope };
}

// ─── Build DTO (strips sensitive fields based on viewer) ─────────────────────

export function buildCalendarEventDTO(
  docData: Record<string, any>,
  docId: string,
  viewerRole: UserRole,
  viewerUserId: string,
): Record<string, any> {
  const startAt = (docData.startAt as Timestamp).toDate().toISOString();
  const endAt = (docData.endAt as Timestamp).toDate().toISOString();
  const nannyIdentity = resolveNannyIdentity(docData);

  // ── Determine if viewer may see exact location ──
  //   Agency: always (operational need)
  //   Nanny: only when status = confirmed
  //   Family: always (it's their own address)
  //   Admin: always
  const status = docData.status as EventStatus;
  const canViewExactLocation =
    viewerRole === 'admin'
    || viewerRole === 'superadmin'
    || viewerRole === 'agency'
    || viewerRole === 'agency_admin'
    || viewerRole === 'agency_recruiter'
    || viewerRole === 'family'
    || (viewerRole === 'nanny' && status === 'confirmed');

  const allowedActions = resolveAllowedActions(docData, viewerRole, viewerUserId);
  const colorKey = resolveColorKey(docData.type, status);

  const dto: Record<string, any> = {
    id: docId,
    type: docData.type,
    title: resolveDisplayTitle(docData, viewerRole, nannyIdentity),
    description: docData.description,
    start: startAt,
    end: endAt,
    timezone: docData.timezone ?? DEFAULT_TZ,
    status,
    locationLabel: docData.locationGeneral ?? undefined,
    canViewExactLocation,
    exactLocation: canViewExactLocation
      ? resolveExactLocation(docData)
      : undefined,
    nannyId: docData.nannyId ?? undefined,
    nannyName: nannyIdentity.name,
    nannyCvid: nannyIdentity.cvid,
    nannyUid: nannyIdentity.uid,
    agencyId: docData.agencyId ?? undefined,
    familyId: docData.familyId ?? undefined,
    childId: docData.childId ?? undefined,
    notesVisible: docData.notesVisible ?? undefined,
    metadata: docData.metadata
      ? {
          payRate: docData.metadata.payRate,
          currency: docData.metadata.currency,
          urgency: docData.metadata.urgency,
        }
      : undefined,
    reminderSettings: docData.reminderSettings ?? undefined,
    recurrence: docData.recurrence ?? undefined,
    parentEventId: docData.parentEventId ?? undefined,
    instanceIndex: docData.instanceIndex ?? undefined,
    allowedActions,
    colorKey,
  };

  // Strip undefined keys
  Object.keys(dto).forEach((k) => dto[k] === undefined && delete dto[k]);
  return dto;
}

// ─── Allowed actions resolver ─────────────────────────────────────────────────

function resolveAllowedActions(
  data: Record<string, any>,
  role: UserRole,
  userId: string,
): string[] {
  const actions: string[] = [];
  const status = data.status as EventStatus;
  const type = data.type as EventType;

  if (role === 'admin' || role === 'superadmin') return ['accept', 'decline', 'confirm', 'cancel', 'reschedule', 'complete', 'view_exact_location', 'edit'];

  switch (role) {
    case 'nanny':
      if (type === 'availability' || type === 'blocked_time') {
        actions.push('edit', 'cancel');
      }
      if (type === 'shift_offer' && status === 'offered') {
        actions.push('accept', 'decline');
      }
      if (type === 'booking_confirmed' && status === 'confirmed') {
        actions.push('view_exact_location');
      }
      break;

    case 'agency':
    case 'agency_admin':
    case 'agency_recruiter':
      actions.push('view_exact_location');
      if (status === 'draft' || status === 'pending' || status === 'offered') {
        actions.push('cancel', 'edit');
      }
      if (type === 'booking_request' && status === 'pending') {
        actions.push('accept', 'decline');
      }
      if (status === 'accepted') {
        actions.push('confirm', 'cancel', 'reschedule');
      }
      if (status === 'confirmed') {
        actions.push('cancel', 'reschedule', 'complete');
      }
      break;

    case 'family':
      actions.push('view_exact_location'); // own address
      if (status === 'pending' || status === 'accepted') {
        actions.push('cancel');
      }
      if (status === 'confirmed') {
        actions.push('cancel'); // per policy (frontend should surface cancellation policy)
      }
      break;
  }

  return [...new Set(actions)];
}

// ─── Color key (mirrors frontend logic for server-built DTOs) ─────────────────

function resolveColorKey(type: string, status: EventStatus): string {
  if (status === 'cancelled' || status === 'declined') return 'red';
  if (status === 'completed') return 'green';
  switch (type) {
    case 'availability': return 'teal';
    case 'blocked_time': return 'grey';
    case 'interview': return 'blue';
    case 'shift_offer':
    case 'booking_request':
      return (status === 'confirmed' || status === 'accepted') ? 'green' : 'yellow';
    case 'booking_confirmed': return 'green';
    default: return 'grey';
  }
}

// ─── Audit logging ────────────────────────────────────────────────────────────

async function writeAuditLog(entry: {
  eventId: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  fromStatus?: EventStatus;
  toStatus?: EventStatus;
  reason?: string;
}): Promise<void> {
  await db.collection(AUDIT_COLLECTION).add({
    ...entry,
    timestamp: Timestamp.now(),
  });
}

// ─── Reminder jobs ────────────────────────────────────────────────────────────

function resolveExactLocation(docData: Record<string, any>): string | undefined {
  if (docData.locationExactEncrypted) {
    return decryptLocationExact(docData.locationExactEncrypted) ?? undefined;
  }
  return docData.locationExact ?? undefined;
}

function resolveDisplayTitle(
  docData: Record<string, any>,
  viewerRole: UserRole,
  nannyIdentity: { name?: string; cvid?: string; uid?: string },
): string {
  const isAgencyViewer = viewerRole === 'agency' || viewerRole === 'agency_admin' || viewerRole === 'agency_recruiter';
  if (!isAgencyViewer || docData.type !== 'availability') {
    return docData.title;
  }

  const name = nannyIdentity.name || 'Nanny';
  const suffix = nannyIdentity.cvid ? ` (${nannyIdentity.cvid})` : '';
  return `${name} Availability${suffix}`;
}

function resolveNannyIdentity(docData: Record<string, any>): { name?: string; cvid?: string; uid?: string } {
  const profile = (docData.nannyProfile ?? null) as Record<string, any> | null;
  const uid = String(docData.nannyId ?? profile?.id ?? '').trim() || undefined;
  const firstName = String(profile?.first_name ?? '').trim();
  const lastName = String(profile?.last_name ?? '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined;
  const cvid = String(profile?.cvid ?? '').trim() || (uid ? buildNannyCvid(uid, firstName, lastName) : undefined);

  return { name, cvid, uid };
}

async function loadAffectedDocuments(
  eventId: string,
  scope: UpdateScope,
  seriesParentId: string,
): Promise<Array<{ id: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }>> {
  if (scope === 'single') {
    const ref = db.collection(COLLECTION).doc(eventId);
    const snap = await ref.get();
    return snap.exists ? [{ id: snap.id, ref, data: snap.data()! }] : [];
  }

  const parentRef = db.collection(COLLECTION).doc(seriesParentId);
  const parentSnap = await parentRef.get();
  const childrenSnap = await db.collection(COLLECTION).where('parentEventId', '==', seriesParentId).get();

  const docs: Array<{ id: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }> = [];
  if (parentSnap.exists) docs.push({ id: parentSnap.id, ref: parentRef, data: parentSnap.data()! });
  childrenSnap.docs.forEach((doc) => docs.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
  return docs;
}

function buildBodyUpdatePatch(
  current: Record<string, any>,
  updates: UpdateEventBodyInput,
  context: { nextStart: Date; nextEnd: Date; now: Timestamp; isSeriesParent: boolean; scope: UpdateScope },
): Record<string, any> {
  const patch: Record<string, any> = {
    'audit.updatedAt': context.now,
  };

  if (updates.title !== undefined) patch.title = String(updates.title || '').trim().slice(0, 200);
  if (updates.description !== undefined) patch.description = updates.description ?? null;
  if (updates.timezone !== undefined) patch.timezone = updates.timezone || DEFAULT_TZ;
  if (updates.locationGeneral !== undefined) patch.locationGeneral = updates.locationGeneral ?? null;
  if (updates.locationExact !== undefined) {
    patch.locationExact = null;
    patch.locationExactEncrypted = encryptLocationExact(updates.locationExact ?? null);
  }
  if (updates.notesVisible !== undefined) patch.notesVisible = updates.notesVisible ?? null;
  if (updates.metadata !== undefined) patch.metadata = updates.metadata ?? null;
  if (updates.reminderSettings !== undefined) patch.reminderSettings = updates.reminderSettings ?? null;
  if (updates.startAt !== undefined) patch.startAt = Timestamp.fromDate(context.nextStart);
  if (updates.endAt !== undefined) patch.endAt = Timestamp.fromDate(context.nextEnd);
  if (updates.recurrence !== undefined && context.scope === 'series' && context.isSeriesParent) {
    patch.recurrence = updates.recurrence ?? null;
  }
  if (updates.recurrence !== undefined && context.scope === 'series' && !context.isSeriesParent) {
    patch.recurrence = null;
  }

  if (current.status === 'confirmed' && updates.locationExact !== undefined) {
    patch.exactLocationUnlocked = true;
  }

  return patch;
}

async function enqueueCreateNotifications({
  eventId,
  input,
}: {
  eventId: string;
  input: CreateEventInput;
}) {
  if (input.type === 'shift_offer' && input.nannyId) {
    await enqueueNotification({
      eventId,
      trigger: 'shift_offered',
      recipientUserId: input.nannyId,
      recipientRole: 'nanny',
      title: 'New shift offer',
      body: `${input.title} has been offered to you.`,
      data: { link: '/nanny/calendar' },
    });
  }

  if (input.type === 'booking_request' && input.agencyId) {
    await enqueueNotification({
      eventId,
      trigger: 'reschedule_requested',
      recipientUserId: input.agencyId,
      recipientRole: 'agency',
      title: 'New booking request',
      body: `${input.title} requires review.`,
      data: { link: '/agency/calendar' },
    });
  }
}

async function enqueueTransitionNotifications({
  eventId,
  eventData,
  nextStatus,
}: {
  eventId: string;
  eventData: Record<string, any>;
  nextStatus: EventStatus;
}) {
  if (nextStatus === 'accepted' && eventData.type === 'shift_offer' && eventData.agencyId) {
    await enqueueNotification({
      eventId,
      trigger: 'offer_accepted',
      recipientUserId: eventData.agencyId,
      recipientRole: 'agency',
      title: 'Shift offer accepted',
      body: `${eventData.title} was accepted by the nanny.`,
      data: { link: '/agency/calendar' },
    });
  }

  if (nextStatus === 'declined' && eventData.type === 'shift_offer' && eventData.agencyId) {
    await enqueueNotification({
      eventId,
      trigger: 'offer_declined',
      recipientUserId: eventData.agencyId,
      recipientRole: 'agency',
      title: 'Shift offer declined',
      body: `${eventData.title} was declined by the nanny.`,
      data: { link: '/agency/calendar' },
    });
  }

  if (nextStatus === 'confirmed') {
    if (eventData.nannyId) {
      await enqueueNotification({
        eventId,
        trigger: 'booking_confirmed',
        recipientUserId: eventData.nannyId,
        recipientRole: 'nanny',
        title: 'Booking confirmed',
        body: `${eventData.title} has been confirmed.`,
        data: { link: '/nanny/calendar' },
      });
    }
    if (eventData.familyId) {
      await enqueueNotification({
        eventId,
        trigger: 'booking_confirmed',
        recipientUserId: eventData.familyId,
        recipientRole: 'family',
        title: 'Booking confirmed',
        body: `${eventData.title} has been confirmed.`,
        data: { link: '/family/calendar' },
      });
    }
  }

  if (nextStatus === 'cancelled') {
    for (const recipient of resolveNotificationRecipients(eventData)) {
      await enqueueNotification({
        eventId,
        trigger: 'booking_cancelled',
        recipientUserId: recipient.id,
        recipientRole: recipient.role,
        title: 'Event cancelled',
        body: `${eventData.title} was cancelled.`,
        data: { link: recipient.role === 'family' ? '/family/calendar' : recipient.role === 'nanny' ? '/nanny/calendar' : '/agency/calendar' },
      });
    }
  }
}

async function enqueueRescheduleNotifications({
  eventId,
  eventData,
}: {
  eventId: string;
  eventData: Record<string, any>;
}) {
  for (const recipient of resolveNotificationRecipients(eventData)) {
    await enqueueNotification({
      eventId,
      trigger: 'reschedule_requested',
      recipientUserId: recipient.id,
      recipientRole: recipient.role,
      title: 'Schedule updated',
      body: `${eventData.title} has been rescheduled.`,
      data: { link: recipient.role === 'family' ? '/family/calendar' : recipient.role === 'nanny' ? '/nanny/calendar' : '/agency/calendar' },
    });
  }
}

function resolveNotificationRecipients(eventData: Record<string, any>): Array<{ id: string; role: UserRole }> {
  const recipients: Array<{ id: string; role: UserRole }> = [];
  if (eventData.nannyId) recipients.push({ id: eventData.nannyId, role: 'nanny' });
  if (eventData.familyId) recipients.push({ id: eventData.familyId, role: 'family' });
  if (eventData.agencyId) recipients.push({ id: eventData.agencyId, role: 'agency' });
  return recipients;
}
