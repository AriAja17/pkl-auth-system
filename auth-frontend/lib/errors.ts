import { clearToken, ApiError } from './api';

type RouterLike = { replace: (href: string) => void };

/** Shared interpretation of API failures; preserves status-code distinctions. */
export function apiErrorText(err: unknown, fallback = 'Terjadi kesalahan'): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return 'Sesi berakhir. Silakan masuk kembali.';
      case 403:
        return 'Anda tidak punya izin untuk aksi ini.';
      case 404:
        return 'Data tidak ditemukan.';
      case 409:
        return 'Data sudah terdaftar atau masih dipakai.';
      case 422:
        return err.message || 'Periksa kembali data yang dikirim.';
      default:
        return err.message || fallback;
    }
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** Returns true when the caller should stop processing (session was cleared). */
export function handleUnauthorized(err: unknown, router: RouterLike): boolean {
  if (!isUnauthorized(err)) return false;
  clearToken();
  router.replace('/login');
  return true;
}
