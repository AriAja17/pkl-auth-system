import { Matches, ValidationOptions } from 'class-validator';

/** Canonical permission keys: action:resource (doc 06 §1). */
export const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

/** Menu URLs must be absolute paths; never protocol-relative or javascript:. */
export const MENU_URL_PATTERN = /^\/(?!\/)[^\s]*$/;

/** PrimeIcons class tokens, e.g. `pi pi-users` or `pi-list-fw pi-bars`. */
export const PRIMEICON_PATTERN = /^(pi[a-z0-9-]*)(\s+pi[a-z0-9-]*)*$/i;

export const IsPermissionKey = (options?: ValidationOptions) =>
  Matches(PERMISSION_KEY_PATTERN, {
    message: 'Permission key harus berformat action:resource',
    ...options,
  });

export const IsMenuUrl = (options?: ValidationOptions) =>
  Matches(MENU_URL_PATTERN, {
    message: 'URL menu harus diawali / dan merupakan path absolut',
    ...options,
  });

export const IsPrimeIcon = (options?: ValidationOptions) =>
  Matches(PRIMEICON_PATTERN, {
    message: 'Icon harus berupa kelas PrimeIcons',
    ...options,
  });
