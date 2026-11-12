"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, PipelineSteps, roundLabel } from "@/components/hire/ui";
import { activeRound, driveRounds, useStore } from "@/mock/store";
import { RealDrives } from "@/features/hiring/real-drives";
import { supabase } from "@/lib/supabase";

function MockDrives() {
  const { state } = useStore();
  useBreadcrumbs([{ label: "Drives" }]);
  return (
    <>
      <PageHeader
        title="Campus drives"
        description="Every drive runs shortlist → aptitude → coding → AI interview → final. You can skip or add rounds."
        actions={
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New drive
            </Link>
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Drive</Th>
            <Th>Campus</Th>
            <Th>Candidates</Th>
            <Th style={{ minWidth: 260 }}>Progress</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {state.drives.map((d) => {
            const current = activeRound(state, d.id);
            return (
              <tr key={d.id}>
                <Td>
                  <Link href={`/hr/drives/${d.id}`} className={h.link}>
                    {d.roleTitle}
                  </Link>
                  <p className={h.xs}>{d.window}</p>
                </Td>
                <Td>{d.campus}</Td>
                <Td>{state.candidates.filter((c) => c.driveId === d.id).length}</Td>
                <Td>
                  <PipelineSteps rounds={driveRounds(state, d.id)} />
                </Td>
                <Td>{current ? <Badge tone="primary">{roundLabel(current)}</Badge> : <Badge>{d.status}</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export default function DrivesPage() {
  return supabase ? <RealDrives /> : <MockDrives />;
}
