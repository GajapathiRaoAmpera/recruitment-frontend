"use client";

import { Library, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { listBanks, updateBank } from "@/api/qbank";
import { hire as h, StatCard } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import ps from "@/features/papers/components/papers.module.scss";
import { useAsync } from "@/features/papers/use-async";
import type { Bank } from "@/features/qbank/types";
import { date, DeleteDialog, DownloadButton, EmbeddingBadge, ReplaceDialog } from "./bank-parts";
import s from "./qbank.module.scss";

type Action = { kind: "replace" | "delete"; bank: Bank };

/** `version` changes (e.g. after an upload) reload the list. */
export function BankList({ uploaderName, version, onUpload }: { uploaderName: (id: string) => string; version: number; onUpload: () => void }) {
  const { data, error, loading, reload } = useAsync(() => listBanks(), [version]);
  const toast = useToast();
  const [action, setAction] = useState<Action>();
  const [toggling, setToggling] = useState<string>();

  const toggleActive = async (b: Bank) => {
    setToggling(b.id);
    try {
      await updateBank(b.id, { isActive: !b.isActive });
      toast({ tone: "success", title: b.isActive ? "Bank deactivated" : "Bank activated", description: b.isActive ? "New papers no longer draw from it." : "New papers can draw from it again." });
      reload();
    } catch (e) {
      toast({ tone: "danger", title: "Could not change the bank", description: e instanceof Error ? e.message : undefined });
    } finally {
      setToggling(undefined);
    }
  };

  if (loading && !data) {
    return (
      <div className={ps.drafts}>
        <LoadingLabel label="Loading question banks" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ height: 180 }} />
        ))}
      </div>
    );
  }
  if (error && !data) return error.status === 403 ? <ForbiddenState /> : <ErrorState message={error.message} onRetry={reload} />;
  const banks = data?.items ?? [];
  if (!banks.length) {
    return (
      <EmptyState
        icon={<Library aria-hidden size={32} />}
        title="Upload your first question bank"
        description="Upload an MCQ PDF. Its questions are read automatically; once you approve them, IT papers draw their Technical section from them."
        action={
          <Button onClick={onUpload}>
            <Upload aria-hidden size={16} style={{ marginRight: 6 }} /> Upload PDF
          </Button>
        }
      />
    );
  }

  const approved = banks.reduce((n, b) => n + (b.isActive ? b.approvedCount : 0), 0);
  const questions = banks.reduce((n, b) => n + b.questionCount, 0);
  return (
    <div className={h.stack}>
      <div className={h.grid3}>
        <StatCard label="Banks" value={banks.length} hint={`${banks.filter((b) => b.isActive).length} active`} />
        <StatCard label="Approved questions" value={approved} hint="In active banks — what papers can use" />
        <StatCard label="Questions read" value={questions} hint="Across all banks" />
      </div>
      <ul className={ps.drafts} aria-label="Question banks">
        {banks.map((b) => (
          <li key={b.id} className={s.bank}>
            <span className={h.between}>
              <Link href={`/hr/question-banks/${encodeURIComponent(b.id)}`} className={s.bankName}>
                {b.name}
              </Link>
              <span className={h.chip}>{b.track === "it" ? "IT" : "Non-IT"}</span>
            </span>
            <span className={h.row}>
              {b.status === "failed" ? <Badge tone="danger">Read failed</Badge> : !b.isActive ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge>}
              <EmbeddingBadge status={b.embeddingStatus} />
            </span>
            <span className={h.xs}>
              {b.approvedCount} of {b.questionCount} questions approved
            </span>
            <span className={s.bar} aria-hidden>
              <span style={{ width: `${b.questionCount ? (100 * b.approvedCount) / b.questionCount : 0}%` }} />
            </span>
            <span className={h.xs}>
              {b.filename} · uploaded {date(b.createdAt)} by {uploaderName(b.uploadedBy)}
            </span>
            {b.canManage && (
              <label className={s.switch}>
                <input type="checkbox" checked={b.isActive} disabled={toggling === b.id} onChange={() => void toggleActive(b)} />
                Use in new papers
              </label>
            )}
            <span className={s.actions}>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/hr/question-banks/${encodeURIComponent(b.id)}`}>Open</Link>
              </Button>
              <DownloadButton bank={b} />
              {b.canManage && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setAction({ kind: "replace", bank: b })}>
                    Replace file
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setAction({ kind: "delete", bank: b })}>
                    Delete
                  </Button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {action?.kind === "replace" && <ReplaceDialog bank={action.bank} onClose={() => setAction(undefined)} onReplaced={reload} />}
      {action?.kind === "delete" && (
        <DeleteDialog
          bank={action.bank}
          onClose={() => setAction(undefined)}
          onDeleted={() => {
            toast({ tone: "success", title: "Bank deleted" });
            reload();
          }}
        />
      )}
    </div>
  );
}
