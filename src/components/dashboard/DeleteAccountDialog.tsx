'use client';

import { useEffect, useRef } from 'react';

type DeleteAccountDialogProps = {
  open: boolean;
  password: string;
  deleting?: boolean;
  error?: string;
  title: string;
  message: string;
  passwordPlaceholder: string;
  cancelLabel: string;
  confirmLabel: string;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function DeleteAccountDialog({
  open,
  password,
  deleting = false,
  error,
  title,
  message,
  passwordPlaceholder,
  cancelLabel,
  confirmLabel,
  onPasswordChange,
  onClose,
  onConfirm
}: DeleteAccountDialogProps) {
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      passwordInputRef.current?.focus();
      passwordInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
            {cancelLabel}
          </button>
        </div>

        <p className="mb-4 text-sm leading-6 text-gray-600">{message}</p>
        {error ? <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onConfirm();
          }}
        >
          <input
            ref={passwordInputRef}
            autoFocus
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={passwordPlaceholder}
            className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-400"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={deleting}
              className="flex-1 rounded-full bg-red-500 px-4 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
