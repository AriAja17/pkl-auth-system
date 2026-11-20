'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Textarea,
  Toast,
  type ToastState,
} from '@/components/ui';
import PageHeader from '@/components/page-header';

type Article = { id: string; title: string; content: string; createdAt: string };
type FormState = { title: string; content: string };
type FieldErrors = { title?: string; content?: string };
type ConfirmState = {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

const emptyForm: FormState = { title: '', content: '' };

export default function ArticlesPage() {
  const { me, has, loading, error } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const [saving, setSaving] = useState(false);

  const canRead = has('read:article');
  const canCreate = has('create:article');
  const canUpdate = has('update:article');
  const canDelete = has('delete:article');

  const loadArticles = useCallback(async () => {
    const result = await api<Article[]>('/articles');
    setArticles(result);
    setLoadError('');
  }, []);

  // Session is loaded once by AuthProvider; no duplicate /auth/me call here.
  useEffect(() => {
    if (loading || !me || !canRead) return;
    let active = true;
    void (async () => {
      try {
        const result = await api<Article[]>('/articles');
        if (active) {
          setArticles(result);
          setLoadError('');
        }
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setLoadError(apiErrorText(err, 'Gagal memuat artikel.'));
      }
    })();
    return () => {
      active = false;
    };
  }, [loading, me, canRead, router]);

  useEffect(() => {
    if (!loading && !me && !error) router.replace('/login');
  }, [loading, me, error, router]);

  function openCreate() {
    setEditingId(null);
    setFormErrors({});
    setForm({ ...emptyForm });
  }

  function startEdit(article: Article) {
    setEditingId(article.id);
    setFormErrors({});
    setForm({ title: article.title, content: article.content });
  }

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
  }

  async function submit() {
    if (!form) return;
    const found: FieldErrors = {};
    if (!form.title.trim()) found.title = 'Judul wajib diisi';
    if (!form.content.trim()) found.content = 'Isi artikel wajib diisi';
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      if (editingId) {
        await api(`/articles/${editingId}`, {
          method: 'PUT',
          body: { title: form.title, content: form.content },
        });
      } else {
        await api('/articles', {
          method: 'POST',
          body: { title: form.title, content: form.content },
        });
      }
      setToast({
        type: 'ok',
        text: editingId
          ? 'Artikel berhasil diubah'
          : 'Artikel berhasil dibuat',
      });
      setForm(null);
      setEditingId(null);
      await loadArticles();
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(article: Article) {
    setDialog({
      title: 'Hapus artikel?',
      text: `Artikel "${article.title}" akan dihapus permanen.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            await api(`/articles/${article.id}`, { method: 'DELETE' });
            setToast({ type: 'ok', text: 'Artikel berhasil dihapus' });
            await loadArticles();
          } catch (err) {
            reportError(err);
          }
        })();
      },
    });
  }

  if (loading) {
    return <LoadingState label="Memuat sesi..." rows={3} />;
  }
  if (error || !me) {
    return (
      <ErrorState
        message={error ?? 'Sesi tidak ditemukan. Silakan masuk kembali.'}
      />
    );
  }

  const abilities = [
    canRead && 'melihat',
    canCreate && 'membuat',
    canUpdate && 'mengedit',
    canDelete && 'menghapus',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Artikel"
        description={
          <>
            {abilities ? `Izinmu: ${abilities}. ` : ''}
            Halaman contoh konten dengan permission kanonik.
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            {canCreate && <Button onClick={openCreate}>Tulis artikel</Button>}
          </div>
        }
      />

      {!canRead ? (
        <EmptyState
          title="Tidak ada akses"
          text="Role kamu belum punya izin untuk melihat artikel. Minta admin memberi akses."
        />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : articles === null ? (
        <LoadingState rows={3} />
      ) : articles.length === 0 ? (
        <EmptyState title="Belum ada artikel" text="Belum ada konten yang dibuat." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {articles.map((article) => (
            <Card
              key={article.id}
              title={article.title}
              description={new Date(article.createdAt).toLocaleString('id-ID')}
              titleSize="card"
            >
              <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                {article.content}
              </p>
              {(canUpdate || canDelete) && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-divider pt-3">
                  {canUpdate && (
                    <Button variant="link" size="sm" onClick={() => startEdit(article)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger"
                      onClick={() => requestDelete(article)}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={editingId ? 'Edit artikel' : 'Artikel baru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="Judul" htmlFor="article-title" error={formErrors.title} required>
              <Input
                id="article-title"
                value={form.title}
                invalid={Boolean(formErrors.title)}
                aria-describedby={formErrors.title ? 'article-title-error' : undefined}
                onChange={(event) => {
                  setForm({ ...form, title: event.target.value });
                  setFormErrors((previous) => ({ ...previous, title: undefined }));
                }}
              />
            </Field>
            <Field label="Isi artikel" htmlFor="article-content" error={formErrors.content} required>
              <Textarea
                id="article-content"
                rows={6}
                value={form.content}
                invalid={Boolean(formErrors.content)}
                aria-describedby={formErrors.content ? 'article-content-error' : undefined}
                onChange={(event) => {
                  setForm({ ...form, content: event.target.value });
                  setFormErrors((previous) => ({ ...previous, content: undefined }));
                }}
              />
            </Field>
          </div>
        )}
      </Drawer>
    </div>
  );
}
