import { FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Round } from "@/mock/types";

/** "Build Round 1 paper" for aptitude rounds; nothing for other round types. */
export function BuildPaperLink({ round }: { round: Pick<Round, "type" | "driveId"> }) {
  if (round.type !== "aptitude") return null;
  return (
    <Button asChild variant="secondary">
      <Link href={`/hr/papers/new?drive=${encodeURIComponent(round.driveId)}`}>
        <FileText aria-hidden size={16} style={{ marginRight: 6 }} /> Build Round 1 paper
      </Link>
    </Button>
  );
}
