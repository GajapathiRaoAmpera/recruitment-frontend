"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDrive, listCandidates, shortlist, type CandidateRow } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Range } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, Person, Segment, StatCard } from "@/components/hire/ui";
import { CircleHelp, FileCheck, UserCheck, Users } from "lucide-react";
import { useAsync } from "@/features/papers/use-async";
import { ImportPanel } from "./import-panel";

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Resume shortlist backed by the API: filters run on the server, shortlisting is saved there. */
export function RealShortlist({ driveId }: { driveId: string }) {
  const toast = useToast();
  const [skills, setSkills] = useState("");
  const [minCgpa, setMinCgpa] = useState(0);
  const [minMatch, setMinMatch] = useState(0);
  const [show, setShow] = useState<"all" | "yes" | "no">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const drive = useAsync(() => getDrive(driveId), [driveId]);
  const f = useDebounced({ skills, minCgpa, minMatch, show });
  const list = useAsync(
    () => listCandidates(driveId, { skills: f.skills, minCgpa: f.minCgpa, minMatch: f.minMatch, shortlisted: f.show === "all" ? undefined : f.show === "yes" }),
    [driveId, f.skills, f.minCgpa, f.minMatch, f.show],
  );
  const all = useAsync(() => listCandidates(driveId), [driveId]);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive.data?.roleTitle ?? "Drive", href: `/hr/drives/${driveId}` }, { label: "Shortlist" }]);

  if (drive.error?.status === 404) return <NotFoundState title="Drive not found" />;
  if ((!drive.data && !drive.error) || (!list.data && !list.error)) return <RocketLoader label="Loading candidates" />;
  const rows: CandidateRow[] = list.data ?? [];
  const filtering = Boolean(skills.trim() || minCgpa || minMatch || show !== "all");
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));

  const apply = async (value: boolean) => {
    setSaving(true);
    try {
      const { updated, moved } = await shortlist(driveId, [...selected], value);
      const skipped = selected.size - updated;
      const note = value ? `${moved} invited to Round 1.` : moved ? `${moved} taken out of Round 1.` : undefined;
      toast({
        tone: skipped ? "info" : "success",
        title: `${updated} candidate(s) ${value ? "shortlisted" : "removed from shortlist"}`,
        description: [note, skipped ? `${skipped} skipped: no resume uploaded yet.` : undefined].filter(Boolean).join(" ") || undefined,
      });
      setSelected(new Set());
      list.reload();
      all.reload();
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't save", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const everyone = all.data ?? rows;
  const missing = everyone.filter((c) => c.parseStatus === "missing").length;
  const shortlistedCount = everyone.filter((c) => c.shortlisted === true).length;
  const notCount = everyone.filter((c) => c.shortlisted === false).length;
  const undecided = everyone.length - shortlistedCount - notCount;
  const reloadAll = () => {
    drive.reload();
    list.reload();
    all.reload();
  };
  const clearFilters = () => {
    setSkills("");
    setMinCgpa(0);
    setMinMatch(0);
  };
  const narrowed = Boolean(skills.trim() || minCgpa || minMatch);

  return (
    <div className={h.stack}>
      <PageHeader title="Resume shortlist" description={drive.data ? `${drive.data.roleTitle} · ${drive.data.campus}` : undefined} />

      <ImportPanel driveId={driveId} missingResumes={missing} total={everyone.length} onChanged={reloadAll} />

      {everyone.length > 0 && (
        <div className={h.grid4}>
          <StatCard label="Imported" value={everyone.length} icon={Users} />
          <StatCard label="Resumes read" value={everyone.filter((c) => c.parseStatus !== "missing" && c.parseStatus !== "failed").length} hint={missing ? `${missing} still missing` : "All fetched"} icon={FileCheck} />
          <StatCard label="Shortlisted" value={shortlistedCount} hint="Invited to round 1" icon={UserCheck} />
          <StatCard label="Undecided" value={undecided} hint={notCount ? `${notCount} not shortlisted` : undefined} icon={CircleHelp} />
        </div>
      )}

      <section className={h.card} aria-labelledby="cands-h">
        <div className={h.cardHead}>
          <div>
            <h2 id="cands-h" className={h.cardTitle}>
              Candidates
            </h2>
            <p className={h.xs}>
              Showing {rows.length} of {everyone.length}
            </p>
          </div>
          <Segment
            label="Show"
            value={show}
            onChange={(v) => {
              setShow(v);
              setSelected(new Set());
            }}
            options={[
              { id: "all", label: `All ${everyone.length}` },
              { id: "yes", label: `Shortlisted ${shortlistedCount}` },
              { id: "no", label: `Not shortlisted ${notCount}` },
            ]}
          />
        </div>

        <div className={h.filterBar}>
          <Field label="Skills (must have all)">
            <Input value={skills} placeholder="e.g. java, sql" onChange={(e) => setSkills(e.target.value)} />
          </Field>
          <Field label="Min CGPA">
            <Input type="number" step={0.1} min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(Math.min(10, Math.max(0, Number(e.target.value))))} />
          </Field>
          <Field label={`Min JD match: ${minMatch}%`}>
            <div className={h.filterControl}>
              <Range className={h.range} min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} />
            </div>
          </Field>
          <div className={h.filterControl}>
            <Button variant="tertiary" size="sm" disabled={!narrowed} onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </div>

        <div className={h.selectionBar} data-active={selected.size > 0 || undefined} role="region" aria-label="Shortlist actions" aria-live="polite">
          {selected.size > 0 ? (
            <>
              <strong>{selected.size} selected</strong>
              <span className={h.row}>
                <Button size="sm" loading={saving} onClick={() => apply(true)}>
                  Shortlist {selected.size}
                </Button>
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => apply(false)}>
                  Mark not shortlisted
                </Button>
                <Button size="sm" variant="tertiary" disabled={saving} onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </span>
            </>
          ) : (
            <>
              <span className={h.muted}>Tick candidates to shortlist them. Shortlisted candidates are invited to round 1.</span>
              {rows.length > 0 && (
                <Button size="sm" variant="tertiary" onClick={() => setSelected(new Set(rows.map((c) => c.id)))}>
                  Select all {rows.length} shown
                </Button>
              )}
            </>
          )}
        </div>

        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : rows.length === 0 ? (
          filtering ? (
            <EmptyState
              title="No candidates match"
              description="Loosen the skills, CGPA or JD-match filter, or switch to All."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    clearFilters();
                    setShow("all");
                  }}
                >
                  Show everyone
                </Button>
              }
            />
          ) : (
            <EmptyState title="No candidates yet" description="Upload the Google Form sheet above. Resumes are fetched automatically." />
          )
        ) : (
          <Table aria-busy={list.loading}>
            <thead>
              <tr>
                <Th>
                  <input type="checkbox" className={h.check} aria-label="Select all shown" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((c) => c.id)))} />
                </Th>
                <Th>Candidate</Th>
                <Th>CGPA</Th>
                <Th>JD match</Th>
                <Th>Skills from resume</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} data-selected={selected.has(c.id) || undefined} className={h.selectableRow}>
                  <Td>
                    <input type="checkbox" className={h.check} aria-label={`Select ${c.fullName}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </Td>
                  <Td>
                    <Link href={`/hr/candidates/${c.id}`}>
                      <Person name={c.fullName} meta={`${c.studentId} · ${c.email}`} />
                    </Link>
                  </Td>
                  <Td>{c.cgpa ?? "—"}</Td>
                  <Td>{c.jdMatch === null ? "—" : <Badge tone={c.jdMatch >= 75 ? "success" : c.jdMatch >= 50 ? "neutral" : "warning"}>{c.jdMatch}%</Badge>}</Td>
                  <Td>
                    {c.parseStatus === "missing" ? (
                      <Badge>No resume yet</Badge>
                    ) : c.parseStatus === "failed" ? (
                      <Badge tone="warning">Couldn&apos;t read resume</Badge>
                    ) : (
                      <Chips items={c.skills.slice(0, 4)} />
                    )}
                  </Td>
                  <Td>{c.shortlisted === null ? <Badge>Undecided</Badge> : c.shortlisted ? <Badge tone="success">Shortlisted</Badge> : <Badge tone="danger">Not shortlisted</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
