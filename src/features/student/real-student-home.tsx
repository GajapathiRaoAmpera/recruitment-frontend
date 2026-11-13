"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { StudentSession } from "@/api/entry";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";

/** Dashboard for a student signed in through the API: the rounds they can sit right now. */
export function RealStudentHome({ student }: { student: StudentSession }) {
  const title = (type: string) => roundTitle[type as Round["type"]] ?? type;
  return (
    <div className={h.stack}>
      <section className={h.hero}>
        <div aria-hidden className={h.heroGlow} />
        <div className={h.heroInner}>
          <div>
            <p className={h.heroEyebrow}>Signed in as {student.studentId}</p>
            <h1 className={h.heroTitle}>Welcome, {student.fullName.split(" ")[0]}</h1>
            <p className={h.heroText}>Pick your round to start the system check.</p>
          </div>
        </div>
      </section>
      <section className={h.card} aria-labelledby="open-h">
        <h2 id="open-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
          Your open rounds
        </h2>
        {student.rounds.length === 0 ? (
          <EmptyState title="No open rounds" description="HR hasn't opened a round for you yet." />
        ) : (
          <ol className={h.list}>
            {student.rounds.map((r) => (
              <li key={r.roundId} className={h.listItem}>
                <p>{title(r.type)}</p>
                <Button asChild>
                  {/* the AI interview has its own sign-in and checks, not the exam system check */}
                  <Link href={r.type === "ai_interview" ? "/interview" : `/exam/${r.roundId}`}>
                    Start <ArrowRight aria-hidden size={16} style={{ marginLeft: 6 }} />
                  </Link>
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
