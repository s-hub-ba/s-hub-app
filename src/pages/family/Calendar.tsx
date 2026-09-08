// ─────────────────────────────────────────────────────────────────────────────
// pages/family/Calendar.tsx
// Family calendar page:
//   - List/agenda view as default (mobile-friendly)
//   - View their booking requests and confirmed bookings
//   - Cancel from event detail drawer
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { CalendarDays, LockKeyhole, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import CalendarShell from '../../features/scheduling/components/CalendarShell';

const FamilyCalendar: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleActionSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="family-calendar-page max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CalendarDays className="h-4 w-4" />
            <span>Family schedule</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">Your care schedule</h1>
            <p className="text-sm text-stone-500">Keep track of requests, confirmed care, and what is coming next.</p>
          </div>
        </div>
        <Link
          to="/family/request-care"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Request care
        </Link>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-600 shadow-sm">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <LockKeyhole className="h-4 w-4" />
        </div>
        <p className="leading-6">
          Your exact address stays private until a booking is confirmed. Before then, agencies and nannies only see your general neighborhood.
        </p>
      </div>

      <CalendarShell
        key={refreshKey}
        defaultView="listWeek"
        visibleTypes={['booking_request', 'booking_confirmed']}
        onEventMutated={handleActionSuccess}
        className="family-calendar-shell"
      />
    </div>
  );
};

export default FamilyCalendar;
