"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { getDraft } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { ErrorState, ForbiddenState, NotFoundState } from "@/components/ui/states";
import { GenerationProgress } from "@/features/papers/components/generation-progress";
import { PrototypeState } from "@/features/papers/components/prototype-state";
import { ReviewStep } from "@/features/papers/components/review-step";
import { SendStep } from "@/features/papers/components/send-step";
import { Stepper } from "@/features/papers/components/stepper";
import type { DraftDetail, DraftStatus } from "@/features/papers/types";
import { useAsync } from "@/features/papers/use-async";
import { liveApi } from "@/lib/auth";

const STEP: Record<DraftStatus, number> = { generating: 1, failed: 1, draft: 2, accepted: 3 };

export function PaperDraftScreen() {
  const { draftId } = useParams<{ draftId: string }>();
  useBreadcrumbs([{ label: "Paper builder", href: "/hr/papers" }, { label: "Paper" }]);
  return liveApi ? <DraftView id={draftId} /> : <PrototypeState />;
}

function DraftView({ id }: { id: string }) {
  const loaded = useAsync(() => getDraft(id), [id]);
  const [live, setLive] = useState<DraftDetail>(); // newer copy from generation polling
  const draft = live?.id === id ? live : loaded.data;
  // After a send: refetch for the new issues; on failure the toast already confirmed the send, so keep the old copy.
  const refresh = () => void getDraft(id).then(setLive, () => {});

  if (!draft) {
    if (loaded.error?.status === 404) return <NotFoundState title="Paper not found" />;
    if (loaded.error?.status === 403) return <ForbiddenState />;
    if (loaded.error) return <ErrorState message={loaded.error.message} onRetry={loaded.reload} />;
    return (
      <>
        <LoadingLabel label="Loading paper" />
        <Skeleton style={{ height: 32, width: "40%", marginBottom: 24 }} />
        <Skeleton style={{ height: 160 }} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={draft.title} description={`${draft.track === "it" ? "IT" : "Non-IT"} track · drive ${draft.driveRef}`} />
      <Stepper current={STEP[draft.status]} />
      {draft.status === "generating" || draft.status === "failed" ? (
        <GenerationProgress draft={draft} onUpdate={setLive} />
      ) : (
        <div className={h.stack}>
          {draft.status === "accepted" && <SendStep draft={draft} onSent={refresh} />}
          <ReviewStep draft={draft} onChange={setLive} />
        </div>
      )}
    </>
  );
}
