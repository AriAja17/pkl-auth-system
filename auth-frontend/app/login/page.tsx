'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!email.trim()) return 'Email wajib diisi';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Format email tidak valid. Contoh: nama@gmail.com';
    }
    if (!password) return 'Password wajib diisi';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      setToken(res.accessToken);
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow text-gray-900">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
          {error && (
            <div
              role="alert"
              className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Login'}
          </button>
          <p className="text-sm text-gray-500">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-600 underline">
              Daftar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}