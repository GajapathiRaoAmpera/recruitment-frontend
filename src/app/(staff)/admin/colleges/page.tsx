"use client";

import { Mail } from "lucide-react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { hire as h, StatCard } from "@/components/hire/ui";
import { useStore } from "@/mock/store";

export default function CollegesPage() {
  useBreadcrumbs([{ label: "Colleges" }]);
  const { state } = useStore();
  return (
    <div className={h.stack}>
      <PageHeader title="Partner colleges" description="Campuses we run drives at, with their placement officer contacts." />
      <div className={h.grid3}>
        {state.colleges.map((c) => {
          const drives = state.drives.filter((d) => d.campus === c.name);
          const enrolled = state.candidates.filter((x) => drives.some((d) => d.id === x.driveId)).length;
          return (
            <article key={c.id} className={h.card}>
              <h2 className={h.cardTitle}>{c.name}</h2>
              <p className={h.xs}>{c.city}</p>
              <p className={h.small} style={{ marginTop: 12 }}>
                {c.tpo} · Placement officer
              </p>
              <a className={h.link} href={`mailto:${c.tpoEmail}`} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Mail aria-hidden size={14} /> {c.tpoEmail}
              </a>
              <div className={h.grid2} style={{ marginTop: 16 }}>
                <StatCard label="Drives" value={drives.length} />
                <StatCard label="Candidates" value={enrolled} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
