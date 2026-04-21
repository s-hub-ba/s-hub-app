// ─────────────────────────────────────────────────────────────────────────────
// pages/family/Calendar.tsx
// Family calendar page:
//   - List/agenda view as default (mobile-friendly)
//   - View their booking requests and confirmed bookings
//   - Cancel from event detail drawer
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import CalendarShell from '../../features/scheduling/components/CalendarShell';

const FamilyCalendar: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleActionSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">My Schedule</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your booking requests and confirmed care sessions</p>
      </div>

      {/* Info strip: exact address privacy note */}
      <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <p>
          Your exact address is only shared with your nanny once a booking is confirmed.
          Until then, only the general neighborhood is visible.
        </p>
      </div>

      <CalendarShell
        key={refreshKey}
        defaultView="listWeek"
        visibleTypes={['booking_request', 'booking_confirmed']}
        onEventMutated={handleActionSuccess}
      />
    </div>
  );
};

export default FamilyCalendar;
