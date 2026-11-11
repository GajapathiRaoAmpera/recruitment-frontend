"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./toast.module.scss";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone?: "success" | "danger" | "info";
}

type ToastFn = (t: Omit<Toast, "id">) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

let nextId = 1;

const ICON = { success: CheckCircle2, danger: AlertTriangle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback<ToastFn>(
    (t) => {
      const id = nextId++;
      // An identical toast already on screen (double submit, StrictMode re-mount) is not shown twice.
      setToasts((all) =>
        all.some((o) => o.title === t.title && o.description === t.description) ? all : [...all, { ...t, id }],
      );
      setTimeout(() => dismiss(id), t.tone === "danger" ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className={s.viewport}>
        {toasts.map((t) => {
          const tone = t.tone ?? "info";
          const Icon = ICON[tone];
          return (
            <div key={t.id} role={t.tone === "danger" ? "alert" : "status"} className={cn(s.toast, s[tone])}>
              <span aria-hidden className={s.bar} />
              <Icon aria-hidden size={16} className={s.icon} />
              <div className={s.text}>
                <p className={s.title}>{t.title}</p>
                {t.description && <p className={s.description}>{t.description}</p>}
              </div>
              <button aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className={s.dismiss}>
                <X aria-hidden size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
