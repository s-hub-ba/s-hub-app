// ─────────────────────────────────────────────────────────────────────────────
// EventDetailsDrawer
// Slides in from the right when a calendar event is clicked.
// Shows event info, location (unlocked/gated), and permitted actions.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import type { CalendarEventDTO, EventAction } from '../types/scheduling';
import { useEventAction } from '../hooks/useEventAction';

interface EventDetailsDrawerProps {
  event: CalendarEventDTO | null;
  onClose: () => void;
  onActionSuccess: (eventId: string) => void;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  available:  'bg-teal-100 text-teal-800',
  confirmed:  'bg-green-100 text-green-800',
  pending:    'bg-yellow-100 text-yellow-800',
  offered:    'bg-yellow-100 text-yellow-800',
  accepted:   'bg-green-100 text-green-800',
  declined:   'bg-red-100 text-red-800',
  cancelled:  'bg-red-100 text-red-800',
  completed:  'bg-gray-100 text-gray-600',
  draft:      'bg-gray-100 text-gray-600',
};

const ACTION_LABELS: Record<EventAction, string> = {
  accept:               'Accept',
  decline:              'Decline',
  confirm:              'Confirm Booking',
  cancel:               'Cancel',
  reschedule:           'Reschedule',
  complete:             'Mark Complete',
  view_exact_location:  'View Address',
  edit:                 'Edit',
};

const ACTION_STYLES: Record<EventAction, string> = {
  accept:              'bg-green-600 hover:bg-green-700 text-white',
  confirm:             'bg-green-600 hover:bg-green-700 text-white',
  complete:            'bg-blue-600 hover:bg-blue-700 text-white',
  decline:             'bg-red-600 hover:bg-red-700 text-white',
  cancel:              'bg-red-100 hover:bg-red-200 text-red-700',
  reschedule:          'bg-amber-100 hover:bg-amber-200 text-amber-800',
  view_exact_location: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  edit:                'bg-gray-100 hover:bg-gray-200 text-gray-700',
};

// Status actions that map directly to an API status transition
const STATUS_ACTION_MAP: Partial<Record<EventAction, string>> = {
  accept:   'accepted',
  decline:  'declined',
  confirm:  'confirmed',
  cancel:   'cancelled',
  complete: 'completed',
};

export const EventDetailsDrawer: React.FC<EventDetailsDrawerProps> = ({
  event,
  onClose,
  onActionSuccess,
}) => {
  const { transitionStatus, loading, error, reset } = useEventAction();

  const handleAction = useCallback(
    async (action: EventAction) => {
      if (!event) return;

      const nextStatus = STATUS_ACTION_MAP[action];
      if (nextStatus) {
        try {
          await transitionStatus(event.id, nextStatus as any);
          onActionSuccess(event.id);
          onClose();
        } catch {
          // error is set by the hook
        }
      }

      if (action === 'reschedule' || action === 'edit') {
        // Reschedule/edit open additional UX flows — handled at page level.
        // For now, close drawer and let parent handle via onActionSuccess.
        onActionSuccess(event.id);
        onClose();
      }
    },
    [event, transitionStatus, onActionSuccess, onClose],
  );

  if (!event) return null;

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = `${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Event details: ${event.title}`}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">
            {event.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Status badge */}
          <div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[event.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {event.status}
            </span>
            <span className="ml-2 text-xs text-gray-400 capitalize">{event.type.replace(/_/g, ' ')}</span>
          </div>

          {/* Date / time */}
          <div className="space-y-1">
            {event.nannyName && <InfoRow label="Nanny" value={event.nannyName} />}
            {event.nannyCvid && <InfoRow label="CVID" value={event.nannyCvid} />}
            {event.nannyUid && <InfoRow label="UID" value={event.nannyUid} />}
            <InfoRow label="Date" value={dateStr} />
            <InfoRow label="Time" value={timeStr} />
            <InfoRow label="Timezone" value={event.timezone} />
          </div>

          {/* Location */}
          {event.locationLabel && (
            <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</p>
              <p className="text-sm text-gray-800">{event.locationLabel}</p>
              {event.canViewExactLocation && event.exactLocation ? (
                <p className="text-sm text-gray-600 font-mono">{event.exactLocation}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Exact address visible after confirmation
                </p>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Details</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {/* Notes */}
          {event.notesVisible && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{event.notesVisible}</p>
            </div>
          )}

          {/* Pay rate */}
          {event.metadata?.payRate && (
            <InfoRow
              label="Pay Rate"
              value={`${event.metadata.currency ?? 'USD'} ${event.metadata.payRate}/hr`}
            />
          )}

          {/* Urgency */}
          {event.metadata?.urgency && event.metadata.urgency !== 'normal' && (
            <div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${event.metadata.urgency === 'high' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}
              >
                {event.metadata.urgency === 'high' ? '🔴 High urgency' : '🟡 Low urgency'}
              </span>
            </div>
          )}

          {/* Recurrence info */}
          {event.recurrence?.enabled && (
            <InfoRow
              label="Recurrence"
              value={`${event.recurrence.frequency}${event.recurrence.daysOfWeek?.length ? ` on days ${event.recurrence.daysOfWeek.join(', ')}` : ''}`}
            />
          )}
          {event.parentEventId && (
            <p className="text-xs text-gray-400">
              Instance {(event.instanceIndex ?? 0) + 1} of recurring series
            </p>
          )}

          {/* Error from action */}
          {error && (
            <div
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {error}
              <button onClick={reset} className="ml-2 underline text-xs">Dismiss</button>
            </div>
          )}
        </div>

        {/* Action footer */}
        {event.allowedActions.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {event.allowedActions
                .filter((a) => a !== 'view_exact_location') // handled inline
                .map((action) => (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {loading ? '…' : ACTION_LABELS[action] ?? action}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Sub-component ────────────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs text-gray-500 min-w-[72px]">{label}</span>
    <span className="text-sm text-gray-800">{value}</span>
  </div>
);

export default EventDetailsDrawer;
