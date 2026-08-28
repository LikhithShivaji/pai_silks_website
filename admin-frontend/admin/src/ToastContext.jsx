import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Lightweight toasts for the admin panel.
 *
 * The admin app reported everything through `window.alert()` — blocking, ugly,
 * and impossible to show more than one of. This replaces it for validation
 * feedback. No new dependency: the storefront already had a hand-rolled toast
 * and this follows the same shape.
 *
 * ⚠️ NOT a copy of client-frontend/src/ToastContext.jsx. That version has a
 * real bug (CLAUDE.md CF-41): it calls setTimeout(() => removeToast(id), 3000)
 * and never clears it. Dismissing a toast by hand leaves its timer to fire a
 * no-op setState 3s later, and unmounting the provider leaks every pending
 * timer. This version tracks timer ids and clears them on dismissal and on
 * unmount. Copying the file verbatim would have imported the defect — the
 * hazard DEP-13 warns about.
 */
const ToastContext = createContext({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const AUTO_DISMISS_MS = 4000;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  // id -> timeout handle, so a timer can be cancelled when its toast goes away
  // for any reason.
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const removeToast = useCallback((id) => {
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "error") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
      );
      return id;
    },
    [removeToast]
  );

  // Clear every pending timer if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((handle) => clearTimeout(handle));
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm text-white ${
              t.type === "success" ? "bg-[#2F7A46]" : "bg-[#68232B]"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss"
              className="opacity-70 hover:opacity-100 leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext;
