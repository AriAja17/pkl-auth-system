'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Article = { id: string; title: string; content: string; createdAt: string };
type Toast = { type: 'ok' | 'error'; text: string };

export default function ArticlesPage() {
  const { me, has, loading, error } = useAuth();
  const router = useRouter();
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

  // Session is loaded once by AuthProvider; no duplicate /auth/me call here.
  useEffect(() => {
    if (!me || !has('read:article')) return;
    let active = true;
    void (async () => {
      try {
        const result = await api<Article[]>('/articles');
        if (active) setArticles(result);
      } catch (err) {
        if (active) handleError(err);
      }
    })();
    return () => {
      active = false;
    };
  }, [me, has]);

  useEffect(() => {
    if (!loading && !me && !error) router.replace('/login');
  }, [loading, me, error, router]);

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      setToast({ type: 'error', text: 'Anda tidak punya izin untuk aksi ini' });
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

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!me) return null;

  const canRead = me.canonicalPermissions.includes('read:article');
  const canCreate = me.canonicalPermissions.includes('create:article');
  const canUpdate = me.canonicalPermissions.includes('update:article');
  const canDelete = me.canonicalPermissions.includes('delete:article');
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