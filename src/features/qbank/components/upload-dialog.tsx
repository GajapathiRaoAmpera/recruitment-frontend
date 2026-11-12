"use client";

import { FileUp } from "lucide-react";
import Link from "next/link";
import { useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { uploadBank } from "@/api/qbank";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Track } from "@/features/papers/types";
import type { Bank } from "@/features/qbank/types";
import s from "./qbank.module.scss";

export const MAX_MB = 20; // backend QBANK_MAX_MB default

/** Client-side check before the round trip; the server checks again (magic bytes, pages, size). */
export function checkPdf(file: File | undefined): string | undefined {
  if (!file) return "Choose a PDF file.";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "The file must be a PDF.";
  if (file.size > MAX_MB * 1024 * 1024) return `The PDF must be ${MAX_MB} MB or smaller.`;
}

/** Readable message for an upload/replace failure; DUPLICATE_FILE links to the bank that already holds the file. */
export function uploadError(e: unknown): ReactNode {
  if (!(e instanceof ApiError)) return "Could not reach the server. Check your connection and try again.";
  const existing = e.details.existing_id;
  if (e.code === "DUPLICATE_FILE" && typeof existing === "string") {
    return (
      <>
        {e.message}{" "}
        <Link href={`/hr/question-banks/${encodeURIComponent(existing)}`} className={h.link}>
          Open the existing bank
        </Link>
      </>
    );
  }
  return e.message;
}

/** Drag-and-drop or picked PDF; reports the chosen file. */
export function PdfPicker({ file, onFile }: { file?: File; onFile: (f: File | undefined) => void }) {
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files[0]);
  };
  return (
    <div
      className={s.dropzone}
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <FileUp aria-hidden size={24} />
      <span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : `Drop a PDF here (up to ${MAX_MB} MB) or choose one`}</span>
      <Field label="PDF file" required>
        <Input type="file" accept="application/pdf,.pdf" onChange={(e) => onFile(e.target.files?.[0])} />
      </Field>
    </div>
  );
}

export function UploadDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded: (b: Bank) => void }) {
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [track, setTrack] = useState<Track>("it");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<ReactNode>();
  const [saving, setSaving] = useState(false);

  const [autoName, setAutoName] = useState("");

  const pick = (f: File | undefined) => {
    setFile(f);
    setError(undefined);
    if (f && (!name.trim() || name === autoName)) {
      // fill the name from the file, but never overwrite one the user typed
      const n = f.name.replace(/\.pdf$/i, "");
      setName(n);
      setAutoName(n);
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const invalid = checkPdf(file) ?? (!name.trim() ? "Enter a name for the bank." : undefined);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(undefined);
    try {
      onUploaded(await uploadBank({ file: file!, name: name.trim(), track, notes }));
      onClose();
    } catch (err) {
      setError(uploadError(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        side
        title="Upload a question bank"
        description="The PDF is read right away. Its questions start unapproved: review and approve them before papers can use them."
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              Upload and read PDF
            </Button>
          </>
        }
      >
        <form className={h.stackSm} onSubmit={submit} noValidate>
          {error && (
            <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          <PdfPicker file={file} onFile={pick} />
          <Field label="Name" required>
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Track" hint="Papers draw Technical questions only from banks of their track.">
            <Select value={track} onChange={(e) => setTrack(e.target.value as Track)}>
              <option value="it">IT</option>
              <option value="non_it">Non-IT</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
