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
