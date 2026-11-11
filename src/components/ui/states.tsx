import { AlertTriangle, Lock, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import s from "./states.module.scss";

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

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className={s.error}>
      <AlertTriangle aria-hidden size={24} className={s.errorIcon} />
      <p>{message}</p>
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
