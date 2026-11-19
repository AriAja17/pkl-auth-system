// Single deterministic username generator shared by registration and the backfill
// script (doc 07 §M2.1, plan §8.6). Never use random values or timestamps.

const MAX_LENGTH = 30;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function usernameFor(email: string, used: Set<string>): string {
  const at = email.indexOf('@');
  let base = (at >= 0 ? email.slice(0, at) : email)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, MAX_LENGTH);

  if (base.length === 0) base = 'user';
  while (base.length < 3) base += '_';

  let candidate = base;
  let n = 1;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${n}`;
    candidate = base.slice(0, MAX_LENGTH - suffix.length) + suffix;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
