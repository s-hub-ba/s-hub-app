// ─────────────────────────────────────────────────────────────────────────────
// Status Transition Validator
// Defines which status transitions are valid for each event type.
// Used on both backend (authoritative) and optionally frontend (for UI gating).
// ─────────────────────────────────────────────────────────────────────────────

import type { EventStatus, EventType } from '../types/scheduling';

// ─── Transition Matrix ────────────────────────────────────────────────────────
//
// Key:   EventType
// Value: Map of currentStatus → Set of valid nextStatuses
//
// If a transition is not in this matrix, it is INVALID.

type TransitionMap = Partial<Record<EventStatus, EventStatus[]>>;

const TRANSITION_MATRIX: Record<EventType, TransitionMap> = {
  availability: {
    available: ['cancelled'],
    cancelled: [], // terminal
  },

  blocked_time: {
    confirmed: ['cancelled'],
    cancelled: [], // terminal
  },

  shift_offer: {
    draft: ['offered', 'cancelled'],
    offered: ['accepted', 'declined', 'cancelled'],
    accepted: ['confirmed', 'cancelled'],
    declined: [], // terminal
    confirmed: ['completed', 'cancelled'],
    cancelled: [], // terminal
    completed: [], // terminal
  },

  booking_request: {
    pending: ['accepted', 'declined', 'cancelled'],
    accepted: ['confirmed', 'cancelled'],
    declined: [], // terminal
    confirmed: ['completed', 'cancelled'],
    cancelled: [], // terminal
    completed: [], // terminal
  },

  booking_confirmed: {
    confirmed: ['completed', 'cancelled'],
    completed: [], // terminal
    cancelled: [], // terminal
  },

  interview: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [], // terminal
    cancelled: [], // terminal
  },
};

// ─── Validation Function ──────────────────────────────────────────────────────

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether a status transition is allowed for a given event type.
 *
 * @example
 * validateStatusTransition('offered', 'accepted', 'shift_offer') // { valid: true }
 * validateStatusTransition('confirmed', 'offered', 'shift_offer') // { valid: false, reason: '...' }
 */
export function validateStatusTransition(
  currentStatus: EventStatus,
  nextStatus: EventStatus,
  eventType: EventType,
): TransitionValidationResult {
  const matrix = TRANSITION_MATRIX[eventType];
  if (!matrix) {
    return { valid: false, reason: `Unknown event type: ${eventType}` };
  }

  const allowedNext = matrix[currentStatus];
  if (allowedNext === undefined) {
    return {
      valid: false,
      reason: `Event type "${eventType}" does not support starting status "${currentStatus}"`,
    };
  }

  if (allowedNext.length === 0) {
    return {
      valid: false,
      reason: `Status "${currentStatus}" is terminal for event type "${eventType}"`,
    };
  }

  if (!allowedNext.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Cannot transition "${eventType}" from "${currentStatus}" to "${nextStatus}". Allowed: ${allowedNext.join(', ')}`,
    };
  }

  return { valid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the valid initial status for a given event type. */
export function getInitialStatus(type: EventType): EventStatus {
  const initialMap: Record<EventType, EventStatus> = {
    availability: 'available',
    blocked_time: 'confirmed',
    shift_offer: 'offered',
    booking_request: 'pending',
    booking_confirmed: 'confirmed',
    interview: 'pending',
  };
  return initialMap[type];
}

/** Returns true if the status is a terminal (no further transitions allowed). */
export function isTerminalStatus(status: EventStatus, type: EventType): boolean {
  const matrix = TRANSITION_MATRIX[type];
  if (!matrix) return false;
  const allowed = matrix[status];
  return allowed !== undefined && allowed.length === 0;
}

/** Returns all statuses that represent an active commitment (not cancelled/declined). */
export const ACTIVE_BLOCKING_STATUSES: EventStatus[] = [
  'confirmed',
  'accepted',
  'completed', // already happened, still counts for history
];
