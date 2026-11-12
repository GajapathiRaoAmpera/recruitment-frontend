import { CheckCircle2, XCircle } from "lucide-react";
import type { Check } from "@/features/papers/types";
import s from "./papers.module.scss";

/** Integrity checklist: icon + label + detail, so pass/fail never relies on colour alone. */
export function ChecksList({ checks }: { checks: Check[] }) {
  return (
    <ul className={s.checks} aria-live="polite" aria-label="Integrity checks">
      {checks.map((c) => (
        <li key={c.id}>
          {c.ok ? <CheckCircle2 aria-hidden size={16} className={s.ok} /> : <XCircle aria-hidden size={16} className={s.bad} />}
          <span>
            <strong>{c.label}</strong> <span className="sr-only">{c.ok ? "passed" : "failed"}</span>
            {c.detail && c.detail !== "OK" && <span> — {c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
