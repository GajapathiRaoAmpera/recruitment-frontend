"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingLabel } from "@/components/ui/skeleton";

/** The round pipeline is not on the API yet, so a real drive opens on its shortlist. */
export function RealDriveHome() {
  const { driveId } = useParams<{ driveId: string }>();
  const router = useRouter();
  useEffect(() => router.replace(`/hr/drives/${driveId}/candidates`), [driveId, router]);
  return <LoadingLabel label="Opening drive" />;
}
