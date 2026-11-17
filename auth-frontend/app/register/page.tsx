'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!email.trim()) return 'Email wajib diisi';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Format email tidak valid. Email harus mengandung @ dan domain, contoh: nama@gmail.com';
    }
    if (password.length < 8) return 'Password minimal 8 karakter';
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
      await api('/auth/register', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow text-gray-900">
        <h1 className="text-2xl font-bold mb-1">Daftar</h1>
        <p className="text-sm text-gray-500 mb-4">
          Akun baru belum punya akses sampai admin memberi role.
        </p>

        {success ? (
          <div className="space-y-3">
            <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              Akun berhasil dibuat. Silakan login, lalu minta admin memberi role.
            </p>
            <Link href="/login" className="text-blue-600 underline text-sm">
              Ke halaman login
            </Link>
          </div>
        ) : (
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
              placeholder="Password (min. 8 karakter)"
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
              {loading ? 'Memproses...' : 'Daftar'}
            </button>
            <p className="text-sm text-gray-500">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-blue-600 underline">
                Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}