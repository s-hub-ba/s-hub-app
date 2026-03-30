// ─────────────────────────────────────────────────────────────────────────────
// Calendar Event Mapper
// Converts CalendarEventDTOs (from API) into FullCalendar-compatible event
// objects. Centralised so colour logic and field mapping live in one place.
// ─────────────────────────────────────────────────────────────────────────────

import type { CalendarEventDTO, CalendarColorKey, EventStatus, EventType } from '../types/scheduling';

// ─── FullCalendar-compatible shape ───────────────────────────────────────────

export interface FullCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  /** Store the original DTO so the detail drawer can access it. */
  extendedProps: {
    dto: CalendarEventDTO;
    colorKey: CalendarColorKey;
  };
  allDay?: boolean;
  editable?: boolean;
}

// ─── Colour palette ───────────────────────────────────────────────────────────
//
// Rule: colour represents the current STATUS of the event (not the type),
// so users understand at a glance what is actionable vs confirmed vs done.

const COLOR_MAP: Record<CalendarColorKey, { bg: string; border: string; text: string }> = {
  grey:   { bg: '#9CA3AF', border: '#6B7280', text: '#ffffff' }, // blocked / cancelled
  yellow: { bg: '#FBBF24', border: '#F59E0B', text: '#1F2937' }, // pending / offered
  green:  { bg: '#34D399', border: '#10B981', text: '#1F2937' }, // confirmed / completed
  red:    { bg: '#F87171', border: '#EF4444', text: '#ffffff' }, // declined / cancelled
  blue:   { bg: '#60A5FA', border: '#3B82F6', text: '#ffffff' }, // interview
  teal:   { bg: '#2DD4BF', border: '#14B8A6', text: '#1F2937' }, // availability
};

// ─── Colour resolution ────────────────────────────────────────────────────────

/**
 * Maps an event's type + status to a semantic colour key.
 * Priority: status wins over type (e.g. a cancelled shift_offer → red).
 */
export function resolveColorKey(type: EventType, status: EventStatus): CalendarColorKey {
  // Terminal/negative states
  if (status === 'cancelled' || status === 'declined') return 'red';
  if (status === 'completed') return 'green';

  // Type-specific mappings when status is active
  switch (type) {
    case 'availability':
      return 'teal';
    case 'blocked_time':
      return 'grey';
    case 'interview':
      return 'blue';
    case 'shift_offer':
      if (status === 'confirmed' || status === 'accepted') return 'green';
      return 'yellow';
    case 'booking_request':
      if (status === 'confirmed' || status === 'accepted') return 'green';
      return 'yellow';
    case 'booking_confirmed':
      return 'green';
    default:
      return 'grey';
  }
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

/**
 * Converts an array of CalendarEventDTOs to FullCalendar event objects.
 *
 * @example
 * const fcEvents = mapEventsToCalendar(dtos);
 * <FullCalendar events={fcEvents} ... />
 */
export function mapEventsToCalendar(dtos: CalendarEventDTO[]): FullCalendarEvent[] {
  return dtos.map(mapSingleEvent);
}

export function mapSingleEvent(dto: CalendarEventDTO): FullCalendarEvent {
  const colorKey = resolveColorKey(dto.type, dto.status);
  const colors = COLOR_MAP[colorKey];

  return {
    id: dto.id,
    // Append type emoji prefix for quick visual scanning in compact views
    title: buildDisplayTitle(dto),
    start: dto.start,
    end: dto.end,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: {
      dto,
      colorKey,
    },
    // Allow drag-and-drop only for draft/available events (future feature hook)
    editable: dto.status === 'available' || dto.status === 'draft',
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<EventType, string> = {
  availability: '🟢',
  blocked_time: '🚫',
  shift_offer: '📋',
  booking_request: '📅',
  booking_confirmed: '✅',
  interview: '🤝',
};

function buildDisplayTitle(dto: CalendarEventDTO): string {
  const prefix = TYPE_PREFIX[dto.type] ?? '';
  return `${prefix} ${dto.title}`.trim();
}

// ─── Legend for UI ────────────────────────────────────────────────────────────

export interface LegendItem {
  colorKey: CalendarColorKey;
  label: string;
  hex: string;
}

export const CALENDAR_LEGEND: LegendItem[] = [
  { colorKey: 'teal',   label: 'Availability',        hex: COLOR_MAP.teal.bg },
  { colorKey: 'grey',   label: 'Blocked / Cancelled', hex: COLOR_MAP.grey.bg },
  { colorKey: 'yellow', label: 'Pending / Offered',   hex: COLOR_MAP.yellow.bg },
  { colorKey: 'green',  label: 'Confirmed',            hex: COLOR_MAP.green.bg },
  { colorKey: 'blue',   label: 'Interview',            hex: COLOR_MAP.blue.bg },
  { colorKey: 'red',    label: 'Declined / Cancelled', hex: COLOR_MAP.red.bg },
];
