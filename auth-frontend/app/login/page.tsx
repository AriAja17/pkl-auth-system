'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { apiErrorText } from '@/lib/errors';
import { Button, Card, Field, Input } from '@/components/ui';

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Email wajib diisi';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Format email tidak valid. Contoh: nama@gmail.com';
    }
    if (!password) next.password = 'Password wajib diisi';
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
      const result = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      setToken(result.accessToken);
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      // Error remains visible until corrected/dismissed (ADJ-02).
      setApiError(apiErrorText(err, 'Gagal masuk. Periksa kembali kredensial Anda.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-4">
      <Card
        title="Studio Management"
        description="Masuk ke workspace"
        className="w-full max-w-[400px] p-6"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3">
          <Field label="Email" htmlFor="login-email" error={errors.email} required>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((previous) => ({ ...previous, email: undefined }));
              }}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="login-password"
            error={errors.password}
            required
          >
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
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
            {loading ? 'Memproses...' : 'Login'}
          </Button>

          <p className="text-center text-sm text-text-muted">
            Belum punya akun?{' '}
            <Link href="/register" className="text-brand-primary hover:underline">
              Daftar
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
