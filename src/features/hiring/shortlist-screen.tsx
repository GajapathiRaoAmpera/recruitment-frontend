"use client";

import { FileWarning } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { Chips, DemoNote, hire as h, Person } from "@/components/hire/ui";
import { RoundActions } from "@/components/hire/round-actions";
import { driveRounds, useStore } from "@/mock/store";
import { RealShortlist } from "@/features/hiring/real-shortlist";
import { supabase } from "@/lib/supabase";

function MockShortlist() {
  const { driveId } = useParams<{ driveId: string }>();
  const { state, dispatch } = useStore();
  const drive = state.drives.find((d) => d.id === driveId);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive?.roleTitle ?? "Drive", href: `/hr/drives/${driveId}` }, { label: "Shortlist" }]);
  const [skill, setSkill] = useState("");
  const [minCgpa, setMinCgpa] = useState(0);
  const [minMatch, setMinMatch] = useState(0);
  const [show, setShow] = useState<"all" | "yes" | "no" | "undecided">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!drive) return <NotFoundState title="Drive not found" />;
  const shortlistRound = driveRounds(state, drive.id).find((r) => r.type === "shortlist")!;
  const editable = shortlistRound.status === "active";
  const all = state.candidates.filter((c) => c.driveId === drive.id);
  const skills = [...new Set(all.flatMap((c) => c.skills))].sort();
  const rows = all.filter(
    (c) =>
      (!skill || c.skills.includes(skill)) &&
      c.cgpa >= minCgpa &&
      c.jdMatch >= minMatch &&
      (show === "all" || (show === "yes" ? c.shortlisted === true : show === "no" ? c.shortlisted === false : c.shortlisted === null)),
  );
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  const apply = (value: boolean) => {
    dispatch({ type: "shortlist", ids: [...selected], value });
    setSelected(new Set());
  };

  return (
    <div className={h.stack}>
      <PageHeader
        title="Resume shortlist"
        description={`${all.length} candidates imported · ${all.filter((c) => c.shortlisted).length} shortlisted`}
        actions={<RoundActions round={shortlistRound} />}
      />
      <DemoNote>Skills, CGPA and JD match come from the local resume analyser (no AI). Rows marked “Parse failed” need a manual check.</DemoNote>

      <div className={h.toolbar}>
        <Field label="Skill">
          <Select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any skill</option>
            {skills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Min CGPA">
          <Input type="number" step={0.1} min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(Number(e.target.value))} />
        </Field>
        <Field label={`Min JD match: ${minMatch}%`}>
          <input className={h.range} type="range" min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} />
        </Field>
        <Field label="Show">
          <Select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="all">All</option>
            <option value="undecided">Undecided</option>
            <option value="yes">Shortlisted</option>
            <option value="no">Not shortlisted</option>
          </Select>
        </Field>
      </div>

      {editable && (
        <div className={h.row}>
          <Button size="sm" disabled={selected.size === 0} onClick={() => apply(true)}>
            Shortlist {selected.size || ""}
          </Button>
          <Button size="sm" variant="secondary" disabled={selected.size === 0} onClick={() => apply(false)}>
            Don&apos;t shortlist
          </Button>
          <Button size="sm" variant="tertiary" onClick={() => setSelected(new Set(rows.map((c) => c.id)))}>
            Select all {rows.length} filtered
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No candidates match these filters" description="Lower the CGPA or JD-match filter, or pick another skill." />
      ) : (
        <Table>
          <thead>
            <tr>
              {editable && (
                <Th>
                  <input type="checkbox" className={h.check} aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((c) => c.id)))} />
                </Th>
              )}
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
                {editable && (
                  <Td>
                    <input type="checkbox" className={h.check} aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </Td>
                )}
                <Td>
                  <Link href={`/hr/candidates/${c.id}`}>
                    <Person name={c.name} meta={`${c.studentId} · ${c.branch}`} />
                  </Link>
                </Td>
                <Td>{c.parseStatus === "failed" ? "—" : c.cgpa}</Td>
                <Td>{c.parseStatus === "failed" ? "—" : `${c.jdMatch}%`}</Td>
                <Td>
                  {c.parseStatus === "failed" ? (
                    <Badge tone="warning">
                      <FileWarning aria-hidden size={12} style={{ marginRight: 4 }} /> Parse failed
                    </Badge>
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

export function ShortlistScreen() {
  const { driveId } = useParams<{ driveId: string }>();
  return supabase ? <RealShortlist driveId={driveId} /> : <MockShortlist />;
}
