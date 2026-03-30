// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection Utility
// Pure functions — no Firestore calls. Firestore queries happen in the service
// layer; this module only reasons about event time windows.
// ─────────────────────────────────────────────────────────────────────────────

import type { CalendarEventDTO, EventType, EventStatus } from '../types/scheduling';

// ─── Date Overlap ─────────────────────────────────────────────────────────────

/**
 * Returns true if [startA, endA) overlaps with [startB, endB).
 * Touching edges (endA === startB) are NOT considered overlapping.
 */
export function doIntervalsOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  // Guard: invalid intervals cannot conflict
  if (eA <= sA || eB <= sB) return false;

  // Overlap exists when neither interval is entirely before/after the other
  return sA < eB && sB < eA;
}

// ─── Which statuses BLOCK time for a nanny ───────────────────────────────────

/**
 * These statuses mean the nanny has a hard time commitment.
 * Used when looking for scheduling conflicts.
 */
const NANNY_BLOCKING_STATUSES: EventStatus[] = ['confirmed', 'accepted'];

/**
 * These event types can block a nanny's calendar when combined with a blocking status.
 */
const NANNY_BLOCKING_TYPES: EventType[] = [
  'booking_confirmed',
  'booking_request',
  'shift_offer',
  'blocked_time',
  'interview',
];

const FAMILY_BLOCKING_STATUSES: EventStatus[] = ['confirmed', 'accepted'];
const FAMILY_BLOCKING_TYPES: EventType[] = ['booking_confirmed', 'booking_request'];

// ─── Public conflict detection functions ─────────────────────────────────────

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  conflictingEventId: string;
  conflictingEventTitle: string;
  conflictType: 'nanny_overlap' | 'family_overlap';
  message: string;
}

/**
 * Given a proposed time window and a set of existing events for a NANNY,
 * returns any hard conflicts.
 *
 * Used server-side: events are queried from Firestore and passed in.
 */
export function detectNannyConflicts(
  proposedStart: string,
  proposedEnd: string,
  existingEvents: Array<{ id: string; title: string; start: string; end: string; status: EventStatus; type: EventType }>,
  excludeEventId?: string,
): ConflictCheckResult {
  const conflicts: ConflictDetail[] = [];

  for (const event of existingEvents) {
    if (event.id === excludeEventId) continue;
    if (!NANNY_BLOCKING_STATUSES.includes(event.status)) continue;
    if (!NANNY_BLOCKING_TYPES.includes(event.type)) continue;

    if (doIntervalsOverlap(proposedStart, proposedEnd, event.start, event.end)) {
      conflicts.push({
        conflictingEventId: event.id,
        conflictingEventTitle: event.title,
        conflictType: 'nanny_overlap',
        message: `Conflicts with ${event.type} "${event.title}" (${formatWindow(event.start, event.end)})`,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

/**
 * Given a proposed time window and a set of existing events for a FAMILY/CHILD,
 * returns any hard conflicts (double-booking same child).
 */
export function detectFamilyConflicts(
  proposedStart: string,
  proposedEnd: string,
  existingEvents: Array<{ id: string; title: string; start: string; end: string; status: EventStatus; type: EventType }>,
  excludeEventId?: string,
): ConflictCheckResult {
  const conflicts: ConflictDetail[] = [];

  for (const event of existingEvents) {
    if (event.id === excludeEventId) continue;
    if (!FAMILY_BLOCKING_STATUSES.includes(event.status)) continue;
    if (!FAMILY_BLOCKING_TYPES.includes(event.type)) continue;

    if (doIntervalsOverlap(proposedStart, proposedEnd, event.start, event.end)) {
      conflicts.push({
        conflictingEventId: event.id,
        conflictingEventTitle: event.title,
        conflictType: 'family_overlap',
        message: `Conflicts with existing booking "${event.title}" (${formatWindow(event.start, event.end)})`,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

// ─── Frontend helper: filter conflicts from already-loaded calendar events ────

/**
 * Client-side conflict detection when the full event list is already loaded.
 * Less authoritative than server-side — always re-validate on the backend.
 */
export function findConflictsInCalendar(
  proposedStart: string,
  proposedEnd: string,
  calendarEvents: CalendarEventDTO[],
  viewerRole: 'nanny' | 'family',
  excludeEventId?: string,
): ConflictCheckResult {
  const flatEvents = calendarEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    status: e.status,
    type: e.type,
  }));

  return viewerRole === 'nanny'
    ? detectNannyConflicts(proposedStart, proposedEnd, flatEvents, excludeEventId)
    : detectFamilyConflicts(proposedStart, proposedEnd, flatEvents, excludeEventId);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatWindow(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString()} ${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return `${start} – ${end}`;
  }
}
