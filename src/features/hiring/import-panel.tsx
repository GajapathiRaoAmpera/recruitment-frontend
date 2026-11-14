"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { fetchResumes, importCandidates, type FetchItem, type FetchStatus, type ImportResult } from "@/api/hiring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h } from "@/components/hire/ui";

const WHY: Record<Exclude<FetchStatus, "parsed">, string> = {
  no_link: "No resume link in the form answers",
  not_accessible: "Drive file is private or deleted. Share the folder as “Anyone with the link”",
  not_pdf: "Not a PDF (for example a .docx)",
  too_large: "Larger than 5 MB",
  parse_failed: "PDF could not be read (scanned and OCR failed?)",
  storage_failed: "Could not save the file on the server",
};

/** Excel/CSV import, then resume fetching. Each step reports exactly what the API said. */
export function ImportPanel({ driveId, onChanged }: { driveId: string; onChanged?: () => void }) {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState<"import" | "fetch">();
  const [error, setError] = useState<string>();
  const [imported, setImported] = useState<ImportResult>();
  const [fetched, setFetched] = useState<FetchItem[]>();

  const run = async (kind: "import" | "fetch") => {
    setBusy(kind);
    setError(undefined);
    try {
      if (kind === "import" && file) {
        setImported(await importCandidates(driveId, file));
        setFetched(undefined);
      }
      if (kind === "fetch") setFetched(await fetchResumes(driveId));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const problems = fetched?.filter((r) => r.status !== "parsed") ?? [];

  return (
    <section className={h.card} aria-label="Import candidates">
      <div className={h.cardHead}>
        <h2 className={h.cardTitle}>Import candidates</h2>
      </div>
      <div className={h.stackSm}>
        <label className={h.cardTight} style={{ cursor: "pointer" }}>
          <FileSpreadsheet aria-hidden size={24} />
          <p style={{ fontWeight: 500, marginTop: 8 }}>Google Form export (.xlsx / .csv)</p>
          <p className={h.xs}>{file?.name ?? "Needs Email, Full name, Student ID and Date of birth columns. Every other column is kept."}</p>
          <input className="sr-only" type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
        <div className={h.row}>
          <Button disabled={!file} loading={busy === "import"} onClick={() => run("import")}>
            Import candidates
          </Button>
          <Button variant="secondary" loading={busy === "fetch"} disabled={busy === "import"} onClick={() => run("fetch")}>
            Fetch resumes from Drive links
          </Button>
        </div>
        {busy === "fetch" && <p className={h.xs}>Downloading and reading resumes. This takes about a minute per 100 candidates.</p>}
        {error && (
          <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
            {error}
          </p>
        )}

        {imported && (
          <div className={h.stackSm}>
            <p>
              <Badge tone="success">{imported.created} new</Badge> <Badge>{imported.updated} updated</Badge>{" "}
              {imported.errors.length > 0 && <Badge tone="warning">{imported.errors.length} rows skipped</Badge>}
            </p>
            {imported.errors.length > 0 && (
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
          </div>
        )}

        {fetched && (
          <div className={h.stackSm}>
            <p>
              <Badge tone="success">{fetched.length - problems.length} resumes read</Badge>{" "}
              {problems.length > 0 && <Badge tone="warning">{problems.length} need attention</Badge>}
              {fetched.length === 0 && " Nothing to fetch: every candidate already has a resume."}
            </p>
            {problems.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>Student ID</Th>
                    <Th>Problem</Th>
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
        )}
      </div>
    </section>
  );
}
