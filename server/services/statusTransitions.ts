// Server-side copy of statusTransitions — mirrors src/features/scheduling/utils/statusTransitions.ts
// Keep in sync with the frontend version.

type EventStatus =
  | 'draft' | 'available' | 'pending' | 'offered' | 'accepted'
  | 'declined' | 'confirmed' | 'cancelled' | 'completed';

type EventType =
  | 'availability' | 'blocked_time' | 'shift_offer'
  | 'booking_request' | 'booking_confirmed' | 'interview';

type TransitionMap = Partial<Record<EventStatus, EventStatus[]>>;

const TRANSITION_MATRIX: Record<EventType, TransitionMap> = {
  availability:      { available: ['cancelled'], cancelled: [] },
  blocked_time:      { confirmed: ['cancelled'], cancelled: [] },
  shift_offer: {
    draft:      ['offered', 'cancelled'],
    offered:    ['accepted', 'declined', 'cancelled'],
    accepted:   ['confirmed', 'cancelled'],
    declined:   [],
    confirmed:  ['completed', 'cancelled'],
    cancelled:  [],
    completed:  [],
  },
  booking_request: {
    pending:   ['accepted', 'declined', 'cancelled'],
    accepted:  ['confirmed', 'cancelled'],
    declined:  [],
    confirmed: ['completed', 'cancelled'],
    cancelled: [],
    completed: [],
  },
  booking_confirmed: {
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  interview: {
    pending:   ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
};

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateStatusTransition(
  currentStatus: EventStatus,
  nextStatus: EventStatus,
  eventType: EventType,
): TransitionValidationResult {
  const matrix = TRANSITION_MATRIX[eventType];
  if (!matrix) return { valid: false, reason: `Unknown event type: ${eventType}` };

  const allowed = matrix[currentStatus];
  if (allowed === undefined) return { valid: false, reason: `Status "${currentStatus}" not valid for "${eventType}"` };
  if (allowed.length === 0) return { valid: false, reason: `Status "${currentStatus}" is terminal` };
  if (!allowed.includes(nextStatus)) {
    return { valid: false, reason: `Cannot go from "${currentStatus}" to "${nextStatus}" for "${eventType}". Allowed: ${allowed.join(', ')}` };
  }
  return { valid: true };
}

export function getInitialStatus(type: EventType): EventStatus {
  const map: Record<EventType, EventStatus> = {
    availability: 'available',
    blocked_time: 'confirmed',
    shift_offer: 'offered',
    booking_request: 'pending',
    booking_confirmed: 'confirmed',
    interview: 'pending',
  };
  return map[type];
}
