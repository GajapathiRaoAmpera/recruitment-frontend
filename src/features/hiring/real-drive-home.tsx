"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { listRounds } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { ErrorState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";

/** A real drive: its shortlist, plus each round with a link to its live progress. */
export function RealDriveHome() {
  const { driveId } = useParams<{ driveId: string }>();
  const { data, error, reload } = useAsync(() => listRounds(driveId), [driveId]);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: "Drive" }]);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RobotLoader label="Opening drive" />;
  return (
    <div className={h.stack}>
      <PageHeader
        title="Drive"
        actions={
          <Button asChild variant="secondary">
            <Link href={`/hr/drives/${driveId}/candidates`}>Shortlist</Link>
          </Button>
        }
      />
      <section className={h.card} aria-labelledby="rounds-h">
        <h2 id="rounds-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
          Rounds
        </h2>
        <ol className={h.list}>
          {data.map((r) => (
            <li key={r.id} className={h.listItem}>
              <span className={h.row}>
                {r.position}. {r.type.replace("_", " ")} <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
              </span>
              <Button asChild variant="secondary">
                <Link href={`/hr/drives/${driveId}/rounds/${r.id}`}>Progress</Link>
              </Button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
