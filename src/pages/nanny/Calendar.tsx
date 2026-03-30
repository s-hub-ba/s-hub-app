// ─────────────────────────────────────────────────────────────────────────────
// pages/nanny/Calendar.tsx
// Nanny calendar page:
//   - Availability management (create / cancel blocks)
//   - Block time
//   - View offered shifts, interviews, confirmed bookings
//   - Agenda view as default on mobile
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import CalendarShell from '../../features/scheduling/components/CalendarShell';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function postJson(path: string, body: object) {
  const auth = getAuth();
  const user = auth.currentUser;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (user) {
    const token = await user.getIdToken();
    (headers as any)['Authorization'] = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    (headers as any)['x-user-id'] = localStorage.getItem('dev_user_id') ?? '';
  }
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

type QuickFormType = 'availability' | 'block';

interface QuickForm {
  type: QuickFormType;
  startAt: string;
  endAt: string;
  title: string;
}

const toLocalValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const NannyCalendar: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuickForm>({
    type: 'availability',
    startAt: '',
    endAt: '',
    title: 'Available',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSlotSelect = useCallback((start: Date, end: Date) => {
    setForm({
      type: 'availability',
      startAt: toLocalValue(start),
      endAt: toLocalValue(end),
      title: 'Available',
    });
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const path = form.type === 'availability' ? '/api/scheduling/availability' : '/api/scheduling/block';
      await postJson(path, {
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        title: form.title,
        timezone: 'America/New_York',
      });
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set your availability and track upcoming shifts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setForm({ type: 'availability', startAt: toLocalValue(new Date()), endAt: toLocalValue(new Date(new Date().getTime() + 3600000)), title: 'Available' }); setShowForm(true); }}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            + Availability
          </button>
          <button
            onClick={() => { setForm({ type: 'block', startAt: toLocalValue(new Date()), endAt: toLocalValue(new Date(new Date().getTime() + 3600000)), title: 'Blocked' }); setShowForm(true); }}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            Block Time
          </button>
        </div>
      </div>

      <CalendarShell
        key={refreshKey}
        defaultView="timeGridWeek"
        onSlotSelect={handleSlotSelect}
        onEventMutated={() => setRefreshKey((k) => k + 1)}
      />

      {/* Quick form overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {form.type === 'availability' ? 'Add Availability' : 'Block Time'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(['availability', 'block'] as QuickFormType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t, title: t === 'availability' ? 'Available' : 'Blocked' }))}
                      className={`flex-1 py-1.5 text-sm font-medium transition-colors ${form.type === t ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {t === 'availability' ? 'Availability' : 'Blocked'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start</label>
                <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: (e.target as HTMLInputElement).value }))} className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End</label>
                <input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: (e.target as HTMLInputElement).value }))} className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: (e.target as HTMLInputElement).value }))} maxLength={100} className={inputCls} />
              </div>

              {formError && (
                <p role="alert" className="text-xs text-red-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NannyCalendar;
