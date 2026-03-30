function deriveSixDigits(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000000;
  }
  return String(hash).padStart(6, '0');
}

export function buildNannyCvid(uid: string, firstName = '', lastName = ''): string {
  const normalizedSeed = `${String(uid || '').trim()}|${String(firstName || '').trim()}|${String(lastName || '').trim()}`;
  return deriveSixDigits(normalizedSeed);
}

export function normalizeCvid(value?: string | null): string | null {
  if (!value) return null;
  const digitsOnly = String(value).replace(/\D/g, '');
  if (digitsOnly.length < 6) return null;
  return digitsOnly.slice(-6);
}

export function getDisplayCvid(input: { cvid?: string | null; id?: string; first_name?: string; last_name?: string }): string {
  const normalized = normalizeCvid(input.cvid);
  if (normalized) return normalized;
  return buildNannyCvid(String(input.id || ''), input.first_name || '', input.last_name || '');
}

export function getShortUid(uid: string, visible = 8): string {
  const value = String(uid || '');
  if (value.length <= visible) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
