"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <FiCheckCircle className="h-5 w-5 text-primary-600" />,
  error: <FiAlertCircle className="h-5 w-5 text-rose-600" />,
  info: <FiInfo className="h-5 w-5 text-secondary-600" />,
  warning: <FiAlertTriangle className="h-5 w-5 text-amber-600" />,
};

const BORDERS: Record<ToastKind, string> = {
  success: "border-primary-200",
  error: "border-rose-200",
  info: "border-secondary-200",
  warning: "border-amber-200",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-fade-in-up flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg",
              BORDERS[t.kind]
            )}
            role="status"
          >
            {ICONS[t.kind]}
            <p className="flex-1 text-sm text-slate-700">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
