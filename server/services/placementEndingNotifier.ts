import { db } from '../firebase.js';
import { enqueueNotification } from './notificationService.ts';

type PlacementRecord = {
  id: string;
  agency_application_id?: string;
  family_application_id?: string;
  family_id?: string;
  agency_id?: string;
  nanny_id?: string;
  end_date?: string;
  start_date?: string;
  care_extended_to?: string;
  care_expected_end_at?: string;
  care_started_at?: string;
  completed_at?: string;
  placement_status?: string;
  job_title?: string;
  job_type?: string;
};

const CARE_HISTORY_COLLECTION = 'care_history';
const ALERT_LEDGER_COLLECTION = 'placement_end_alerts';

const LONG_TERM_REMINDER_RULES = [
  { phase: 'three_months', daysBefore: 90 },
  { phase: 'one_month', daysBefore: 30 },
  { phase: 'one_week', daysBefore: 7 },
] as const;

const OCCASIONAL_SOON_MINUTES = 90;

function parseDateSafe(value: unknown, mode: 'exact' | 'start' | 'end' = 'exact'): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const normalized = value.trim();
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  if (dateOnlyMatch) {
    if (mode === 'start') {
      const parsedStart = new Date(`${normalized}T00:00:00.000`);
      return Number.isNaN(parsedStart.getTime()) ? null : parsedStart;
    }
    if (mode === 'end') {
      const parsedEnd = new Date(`${normalized}T23:59:59.999`);
      return Number.isNaN(parsedEnd.getTime()) ? null : parsedEnd;
    }
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function diffMinutes(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (60 * 1000));
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeCareType(value: unknown): 'full-time' | 'part-time' | 'occasional' | 'last-minute' | 'other' {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'other';
  if (normalized.includes('full')) return 'full-time';
  if (normalized.includes('part')) return 'part-time';
  if (normalized.includes('last')) return 'last-minute';
  if (normalized.includes('occasional')) return 'occasional';
  return 'other';
}

function isLongTermCareType(careType: ReturnType<typeof normalizeCareType>): boolean {
  return careType === 'full-time' || careType === 'part-time';
}

function isOccasionalCareType(careType: ReturnType<typeof normalizeCareType>): boolean {
  return careType === 'occasional' || careType === 'last-minute';
}

function resolveStartDate(placement: PlacementRecord): Date | null {
  return parseDateSafe(placement.care_started_at, 'start')
    || parseDateSafe(placement.start_date, 'start');
}

function resolveEndDate(placement: PlacementRecord): Date | null {
  return parseDateSafe(placement.care_extended_to, 'end')
    || parseDateSafe(placement.care_expected_end_at, 'end')
    || parseDateSafe(placement.end_date, 'end');
}

async function syncApplicationCompleted(applicationId: string, endedAt: Date): Promise<void> {
  if (!applicationId) return;

  const appRef = db.collection('applications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) return;

  const app = appSnap.data() as any;
  const currentStatus = String(app?.status || '');
  if (currentStatus === 'completed') return;

  const eligibleStatuses = new Set(['accepted', 'hired', 'active', 'pending_family_approval']);
  if (!eligibleStatuses.has(currentStatus)) return;

  const existingHistory = Array.isArray(app?.status_history) ? app.status_history : [];
  const now = new Date();
  await appRef.update({
    status: 'completed',
    completed_at: endedAt,
    updated_at: now,
    status_history: [
      ...existingHistory,
      {
        status: 'completed',
        actor_role: 'system',
        note: 'Automatically marked completed because placement end date/time passed.',
        at: now,
      },
    ],
  });
}

async function enqueueWithLedger(options: {
  placementId: string;
  phase: 'three_months' | 'one_month' | 'one_week' | 'start_soon' | 'end_soon';
  recipientRole: 'agency' | 'nanny' | 'family';
  recipientId: string;
  trigger: 'placement_ending_soon' | 'placement_ending_final';
  title: string;
  body: string;
  link: string;
  timingLeft: number;
  timingUnit: 'days' | 'minutes';
}): Promise<boolean> {
  const key = normalizeSlug(`${options.placementId}_${options.phase}_${options.recipientRole}_${options.recipientId}`);
  const ref = db.collection(ALERT_LEDGER_COLLECTION).doc(key);

  try {
    await ref.create({
      placement_id: options.placementId,
      phase: options.phase,
      recipient_role: options.recipientRole,
      recipient_id: options.recipientId,
      created_at: new Date().toISOString(),
      timing_left: options.timingLeft,
      timing_unit: options.timingUnit,
    });
  } catch (error: any) {
    if (String(error?.code) === '6' || String(error?.message || '').includes('ALREADY_EXISTS')) {
      return false;
    }
    throw error;
  }

  await enqueueNotification({
    eventId: `placement-ending-${options.phase}-${options.placementId}`,
    trigger: options.trigger,
    recipientUserId: options.recipientId,
    recipientRole: options.recipientRole,
    title: options.title,
    body: options.body,
    data: {
      link: options.link,
      placementId: options.placementId,
      phase: options.phase,
      timingLeft: String(options.timingLeft),
      timingUnit: options.timingUnit,
    },
  });

  return true;
}

async function autoEndPlacementIfNeeded(placement: PlacementRecord, now: Date): Promise<boolean> {
  const status = String(placement.placement_status || '').toLowerCase();
  if (status !== 'active') return false;

  const endDate = resolveEndDate(placement);
  if (!endDate) return false;
  if (endDate.getTime() > now.getTime()) return false;

  const ref = db.collection(CARE_HISTORY_COLLECTION).doc(placement.id);
  await ref.update({
    placement_status: 'completed',
    completed_at: endDate.toISOString(),
    updated_at: new Date().toISOString(),
    auto_completed_by_system: true,
  });

  const applicationId = String(placement.agency_application_id || placement.family_application_id || '').trim();
  if (applicationId) {
    await syncApplicationCompleted(applicationId, endDate);
  }

  return true;
}

export async function processPlacementEndingSoonNotifications(): Promise<number> {
  const now = new Date();
  const snap = await db
    .collection(CARE_HISTORY_COLLECTION)
    .where('placement_status', '==', 'active')
    .get();

  if (snap.empty) return 0;

  let enqueued = 0;

  for (const doc of snap.docs) {
    const placement = { id: doc.id, ...(doc.data() as Record<string, any>) } as PlacementRecord;
    const autoEnded = await autoEndPlacementIfNeeded(placement, now);
    if (autoEnded) continue;

    const jobTitle = String(placement.job_title || 'your care placement');
    const careType = normalizeCareType(placement.job_type);
    const familyId = String(placement.family_id || '').trim();
    const nannyId = String(placement.nanny_id || '').trim();
    const agencyId = String(placement.agency_id || '').trim();

    const endDate = resolveEndDate(placement);
    if (!endDate) continue;
    const daysLeft = Math.max(0, diffDays(now, endDate));

    if (isLongTermCareType(careType)) {
      for (const rule of LONG_TERM_REMINDER_RULES) {
        if (daysLeft > rule.daysBefore) continue;

        if (familyId) {
          const familyCreated = await enqueueWithLedger({
            placementId: placement.id,
            phase: rule.phase,
            recipientRole: 'family',
            recipientId: familyId,
            trigger: rule.phase === 'one_week' ? 'placement_ending_final' : 'placement_ending_soon',
            title: 'Placement ending soon',
            body: `${jobTitle} is ending in about ${daysLeft} day(s). If you want to continue care, apply to extend and discuss next steps with your agency.`,
            link: `/family/extensions/new?fromPlacement=${encodeURIComponent(placement.id)}${agencyId ? `&agencyId=${encodeURIComponent(agencyId)}` : ''}`,
            timingLeft: daysLeft,
            timingUnit: 'days',
          });
          if (familyCreated) enqueued += 1;
        }

        if (nannyId) {
          const nannyCreated = await enqueueWithLedger({
            placementId: placement.id,
            phase: rule.phase,
            recipientRole: 'nanny',
            recipientId: nannyId,
            trigger: rule.phase === 'one_week' ? 'placement_ending_final' : 'placement_ending_soon',
            title: 'Placement ending reminder',
            body: `${jobTitle} is expected to end in about ${daysLeft} day(s).`,
            link: '/nanny/applications',
            timingLeft: daysLeft,
            timingUnit: 'days',
          });
          if (nannyCreated) enqueued += 1;
        }

        if (agencyId) {
          const agencyCreated = await enqueueWithLedger({
            placementId: placement.id,
            phase: rule.phase,
            recipientRole: 'agency',
            recipientId: agencyId,
            trigger: rule.phase === 'one_week' ? 'placement_ending_final' : 'placement_ending_soon',
            title: 'Placement ending reminder',
            body: `${jobTitle} is expected to end in about ${daysLeft} day(s).`,
            link: '/agency/applications',
            timingLeft: daysLeft,
            timingUnit: 'days',
          });
          if (agencyCreated) enqueued += 1;
        }
      }

      continue;
    }

    if (!isOccasionalCareType(careType)) {
      continue;
    }

    const startDate = resolveStartDate(placement);
    const startLeftMinutes = startDate ? diffMinutes(now, startDate) : Number.NaN;
    const endLeftMinutes = diffMinutes(now, endDate);

    if (Number.isFinite(startLeftMinutes) && startLeftMinutes >= 0 && startLeftMinutes <= OCCASIONAL_SOON_MINUTES) {
      if (familyId) {
        const familyStartSoon = await enqueueWithLedger({
          placementId: placement.id,
          phase: 'start_soon',
          recipientRole: 'family',
          recipientId: familyId,
          trigger: 'placement_ending_soon',
          title: 'Care starts soon',
          body: `${jobTitle} starts in about ${startLeftMinutes} minute(s).`,
          link: '/family/placements',
          timingLeft: startLeftMinutes,
          timingUnit: 'minutes',
        });
        if (familyStartSoon) enqueued += 1;
      }

      if (nannyId) {
        const nannyStartSoon = await enqueueWithLedger({
          placementId: placement.id,
          phase: 'start_soon',
          recipientRole: 'nanny',
          recipientId: nannyId,
          trigger: 'placement_ending_soon',
          title: 'Care starts soon',
          body: `${jobTitle} starts in about ${startLeftMinutes} minute(s).`,
          link: '/nanny/applications',
          timingLeft: startLeftMinutes,
          timingUnit: 'minutes',
        });
        if (nannyStartSoon) enqueued += 1;
      }
    }

    if (endLeftMinutes >= 0 && endLeftMinutes <= OCCASIONAL_SOON_MINUTES) {
      if (familyId) {
        const familyEndSoon = await enqueueWithLedger({
          placementId: placement.id,
          phase: 'end_soon',
          recipientRole: 'family',
          recipientId: familyId,
          trigger: 'placement_ending_final',
          title: 'Care ending soon',
          body: `${jobTitle} is ending in about ${endLeftMinutes} minute(s).`,
          link: '/family/placements',
          timingLeft: endLeftMinutes,
          timingUnit: 'minutes',
        });
        if (familyEndSoon) enqueued += 1;
      }

      if (nannyId) {
        const nannyEndSoon = await enqueueWithLedger({
          placementId: placement.id,
          phase: 'end_soon',
          recipientRole: 'nanny',
          recipientId: nannyId,
          trigger: 'placement_ending_final',
          title: 'Care ending soon',
          body: `${jobTitle} is ending in about ${endLeftMinutes} minute(s).`,
          link: '/nanny/applications',
          timingLeft: endLeftMinutes,
          timingUnit: 'minutes',
        });
        if (nannyEndSoon) enqueued += 1;
      }
    }
  }

  if (enqueued > 0) {
    console.log(`[placement-ending-notifier] Enqueued ${enqueued} notification job(s)`);
  }

  return enqueued;
}
