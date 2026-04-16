import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import type { CreateBookingRequestInput } from '../types/scheduling';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface BookingRequestFormProps {
  agencyId: string;
  nannyId?: string;
  onSuccess?: (primaryId: string) => void;
}

export const BookingRequestForm: React.FC<BookingRequestFormProps> = ({ agencyId, nannyId, onSuccess }) => {
  const [title, setTitle] = useState('Care Request');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [locationGeneral, setLocationGeneral] = useState('');
  const [locationExact, setLocationExact] = useState('');
  const [notesVisible, setNotesVisible] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        (headers as any).Authorization = `Bearer ${token}`;
      } else if (import.meta.env.DEV) {
        (headers as any)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
      }

      const payload: CreateBookingRequestInput = {
        agencyId,
        nannyId,
        title,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        timezone: 'America/New_York',
        locationGeneral,
        locationExact,
        notesVisible: notesVisible || undefined,
      };

      const res = await fetch(`${API_BASE}/api/scheduling/booking-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to create booking request');
      onSuccess?.(body.primaryId);
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Request Care</h2>
        <p className="text-sm text-gray-500 mt-1">Only the general neighborhood is shared until a booking is confirmed.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Title</label>
        <input value={title} onChange={(e) => setTitle(e.currentTarget.value)} className={inputCls} maxLength={120} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start</label>
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.currentTarget.value)} className={inputCls} required />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End</label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.currentTarget.value)} className={inputCls} required />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">General Location</label>
        <input value={locationGeneral} onChange={(e) => setLocationGeneral(e.currentTarget.value)} placeholder="e.g. Canarsie, Brooklyn" className={inputCls} required />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Exact Address</label>
        <input value={locationExact} onChange={(e) => setLocationExact(e.currentTarget.value)} placeholder="Full address" className={inputCls} required />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea value={notesVisible} onChange={(e) => setNotesVisible(e.currentTarget.value)} rows={3} className={inputCls} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {loading ? 'Submitting...' : 'Submit Request'}
      </button>
    </form>
  );
};

export default BookingRequestForm;
