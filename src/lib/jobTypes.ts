export type CanonicalCareType = 'full-time' | 'part-time' | 'occasional' | 'last-minute';
export type PlacementBucket = 'full-time' | 'part-time' | 'recurring' | 'occasional' | 'last-minute';

export function normalizeJobTypeValue(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return '';
  if (normalized === 'full time' || normalized === 'fulltime') return 'full-time';
  if (normalized === 'part time' || normalized === 'parttime') return 'part-time';
  if (normalized === 'last minute') return 'last-minute';
  if (normalized === 'temporary') return 'occasional';
  if (normalized === 'date night') return 'date-night';
  if (normalized === 'live in') return 'live-in';
  if (normalized === 'live out') return 'live-out';

  return normalized;
}

export function formatJobTypeLabel(value: unknown): string {
  switch (normalizeJobTypeValue(value)) {
    case 'full-time':
      return 'Full-Time';
    case 'part-time':
      return 'Part-Time';
    case 'occasional':
      return 'Occasional';
    case 'last-minute':
      return 'Last Minute';
    case 'overnight':
      return 'Overnight';
    case 'date-night':
      return 'Date Night';
    case 'live-in':
      return 'Live-In';
    case 'live-out':
      return 'Live-Out';
    case 'recurring':
      return 'Recurring';
    default: {
      const raw = String(value || '').trim();
      return raw || 'Care';
    }
  }
}

export const formatCareTypeLabel = formatJobTypeLabel;

export function classifyPlacementBucket(input: {
  scheduleType?: unknown;
  jobType?: unknown;
  title?: unknown;
  description?: unknown;
}): PlacementBucket | null {
  const scheduleType = normalizeJobTypeValue(input.scheduleType);
  const jobType = normalizeJobTypeValue(input.jobType);
  const content = [
    scheduleType,
    jobType,
    normalizeJobTypeValue(input.title),
    normalizeJobTypeValue(input.description),
  ].join(' ');

  const includesAny = (tokens: string[]) => tokens.some((token) => content.includes(token));

  const hasFullTime = includesAny(['full-time']);
  const hasPartTime = includesAny(['part-time']);
  const hasRecurring = includesAny(['weekly_days', 'recurring', 'recurrence', 'weekly', 'repeating', 'repeat']);
  const hasLastMinute = includesAny(['last-minute', 'urgent', 'short notice']);
  const hasOccasional = includesAny(['occasional', 'temporary', 'one-time', 'one time', 'backup', 'date-night', 'date night', 'weekend']);

  if (hasLastMinute) return 'last-minute';
  if (hasOccasional && !hasRecurring && !hasFullTime && !hasPartTime) return 'occasional';
  if (hasFullTime) return 'full-time';
  if (hasPartTime) return 'part-time';
  if (hasRecurring) return 'recurring';

  return null;
}