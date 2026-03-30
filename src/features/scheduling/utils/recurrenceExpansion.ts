// ─────────────────────────────────────────────────────────────────────────────
// Recurrence Expansion Utility
// MVP choice: expand recurring events into CHILD INSTANCES on write.
// Pro: simple Firestore queries (no on-read expansion), per-instance overrides.
// Con: writes more documents; acceptable at MVP scale.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecurrenceRule } from '../types/scheduling';

export interface TimeWindow {
  startAt: Date;
  endAt: Date;
  instanceIndex: number;
}

const MAX_INSTANCES = 365; // Hard cap to prevent runaway expansion

/**
 * Given a start/end pair and a recurrence rule, returns all concrete
 * time windows for the series (excluding the parent/first occurrence).
 *
 * The PARENT event itself is written with the original start/end.
 * This function returns the CHILD instances (index 1..n).
 *
 * @example
 * expandRecurrence(start, end, { enabled: true, frequency: 'weekly', daysOfWeek: [1,3], endsOn: someDate })
 */
export function expandRecurrence(
  parentStart: Date,
  parentEnd: Date,
  rule: RecurrenceRule,
): TimeWindow[] {
  if (!rule.enabled || !rule.frequency) return [];

  const duration = parentEnd.getTime() - parentStart.getTime();
  const interval = Math.max(1, rule.interval ?? 1);
  const instances: TimeWindow[] = [];

  const endDate = rule.endsOn
    ? new Date((rule.endsOn as any).toDate?.() ?? rule.endsOn)
    : null;
  const maxOccurrences = Math.min(
    rule.occurrences ?? MAX_INSTANCES,
    MAX_INSTANCES,
  );

  if (rule.frequency === 'daily') {
    let current = advanceDays(parentStart, interval);
    let idx = 1;

    while (instances.length < maxOccurrences - 1) {
      if (endDate && current > endDate) break;
      instances.push({
        startAt: new Date(current),
        endAt: new Date(current.getTime() + duration),
        instanceIndex: idx,
      });
      current = advanceDays(current, interval);
      idx++;
    }
  } else if (rule.frequency === 'weekly') {
    const targetDays = rule.daysOfWeek?.length
      ? rule.daysOfWeek
      : [parentStart.getDay()]; // default to parent's day of week

    // Start from the day after the parent to avoid duplicating parent
    let cursor = advanceDays(parentStart, 1);
    let idx = 1;

    while (instances.length < maxOccurrences - 1) {
      if (endDate && cursor > endDate) break;

      if (targetDays.includes(cursor.getDay())) {
        // Check weekly interval: only emit if we're within the correct week boundary
        const weeksSinceParent = Math.floor(
          (cursor.getTime() - parentStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        if (weeksSinceParent % interval === 0 || targetDays.length > 1) {
          // Align start time to cursor date while keeping the original HH:mm
          const slotStart = combineDateAndTime(cursor, parentStart);
          instances.push({
            startAt: slotStart,
            endAt: new Date(slotStart.getTime() + duration),
            instanceIndex: idx,
          });
          idx++;
          if (instances.length >= maxOccurrences - 1) break;
        }
      }

      cursor = advanceDays(cursor, 1);

      // Safety valve: stop after scanning 2 years of days
      if (cursor.getTime() - parentStart.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) break;
    }
  }

  return instances;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function advanceDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Takes the date from `dateSource` and the time from `timeSource`. */
function combineDateAndTime(dateSource: Date, timeSource: Date): Date {
  const result = new Date(dateSource);
  result.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    0,
  );
  return result;
}
