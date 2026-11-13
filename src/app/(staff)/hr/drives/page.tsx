"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DrivesTable } from "@/features/hiring/drives-table";
import { supabase } from "@/lib/supabase";

export default function DrivesPage() {
  useBreadcrumbs([{ label: "Drives" }]);
  return (
    <>
      <PageHeader
        title="Campus drives"
        description={supabase ? "Create a drive, import the Google Form export, then shortlist from the resumes." : "Every drive runs shortlist → aptitude → coding → AI interview → final. You can skip or add rounds."}
        actions={
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New drive
            </Link>
          </Button>
        }
      />
      <DrivesTable />
    </>
  );
}
