'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearToken, getToken } from '@/lib/api';

type Me = { id: string; email: string; role: string | null; permissions: string[] };
type Article = { id: string; title: string; content: string; createdAt: string };
type Toast = { type: 'ok' | 'error'; text: string };

export default function ArticlesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadArticles = useCallback(async () => {
    setArticles(await api<Article[]>('/articles'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    api<Me>('/auth/me')
      .then(async (m) => {
        setMe(m);
        if (m.permissions.includes('article.read')) {
          await loadArticles();
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/login');
        } else {
          setToast({ type: 'error', text: err.message });
        }
      });
  }, [router, loadArticles]);

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      router.replace('/login');
      return;
    }
    setToast({
      type: 'error',
      text: err instanceof Error ? err.message : 'Terjadi kesalahan',
    });
  }

  function resetForm() {
    setTitle('');
    setContent('');
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setToast({ type: 'error', text: 'Judul dan isi artikel wajib diisi' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api(`/articles/${editingId}`, {
          method: 'PUT',
          body: { title, content },
        });
      } else {
        await api('/articles', { method: 'POST', body: { title, content } });
      }
      const wasEditing = editingId !== null;
      resetForm();
      await loadArticles();
      setToast({
        type: 'ok',
        text: wasEditing ? 'Artikel berhasil diubah' : 'Artikel berhasil dibuat',
      });
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(article: Article) {
    setEditingId(article.id);
    setTitle(article.title);
    setContent(article.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeArticle(article: Article) {
    if (!window.confirm(`Hapus artikel "${article.title}"?`)) return;
    try {
      await api(`/articles/${article.id}`, { method: 'DELETE' });
      if (editingId === article.id) resetForm();
      await loadArticles();
      setToast({ type: 'ok', text: 'Artikel berhasil dihapus' });
    } catch (err) {
      handleError(err);
    }
  }

  if (!me) {
    return (
      <p className="p-6 text-gray-500">{toast ? toast.text : 'Memuat...'}</p>
    );
  }

  const canRead = me.permissions.includes('article.read');
  const canCreate = me.permissions.includes('article.create');
  const canUpdate = me.permissions.includes('article.update');
  const canDelete = me.permissions.includes('article.delete');
  const showForm = editingId ? canUpdate : canCreate;

  const abilities = [
    canRead && 'melihat',
    canCreate && 'membuat',
    canUpdate && 'mengedit',
    canDelete && 'menghapus',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900">
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="font-bold">
            {toast.type === 'ok' ? 'Berhasil' : 'Gagal'}
          </span>
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup">
            x
          </button>
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Artikel</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 underline">
            Kembali ke dashboard
          </Link>
        </div>

        {abilities && (
          <p className="text-sm text-gray-500">
            Izinmu di halaman ini: {abilities}.
          </p>
        )}

        {!canRead ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Role kamu belum punya izin untuk melihat artikel. Minta admin
            memberi akses.
          </div>
        ) : (
          <>
            {showForm && (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="space-y-3 rounded-xl bg-white p-4 shadow"
              >
                <h2 className="font-semibold">
                  {editingId ? 'Edit artikel' : 'Tulis artikel baru'}
                </h2>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Judul"
                  className="w-full rounded border border-gray-300 p-2"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Isi artikel"
                  rows={4}
                  className="w-full rounded border border-gray-300 p-2"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    {saving
                      ? 'Menyimpan...'
                      : editingId
                        ? 'Simpan perubahan'
                        : 'Simpan'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded border border-gray-300 px-3 py-1 text-sm"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            )}

            {articles.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow">
                Belum ada artikel.
              </p>
            ) : (
              articles.map((a) => (
                <article key={a.id} className="rounded-xl bg-white p-4 shadow">
                  <h3 className="text-lg font-semibold">{a.title}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleString('id-ID')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{a.content}</p>
                  {(canUpdate || canDelete) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {canUpdate && (
                        <button
                          onClick={() => startEdit(a)}
                          className="text-blue-600 underline"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => removeArticle(a)}
                          className="text-red-600 underline"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}