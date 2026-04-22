// ─────────────────────────────────────────────────────────────────────────────
// useCreateShift
// Agency hook: submits a new shift offer to the scheduling API.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getApiBaseUrl } from '../../../lib/apiBase';
import type { CreateShiftOfferInput } from '../types/scheduling';

const API_BASE = getApiBaseUrl();

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

export interface UseCreateShiftResult {
  createShift: (input: CreateShiftOfferInput) => Promise<{ primaryId: string; eventIds: string[] }>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useCreateShift(): UseCreateShiftResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createShift = useCallback(async (input: CreateShiftOfferInput) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_BASE}/api/scheduling/shift-offer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      return body as { primaryId: string; eventIds: string[] };
    } catch (err: any) {
      const msg = err.message ?? 'Failed to create shift';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { createShift, loading, error, reset };
}
