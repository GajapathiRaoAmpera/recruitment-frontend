"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import s from "./shell.module.scss";

export interface Crumb {
  label: string;
  href?: string;
}

const Ctx = createContext<{ crumbs: Crumb[]; setCrumbs: (c: Crumb[]) => void } | null>(null);

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return <Ctx.Provider value={{ crumbs, setCrumbs }}>{children}</Ctx.Provider>;
}

/** Pages declare their trail; it resets when the page unmounts. */
export function useBreadcrumbs(crumbs: Crumb[]) {
  const ctx = useContext(Ctx);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    if (!ctx) return;
    ctx.setCrumbs(JSON.parse(key) as Crumb[]);
    return () => ctx.setCrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not identity
  }, [key]);
}

export function Breadcrumbs() {
  const ctx = useContext(Ctx);
  const crumbs = ctx?.crumbs ?? [];
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={s.crumbNav}>
      <ol className={s.crumbs}>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={s.crumb}>
              {c.href && !last ? (
                <Link href={c.href} className={s.crumbLink}>
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={s.crumbCurrent}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden size={16} className={s.crumbSep} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
