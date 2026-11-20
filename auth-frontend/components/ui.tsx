'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white border border-brand-primary hover:bg-brand-primary-hover active:bg-brand-primary-active',
  secondary:
    'bg-surface text-text-secondary border border-border-strong hover:bg-brand-primary-subtle',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-brand-primary-subtle',
  danger: 'bg-danger text-white border border-danger hover:brightness-95',
  link: 'bg-transparent text-brand-primary border border-transparent underline-offset-2 hover:underline px-0',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:bg-disabled-surface disabled:text-disabled-text disabled:border-disabled-surface',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * RowMenu — portal-based so table containers with overflow-x cannot clip it
 * ------------------------------------------------------------------ */

export type RowMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export function RowMenu({
  items,
  label = 'More',
}: {
  items: RowMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 176;
    const estimatedHeight = items.length * 34 + 8;
    const flip = window.innerHeight - rect.bottom < estimatedHeight + 8;
    setPosition({
      top: flip
        ? Math.max(8, rect.top - estimatedHeight - 4)
        : rect.bottom + 4,
      left: Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
      ),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="link"
        size="sm"
        onClick={show}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left }}
            className="fixed z-[55] w-44 rounded-md border border-border-subtle bg-surface p-1 shadow-2"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cx(
                  'block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-brand-primary-subtle',
                  item.danger
                    ? 'text-danger hover:bg-danger-surface'
                    : 'text-text-secondary',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Field / Input / Textarea / Select / Checkbox
 * ------------------------------------------------------------------ */

export type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-text-secondary"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-sm border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-disabled-surface disabled:text-disabled-text';
const CONTROL_BORDER = 'border-border-strong';
const CONTROL_ERROR = 'border-danger';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(
        CONTROL_BASE,
        'h-9',
        invalid ? CONTROL_ERROR : CONTROL_BORDER,
        className,
      )}
      {...rest}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          CONTROL_BASE,
          'min-h-20 py-2',
          invalid ? CONTROL_ERROR : CONTROL_BORDER,
          className,
        )}
        {...rest}
      />
    );
  },
);

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid, className, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          CONTROL_BASE,
          'h-9 cursor-pointer',
          invalid ? CONTROL_ERROR : CONTROL_BORDER,
          className,
        )}
        {...rest}
      />
    );
  },
);

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, hint, className, id, ...rest }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex items-start gap-2">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cx(
            'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-border-strong text-brand-primary accent-brand-primary disabled:cursor-not-allowed',
            className,
          )}
          {...rest}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm text-text-primary">
          <span className="block">{label}</span>
          {hint && <span className="block text-xs text-text-muted">{hint}</span>}
        </label>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ *
 * Badge / Card / Table
 * ------------------------------------------------------------------ */

export type BadgeVariant =
  | 'discipline'
  | 'access'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  discipline:
    'bg-brand-secondary-subtle border-border-discipline text-text-secondary',
  access:
    'bg-brand-primary-subtle border-border-access text-brand-primary',
  success: 'bg-success-surface border-success text-success',
  warning: 'bg-warning-surface border-warning text-warning',
  danger: 'bg-danger-surface border-danger text-danger',
  info: 'bg-info-surface border-info text-info',
  neutral: 'bg-surface-subtle border-border-subtle text-text-secondary',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium',
        BADGE_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const CARD_TITLE_SIZES = {
  page: 'text-page-title',
  section: 'text-section-title',
  card: 'text-card-title',
} as const;

export function Card({
  title,
  description,
  titleSize = 'section',
  as = 'h2',
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  description?: ReactNode;
  /** Visual hierarchy: page = 24px, section = 18px, card = 16px. */
  titleSize?: keyof typeof CARD_TITLE_SIZES;
  /** Heading level, so a page can keep exactly one H1. */
  as?: 'h1' | 'h2' | 'h3';
}) {
  const Heading = as;
  return (
    <section
      className={cx(
        'rounded-md border border-border-subtle bg-surface p-4',
        className,
      )}
      {...rest}
    >
      {title && (
        <Heading
          className={cx(
            'font-semibold text-text-primary',
            CARD_TITLE_SIZES[titleSize],
          )}
        >
          {title}
        </Heading>
      )}
      {description && (
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      )}
      {children}
    </section>
  );
}

export function Table({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-border-subtle bg-surface">
      <table
        className={cx('w-full min-w-[640px] text-sm text-text-primary', className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx(
        'border-b border-border-subtle bg-canvas px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cx('border-b border-divider px-3 py-2 align-middle', className)}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ *
 * Drawer / Modal (accessible dialogs)
 * ------------------------------------------------------------------ */

function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        : [];

    (focusables()[0] ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  return panelRef;
}

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-2 outline-none sm:w-[480px] xl:w-[720px]',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-text-primary">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup drawer">
            Tutup
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'dialog' | 'alertdialog';
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'dialog',
}: ModalProps) {
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div
        className="absolute inset-0 bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role={variant}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-[420px] rounded-lg bg-surface p-5 shadow-2 outline-none"
      >
        <h2 id={titleId} className="text-base font-semibold text-text-primary">
          {title}
        </h2>
        <div className="mt-2">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
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
    <Modal
      open
      onClose={onCancel}
      title={title}
      variant="alertdialog"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">{text}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Toast (ADJ-02)
 * ------------------------------------------------------------------ */

export type ToastType = 'ok' | 'success' | 'info' | 'error';
export type ToastState = { type: ToastType; text: string };

const TOAST_ACCENT: Record<ToastType, string> = {
  ok: 'bg-success',
  success: 'bg-success',
  info: 'bg-info',
  error: 'bg-danger',
};

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timer = setTimeout(() => closeRef.current(), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const isError = toast.type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="fixed right-4 top-4 z-[60] flex w-full max-w-[360px] items-start gap-3 overflow-hidden rounded-md bg-surface p-4 shadow-toast"
    >
      <span
        aria-hidden="true"
        className={cx('absolute inset-y-0 left-0 w-1', TOAST_ACCENT[toast.type])}
      />
      <div className="min-w-0 flex-1 pl-1">
        <p className="text-sm font-semibold text-text-primary">
          {isError ? 'Gagal' : toast.type === 'info' ? 'Informasi' : 'Berhasil'}
        </p>
        <p className="mt-0.5 text-sm text-text-secondary">{toast.text}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup notifikasi"
        className="rounded-sm px-1 text-text-muted hover:text-text-primary"
      >
        ×
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Loading / Empty / Error / Pagination
 * ------------------------------------------------------------------ */

export function LoadingState({
  label = 'Memuat...',
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-2 p-4">
      <p className="sr-only">{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-10 animate-pulse rounded-sm bg-surface-subtle"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  text,
  title = 'Tidak ada data',
  action,
  className,
}: {
  text?: string;
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-surface px-4 py-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {text && <p className="text-sm text-text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  title = 'Terjadi kesalahan',
  onRetry,
  className,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cx(
        'rounded-md border border-danger bg-danger-surface p-4',
        className,
      )}
    >
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
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
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, Math.max(start + 4, page + 2));
  const numbers: number[] = [];
  for (let value = start; value <= end; value += 1) numbers.push(value);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-sm">
      <span className="text-text-muted">
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        {numbers.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPage(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cx(
              'h-8 min-w-8 rounded-sm border px-2 text-xs font-medium',
              value === page
                ? 'border-brand-primary bg-brand-primary-subtle text-brand-primary'
                : 'border-transparent text-text-secondary hover:bg-brand-primary-subtle',
            )}
          >
            {value}
          </button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
