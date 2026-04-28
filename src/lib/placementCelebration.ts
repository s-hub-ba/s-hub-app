export const toPlacementCelebrationMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const buildPlacementCelebrationKey = (
  audience: 'agency' | 'family' | 'nanny',
  viewerId: string,
  applicationId: string,
  activeAt: any
) => `placement-seal:${audience}:${viewerId}:${applicationId}:${toPlacementCelebrationMillis(activeAt)}`;

export const consumePlacementCelebrationKey = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.localStorage.getItem(key)) return false;
  window.localStorage.setItem(key, '1');
  return true;
};

export const hasSeenPlacementCelebration = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
};
