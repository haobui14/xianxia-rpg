"use client";

import { useState, useCallback, useEffect, createContext, useContext } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op if used outside provider (safe fallback)
    return {
      addToast: () => {},
      removeToast: () => {},
      toast: {
        success: (msg: string) => {},
        error: (msg: string) => {},
        warning: (msg: string) => {},
        info: (msg: string) => {},
      },
    };
  }
  return {
    ...ctx,
    toast: {
      success: (msg: string, duration?: number) => ctx.addToast(msg, "success", duration),
      error: (msg: string, duration?: number) => ctx.addToast(msg, "error", duration),
      warning: (msg: string, duration?: number) => ctx.addToast(msg, "warning", duration),
      info: (msg: string, duration?: number) => ctx.addToast(msg, "info", duration),
    },
  };
}

const TOAST_ACCENT: Record<ToastType, string> = {
  success: "var(--jade)",
  error: "var(--cinnabar)",
  warning: "var(--gold)",
  info: "var(--ink-soft)",
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, toast.duration - 300);

    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`ink-card ${isExiting ? "" : "animate-toast-in"}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderLeft: `3px solid ${TOAST_ACCENT[toast.type]}`,
        background: "var(--card)",
        color: "var(--ink)",
        boxShadow: "0 4px 12px rgba(70, 50, 20, 0.18)",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(16px)" : "translateX(0)",
        transition: "all 0.3s ease",
      }}
    >
      <span
        className="t-han"
        style={{
          fontSize: 18,
          color: TOAST_ACCENT[toast.type],
          flexShrink: 0,
        }}
      >
        {TOAST_ICONS[toast.type]}
      </span>
      <span style={{ fontSize: 14, flex: 1, color: "var(--ink)" }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--ink-mute)",
          cursor: "pointer",
          fontSize: 16,
          padding: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]); // Max 5 toasts
    },
    []
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
