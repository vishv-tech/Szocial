"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "info" | "warning";
};

type ToastContextValue = {
  notify: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            className={cn(
              "rounded-2xl border bg-white p-4 shadow-soft",
              toast.variant === "warning" ? "border-orange-200" : "border-slate-100"
            )}
            key={toast.id}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  toast.variant === "warning"
                    ? "bg-szocial-orangeSoft text-szocial-orange"
                    : "bg-szocial-tealSoft text-szocial-teal"
                )}
              >
                {toast.variant === "warning" ? (
                  <Info className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-szocial-ink">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm leading-5 text-szocial-muted">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-szocial-muted transition hover:bg-slate-100"
                onClick={() =>
                  setToasts((current) => current.filter((item) => item.id !== toast.id))
                }
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
