"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { listDrives, type Drive } from "@/api/hiring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, PipelineSteps, roundLabel } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { liveApi } from "@/lib/auth";
import { activeRound, driveRounds, useStore } from "@/mock/store";

/** The drives list shared by the Drives page and both dashboards (the API scopes it: HR sees own drives, Super Admin sees all). */
export function MockDrivesTable() {
  const { state } = useStore();
  if (state.drives.length === 0) {
    return <EmptyState title="No drives yet" description="Create your first campus drive." action={<Button asChild><Link href="/hr/drives/new">New drive</Link></Button>} />;
  }
  return (
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
  );
}

export function RealDrivesTable() {
  const { data, error, reload } = useAsync(listDrives, []);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RocketLoader label="Loading drives" />;
  if (!data.length) {
    return <EmptyState title="No drives yet" description="Create your first campus drive." action={<Button asChild><Link href="/hr/drives/new">New drive</Link></Button>} />;
  }
  return (
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
              <Link href={`/hr/drives/${d.id}`} className={h.link}>
                {d.roleTitle}
              </Link>
              <p className={h.xs}>
                {d.company}
                {d.ownerName ? ` · Run by ${d.ownerName}` : ""}
              </p>
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
  );
}

export const DrivesTable = () => (liveApi ? <RealDrivesTable /> : <MockDrivesTable />);

/** Card layout of the same drives list, used on the dashboards. */
export function MockDrivesCards() {
  const { state } = useStore();
  if (state.drives.length === 0) {
    return <EmptyState title="No drives yet" description="Create your first campus drive." action={<Button asChild><Link href="/hr/drives/new">New drive</Link></Button>} />;
  }
  return (
    <>
      {state.drives.map((d) => {
        const current = activeRound(state, d.id);
        const enrolled = state.candidates.filter((c) => c.driveId === d.id).length;
        return (
          <article key={d.id} className={h.card}>
            <div className={h.cardHead}>
              <div>
                <h3 style={{ fontWeight: 500 }}>{d.roleTitle}</h3>
                <p className={h.xs}>
                  {d.campus} · {d.window}
                </p>
              </div>
              {current ? <Badge tone="primary">{roundLabel(current)} active</Badge> : <Badge>Not started</Badge>}
            </div>
            <PipelineSteps rounds={driveRounds(state, d.id)} />
            <div className={h.between} style={{ marginTop: "1rem" }}>
              <p className={h.small}>
                <strong>{enrolled}</strong> candidates enrolled
              </p>
              <Button asChild size="sm">
                <Link href={`/hr/drives/${d.id}`}>
                  Manage pipeline <ArrowRight aria-hidden size={14} style={{ marginLeft: 4 }} />
                </Link>
              </Button>
            </div>
          </article>
        );
      })}
    </>
  );
}

/** Fetches the drives itself; pages that already hold the list should render `DriveCardList` so nothing loads twice. */
export function RealDrivesCards() {
  const { data, error, reload } = useAsync(listDrives, []);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RocketLoader label="Loading drives" />;
  return <DriveCardList drives={data} />;
}

/** The cards only: a long list scrolls inside its own box instead of stretching the page. */
export function DriveCardList({ drives: data }: { drives: Drive[] }) {
  if (!data.length) {
    return <EmptyState title="No drives yet" description="Create your first campus drive." action={<Button asChild><Link href="/hr/drives/new">New drive</Link></Button>} />;
  }
  return (
    <div className={`${h.stackSm} ${h.scrollBox}`}>
      {data.map((d) => (
        <article key={d.id} className={h.card}>
          <div className={h.cardHead}>
            <div>
              <h3 style={{ fontWeight: 500 }}>{d.roleTitle}</h3>
              <p className={h.xs}>
                {d.company} · {d.campus}
                {d.ownerName ? ` · Run by ${d.ownerName}` : ""}
              </p>
            </div>
            <Badge>{d.status}</Badge>
          </div>
          <div className={h.between} style={{ marginTop: "1rem" }}>
            <p className={h.small}>
              <strong>{d.candidates}</strong> candidates enrolled
            </p>
            <Button asChild size="sm">
              <Link href={`/hr/drives/${d.id}`}>
                Manage pipeline <ArrowRight aria-hidden size={14} style={{ marginLeft: 4 }} />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export const DrivesCards = () => (liveApi ? <RealDrivesCards /> : <MockDrivesCards />);
