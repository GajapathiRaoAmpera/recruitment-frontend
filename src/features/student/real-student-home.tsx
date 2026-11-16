"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { EntryRound, StudentSession } from "@/api/entry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";
import { useFreshRounds } from "./use-entry-rounds";

/** The one thing a student can do with a round, from where its attempt stands. Never marks or scores. */
function RoundAction({ round }: { round: EntryRound }) {
  switch (round.attemptStatus) {
    case "submitted":
      return <Badge tone="success">Submitted</Badge>;
    case "locked":
      return <Badge tone="warning">Paused, waiting for HR</Badge>;
    case "expired":
      return <Badge>Time over</Badge>;
    default: {
      const resume = round.attemptStatus === "in_progress";
      return (
        <Button asChild>
          {/* the AI interview has its own sign-in and checks, not the exam system check */}
          <Link
            href={
              round.type === "ai_interview"
                ? "/interview"
                : `/exam/${round.roundId}`
            }
          >
            {resume ? "Resume" : "Start"}{" "}
            <ArrowRight aria-hidden size={16} style={{ marginLeft: 6 }} />
          </Link>
        </Button>
      );
    }
  }
}

/** Dashboard for a student signed in through the API: their rounds, read fresh from the server on every visit. */
export function RealStudentHome({ student }: { student: StudentSession }) {
  const title = (type: string) => roundTitle[type as Round["type"]] ?? type;
  const { status, rounds, retry } = useFreshRounds(student);
  return (
    <div className={h.stack}>
      <section className={h.hero}>
        <div aria-hidden className={h.heroGlow} />
        <div className={h.heroInner}>
          <div>
            <p className={h.heroEyebrow}>Signed in as {student.studentId}</p>
            <h1 className={h.heroTitle}>
              Welcome, {student.fullName.split(" ")[0]}
            </h1>
            <p className={h.heroText}>
              Pick your round to start the system check.
            </p>
          </div>
        </div>
      </section>
      <section
        className={h.card}
        aria-labelledby="open-h"
        aria-busy={status === "loading"}
      >
        <h2 id="open-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
          Your rounds
        </h2>
        {status === "error" && (
          <div style={{ marginBottom: 16 }}>
            <Notice
              role="alert"
              tone="warning"
              compact
              title="Couldn't refresh your rounds"
              actions={
                <Button variant="secondary" size="sm" onClick={retry}>
                  Try again
                </Button>
              }
            >
              This is the list from when you signed in.
            </Notice>
          </div>
        )}
        {status === "loading" ? (
          <RocketLoader size="inline" still label="Loading your rounds" />
        ) : rounds.length === 0 ? (
          <EmptyState
            title="No open rounds"
            description="HR hasn't opened a round for you yet."
          />
        ) : (
          <ol className={h.list}>
            {rounds.map((r) => (
              <li key={r.roundId} className={h.listItem}>
                <p>{title(r.type)}</p>
                <RoundAction round={r} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
