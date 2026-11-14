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
import { hire as h } from "@/components/hire/ui";
import { OwnerSelect } from "@/features/hiring/owner-select";
import { useAsync } from "@/features/papers/use-async";
import { useStore } from "@/mock/store";

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
          <>
            {isAdmin && (
              <Button variant="secondary" onClick={() => setReassigning(true)}>
                <UserRoundCog aria-hidden size={16} style={{ marginRight: 6 }} /> Change HR
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href={`/hr/drives/${driveId}/candidates`}>Shortlist</Link>
            </Button>
          </>
        }
      />
      <section className={h.card} aria-labelledby="rounds-h">
        <h2 id="rounds-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
          Rounds
        </h2>
        <ol className={h.list}>
          {data.map((r) => (
            <li key={r.id} className={h.listItem}>
              <span className={h.row}>
                {r.position}. {r.type.replace("_", " ")} <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
              </span>
              <Button asChild variant="secondary">
                <Link href={`/hr/drives/${driveId}/rounds/${r.id}`}>Progress</Link>
              </Button>
            </li>
          ))}
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
