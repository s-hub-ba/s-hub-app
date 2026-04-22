// ─────────────────────────────────────────────────────────────────────────────
// useCalendarEvents
// Fetches calendar events from the scheduling API for the current user.
// Accepts a date range and optional type/status filters.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { getApiBaseUrl } from '../../../lib/apiBase';
import type { CalendarEventDTO, EventType, EventStatus } from '../types/scheduling';

const API_BASE = getApiBaseUrl();

async function getAuthHeaders(): Promise<HeadersInit> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  // Dev fallback
  const uid = localStorage.getItem('dev_user_id') ?? '';
  return { 'x-user-id': uid, 'Content-Type': 'application/json' };
}

export interface UseCalendarEventsOptions {
  rangeStart: Date;
  rangeEnd: Date;
  types?: EventType[];
  statuses?: EventStatus[];
  /** Set false to pause fetching (e.g. while editing) */
  enabled?: boolean;
}

export interface UseCalendarEventsResult {
  events: CalendarEventDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCalendarEvents({
  rangeStart,
  rangeEnd,
  types,
  statuses,
  enabled = true,
}: UseCalendarEventsOptions): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;

    // Cancel previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });
      if (types?.length) params.set('types', types.join(','));
      if (statuses?.length) params.set('statuses', statuses.join(','));

      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_BASE}/api/scheduling/events?${params}`, {
        headers,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message ?? 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [enabled, rangeStart.toISOString(), rangeEnd.toISOString(), types?.join(','), statuses?.join(',')]);

  useEffect(() => {
    fetch();
    return () => abortRef.current?.abort();
  }, [fetch]);

  return { events, loading, error, refetch: fetch };
}
