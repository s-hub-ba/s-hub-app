// ─────────────────────────────────────────────────────────────────────────────
// Permission Service
// Centralises role-based scheduling permissions so route handlers do not grow
// into a long list of role/event/status checks.
// ─────────────────────────────────────────────────────────────────────────────

import type { EventStatus, EventType, UserRole } from './scheduling.ts';

export interface SchedulingViewerContext {
  userId: string;
  role: UserRole;
  nannyId?: string;
  agencyId?: string;
  familyId?: string;
}

export interface SchedulingEventOwnership {
  createdBy?: string;
  nannyId?: string;
  agencyId?: string;
  familyId?: string;
  type: EventType;
  status: EventStatus;
}

export function canViewEvent(
  viewer: SchedulingViewerContext,
  event: SchedulingEventOwnership,
): boolean {
  if (viewer.role === 'admin' || viewer.role === 'superadmin') return true;
  if (viewer.nannyId && event.nannyId === viewer.nannyId) return true;
  if (viewer.agencyId && event.agencyId === viewer.agencyId) return true;
  if (viewer.familyId && event.familyId === viewer.familyId) return true;
  return event.createdBy === viewer.userId;
}

export function canEditAvailability(
  viewer: SchedulingViewerContext,
  event: SchedulingEventOwnership,
): boolean {
  return (
    viewer.role === 'nanny'
    && !!viewer.nannyId
    && event.nannyId === viewer.nannyId
    && (event.type === 'availability' || event.type === 'blocked_time')
  );
}

export function canAcceptOffer(
  viewer: SchedulingViewerContext,
  event: SchedulingEventOwnership,
): boolean {
  return viewer.role === 'nanny'
    && !!viewer.nannyId
    && event.type === 'shift_offer'
    && event.nannyId === viewer.nannyId
    && event.status === 'offered';
}

export function canAgencyConfirm(
  viewer: SchedulingViewerContext,
  event: SchedulingEventOwnership,
): boolean {
  return ['agency', 'agency_admin', 'agency_recruiter', 'admin', 'superadmin'].includes(viewer.role)
    && !!viewer.agencyId
    && event.agencyId === viewer.agencyId
    && ['accepted', 'pending'].includes(event.status);
}

export function canCancelEvent(
  viewer: SchedulingViewerContext,
  event: SchedulingEventOwnership,
): boolean {
  if (viewer.role === 'admin' || viewer.role === 'superadmin') return true;
  if (canEditAvailability(viewer, event)) return true;
  if (viewer.familyId && event.familyId === viewer.familyId) return true;
  if (viewer.agencyId && event.agencyId === viewer.agencyId) return true;
  return false;
}
