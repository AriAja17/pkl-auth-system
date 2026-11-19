import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_LIMIT = 10;
const DEFAULT_TTL_MS = 900_000; // 15 menit

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} harus integer positif (diterima: ${raw})`);
  }
  return value;
}

/**
 * Rate limit hanya untuk POST /auth/login.
 *
 * Catatan operasional:
 * - ThrottlerStorage bawaan menyimpan hitungan di memory setiap process.
 *   Jika aplikasi berjalan pada beberapa instance, tiap instance memiliki
 *   batasnya sendiri (bukan batas global). Tidak ada Redis/distributed store.
 * - Tracker memakai `req.ip` dari Express. Karena `trust proxy` tidak diaktifkan,
 *   header X-Forwarded-For tidak dipercaya langsung sebagai identitas klien.
 */
export function loginThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        limit: positiveInteger('AUTH_LOGIN_RATE_LIMIT', DEFAULT_LIMIT),
        ttl: positiveInteger('AUTH_LOGIN_RATE_TTL_MS', DEFAULT_TTL_MS),
      },
    ],
  };
}
