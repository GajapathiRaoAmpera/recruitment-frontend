"use client";

import { AlertTriangle, Lock, SearchX } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import s from "./states.module.scss";
import { useToast } from "./toast";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(s.empty, className)}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      <h2 className={s.title}>{title}</h2>
      {description && <p className={s.description}>{description}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}

/** The error text goes to a toast; the box only holds the place and the retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const toast = useToast();
  useEffect(() => toast({ tone: "danger", title: message }), [message, toast]);
  return (
    <div className={s.error}>
      <AlertTriangle aria-hidden size={24} className={s.errorIcon} />
      <p>Couldn&apos;t load this.</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function NotFoundState({ title = "Not found", description }: { title?: string; description?: string }) {
  return (
    <EmptyState
      icon={<SearchX aria-hidden size={32} />}
      title={title}
      description={description ?? "It may have been deleted, or you may not have access to it."}
    />
  );
}

export function ForbiddenState() {
  return (
    <EmptyState
      icon={<Lock aria-hidden size={32} />}
      title="You don't have access to this page"
      description="Ask a Super Admin if you think you should."
    />
  );
}
