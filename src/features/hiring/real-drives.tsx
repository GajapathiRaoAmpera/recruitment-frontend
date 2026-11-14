"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { listDrives } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";

export function RealDrives() {
  useBreadcrumbs([{ label: "Drives" }]);
  const { data, error, loading, reload } = useAsync(listDrives, []);
  if (loading && !data && !error) return <RobotLoader label="Loading drives" />;
  return (
    <>
      <PageHeader
        title="Campus drives"
        description="Create a drive, import the Google Form export, then shortlist from the resumes."
        actions={
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New drive
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title="No drives yet" description="Create your first campus drive." action={<Button asChild><Link href="/hr/drives/new">New drive</Link></Button>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Drive</Th>
              <Th>Campus</Th>
              <Th>Candidates</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href={`/hr/drives/${d.id}/candidates`} className={h.link}>
                    {d.roleTitle}
                  </Link>
                  <p className={h.xs}>{d.company}</p>
                </Td>
                <Td>{d.campus}</Td>
                <Td>{d.candidates}</Td>
                <Td>
                  <Badge>{d.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
