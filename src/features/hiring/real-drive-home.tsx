"use client";

import { UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getDrive, listRounds, reassignDrive } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RobotLoader } from "@/components/ui/robot-loader";
import { ErrorState, NotFoundState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { hire as h, PipelineSteps } from "@/components/hire/ui";
import type { BadgeTone } from "@/components/ui/badge";
import { OwnerSelect } from "@/features/hiring/owner-select";
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

/** A real drive: who runs it, its shortlist, plus each round with a link to its live progress. */
export function RealDriveHome() {
  const { driveId } = useParams<{ driveId: string }>();
  const { state } = useStore();
  const isAdmin = state.session?.role === "SUPER_ADMIN";
  const drive = useAsync(() => getDrive(driveId), [driveId]);
  const { data, error, reload } = useAsync(() => listRounds(driveId), [driveId]);
  const [reassigning, setReassigning] = useState(false);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive.data?.roleTitle ?? "Drive" }]);

  if (drive.error?.status === 404) return <NotFoundState title="Drive not found" />;
  if (error || drive.error) return <ErrorState message={(error ?? drive.error)!.message} onRetry={() => (reload(), drive.reload())} />;
  if (!data || !drive.data) return <RobotLoader label="Opening drive" />;
  const d = drive.data;

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
            <p className={h.xs}>{data.length ? `${data.filter((r) => r.status === "completed").length} of ${data.length} completed` : "No rounds set up yet"}</p>
          </div>
        </div>
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
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </p>
                    <p className={h.xs}>{isShortlist ? `${d.candidates} candidate${d.candidates === 1 ? "" : "s"} imported · ${info.hint}` : info.hint}</p>
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
