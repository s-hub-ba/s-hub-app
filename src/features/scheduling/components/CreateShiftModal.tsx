// ─────────────────────────────────────────────────────────────────────────────
// CreateShiftModal  (Agency)
// Modal form for creating a shift offer addressed to a specific nanny.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useCreateShift } from '../hooks/useCreateShift';
import type { CreateShiftOfferInput, RecurrenceRule } from '../types/scheduling';

interface CreateShiftModalProps {
  /** Pre-filled start/end (from calendar slot selection) */
  defaultStart?: Date;
  defaultEnd?: Date;
  onSuccess: (eventIds: string[]) => void;
  onClose: () => void;
}

// Quick date-to-datetime-local value helper
const toLocalValue = (d?: Date): string => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const CreateShiftModal: React.FC<CreateShiftModalProps> = ({
  defaultStart,
  defaultEnd,
  onSuccess,
  onClose,
}) => {
  const { createShift, loading, error, reset } = useCreateShift();

  const [nannyId, setNannyId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState(toLocalValue(defaultStart));
  const [endAt, setEndAt] = useState(toLocalValue(defaultEnd));
  const [locationGeneral, setLocationGeneral] = useState('');
  const [locationExact, setLocationExact] = useState('');
  const [payRate, setPayRate] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high'>('normal');
  const [recurEnabled, setRecurEnabled] = useState(false);
  const [recurFreq, setRecurFreq] = useState<'daily' | 'weekly'>('weekly');
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [recurEndsOn, setRecurEndsOn] = useState('');
  const [reminders, setReminders] = useState({ enabled: true, remind24h: true, remind2h: false });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!nannyId.trim()) return;

      const recurrence: CreateShiftOfferInput['recurrence'] = recurEnabled
        ? {
            enabled: true,
            frequency: recurFreq,
            daysOfWeek: recurFreq === 'weekly' ? recurDays : undefined,
            endsOn: recurEndsOn ? (new Date(recurEndsOn) as any) : null,
          }
        : undefined;

      const input: CreateShiftOfferInput = {
        nannyId: nannyId.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        timezone: 'America/New_York',
        locationGeneral: locationGeneral.trim() || undefined,
        locationExact: locationExact.trim() || undefined,
        metadata: {
          payRate: payRate ? Number(payRate) : undefined,
          currency: 'USD',
          urgency,
          source: 'agency_created',
        },
        reminderSettings: reminders,
        recurrence,
      };

      try {
        const result = await createShift(input);
        onSuccess(result.eventIds);
        onClose();
      } catch {
        // error shown via `error` state from hook
      }
    },
    [nannyId, title, description, startAt, endAt, locationGeneral, locationExact, payRate, urgency, recurEnabled, recurFreq, recurDays, recurEndsOn, reminders, createShift, onSuccess, onClose],
  );

  const toggleDay = (day: number) =>
    setRecurDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Shift Offer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Create Shift Offer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Nanny ID *" htmlFor="nannyId">
            <input
              id="nannyId"
              type="text"
              value={nannyId}
              onChange={(e) => setNannyId((e.target as HTMLInputElement).value)}
              placeholder="uid of the nanny"
              required
              className={inputCls}
            />
          </Field>

          <Field label="Title *" htmlFor="title">
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
              placeholder="e.g. After-school Monday shift"
              required
              maxLength={200}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start *" htmlFor="startAt">
              <input id="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt((e.target as HTMLInputElement).value)} required className={inputCls} />
            </Field>
            <Field label="End *" htmlFor="endAt">
              <input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt((e.target as HTMLInputElement).value)} required className={inputCls} />
            </Field>
          </div>

          <Field label="General Location" htmlFor="locationGeneral">
            <input
              id="locationGeneral"
              type="text"
              value={locationGeneral}
              onChange={(e) => setLocationGeneral((e.target as HTMLInputElement).value)}
              placeholder="e.g. Upper East Side, Manhattan"
              className={inputCls}
            />
          </Field>

          <Field label="Exact Address (hidden from nanny until confirmation)" htmlFor="locationExact">
            <input
              id="locationExact"
              type="text"
              value={locationExact}
              onChange={(e) => setLocationExact((e.target as HTMLInputElement).value)}
              placeholder="Full address"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pay Rate ($/hr)" htmlFor="payRate">
              <input id="payRate" type="number" value={payRate} onChange={(e) => setPayRate((e.target as HTMLInputElement).value)} min={0} step={0.5} className={inputCls} />
            </Field>
            <Field label="Urgency" htmlFor="urgency">
              <select id="urgency" value={urgency} onChange={(e) => setUrgency((e.target as HTMLInputElement).value as any)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </Field>
          </div>

          <Field label="Description" htmlFor="description">
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription((e.target as HTMLInputElement).value)}
              rows={2}
              className={inputCls}
            />
          </Field>

          {/* Recurrence */}
          <div className="rounded-lg border border-gray-200 px-4 py-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurEnabled} onChange={(e) => setRecurEnabled((e.target as HTMLInputElement).checked)} className="rounded text-primary" />
              <span className="text-sm font-medium text-gray-700">Recurring shift</span>
            </label>
            {recurEnabled && (
              <div className="space-y-3 pl-6">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500">Frequency</label>
                  <select value={recurFreq} onChange={(e) => setRecurFreq((e.target as HTMLInputElement).value as any)} className="text-sm border border-gray-200 rounded-md px-2 py-1">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                {recurFreq === 'weekly' && (
                  <div className="flex gap-1 flex-wrap">
                    {DAY_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${recurDays.includes(idx) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label htmlFor="recurEndsOn" className="text-xs text-gray-500">Ends on</label>
                  <input id="recurEndsOn" type="date" value={recurEndsOn} onChange={(e) => setRecurEndsOn((e.target as HTMLInputElement).value)} className="text-sm border border-gray-200 rounded-md px-2 py-1" />
                </div>
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reminders</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={reminders.remind24h} onChange={(e) => setReminders((r) => ({ ...r, remind24h: (e.target as HTMLInputElement).checked, enabled: true }))} className="rounded" />
              24 hours before
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={reminders.remind2h} onChange={(e) => setReminders((r) => ({ ...r, remind2h: (e.target as HTMLInputElement).checked, enabled: true }))} className="rounded" />
              2 hours before
            </label>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
              <button onClick={reset} className="ml-2 underline text-xs">Dismiss</button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Creating…' : 'Create Shift Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div className="space-y-1">
    <label htmlFor={htmlFor} className="text-xs font-medium text-gray-500">{label}</label>
    {children}
  </div>
);

export default CreateShiftModal;
