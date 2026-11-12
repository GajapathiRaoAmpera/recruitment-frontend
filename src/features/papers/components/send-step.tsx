"use client";

import { Info, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { sendPapers } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { DraftDetail } from "@/features/papers/types";
import { useDriveCandidates } from "@/features/papers/use-drive-candidates";
import s from "./papers.module.scss";

/** Step 4: pick candidates of the draft's drive and record a paper issue for each (idempotent on the server). */
export function SendStep({ draft, onSent }: { draft: DraftDetail; onSent: () => void }) {
  const toast = useToast();
  const candidates = useDriveCandidates(draft.driveRef);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const sentTo = useMemo(() => new Set(draft.issues.map((i) => i.candidateRef)), [draft.issues]);
  const accepted = draft.status === "accepted";

  const q = query.trim().toLowerCase();
  const rows = candidates.filter((c) => !q || [c.name, c.studentId, c.branch, c.email].some((v) => v.toLowerCase().includes(q)));
  const allRowsSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setRows = (on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const c of rows) {
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });

  const send = async () => {
    setSending(true);
    setError(undefined);
    try {
      const r = await sendPapers(draft.id, [...selected]);
      setConfirming(false);
      setSelected(new Set());
      toast({ tone: "success", title: `Sent to ${r.sent} candidate${r.sent === 1 ? "" : "s"}`, description: r.alreadySent ? `${r.alreadySent} already had this paper and were skipped.` : undefined });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={h.card} aria-labelledby="send-title">
      <div className={h.cardHead}>
        <h2 id="send-title" className={h.cardTitle}>
          Send to candidates
        </h2>
        <span className={h.xs}>
          {sentTo.size} of {candidates.length} sent
        </span>
      </div>
      <p className={s.banner} data-tone="info" style={{ marginBottom: "1rem" }}>
        <Info aria-hidden size={16} />
        <span>Sending saves each candidate&apos;s paper. Candidates can open it once the exam module ships.</span>
      </p>

      {candidates.length === 0 ? (
        <EmptyState title="No candidates in this drive" description="Import candidates for the drive first, then come back to send the paper." />
      ) : (
        <>
          <div className={s.sendBar}>
            <Field label="Search candidates">
              <Input type="search" value={query} placeholder="Name, student ID or branch" onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Button disabled={!accepted || selected.size === 0} onClick={() => setConfirming(true)}>
              <Send aria-hidden size={16} style={{ marginRight: 6 }} /> Send to {selected.size} selected
            </Button>
          </div>
          {!accepted && <p className={h.xs} style={{ marginBottom: "0.75rem" }}>Accept the paper before sending it.</p>}
          {rows.length === 0 ? (
            <EmptyState title="No candidates match" description="Try a different search." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 40 }}>
                    <input type="checkbox" className={h.check} aria-label={allRowsSelected ? "Select none" : "Select all shown"} checked={allRowsSelected} onChange={(e) => setRows(e.target.checked)} />
                  </Th>
                  <Th>Candidate</Th>
                  <Th>Branch</Th>
                  <Th>CGPA</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <input type="checkbox" className={h.check} aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                    </Td>
                    <Td>
                      {c.name}
                      <span className={h.xs} style={{ display: "block" }}>
                        {c.studentId}
                      </span>
                    </Td>
                    <Td>{c.branch}</Td>
                    <Td>{c.cgpa.toFixed(1)}</Td>
                    <Td>{sentTo.has(c.id) ? <Badge tone="success">Sent</Badge> : <span className={h.xs}>Not sent</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => {
          setConfirming(o);
          if (!o) setError(undefined);
        }}
        title={`Send the paper to ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`}
        description="Each candidate gets their own question set from the accepted pool. Candidates who already have it are skipped."
        confirmLabel="Send paper"
        destructive={false}
        loading={sending}
        error={error}
        onConfirm={send}
      />
    </section>
  );
}
