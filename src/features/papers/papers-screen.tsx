"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DraftList } from "@/features/papers/components/draft-list";
import { PrototypeState } from "@/features/papers/components/prototype-state";
import { liveApi } from "@/lib/auth";
import { useStore } from "@/mock/store";

export function PapersScreen() {
  useBreadcrumbs([{ label: "Paper builder" }]);
  const { state } = useStore();
  const isSuperAdmin = state.session?.role === "SUPER_ADMIN";
  const ownerName = (id: string) => state.staff.find((u) => u.id === id)?.name ?? `${id.slice(0, 8)}…`;

  return (
    <>
      <PageHeader
        title="Paper builder"
        description="Round 1 aptitude papers generated and checked by AI, reviewed by you."
        actions={
          liveApi && (
            <Button asChild>
              <Link href="/hr/papers/new">
                <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New paper
              </Link>
            </Button>
          )
        }
      />
      {liveApi ? <DraftList showOwner={isSuperAdmin} ownerName={ownerName} /> : <PrototypeState />}
    </>
  );
}
