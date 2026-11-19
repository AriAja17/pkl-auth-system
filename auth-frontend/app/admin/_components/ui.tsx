'use client';

import { useEffect } from 'react';

export type ToastState = { type: 'ok' | 'error'; text: string };

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
        toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      <span className="font-bold">{toast.type === 'ok' ? 'Berhasil' : 'Gagal'}</span>
      <span className="flex-1">{toast.text}</span>
      <button onClick={onClose} aria-label="Tutup">
        x
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel = 'Ya',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className={`rounded px-3 py-1 text-sm text-white ${
              danger ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
      <span className="text-gray-500">
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
        >
          Sebelumnya
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

export function LoadingState() {
  return <p className="p-6 text-gray-500">Memuat...</p>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">{text}</p>
  );
}
