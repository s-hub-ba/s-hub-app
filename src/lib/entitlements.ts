/**
 * useAgencyEntitlements — React hook
 *
 * Reads the agency's subscription and active add-ons from Firestore and
 * returns a fully-resolved AgencyEntitlements object.
 *
 * Usage:
 *   const { entitlements, loading } = useAgencyEntitlements(agencyId);
 */

import { useState, useEffect } from 'react';
import {
  AgencyEntitlements,
  AgencySubscription,
  AgencyAddon,
  resolveEntitlements,
} from './plans';
import { getAgencySubscription, getAgencyAddons } from './api';

export interface UseAgencyEntitlementsResult {
  entitlements: AgencyEntitlements | null;
  subscription: AgencySubscription | null;
  addons: AgencyAddon[];
  loading: boolean;
  error: string | null;
  /** Re-fetch subscription + addons (call after plan change) */
  refresh: () => void;
}

export function useAgencyEntitlements(
  agencyId: string | null | undefined
): UseAgencyEntitlementsResult {
  const [subscription, setSubscription] = useState<AgencySubscription | null>(null);
  const [addons, setAddons] = useState<AgencyAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!agencyId) {
      setSubscription(null);
      setAddons([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getAgencySubscription(agencyId),
      getAgencyAddons(agencyId),
    ])
      .then(([sub, ads]) => {
        if (cancelled) return;
        setSubscription(sub);
        setAddons(ads);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load subscription');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agencyId, refreshTick]);

  const entitlements =
    !loading && agencyId
      ? resolveEntitlements(subscription, addons)
      : null;

  return {
    entitlements,
    subscription,
    addons,
    loading,
    error,
    refresh: () => setRefreshTick((t) => t + 1),
  };
}
