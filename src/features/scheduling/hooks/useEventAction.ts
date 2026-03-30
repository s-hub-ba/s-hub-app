// ─────────────────────────────────────────────────────────────────────────────
// useEventAction
// Handles status transitions (accept, decline, confirm, cancel, complete)
// and reschedule requests for a single event.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { EventStatus } from '../types/scheduling';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function getAuthHeaders(): Promise<HeadersInit> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  const uid = localStorage.getItem('dev_user_id') ?? '';
  return { 'x-user-id': uid, 'Content-Type': 'application/json' };
}

export interface UseEventActionResult {
  transitionStatus: (eventId: string, status: EventStatus, reason?: string) => Promise<void>;
  reschedule: (eventId: string, startAt: string, endAt: string, reason?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useEventAction(): UseEventActionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitionStatus = useCallback(async (
    eventId: string,
    status: EventStatus,
    reason?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_BASE}/api/scheduling/events/${eventId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    } catch (err: any) {
      const msg = err.message ?? 'Action failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const reschedule = useCallback(async (
    eventId: string,
    startAt: string,
    endAt: string,
    reason?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_BASE}/api/scheduling/events/${eventId}/reschedule`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ startAt, endAt, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    } catch (err: any) {
      const msg = err.message ?? 'Reschedule failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { transitionStatus, reschedule, loading, error, reset };
}
