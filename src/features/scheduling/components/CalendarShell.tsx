// ─────────────────────────────────────────────────────────────────────────────
// CalendarShell
// The primary calendar component used across all roles.
// Renders FullCalendar with week/month/agenda views. On event click, opens the
// EventDetailsDrawer. Accepts an optional action trigger callback so parent
// pages can re-fetch after an action.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core';

import type { CalendarEventDTO, EventType, EventStatus } from '../types/scheduling';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { mapEventsToCalendar, CALENDAR_LEGEND } from '../utils/mapEventsToCalendar';
import { EventDetailsDrawer } from './EventDetailsDrawer';

interface CalendarShellProps {
  /** If provided, limits visible event types (default: all) */
  visibleTypes?: EventType[];
  /** If provided, limits visible statuses (default: all) */
  visibleStatuses?: EventStatus[];
  /**
   * Called when the user selects a blank time slot.
   * Parent page uses this to open its create-event form.
   */
  onSlotSelect?: (start: Date, end: Date) => void;
  /** Called after any action is performed on an event. */
  onEventMutated?: () => void;
  /** Default view: 'timeGridWeek' | 'dayGridMonth' | 'listWeek' */
  defaultView?: 'timeGridWeek' | 'dayGridMonth' | 'listWeek';
  className?: string;
}

export const CalendarShell: React.FC<CalendarShellProps> = ({
  visibleTypes,
  visibleStatuses,
  onSlotSelect,
  onEventMutated,
  defaultView = 'timeGridWeek',
  className = '',
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // start of current week
    return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + 42); // ~6 weeks
    return d;
  });

  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDTO | null>(null);

  const { events, loading, refetch } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    types: visibleTypes,
    statuses: visibleStatuses,
  });

  // ── When FullCalendar navigates, update the range to trigger re-fetch ──
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRangeStart(arg.start);
    setRangeEnd(arg.end);
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const dto = arg.event.extendedProps?.dto as CalendarEventDTO | undefined;
    if (dto) setSelectedEvent(dto);
  }, []);

  const handleSlotSelect = useCallback((arg: DateSelectArg) => {
    onSlotSelect?.(arg.start, arg.end);
    calendarRef.current?.getApi().unselect();
  }, [onSlotSelect]);

  const handleActionSuccess = useCallback((_eventId: string) => {
    setSelectedEvent(null);
    refetch();
    onEventMutated?.();
  }, [refetch, onEventMutated]);

  const fcEvents = mapEventsToCalendar(events);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const nextView = isMobile ? 'listWeek' : defaultView;
    if (api.view.type !== nextView) {
      api.changeView(nextView);
    }
  }, [defaultView, isMobile]);

  return (
    <div className={`flex flex-col gap-3 ${isMobile ? 'mobile-calendar' : ''} ${className}`}>
      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
          Loading events…
        </div>
      )}

      {/* FullCalendar */}
      <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden bg-white">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listWeek' : defaultView}
          headerToolbar={{
            left: isMobile ? 'prev,next' : 'prev,next today',
            center: 'title',
            right: isMobile ? 'today,listWeek,dayGridMonth' : 'timeGridWeek,dayGridMonth,listWeek',
          }}
          buttonText={{
            today: 'Today',
            week: 'Week',
            month: 'Month',
            list: 'Agenda',
          }}
          height="auto"
          events={fcEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          selectable={!!onSlotSelect}
          select={handleSlotSelect}
          selectMirror
          nowIndicator
          // Start week on Monday (NYC market convention)
          firstDay={1}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
          dayMaxEventRows={isMobile ? 2 : true}
          stickyHeaderDates
          // Gracefully handle no events
          noEventsContent={<NoEventsMessage />}
        />
      </div>

      {/* Legend */}
      <CalendarLegend />

      {/* Event details drawer */}
      <EventDetailsDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const NoEventsMessage: React.FC = () => (
  <div className="py-10 text-center text-gray-400 text-sm">
    No events for this period.
  </div>
);

const CalendarLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
    {CALENDAR_LEGEND.map((item) => (
      <div key={item.colorKey} className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: item.hex }}
        />
        <span className="text-xs text-gray-500">{item.label}</span>
      </div>
    ))}
  </div>
);

export default CalendarShell;
