const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const DEFAULT_GITHUB_PAGES_API_BASE = 'https://s-hub-app.onrender.com';

export function getApiBaseUrl(): string {
  const normalized = RAW_API_BASE_URL.replace(/\/$/, '');
  if (normalized) return normalized;

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    console.warn('Missing VITE_API_BASE_URL. Falling back to default hosted API endpoint.');
    return DEFAULT_GITHUB_PAGES_API_BASE;
  }

  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}
