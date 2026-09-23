import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * A confirmation dialog for destructive actions.
 *
 * WHY NOT `window.confirm`
 * Category deletion used the browser prompt. Three problems with it: it cannot
 * be styled, so a permanent action looked identical to any other alert; it
 * cannot carry emphasis, so "this will also delete 6 products" read with the
 * same weight as the rest of the sentence; and it blocks the whole page, which
 * on a slow machine makes the panel feel frozen.
 *
 * Deliberately NOT a shadcn Dialog: that pulls in Radix's focus-trap and portal
 * machinery for a component used in one place. This is a plain overlay with the
 * three behaviours that actually matter — Escape closes it, the backdrop closes
 * it, and focus lands on a button so Enter works.
 *
 * ⚠️ The dialog is a COURTESY, not the guard. The server independently refuses
 * to delete a populated category without an explicit `confirmCascade` flag, so
 * a direct API call cannot bypass this by skipping the UI. See AF-19 for why
 * that distinction matters — window.confirm protects nobody calling the
 * endpoint directly.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  consequence,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Escape closes. Bound while open only, so it cannot swallow Escape from
  // anything else on the page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  // Focus the confirm button so Enter works and a keyboard user is not left
  // hunting for where the dialog went.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      // Backdrop click cancels — but only when the click STARTED on the
      // backdrop. Without the target check, dragging a text selection out of
      // the dialog and releasing outside it would dismiss the dialog.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="mt-0.5 shrink-0 rounded-full bg-red-50 p-2">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h2
            id="confirm-dialog-title"
            className="flex-1 text-lg font-semibold text-[#68232B]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-700">{message}</p>

          {/* The consequence is visually separated rather than appended to the
              question. Buried in the same sentence it gets skimmed, and this is
              the part that cannot be undone. */}
          {consequence && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{consequence}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 bg-gray-50 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer disabled:opacity-60"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
