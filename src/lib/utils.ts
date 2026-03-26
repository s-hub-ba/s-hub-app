import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateShiftScore(
  reviews: { rating: number }[],
  completedShifts: number,
  certifications: number
): number {
  if (completedShifts === 0) return 50; // Base score for new nannies

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length
      : 5;

  // Weightings: Rating (60%), Shifts (30%), Certs (10%)
  // Rating: 5.0 = 60 points
  // Shifts: 50+ = 30 points
  // Certs: 3+ = 10 points

  const ratingScore = (avgRating / 5) * 60;
  const shiftsScore = Math.min((completedShifts / 50) * 30, 30);
  const certsScore = Math.min((certifications / 3) * 10, 10);

  return Math.round(ratingScore + shiftsScore + certsScore);
}

export function getShiftScoreTier(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Professional';
  if (score >= 60) return 'Emerging';
  return 'Developing';
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof candidate.seconds === 'number') {
      const date = new Date(candidate.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatJobSchedule(job: {
  schedule_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string[] | null;
  schedule_summary?: string | null;
  schedule?: string | null;
}): string {
  if (job.schedule_type === 'date_range') {
    return `Date range: ${job.start_date || 'TBD'} to ${job.end_date || 'TBD'}`;
  }

  if (job.schedule_type === 'weekly_days') {
    const selectedDays = Array.isArray(job.weekdays) ? job.weekdays.filter(Boolean) : [];
    return `Weekdays: ${selectedDays.join(', ') || 'Not specified'}`;
  }

  if (job.schedule_summary) return job.schedule_summary;
  if (job.schedule) return job.schedule;
  return 'Schedule not specified';
}
