import crypto from 'crypto';

const DEV_FALLBACK_SECRET = 'shift-me-up-dev-only-scheduling-secret';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

function resolveSecret(): string {
  const secret = process.env.SCHEDULING_LOCATION_SECRET;
  if (secret && secret.trim()) return secret.trim();

  if (process.env.NODE_ENV !== 'production') {
    return DEV_FALLBACK_SECRET;
  }

  throw new Error('Missing SCHEDULING_LOCATION_SECRET for encrypted scheduling locations');
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptLocationExact(value?: string | null): EncryptedPayload | null {
  if (!value) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(resolveSecret());
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptLocationExact(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  const payload = value as Partial<EncryptedPayload>;
  if (payload.v !== 1 || !payload.iv || !payload.tag || !payload.ciphertext) {
    return null;
  }

  const key = deriveKey(resolveSecret());
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
