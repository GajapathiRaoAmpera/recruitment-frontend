"use client";

import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, Person } from "@/components/hire/ui";
import { RealInterviews } from "@/features/interview/real-interviews";
import { supabase } from "@/lib/supabase";
import { candidateById, useStore } from "@/mock/store";

export default function InterviewsPage() {
  return supabase ? <RealInterviews /> : <MockInterviews />;
}

function MockInterviews() {
  useBreadcrumbs([{ label: "Interviews" }]);
  const { state } = useStore();
  return (
    <>
      <PageHeader title="AI interviews" description="Transcripts and AI rubric scores from Gemini Live interviews. Add your notes before deciding." />
      {state.interviews.length === 0 ? (
        <EmptyState title="No interviews yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>Drive</Th>
              <Th>Slot</Th>
              <Th>AI score</Th>
              <Th>HR notes</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {state.interviews.map((iv) => {
              const c = candidateById(state, iv.candidateId)!;
              const d = state.drives.find((x) => x.id === c.driveId)!;
              const s = iv.aiScores;
              return (
                <tr key={iv.id}>
                  <Td>
                    <Link href={`/hr/interviews/${iv.id}`}>
                      <Person name={c.name} meta={c.studentId} />
                    </Link>
                  </Td>
                  <Td>{d.roleTitle}</Td>
                  <Td>{iv.slot}</Td>
                  <Td>{s ? `${((s.communication + s.technical + s.problemSolving + s.culture) / 4).toFixed(1)} / 5` : "—"}</Td>
                  <Td className={h.small}>{iv.hrNotes || <span className={h.muted}>None</span>}</Td>
                  <Td>
                    <Badge tone={iv.status === "completed" ? "success" : "info"}>{iv.status === "completed" ? "Completed" : "Scheduled"}</Badge>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
