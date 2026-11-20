'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { Button, Card, Field, Input } from '@/components/ui';

type FieldErrors = {
  email?: string;
  username?: string;
  password?: string;
};

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Email wajib diisi';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email =
        'Format email tidak valid. Contoh: nama@gmail.com';
    }
    if (username.trim() && !/^[a-z0-9_]{3,30}$/.test(username.trim())) {
      next.username = 'Username harus 3-30 karakter [a-z0-9_]';
    }
    if (password.length < 6) next.password = 'Password minimal 6 karakter';
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setApiError('');
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const name = username.trim();
      await api('/auth/register', {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
          ...(name ? { username: name } : {}),
        },
      });
      setSuccess(true);
    } catch (err) {
      setApiError(apiErrorText(err, 'Gagal membuat akun.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-4">
      <Card
        as="h1"
        titleSize="page"
        title="Daftar"
        description="Akun baru belum punya akses sampai admin memberi role."
        className="w-full max-w-[400px] p-6"
      >
        {success ? (
          <div className="mt-5 space-y-3">
            <p
              role="status"
              className="rounded-sm border border-success bg-success-surface p-3 text-sm text-success"
            >
              Akun berhasil dibuat. Silakan masuk, lalu minta admin memberi role.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-brand-primary hover:underline"
            >
              Ke halaman login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3">
            <Field label="Email" htmlFor="register-email" error={errors.email} required>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                className="h-10"
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((previous) => ({ ...previous, email: undefined }));
                }}
              />
            </Field>

            <Field
              label="Username (opsional)"
              htmlFor="register-username"
              error={errors.username}
              hint="3-30 karakter, huruf kecil, angka, atau underscore"
            >
              <Input
                id="register-username"
                value={username}
                className="h-10"
                invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? 'register-username-error' : undefined}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setErrors((previous) => ({ ...previous, username: undefined }));
                }}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="register-password"
              error={errors.password}
              required
            >
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                className="h-10"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((previous) => ({ ...previous, password: undefined }));
                }}
              />
            </Field>

            {apiError && (
              <div
                role="alert"
                className="rounded-sm border border-danger bg-danger-surface p-3 text-sm text-danger"
              >
                {apiError}
                <button
                  type="button"
                  onClick={() => setApiError('')}
                  aria-label="Tutup pesan error"
                  className="ml-2 underline"
                >
                  Tutup
                </button>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Memproses...' : 'Daftar'}
            </Button>

            <p className="text-center text-sm text-text-muted">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-brand-primary hover:underline">
                Login
              </Link>
            </p>
          </form>
        )}
      </Card>
    </main>
  );
}
