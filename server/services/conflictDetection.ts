// Server-side copy of conflictDetection
// Mirrors src/features/scheduling/utils/conflictDetection.ts

type EventStatus = 'draft' | 'available' | 'pending' | 'offered' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'completed';
type EventType = 'availability' | 'blocked_time' | 'shift_offer' | 'booking_request' | 'booking_confirmed' | 'interview';

export interface ConflictDetail {
  conflictingEventId: string;
  conflictingEventTitle: string;
  conflictType: 'nanny_overlap' | 'family_overlap';
  message: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

const NANNY_BLOCKING_STATUSES: EventStatus[] = ['confirmed', 'accepted'];
const NANNY_BLOCKING_TYPES: EventType[] = ['booking_confirmed', 'booking_request', 'shift_offer', 'blocked_time', 'interview'];
const FAMILY_BLOCKING_STATUSES: EventStatus[] = ['confirmed', 'accepted'];
const FAMILY_BLOCKING_TYPES: EventType[] = ['booking_confirmed', 'booking_request'];

function doIntervalsOverlap(
  startA: string, endA: string, startB: string, endB: string,
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  if (eA <= sA || eB <= sB) return false;
  return sA < eB && sB < eA;
}

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
        message: `Conflicts with ${event.type} "${event.title}"`,
      });
    }
  }
  return { hasConflict: conflicts.length > 0, conflicts };
}

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
        message: `Conflicts with existing booking "${event.title}"`,
      });
    }
  }
  return { hasConflict: conflicts.length > 0, conflicts };
}
