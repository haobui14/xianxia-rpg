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

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-green-900/95 border-green-500/50 text-green-200",
  error: "bg-red-900/95 border-red-500/50 text-red-200",
  warning: "bg-yellow-900/95 border-yellow-500/50 text-yellow-200",
  info: "bg-blue-900/95 border-blue-500/50 text-blue-200",
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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ${
        TOAST_STYLES[toast.type]
      } ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0 animate-toast-in"}`}
    >
      <span className="text-lg flex-shrink-0">{TOAST_ICONS[toast.type]}</span>
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-400 hover:text-white transition-colors text-sm ml-2 flex-shrink-0"
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
