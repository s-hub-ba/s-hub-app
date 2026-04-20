import { db } from '../firebase.js';
import { enqueueNotification } from './notificationService.ts';

type PlacementRecord = {
  id: string;
  nanny_id?: string;
  end_date?: string;
  start_date?: string;
  placement_status?: string;
  job_title?: string;
  job_type?: string;
};

const CARE_HISTORY_COLLECTION = 'care_history';
const TALENT_POOL_COLLECTION = 'agency_talent_pool';
const ALERT_LEDGER_COLLECTION = 'placement_end_alerts';

const DEFAULT_SOON_DAYS = Number(process.env.PLACEMENT_ENDING_SOON_DAYS || 14);
const DEFAULT_FINAL_REMINDER_DAYS = Number(process.env.PLACEMENT_ENDING_FINAL_DAYS || 3);

function parseDateSafe(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function isLongTermPlacement(placement: PlacementRecord, now: Date, endDate: Date): boolean {
  const jobType = String(placement.job_type || '').toLowerCase();
  if (jobType.includes('long')) return true;

  const startDate = parseDateSafe(placement.start_date);
  if (!startDate) return false;

  const totalDurationDays = diffDays(startDate, endDate);
  const elapsedDays = diffDays(startDate, now);

  // Heuristic: treat as long-term if the placement was planned for at least 8 weeks
  // and has been active for at least 2 weeks.
  return totalDurationDays >= 56 && elapsedDays >= 14;
}

async function getAcceptedTalentPoolAgencies(nannyId: string): Promise<string[]> {
  const snap = await db
    .collection(TALENT_POOL_COLLECTION)
    .where('nanny_id', '==', nannyId)
    .where('invitation_status', '==', 'accepted')
    .get();

  return Array.from(new Set(
    snap.docs
      .map((doc) => String(doc.data()?.agency_id || '').trim())
      .filter(Boolean),
  ));
}

async function enqueueWithLedger(options: {
  placementId: string;
  phase: 'soon' | 'final';
  recipientRole: 'agency' | 'nanny';
  recipientId: string;
  trigger: 'placement_ending_soon' | 'placement_ending_final';
  title: string;
  body: string;
  link: string;
  daysLeft: number;
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
      days_left: options.daysLeft,
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
      daysLeft: String(options.daysLeft),
    },
  });

  return true;
}

export async function processPlacementEndingSoonNotifications(): Promise<number> {
  const now = new Date();
  const nowIso = now.toISOString();
  const soonThreshold = new Date(now.getTime() + DEFAULT_SOON_DAYS * 24 * 60 * 60 * 1000);

  // end_date is stored as ISO text in care_history; lexicographic range works.
  const snap = await db
    .collection(CARE_HISTORY_COLLECTION)
    .where('placement_status', '==', 'active')
    .where('end_date', '>=', nowIso)
    .where('end_date', '<=', soonThreshold.toISOString())
    .get();

  if (snap.empty) return 0;

  let enqueued = 0;

  for (const doc of snap.docs) {
    const placement = { id: doc.id, ...(doc.data() as Record<string, any>) } as PlacementRecord;
    const nannyId = String(placement.nanny_id || '').trim();
    if (!nannyId) continue;

    const endDate = parseDateSafe(placement.end_date);
    if (!endDate) continue;
    if (!isLongTermPlacement(placement, now, endDate)) continue;

    const daysLeft = Math.max(0, diffDays(now, endDate));
    const jobTitle = String(placement.job_title || 'a current placement');

    const agencyIds = await getAcceptedTalentPoolAgencies(nannyId);

    for (const agencyId of agencyIds) {
      const created = await enqueueWithLedger({
        placementId: placement.id,
        phase: 'soon',
        recipientRole: 'agency',
        recipientId: agencyId,
        trigger: 'placement_ending_soon',
        title: 'Talent pool nanny ending current placement soon',
        body: `A nanny in your talent pool is finishing ${jobTitle} in about ${daysLeft} day(s).`,
        link: '/agency/talent-pool',
        daysLeft,
      });

      if (created) enqueued += 1;
    }

    const nannySoonCreated = await enqueueWithLedger({
      placementId: placement.id,
      phase: 'soon',
      recipientRole: 'nanny',
      recipientId: nannyId,
      trigger: 'placement_ending_soon',
      title: 'Your placement is ending soon',
      body: `Your placement for ${jobTitle} is expected to end in about ${daysLeft} day(s).`,
      link: '/nanny/applications',
      daysLeft,
    });

    if (nannySoonCreated) enqueued += 1;

    if (daysLeft <= DEFAULT_FINAL_REMINDER_DAYS) {
      const nannyFinalCreated = await enqueueWithLedger({
        placementId: placement.id,
        phase: 'final',
        recipientRole: 'nanny',
        recipientId: nannyId,
        trigger: 'placement_ending_final',
        title: 'Final reminder: placement ending very soon',
        body: `Reminder: your placement for ${jobTitle} is ending in about ${daysLeft} day(s).`,
        link: '/nanny/applications',
        daysLeft,
      });

      if (nannyFinalCreated) enqueued += 1;
    }
  }

  if (enqueued > 0) {
    console.log(`[placement-ending-notifier] Enqueued ${enqueued} notification job(s)`);
  }

  return enqueued;
}
