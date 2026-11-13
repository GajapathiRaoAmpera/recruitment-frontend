"use client";

import { AptitudeTestScreen } from "@/features/student/aptitude-test-screen";

export default function AptitudeTestPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { real } = useStudent();
  return real ? <RealExamShell student={real} roundId={roundId} /> : <MockTest />;
}
