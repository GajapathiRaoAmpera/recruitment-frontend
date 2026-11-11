"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import { useExamRound } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";

export default function DonePage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { round, recorded } = useExamRound(roundId);
  // Coding summary shows counts only — hidden case contents are never shown to students.
  const [summary] = useState<{ title: string; passed: number }[] | null>(() => {
    try {
      const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(`done:${roundId}`);
      return raw ? (JSON.parse(raw) as { title: string; passed: number }[]) : null;
    } catch {
      return null;
    }
  });

  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
      </header>
      <main className={s.examBody} style={{ maxWidth: "36rem", marginInline: "auto", width: "100%" }}>
        <section className={h.card} style={{ textAlign: "center" }}>
          <CheckCircle2 aria-hidden size={40} color="var(--ui-color-success)" style={{ margin: "0 auto" }} />
          <h1 className={h.cardTitle} style={{ marginTop: 12 }}>
            {round?.type === "ai_interview" ? "Interview submitted" : "Submitted successfully"}
          </h1>
          <p className={h.muted} style={{ marginTop: 6 }}>
            {recorded ? "Your responses are recorded. HR reviews every round and you'll get an email with the result." : "Preview finished — nothing was recorded."}
          </p>
          {round?.type === "coding" && summary && (
            <ul className={h.list} style={{ marginTop: 16, textAlign: "left" }}>
              {summary.map((p) => (
                <li key={p.title} className={h.listItem}>
                  <span>{p.title}</span>
                  <strong>{p.passed} / 18 passed</strong>
                </li>
              ))}
            </ul>
          )}
          <Button asChild style={{ marginTop: 20 }}>
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </section>
      </main>
    </>
  );
}
