"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import { RealDrivesCards } from "@/features/hiring/drives-table";

/** Super Admin overview from the API: the same drives list as the Drives page (the API returns every drive for this role). */
export function RealAdminOverview() {
  useBreadcrumbs([{ label: "Admin overview" }]);
  return (
    <div className={h.stack}>
      <PageHeader
        title="Super Admin overview"
        description="All campus drives."
        actions={
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New drive
            </Link>
          </Button>
        }
      />
      <section className={h.stackSm} aria-labelledby="drives-h">
        <div className={h.between}>
          <h2 id="drives-h" className={h.cardTitle}>
            Campus drives
          </h2>
          <Link href="/hr/drives" className={h.link}>
            View all drives
          </Link>
        </div>
        <RealDrivesCards />
      </section>
    </div>
  );
}
