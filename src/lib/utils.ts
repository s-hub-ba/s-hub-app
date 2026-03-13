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
