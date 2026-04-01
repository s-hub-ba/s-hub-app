// ─────────────────────────────────────────────────────────────────────────────
// Scheduling API Routes
// Express router mounted at /api/scheduling
//
// Role-scoped access pattern:
//   Nanny:   availability, blocked_time, accept/decline offers
//   Agency:  shift offers, interviews, confirm/reschedule/cancel events
//   Family:  booking requests, cancel own events
//   All:     getCalendarEvents (filtered by role)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db, auth, normalizeFirebaseAdminError } from '../firebase.js';
import {
  createScheduleEvent,
  transitionEventStatus,
  rescheduleEvent,
  updateScheduleEventBody,
  getNannyEventsInRange,
  getFamilyEventsInRange,
  getAgencyEventsInRange,
  buildCalendarEventDTO,
  type UserRole,
  type EventType,
  type EventStatus,
  type UpdateScope,
} from '../services/scheduling.js';

const router = Router();
const DEFAULT_TZ = 'America/New_York';
const isAgencyRole = (role: UserRole) => ['agency', 'agency_admin', 'agency_recruiter'].includes(role as string);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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
 * Resolves the authenticated user ID and their role from Firestore.
 * Falls back to x-user-id header in non-production dev mode.
 */
async function resolveCallerIdentity(req: any): Promise<{
  userId: string;
  role: UserRole;
  agencyId?: string;
  nannyId?: string;
  familyId?: string;
} | null> {
  let userId = '';
  const token = getBearerToken(req);

  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = String(decoded.uid || '');
    } catch {
      return null;
    }
  } else if (process.env.NODE_ENV !== 'production') {
    userId = getHeaderValue(req.headers['x-user-id']);
  }

  if (!userId) return null;

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data()!;
  const role = userData.role as UserRole;

  return {
    userId,
    role,
    agencyId: userData.agency_id ?? userData.agency_profile_id ?? undefined,
    nannyId: userData.nanny_id ?? userData.nanny_profile_id ?? (role === 'nanny' ? userId : undefined),
    familyId: userData.family_id ?? (role === 'family' ? userId : undefined),
  };
}

async function resolveCallerIdentityOrRespond(req: any, res: any): Promise<{
  userId: string;
  role: UserRole;
  agencyId?: string;
  nannyId?: string;
  familyId?: string;
} | null> {
  try {
    const caller = await resolveCallerIdentity(req);
    if (!caller) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return caller;
  } catch (error) {
    const normalized = normalizeFirebaseAdminError(error);
    res.status(normalized.status).json({ error: normalized.message });
    return null;
  }
}

// ─── Input validation helpers ─────────────────────────────────────────────────

