"use client";

import { Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import { deleteBank, downloadBankFile, replaceBankFile } from "@/api/qbank";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { Bank, EmbeddingStatus } from "@/features/qbank/types";
import { checkPdf, PdfPicker, uploadError } from "./upload-dialog";
import { hire as h } from "@/components/hire/ui";

export const EMBEDDING: Record<EmbeddingStatus, { label: string; tone: BadgeTone; help: string }> = {
  pending: { label: "Indexing", tone: "info", help: "Building the search index. Papers can already use approved questions." },
  done: { label: "Search ready", tone: "success", help: "A paper's focus text can rank these questions." },
  failed: { label: "Index failed", tone: "warning", help: "Building the search index failed (the server could not load the embedding model). Papers still use approved questions, but focus text cannot rank them." },
  skipped: { label: "No search index", tone: "neutral", help: "This bank has no search index: papers still use approved questions, but focus text cannot rank them." },
};

export const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function EmbeddingBadge({ status }: { status: EmbeddingStatus }) {
  const e = EMBEDDING[status];
  return (
    <span title={e.help}>
      <Badge tone={e.tone}>{e.label}</Badge>
      <span className="sr-only"> — {e.help}</span>
    </span>
  );
}

export function DownloadButton({ bank }: { bank: Pick<Bank, "id" | "filename" | "name"> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(await downloadBankFile(bank.id));
      const a = document.createElement("a");
      a.href = url;
      a.download = bank.filename || `${bank.name}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast({ tone: "danger", title: "Download failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={() => void download()} aria-label={`Download ${bank.name}`}>
      <Download aria-hidden size={14} style={{ marginRight: 4 }} /> Download
    </Button>
  );
}

/** Pick a new PDF, then confirm: replacing re-reads the file and resets approval and the search index. */
export function ReplaceDialog({ bank, onClose, onReplaced }: { bank: Bank; onClose: () => void; onReplaced: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<ReactNode>();
  const [saving, setSaving] = useState(false);
  const replace = async () => {
    const invalid = checkPdf(file);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(undefined);
    try {
      await replaceBankFile(bank.id, file!);
      toast({ tone: "success", title: "File replaced", description: "Review and approve the new questions." });
      onReplaced();
      onClose();
    } catch (e) {
      setError(uploadError(e));
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        side
        title={`Replace the file of ${bank.name}`}
        description="Every question of this bank is replaced by the new file's questions. They start unapproved, and the search index is rebuilt. Papers already sent keep their own copies."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={() => void replace()}>
              Replace file
            </Button>
          </>
        }
      >
        <div className={h.stackSm}>
          {error && (
            <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          <PdfPicker file={file} onFile={(f) => (setFile(f), setError(undefined))} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({ bank, onClose, onDeleted }: { bank: Bank; onClose: () => void; onDeleted: () => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`Delete ${bank.name}?`}
      description={`This deletes the PDF and its ${bank.questionCount} questions. Questions inside papers already sent are unaffected. If issued tests use them, the bank cannot be deleted — deactivate it instead.`}
      confirmLabel="Delete bank"
      loading={busy}
      error={error}
      onConfirm={async () => {
        setBusy(true);
        setError(undefined);
        try {
          await deleteBank(bank.id);
          onDeleted();
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not delete. Try again.");
          setBusy(false);
        }
      }}
    />
  );
}
