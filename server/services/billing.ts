export const PRICING = {
  BASE_PRICE: 29.00,
  SEAT_PRICE: 5.00,
  INCLUDED_SEATS: 1
};

/**
 * Calculates the total monthly subscription price based on the number of recruiters.
 * Formula: 29 + (additional_recruiters * 5)
 * The first recruiter is included in the base price.
 */
export function calculateSubscriptionPrice(totalRecruiters: number): number {
  if (totalRecruiters <= 0) return 0;
  
  const additionalRecruiters = Math.max(0, totalRecruiters - PRICING.INCLUDED_SEATS);
  const totalPrice = PRICING.BASE_PRICE + (additionalRecruiters * PRICING.SEAT_PRICE);
  
  return Number(totalPrice.toFixed(2));
}