function parseDate(value: unknown, fieldName: string): Date {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be an ISO-8601 string`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error(`${fieldName} is not a valid date`);
  return d;
}

function validateDateRange(startAt: Date, endAt: Date): void {
  if (endAt <= startAt) throw new Error('endAt must be after startAt');
  const maxDuration = 24 * 60 * 60 * 1000; // 24h max per single event
  if (endAt.getTime() - startAt.getTime() > maxDuration) {
    throw new Error('Event duration cannot exceed 24 hours');
  }
}

function resolveUpdateScope(value: unknown): UpdateScope {
  return value === 'series' ? 'series' : 'single';
}

// ─── GET /api/scheduling/events ───────────────────────────────────────────────
// Returns calendar events filtered for the requesting user's role.

router.get('/events', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const { rangeStart, rangeEnd, types, statuses } = req.query as Record<string, string>;
    const start = parseDate(rangeStart, 'rangeStart');
    const end = parseDate(rangeEnd, 'rangeEnd');

    if (end <= start) return res.status(400).json({ error: 'rangeEnd must be after rangeStart' });

    let rawEvents: any[] = [];

    switch (caller.role) {
      case 'nanny':
        if (!caller.nannyId) return res.status(403).json({ error: 'Nanny profile not found' });
        rawEvents = await getNannyEventsInRange(caller.nannyId, start, end);
        break;

      case 'family':
        if (!caller.familyId) return res.status(403).json({ error: 'Family profile not found' });
        rawEvents = await getFamilyEventsInRange(caller.familyId, start, end);
        break;

      case 'agency':
      case 'agency_admin' as any:
      case 'agency_recruiter' as any:
        if (!caller.agencyId) return res.status(403).json({ error: 'Agency profile not found' });
        rawEvents = await getAgencyEventsInRange(caller.agencyId, start, end);
        break;

      case 'admin':
        // Admin sees everything in range
        const snap = await db
          .collection('schedule_events')
          .where('startAt', '>=', Timestamp.fromDate(start))
          .where('startAt', '<=', Timestamp.fromDate(end))
          .get();
        rawEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        break;

      default:
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Optional client-side filtering by type and status
    const typeFilter = types ? types.split(',') as EventType[] : null;
    const statusFilter = statuses ? statuses.split(',') as EventStatus[] : null;

    if (typeFilter) rawEvents = rawEvents.filter((e) => typeFilter.includes(e.type));
    if (statusFilter) rawEvents = rawEvents.filter((e) => statusFilter.includes(e.status));

    // Map to DTOs
    const dtos = rawEvents.map((e) =>
      buildCalendarEventDTO(e, e.id, caller.role, caller.userId),
    );

    return res.json({ events: dtos, total: dtos.length });
  } catch (err: any) {
    console.error('[scheduling/events]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scheduling/events/:id ──────────────────────────────────────────

router.get('/events/:id', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const snap = await db.collection('schedule_events').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });

    const data = snap.data()!;

    // Basic access guard: event must belong to caller's entity
    const allowed =
      caller.role === 'admin'
      || data.nannyId === caller.nannyId
      || data.agencyId === caller.agencyId
      || data.familyId === caller.familyId
      || data.createdBy === caller.userId;

    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const dto = buildCalendarEventDTO(data, snap.id, caller.role, caller.userId);
    return res.json({ event: dto });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scheduling/availability ────────────────────────────────────────
// Nanny creates an availability window.

router.post('/availability', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (caller.role !== 'nanny') return res.status(403).json({ error: 'Nanny access only' });
  if (!caller.nannyId) return res.status(403).json({ error: 'Nanny profile not found' });

  try {
    const { startAt: startStr, endAt: endStr, timezone, title, recurrence, reminderSettings } = req.body;

    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);

    const ids = await createScheduleEvent({
      type: 'availability',
      title: title ?? 'Available',
      startAt,
      endAt,
      timezone: timezone ?? DEFAULT_TZ,
      createdBy: caller.userId,
      createdByRole: 'nanny',
      nannyId: caller.nannyId,
      recurrence,
      reminderSettings,
    });

    return res.status(201).json({ eventIds: ids, primaryId: ids[0] });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// ─── POST /api/scheduling/block ───────────────────────────────────────────────
// Nanny or agency blocks time.

router.post('/block', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (!['nanny', 'agency', 'agency_admin', 'agency_recruiter'].includes(caller.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { startAt: startStr, endAt: endStr, timezone, title, reason, recurrence } = req.body;
    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);

    const ids = await createScheduleEvent({
      type: 'blocked_time',
      title: title ?? 'Blocked',
      description: reason,
      startAt,
      endAt,
      timezone: timezone ?? DEFAULT_TZ,
      createdBy: caller.userId,
      createdByRole: caller.role as UserRole,
      nannyId: caller.nannyId,
      agencyId: caller.agencyId,
      recurrence,
    });

    return res.status(201).json({ eventIds: ids, primaryId: ids[0] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/scheduling/shift-offer ────────────────────────────────────────
// Agency creates a shift offer addressed to a specific nanny.

router.post('/shift-offer', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (!['agency', 'agency_admin', 'agency_recruiter'].includes(caller.role as string)) {
    return res.status(403).json({ error: 'Agency access only' });
  }
  if (!caller.agencyId) return res.status(403).json({ error: 'Agency profile not found' });

  try {
    const {
      nannyId, familyId, childId,
      startAt: startStr, endAt: endStr, timezone,
      title, description, locationGeneral, locationExact,
      notesVisible, metadata, reminderSettings, recurrence,
    } = req.body;

    if (!nannyId || typeof nannyId !== 'string') {
      return res.status(400).json({ error: 'nannyId is required' });
    }

    // Verify nanny exists
    const nannyDoc = await db.collection('users').doc(nannyId).get();
    if (!nannyDoc.exists || nannyDoc.data()?.role !== 'nanny') {
      return res.status(400).json({ error: 'Invalid nannyId' });
    }

    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });

    const ids = await createScheduleEvent({
      type: 'shift_offer',
      title: String(title).trim(),
      description,
      startAt,
      endAt,
      timezone: timezone ?? DEFAULT_TZ,
      createdBy: caller.userId,
      createdByRole: 'agency',
      nannyId,
      agencyId: caller.agencyId,
      familyId,
      childId,
      locationGeneral,
      locationExact,
      notesVisible,
      metadata: {
        ...metadata,
        source: 'agency_created',
      },
      reminderSettings,
      recurrence,
    });

    return res.status(201).json({ eventIds: ids, primaryId: ids[0] });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// ─── POST /api/scheduling/booking-request ────────────────────────────────────
// Family creates a booking request.

router.post('/booking-request', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (caller.role !== 'family') return res.status(403).json({ error: 'Family access only' });
  if (!caller.familyId) return res.status(403).json({ error: 'Family profile not found' });

  try {
    const {
      agencyId, nannyId, childId,
      startAt: startStr, endAt: endStr, timezone,
      title, description,
      locationGeneral, locationExact,
      notesVisible, metadata, reminderSettings,
    } = req.body;

    if (!agencyId || typeof agencyId !== 'string') {
      return res.status(400).json({ error: 'agencyId is required' });
    }
    if (!locationGeneral || !locationExact) {
      return res.status(400).json({ error: 'locationGeneral and locationExact are required' });
    }

    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);

    const ids = await createScheduleEvent({
      type: 'booking_request',
      title: title ?? 'Booking Request',
      description,
      startAt,
      endAt,
      timezone: timezone ?? DEFAULT_TZ,
      createdBy: caller.userId,
      createdByRole: 'family',
      nannyId,
      agencyId,
      familyId: caller.familyId,
      childId,
      locationGeneral,
      locationExact,
      notesVisible,
      metadata: { ...metadata, source: 'family_requested' },
      reminderSettings,
    });

    return res.status(201).json({ eventIds: ids, primaryId: ids[0] });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// ─── POST /api/scheduling/interview ──────────────────────────────────────────
// Agency creates an interview event.

router.post('/interview', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (!['agency', 'agency_admin', 'agency_recruiter'].includes(caller.role as string)) {
    return res.status(403).json({ error: 'Agency access only' });
  }
  if (!caller.agencyId) return res.status(403).json({ error: 'Agency profile not found' });

  try {
    const { nannyId, familyId, startAt: startStr, endAt: endStr, timezone, title, notesVisible, locationGeneral } = req.body;

    if (!nannyId || typeof nannyId !== 'string') {
      return res.status(400).json({ error: 'nannyId is required' });
    }

    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);

    const ids = await createScheduleEvent({
      type: 'interview',
      title: title ?? 'Interview',
      startAt,
      endAt,
      timezone: timezone ?? DEFAULT_TZ,
      createdBy: caller.userId,
      createdByRole: 'agency',
      nannyId,
      agencyId: caller.agencyId,
      familyId,
      locationGeneral,
      notesVisible,
    });

    return res.status(201).json({ eventIds: ids, primaryId: ids[0] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── PATCH /api/scheduling/availability/:id ──────────────────────────────────
// Dedicated nanny availability editor with support for single-instance vs series updates.

router.patch('/availability/:id', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;
  if (caller.role !== 'nanny' || !caller.nannyId) {
    return res.status(403).json({ error: 'Nanny access only' });
  }

  try {
    const snap = await db.collection('schedule_events').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });

    const event = snap.data()!;
    if (!['availability', 'blocked_time'].includes(event.type)) {
      return res.status(400).json({ error: 'This endpoint only edits availability or blocked time' });
    }
    if (event.nannyId !== caller.nannyId) {
      return res.status(403).json({ error: 'Cannot edit another nanny\'s availability' });
    }

    const scope = resolveUpdateScope(req.body.scope);
    const hasStart = req.body.startAt !== undefined;
    const hasEnd = req.body.endAt !== undefined;
    if (hasStart !== hasEnd) {
      return res.status(400).json({ error: 'startAt and endAt must be provided together' });
    }

    const startAt = hasStart ? parseDate(req.body.startAt, 'startAt') : undefined;
    const endAt = hasEnd ? parseDate(req.body.endAt, 'endAt') : undefined;
    if (startAt && endAt) validateDateRange(startAt, endAt);

    const result = await updateScheduleEventBody(
      req.params.id,
      {
        title: req.body.title,
        startAt,
        endAt,
        timezone: req.body.timezone,
        recurrence: req.body.recurrence,
      },
      caller.userId,
      caller.role,
      scope,
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// ─── PATCH /api/scheduling/events/:id ────────────────────────────────────────
// Generic body editor for schedule event content, including series updates.

router.patch('/events/:id', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const snap = await db.collection('schedule_events').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });

    const event = snap.data()!;
    const isParticipant =
      caller.role === 'admin'
      || caller.role === 'superadmin'
      || event.nannyId === caller.nannyId
      || event.agencyId === caller.agencyId
      || event.familyId === caller.familyId
      || event.createdBy === caller.userId;

    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    if (event.type === 'availability' || event.type === 'blocked_time') {
      return res.status(400).json({ error: 'Use the dedicated availability endpoint for this event type' });
    }

    // Agency operational events are editable by agency roles; family requests by family or agency; nanny cannot rewrite offer bodies.
    if (caller.role === 'nanny' && event.nannyId === caller.nannyId) {
      return res.status(403).json({ error: 'Nannies cannot edit shift or booking details directly' });
    }
    if (event.type === 'shift_offer' && !isAgencyRole(caller.role) && caller.role !== 'admin' && caller.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only agency staff can edit shift offers' });
    }

    const scope = resolveUpdateScope(req.body.scope);
    const hasStart = req.body.startAt !== undefined;
    const hasEnd = req.body.endAt !== undefined;
    if (hasStart !== hasEnd) {
      return res.status(400).json({ error: 'startAt and endAt must be provided together' });
    }

    const startAt = hasStart ? parseDate(req.body.startAt, 'startAt') : undefined;
    const endAt = hasEnd ? parseDate(req.body.endAt, 'endAt') : undefined;
    if (startAt && endAt) validateDateRange(startAt, endAt);

    const result = await updateScheduleEventBody(
      req.params.id,
      {
        title: req.body.title,
        description: req.body.description,
        startAt,
        endAt,
        timezone: req.body.timezone,
        locationGeneral: req.body.locationGeneral,
        locationExact: req.body.locationExact,
        notesVisible: req.body.notesVisible,
        metadata: req.body.metadata,
        reminderSettings: req.body.reminderSettings,
        recurrence: req.body.recurrence,
      },
      caller.userId,
      caller.role,
      scope,
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// ─── PATCH /api/scheduling/events/:id/status ─────────────────────────────────
// Transitions an event status: accept, decline, confirm, cancel, complete.

router.patch('/events/:id/status', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const { status: nextStatus, reason } = req.body;
    if (!nextStatus || typeof nextStatus !== 'string') {
      return res.status(400).json({ error: 'status is required' });
    }

    // Fetch event to check ownership before allowing transition
    const snap = await db.collection('schedule_events').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });
    const data = snap.data()!;

    // Permission check: caller must be a participant
    const isParticipant =
      caller.role === 'admin'
      || data.nannyId === caller.nannyId
      || data.agencyId === caller.agencyId
      || data.familyId === caller.familyId
      || data.createdBy === caller.userId;

    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    // Role-specific action gates
    if (nextStatus === 'accepted' || nextStatus === 'declined') {
      // Only the nanny can accept/decline a shift_offer addressed to them
      if (data.type === 'shift_offer' && data.nannyId !== caller.nannyId) {
        return res.status(403).json({ error: 'Only the addressed nanny can accept/decline this offer' });
      }
      // Agency can accept/decline a booking_request
      if (data.type === 'booking_request' && !['agency', 'agency_admin', 'agency_recruiter'].includes(caller.role as string)) {
        return res.status(403).json({ error: 'Only agency can accept/decline booking requests' });
      }
    }

    if (nextStatus === 'confirmed') {
      // Only agency or admin may confirm
      if (!['agency', 'agency_admin', 'agency_recruiter', 'admin'].includes(caller.role as string)) {
        return res.status(403).json({ error: 'Only agency/admin can confirm events' });
      }
    }

    await transitionEventStatus(req.params.id, nextStatus as EventStatus, caller.userId, caller.role, reason);

    return res.json({ success: true, eventId: req.params.id, newStatus: nextStatus });
  } catch (err: any) {
    const status = err.message?.includes('conflict') ? 409
      : err.message?.includes('Invalid') || err.message?.includes('Cannot') ? 400
      : 500;
    return res.status(status).json({ error: err.message });
  }
});

// ─── PATCH /api/scheduling/events/:id/reschedule ─────────────────────────────

router.patch('/events/:id/reschedule', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const { startAt: startStr, endAt: endStr, reason } = req.body;
    const startAt = parseDate(startStr, 'startAt');
    const endAt = parseDate(endStr, 'endAt');
    validateDateRange(startAt, endAt);

    const snap = await db.collection('schedule_events').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });
    const data = snap.data()!;

    // Only agency/admin may reschedule confirmed events
    if (
      !['agency', 'agency_admin', 'agency_recruiter', 'admin'].includes(caller.role as string)
      && !['draft', 'available', 'pending'].includes(data.status)
    ) {
      return res.status(403).json({ error: 'Only agency/admin can reschedule confirmed events' });
    }

    await rescheduleEvent(req.params.id, startAt, endAt, caller.userId, caller.role, reason);
    return res.json({ success: true, eventId: req.params.id });
  } catch (err: any) {
    const statusCode = err.message?.includes('conflict') ? 409 : 400;
    return res.status(statusCode).json({ error: err.message });
  }
});

// ─── GET /api/scheduling/availability/:nannyId ────────────────────────────────
// Returns a nanny's availability for a given date range (agency/family visible).

router.get('/availability/:nannyId', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const { rangeStart, rangeEnd } = req.query as Record<string, string>;
    const start = parseDate(rangeStart, 'rangeStart');
    const end = parseDate(rangeEnd, 'rangeEnd');

    const snap = await db
      .collection('schedule_events')
      .where('nannyId', '==', req.params.nannyId)
      .where('type', '==', 'availability')
      .where('status', '==', 'available')
      .where('startAt', '>=', Timestamp.fromDate(start))
      .where('startAt', '<=', Timestamp.fromDate(end))
      .get();

    const dtos = snap.docs.map((d) =>
      buildCalendarEventDTO({ id: d.id, ...d.data() }, d.id, caller.role, caller.userId),
    );

    return res.json({ availability: dtos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scheduling/agenda ───────────────────────────────────────────────
// Returns an ordered list view of upcoming events (mobile-friendly agenda view).

router.get('/agenda', async (req, res) => {
  const caller = await resolveCallerIdentityOrRespond(req, res);
  if (!caller) return;

  try {
    const now = new Date();
    const lookahead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    let rawEvents: any[] = [];

    switch (caller.role) {
      case 'nanny':
        if (!caller.nannyId) return res.status(403).json({ error: 'Nanny profile not found' });
        rawEvents = await getNannyEventsInRange(caller.nannyId, now, lookahead);
        break;
      case 'family':
        if (!caller.familyId) return res.status(403).json({ error: 'Family profile not found' });
        rawEvents = await getFamilyEventsInRange(caller.familyId, now, lookahead);
        break;
      default:
        if (!caller.agencyId) return res.status(403).json({ error: 'Agency profile not found' });
        rawEvents = await getAgencyEventsInRange(caller.agencyId, now, lookahead);
    }

    // Sort by startAt ascending
    rawEvents.sort((a, b) => {
      const ta = (a.startAt?.toDate?.() ?? new Date(a.startAt)).getTime();
      const tb = (b.startAt?.toDate?.() ?? new Date(b.startAt)).getTime();
      return ta - tb;
    });

    // Filter out cancelled/completed for agenda by default
    const activeEvents = rawEvents.filter(
      (e) => e.status !== 'cancelled' && e.status !== 'declined',
    );

    const dtos = activeEvents.map((e) =>
      buildCalendarEventDTO(e, e.id, caller.role, caller.userId),
    );

    return res.json({ events: dtos, total: dtos.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
