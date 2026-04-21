// ─────────────────────────────────────────────────────────────────────────────
// pages/agency/Calendar.tsx
// Agency calendar page:
//   - Primary operational view (week view default)
//   - Create shift offers via slot selection / button
//   - View all agency events (shift offers, booking requests, interviews)
//   - Accept/confirm/cancel from event detail drawer
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import CalendarShell from '../../features/scheduling/components/CalendarShell';
import { CreateShiftModal } from '../../features/scheduling/components/CreateShiftModal';

const AgencyCalendar: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preselectedStart, setPreselectedStart] = useState<Date | undefined>();
  const [preselectedEnd, setPreselectedEnd] = useState<Date | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSlotSelect = useCallback((start: Date, end: Date) => {
    setPreselectedStart(start);
    setPreselectedEnd(end);
    setShowCreateModal(true);
  }, []);

  const handleCreateSuccess = useCallback((_eventIds: string[]) => {
    setRefreshKey((k) => k + 1);
    setShowCreateModal(false);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shift Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage shift offers, interviews and confirmed bookings, with talent-pool availability overlaid in the same view.</p>
        </div>
        <button
          onClick={() => { setPreselectedStart(undefined); setPreselectedEnd(undefined); setShowCreateModal(true); }}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
        >
          + Create Shift
        </button>
      </div>

      <CalendarShell
        key={refreshKey}
        defaultView="timeGridWeek"
        onSlotSelect={handleSlotSelect}
        onEventMutated={() => setRefreshKey((k) => k + 1)}
      />

      {showCreateModal && (
        <CreateShiftModal
          defaultStart={preselectedStart}
          defaultEnd={preselectedEnd}
          onSuccess={handleCreateSuccess}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export default AgencyCalendar;
