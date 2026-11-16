"use client";

import { FileSpreadsheet, FileUp, FileWarning, Hourglass, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { fetchResumes, importCandidates, type FetchItem, type FetchStatus, type ImportResult } from "@/api/hiring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Notice } from "@/components/ui/notice";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Progress } from "@/components/hire/ui";

const WHY: Record<Exclude<FetchStatus, "parsed">, string> = {
  no_link: "No resume link in the form answers",
  not_accessible: "Drive file is private or deleted. Share the folder as “Anyone with the link”",
  not_pdf: "Not a PDF (for example a .docx)",
  too_large: "Larger than 5 MB",
  parse_failed: "PDF could not be read (scanned and OCR failed?)",
  storage_failed: "Could not save the file on the server",
};

/**
 * One action: upload the Google Form sheet, then its resumes are fetched straight away.
 * "Fetch resumes" only appears when some candidates still have none (e.g. a private Drive link was fixed).
 */
export function ImportPanel({ driveId, onChanged, missingResumes = 0, total = 0 }: { driveId: string; onChanged?: () => void; missingResumes?: number; total?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"import" | "fetch">();
  const toast = useToast();
  const [imported, setImported] = useState<ImportResult>();
  const [fetched, setFetched] = useState<FetchItem[]>();

  const fetchAll = async () => {
    setBusy("fetch");
    setFetched(await fetchResumes(driveId));
  };

  const run = async (step: () => Promise<void>) => {
    try {
      await step();
    } catch (e) {
      toast({ tone: "danger", title: (e as Error).message });
    } finally {
      setBusy(undefined);
      onChanged?.();
    }
  };

  const upload = (file: File) =>
    run(async () => {
      setBusy("import");
      setFetched(undefined);
      setImported(await importCandidates(driveId, file));
      await fetchAll();
    });

  const problems = fetched?.filter((r) => r.status !== "parsed") ?? [];

  return (
    <section className={h.cardTight} aria-label="Import candidates">
      <div className={h.between}>
        <div className={h.row} style={{ flexWrap: "nowrap", alignItems: "flex-start", minWidth: 0 }}>
          <span className={h.statIcon} aria-hidden>
            <FileSpreadsheet size={16} />
          </span>
          <div>
            <p className={h.row} style={{ fontWeight: 500, gap: 4 }}>
              Google Form sheet
              <InfoTip label="About the sheet">.xlsx or .csv with Email, Full name, Student ID and Date of birth columns. Uploading again updates existing candidates. Resumes are fetched right after upload.</InfoTip>
            </p>
            <p className={h.xs}>{total ? `${total} candidate${total === 1 ? "" : "s"} imported` : "No candidates yet"}</p>
          </div>
        </div>
        <Button variant={total ? "secondary" : "primary"} size="sm" loading={busy === "import"} disabled={busy === "fetch"} onClick={() => input.current?.click()}>
          <FileUp aria-hidden size={14} style={{ marginRight: 6 }} /> {total ? "Upload new sheet" : "Upload sheet"}
        </Button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // same file can be picked again
            if (f) upload(f);
          }}
        />
      </div>

      {(busy || missingResumes > 0) && (
        <div style={{ marginTop: 16 }}>
          <Notice
            role="status"
            compact
            tone={busy ? "info" : "warning"}
            icon={busy ? Hourglass : FileWarning}
            title={busy === "import" ? "Importing candidates…" : busy === "fetch" ? "Reading resumes…" : `${missingResumes} resume${missingResumes === 1 ? "" : "s"} still missing`}
            actions={
              !busy && (
                <Button size="sm" onClick={() => run(fetchAll)}>
                  <RefreshCw aria-hidden size={14} style={{ marginRight: 6 }} /> Fetch {missingResumes} resume{missingResumes === 1 ? "" : "s"}
                </Button>
              )
            }
          >
            {busy === "import" ? (
              "Adding and updating candidates from the sheet."
            ) : busy === "fetch" ? (
              "Downloading and reading resumes. About a minute per 100 candidates; you can keep working."
            ) : (
              <>
                {total - missingResumes} of {total} read.
                {total > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Progress value={((total - missingResumes) / total) * 100} label="Resumes read" />
                  </div>
                )}
              </>
            )}
          </Notice>
        </div>
      )}

      <div className={h.stackSm} style={{ marginTop: imported || fetched ? 16 : 0 }}>

      {(imported || fetched) && (
        <p className={h.row}>
          {imported && (
            <>
              <Badge tone="success">{imported.created} new</Badge>
              <Badge>{imported.updated} updated</Badge>
              {imported.errors.length > 0 && <Badge tone="warning">{imported.errors.length} rows skipped</Badge>}
            </>
          )}
          {fetched && (
            <>
              <Badge tone="success">{fetched.length - problems.length} resumes read</Badge>
              {problems.length > 0 && <Badge tone="warning">{problems.length} need attention</Badge>}
            </>
          )}
        </p>
      )}

      {imported && imported.errors.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Sheet row</Th>
              <Th>Problem</Th>
            </tr>
          </thead>
          <tbody>
            {imported.errors.map((e) => (
              <tr key={e.row}>
                <Td>{e.row}</Td>
                <Td>{e.message}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {problems.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Student ID</Th>
              <Th>Why the resume couldn&apos;t be read</Th>
            </tr>
          </thead>
          <tbody>
            {problems.map((r) => (
              <tr key={r.candidateId}>
                <Td>{r.studentId}</Td>
                <Td>{WHY[r.status as keyof typeof WHY]}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      </div>
    </section>
  );
}
