const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s0-9]*$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!PHONE_REGEX.test(trimmed)) return false;

  const digitCount = (trimmed.match(/\d/g) || []).length;
  return digitCount >= 10;
}
