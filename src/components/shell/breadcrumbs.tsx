"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDrive } from "@/api/hiring";
import s from "./shell.module.scss";

export interface Crumb {
  /** Undefined while the page is still loading the name: the trail waits rather than showing a stand-in like "Drive". */
  label?: string;
  href?: string;
  /** A drive crumb whose name the trail looks up itself (cached), for pages that don't load the drive. */
  driveId?: string;
}

/** How a drive is named in the trail: role and campus, so two drives for the same role stay apart. */
const driveLabel = (d: { roleTitle: string; campus: string } | undefined | null) => (d ? `${d.roleTitle} · ${d.campus}` : undefined);

const driveNames = new Map<string, Promise<string>>();
function driveName(id: string) {
  let p = driveNames.get(id);
  if (!p) {
    p = getDrive(id).then(
      (d) => driveLabel(d)!,
      () => {
        driveNames.delete(id); // try again on the next page
        return "Drive";
      },
    );
    driveNames.set(id, p);
  }
  return p;
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
  const [names, setNames] = useState<Record<string, string>>({});
  const missing = crumbs.filter((c) => !c.label && c.driveId && !names[c.driveId]).map((c) => c.driveId!);
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!missingKey) return;
    let stale = false;
    for (const id of missingKey.split(",")) void driveName(id).then((n) => !stale && setNames((m) => ({ ...m, [id]: n })));
    return () => {
      stale = true;
    };
  }, [missingKey]);

  const resolved = crumbs.map((c) => ({ ...c, label: c.label ?? (c.driveId ? names[c.driveId] : undefined) }));
  // The whole trail appears at once, with real names only.
  if (resolved.length === 0 || resolved.some((c) => !c.label)) return null;
  return (
    <nav aria-label="Breadcrumb" className={s.crumbNav}>
      <ol className={s.crumbs}>
        {resolved.map((c, i) => {
          const last = i === resolved.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={s.crumb}>
              {c.href && !last ? (
                <Link href={c.href} className={s.crumbLink} title={c.label}>
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? s.crumbCurrent : s.crumbText} title={c.label}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden size={14} className={s.crumbSep} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
