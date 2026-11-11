"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h } from "@/components/hire/ui";
import { useStore } from "@/mock/store";

export default function AuditLogsPage() {
  useBreadcrumbs([{ label: "Audit logs" }]);
  const { state } = useStore();
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");
  const actors = [...new Set(state.auditLogs.map((a) => a.actor))];
  const rows = state.auditLogs.filter((a) => (!actor || a.actor === actor) && (!q || `${a.action} ${a.target}`.toLowerCase().includes(q.toLowerCase())));

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [["Time", "Actor", "Action", "Target"], ...rows.map((a) => [a.at, a.actor, a.action, a.target])].map((r) => r.map(esc).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "audit-logs.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={h.stack}>
      <PageHeader
        title="Audit logs"
        description="Every HR and Super Admin action. Try advancing a round or correcting an answer key — it shows up here."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download aria-hidden size={16} style={{ marginRight: 4 }} /> Export CSV
          </Button>
        }
      />
      <div className={h.toolbar}>
        <Field label="Actor">
          <Select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Search">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action or target" />
        </Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No matching events" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <Td className={h.mono}>{a.at}</Td>
                <Td>{a.actor}</Td>
                <Td>{a.action}</Td>
                <Td>{a.target}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
