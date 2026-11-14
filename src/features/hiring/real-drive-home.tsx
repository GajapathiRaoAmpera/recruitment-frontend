"use client";

import { ListChecks, Trophy, UserCheck, UserRoundCog, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getDrive, getRoundProgress, listCandidates, listRounds, reassignDrive } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { ErrorState, NotFoundState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { hire as h, PipelineSteps, StatCard } from "@/components/hire/ui";
import type { BadgeTone } from "@/components/ui/badge";
import { OwnerSelect } from "@/features/hiring/owner-select";
import { countOutcomes, type OutcomeCounts } from "@/features/hiring/round-outcome";
import { useAsync } from "@/features/papers/use-async";
import { useStore } from "@/mock/store";
import type { Round } from "@/mock/types";

const rounds: Record<string, { title: string; hint: string }> = {
  shortlist: { title: "Resume shortlist", hint: "Filter by skills, CGPA and JD match, then invite to round 1" },
  aptitude: { title: "Aptitude test", hint: "Timed multiple-choice test with a pass cut-off" },
  coding: { title: "Coding test", hint: "Programming problems checked against hidden test cases" },
  ai_interview: { title: "AI interview", hint: "Voice interview led by AI, scored for your review" },
  technical: { title: "Technical round", hint: "Extra technical test before the final decision" },
  final: { title: "Final decision", hint: "Select or reject the remaining candidates" },
};
const roundInfo = (type: string) => rounds[type] ?? { title: type[0]!.toUpperCase() + type.slice(1).replaceAll("_", " "), hint: "" };

const roundStatus: Record<string, { text: string; tone: BadgeTone }> = {
  pending: { text: "Not started", tone: "neutral" },
  active: { text: "Open", tone: "primary" },
  completed: { text: "Completed", tone: "success" },
  skipped: { text: "Skipped", tone: "warning" },
};

interface DriveAnalysis {
  shortlisted: number;
  /** Per round id: who is in it and how many cleared / didn't / are still open. A round that can't be read is left out. */
  byRound: Record<string, OutcomeCounts>;
}

/** Drive-wide numbers for the Rounds section: the shortlist size and, per round, how many students passed. */
async function analyseDrive(driveId: string, rounds: { id: string; type: string }[]): Promise<DriveAnalysis> {
  const [shortlisted, progress] = await Promise.all([
    listCandidates(driveId, { shortlisted: true }).then((rows) => rows.length, () => 0),
    Promise.all(rounds.filter((r) => r.type !== "shortlist").map((r) => getRoundProgress(driveId, r.id).catch(() => null))),
  ]);
  const byRound: Record<string, OutcomeCounts> = {};
  for (const p of progress) if (p) byRound[p.roundId] = countOutcomes(p.candidates.map((c) => c.status));
  return { shortlisted, byRound };
}

/** A real drive: who runs it, its shortlist, plus each round with a link to its live progress. */
export function RealDriveHome() {
  const { driveId } = useParams<{ driveId: string }>();
  const { state } = useStore();
  const isAdmin = state.session?.role === "SUPER_ADMIN";
  const drive = useAsync(() => getDrive(driveId), [driveId]);
  const { data, error, reload } = useAsync(() => listRounds(driveId), [driveId]);
  const analysis = useAsync(() => (data ? analyseDrive(driveId, data) : Promise.resolve(undefined)), [driveId, data]);
  const [reassigning, setReassigning] = useState(false);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive.data?.roleTitle ?? "Drive" }]);

  if (drive.error?.status === 404) return <NotFoundState title="Drive not found" />;
  if (error || drive.error) return <ErrorState message={(error ?? drive.error)!.message} onRetry={() => (reload(), drive.reload())} />;
  if (!data || !drive.data) return <RocketLoader label="Opening drive" />;
  const d = drive.data;
  const stats = analysis.data;
  // The resume shortlist is a step, not a round: it isn't counted in "rounds completed".
  const active = data.filter((r) => r.status !== "skipped" && r.type !== "shortlist");
  const finalRound = data.find((r) => r.type === "final");
  const selectedTotal = finalRound ? stats?.byRound[finalRound.id]?.cleared : undefined;
  const dash = (n: number | undefined) => (stats ? n : "—");

  return (
    <div className={h.stack}>
      <PageHeader
        title={d.roleTitle}
        description={`${d.company} · ${d.campus}${d.ownerName ? ` · Run by ${d.ownerName}` : ""}`}
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => setReassigning(true)}>
              <UserRoundCog aria-hidden size={16} style={{ marginRight: 6 }} /> Change HR
            </Button>
          )
        }
      />
      <section className={h.card} aria-labelledby="rounds-h">
        <div className={h.cardHead}>
          <div>
            <h2 id="rounds-h" className={h.cardTitle}>
              Rounds
            </h2>
            <p className={h.xs}>{active.length ? `${active.filter((r) => r.status === "completed").length} of ${active.length} completed` : "No rounds set up yet"}</p>
          </div>
        </div>
        {active.length > 0 && (
          <div className={h.grid4} style={{ marginBottom: 20 }}>
            <StatCard label="Rounds completed" value={`${active.filter((r) => r.status === "completed").length} / ${active.length}`} icon={ListChecks} hint={`${active.filter((r) => r.status === "active").length} running now`} />
            <StatCard label="Candidates" value={d.candidates} icon={Users} hint="Imported from the form" />
            <StatCard label="Shortlisted" value={dash(stats?.shortlisted)} icon={UserCheck} hint="Invited to round 1" />
            <StatCard label="Selected" value={dash(selectedTotal)} icon={Trophy} hint={finalRound ? "Cleared the final round" : "No final round"} />
          </div>
        )}
        {data.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <PipelineSteps rounds={data as Round[]} />
          </div>
        )}
        <ol className={h.list}>
          {data.map((r) => {
            const info = roundInfo(r.type);
            const status = roundStatus[r.status] ?? { text: r.status, tone: "neutral" as const };
            const isShortlist = r.type === "shortlist";
            const counts = stats?.byRound[r.id];
            const isFinal = r.type === "final";
            return (
              <li key={r.id} className={h.listItem}>
                <div className={h.row} style={{ flex: "1 1 320px", alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <span className={h.avatar} aria-hidden>
                    {r.position}
                  </span>
                  <div>
                    <p className={h.row}>
                      <span style={{ fontWeight: 500 }}>
                        <span className="sr-only">Round {r.position}: </span>
                        {info.title}
                      </span>
                      {info.hint && <InfoTip label={`About ${info.title}`}>{info.hint}</InfoTip>}
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </p>
                    {isShortlist && (
                      <p className={h.xs}>
                        {`${d.candidates} candidate${d.candidates === 1 ? "" : "s"} imported`}
                        {stats ? ` · ${stats.shortlisted} shortlisted` : ""}
                      </p>
                    )}
                    {!isShortlist && counts && (
                      <p className={h.xs}>
                        {`${counts.total} in round · ${counts.cleared} ${isFinal ? "selected" : "passed"} · ${counts.notCleared} ${isFinal ? "rejected" : "not passed"}`}
                        {counts.open ? ` · ${counts.open} awaiting` : ""}
                        {counts.total ? ` · ${Math.round((counts.cleared / counts.total) * 100)}% ${isFinal ? "selected" : "pass rate"}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild variant={r.status === "active" ? "primary" : "secondary"} size="sm">
                  <Link href={isShortlist ? `/hr/drives/${driveId}/candidates` : `/hr/drives/${driveId}/rounds/${r.id}`}>
                    {isShortlist ? "Review resumes" : "View progress"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ol>
      </section>
      {isAdmin && (
        <ReassignDialog
          open={reassigning}
          onOpenChange={setReassigning}
          driveId={driveId}
          current={d.ownerId}
          currentName={d.ownerName}
          onDone={() => {
            setReassigning(false);
            drive.reload();
          }}
        />
      )}
    </div>
  );
}

interface ReassignProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driveId: string;
  current: string | null;
  currentName: string | null;
  onDone: () => void;
}

/** Super Admin hands the drive to another HR: it leaves the current owner's portal and appears in theirs. */
function ReassignDialog({ open, onOpenChange, driveId, current, currentName, onDone }: ReassignProps) {
  const toast = useToast();
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerId) return setError("Choose who runs this drive.");
    setSaving(true);
    try {
      const d = await reassignDrive(driveId, ownerId);
      toast({ tone: "success", title: `${d.ownerName ?? "The new HR"} now runs this drive`, description: currentName ? `It no longer shows in ${currentName}'s portal.` : undefined });
      setOwnerId("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (saving) return;
        if (!o) setError(undefined);
        onOpenChange(o);
      }}
    >
      <DialogContent
        title="Change who runs this drive"
        description={currentName ? `Right now ${currentName} runs it.` : undefined}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="reassign-form" loading={saving}>
              Move drive
            </Button>
          </>
        }
      >
        <form id="reassign-form" onSubmit={save} noValidate>
          <OwnerSelect
            value={ownerId}
            exclude={current}
            error={error}
            onChange={(id) => {
              setOwnerId(id);
              setError(undefined);
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
