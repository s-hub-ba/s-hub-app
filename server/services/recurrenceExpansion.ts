// Server-side copy of recurrenceExpansion
// Mirrors src/features/scheduling/utils/recurrenceExpansion.ts

import type { RecurrenceRule } from './scheduling.ts';

export interface TimeWindow {
  startAt: Date;
  endAt: Date;
  instanceIndex: number;
}

const MAX_INSTANCES = 365;

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
  const maxOccurrences = Math.min(rule.occurrences ?? MAX_INSTANCES, MAX_INSTANCES);

  if (rule.frequency === 'daily') {
    let current = advanceDays(parentStart, interval);
    let idx = 1;
    while (instances.length < maxOccurrences - 1) {
      if (endDate && current > endDate) break;
      instances.push({ startAt: new Date(current), endAt: new Date(current.getTime() + duration), instanceIndex: idx });
      current = advanceDays(current, interval);
      idx++;
    }
  } else if (rule.frequency === 'weekly') {
    const targetDays = rule.daysOfWeek?.length ? rule.daysOfWeek : [parentStart.getDay()];
    let cursor = advanceDays(parentStart, 1);
    let idx = 1;
    while (instances.length < maxOccurrences - 1) {
      if (endDate && cursor > endDate) break;
      if (targetDays.includes(cursor.getDay())) {
        const weeksSince = Math.floor((cursor.getTime() - parentStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksSince % interval === 0 || targetDays.length > 1) {
          const slotStart = combineDateAndTime(cursor, parentStart);
          instances.push({ startAt: slotStart, endAt: new Date(slotStart.getTime() + duration), instanceIndex: idx });
          idx++;
          if (instances.length >= maxOccurrences - 1) break;
        }
      }
      cursor = advanceDays(cursor, 1);
      if (cursor.getTime() - parentStart.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) break;
    }
  }

  return instances;
}

function advanceDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function combineDateAndTime(dateSource: Date, timeSource: Date): Date {
  const result = new Date(dateSource);
  result.setHours(timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), 0);
  return result;
}
