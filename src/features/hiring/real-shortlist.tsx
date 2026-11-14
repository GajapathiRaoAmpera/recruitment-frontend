"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDrive, listCandidates, shortlist, type CandidateRow } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Range, Select } from "@/components/ui/input";
import { RobotLoader } from "@/components/ui/robot-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, Person } from "@/components/hire/ui";
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
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive.data?.roleTitle ?? "Drive", href: `/hr/drives/${driveId}` }, { label: "Shortlist" }]);

  if (drive.error?.status === 404) return <NotFoundState title="Drive not found" />;
  if ((!drive.data && !drive.error) || (!list.data && !list.error)) return <RobotLoader label="Loading candidates" />;
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
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't save", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={h.stack}>
      <PageHeader
        title="Resume shortlist"
        description={drive.data ? `${drive.data.roleTitle} · ${drive.data.campus} · ${drive.data.candidates} candidates imported` : undefined}
        actions={
          <Button asChild variant="secondary">
            <Link href={`/hr/drives/${driveId}`}>Rounds</Link>
          </Button>
        }
      />

      <ImportPanel driveId={driveId} onChanged={() => { drive.reload(); list.reload(); }} />

      <div className={h.toolbar}>
        <Field label="Skills" hint="Comma separated. A candidate needs all of them.">
          <Input value={skills} placeholder="java, sql" onChange={(e) => setSkills(e.target.value)} />
        </Field>
        <Field label="Min CGPA">
          <Input type="number" step={0.1} min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(Math.min(10, Math.max(0, Number(e.target.value))))} />
        </Field>
        <Field label={`Min JD match: ${minMatch}%`}>
          <Range className={h.range} min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} />
        </Field>
        <Field label="Show">
          <Select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="all">All</option>
            <option value="yes">Shortlisted</option>
            <option value="no">Not shortlisted</option>
          </Select>
        </Field>
      </div>

      <div className={h.row}>
        <Button size="sm" disabled={selected.size === 0} loading={saving} onClick={() => apply(true)}>
          Shortlist {selected.size || ""}
        </Button>
        <Button size="sm" variant="secondary" disabled={selected.size === 0 || saving} onClick={() => apply(false)}>
          Don&apos;t shortlist
        </Button>
        <Button size="sm" variant="tertiary" disabled={rows.length === 0} onClick={() => setSelected(new Set(rows.map((c) => c.id)))}>
          Select all {rows.length} shown
        </Button>
      </div>

      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : rows.length === 0 ? (
        filtering ? (
          <EmptyState title="No candidates match these filters" description="Lower the CGPA or JD-match filter, or change the skills." />
        ) : (
          <EmptyState title="No candidates yet" description="Import the Google Form export above, then fetch the resumes." />
        )
      ) : (
        <Table aria-busy={list.loading}>
          <thead>
            <tr>
              <Th>
                <input type="checkbox" className={h.check} aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((c) => c.id)))} />
              </Th>
              <Th>Candidate</Th>
              <Th>CGPA</Th>
              <Th>JD match</Th>
              <Th>Skills (extracted)</Th>
              <Th>Shortlist</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td>
                  <input type="checkbox" className={h.check} aria-label={`Select ${c.fullName}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                </Td>
                <Td>
                  <Link href={`/hr/candidates/${c.id}`}>
                    <Person name={c.fullName} meta={`${c.studentId} · ${c.email}`} />
                  </Link>
                </Td>
                <Td>{c.cgpa ?? "—"}</Td>
                <Td>{c.jdMatch === null ? "—" : `${c.jdMatch}%`}</Td>
                <Td>
                  {c.parseStatus === "missing" ? (
                    <Badge>No resume yet</Badge>
                  ) : c.parseStatus === "failed" ? (
                    <Badge tone="warning">Parse failed</Badge>
                  ) : (
                    <Chips items={c.skills} />
                  )}
                </Td>
                <Td>{c.shortlisted === null ? <Badge>Undecided</Badge> : c.shortlisted ? <Badge tone="success">Yes</Badge> : <Badge tone="danger">No</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
