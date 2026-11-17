"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { exitFullscreen } from "@/components/student/hooks";
import student from "@/components/student/student.module.scss";
import s from "./thank-you-screen.module.scss";

/** Interview rounds end the drive's assessments, so "what happens next" talks about the decision, not a next round. */
const LAST_ROUNDS = new Set(["ai_interview", "technical", "final"]);

interface Props {
  /** The student's full name; the first word is used in the greeting. */
  name?: string;
  /** Round type from the API (aptitude, coding, ai_interview, ...). */
  roundType?: string;
  /** Shown under the greeting, e.g. "Round 2 · Coding". */
  roundTitle?: string;
  /** Time ran out and the answers were submitted automatically. */
  timeUp?: boolean;
  /** False in prototype preview: nothing was saved, so there are no next steps. */
  recorded?: boolean;
  /** Offer the way back to the student dashboard (the interview has its own sign-in, so it has none). */
  dashboard?: boolean;
}

/**
 * The page a student sees when a round ends: a thank-you, what was submitted, and what happens next.
 * Never shows marks, scores or test-case results (AC-7): those reach the student only through HR.
 */
export function ThankYouScreen({ name, roundType, roundTitle, timeUp = false, recorded = true, dashboard = true }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Fixed when the page opens, which is when the round was submitted. The server render may differ by a minute or a
  // locale, so the line below opts out of the hydration text check.
  const [at] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  useEffect(() => {
    exitFullscreen(); // the round is over: give the student their normal window back
    heading.current?.focus(); // screen readers start here, not wherever focus was in the test
  }, []);

  const first = name?.trim().split(/\s+/)[0];
  const isInterview = roundType === "ai_interview";
  const what = isInterview ? "interview" : "answers";
  const steps = LAST_ROUNDS.has(roundType ?? "")
    ? [`HR reviews your ${isInterview ? "interview" : "round"}.`, "You'll get an email with the final decision.", "If you're selected, HR contacts you about the offer."]
    : ["HR reviews every submission once the round closes.", "You'll get an email with your result.", "If you move on, your next round opens on your dashboard."];

  return (
    <div className={s.page}>
      <header className={student.examBar}>
        <Logo height={22} />
      </header>
      <main className={s.body}>
        <section className={s.card} aria-labelledby="thank-you-h">
          <svg className={s.mark} viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r="38" className={s.disc} />
            <circle cx="40" cy="40" r="30" className={s.ring} />
            <path d="M27 41 L36 50 L54 31" className={s.check} />
          </svg>
          <h1 id="thank-you-h" ref={heading} tabIndex={-1} className={s.title}>
            {first ? `Thank you, ${first}` : "Thank you"}
          </h1>
          <p className={s.lead}>
            {!recorded
              ? "Preview finished. Nothing was recorded."
              : timeUp
                ? `Time ran out, so your ${what} were submitted automatically.`
                : isInterview
                  ? "Your interview is complete and saved."
                  : "Your answers are submitted and saved."}
          </p>
          {(roundTitle || at) && (
            <p className={s.meta} suppressHydrationWarning>
              {roundTitle}
              {roundTitle && at && ", "}
              {at && `${isInterview ? "finished" : "submitted"} at ${at}`}
            </p>
          )}

          {recorded && (
            <div className={s.next}>
              <h2 className={s.nextTitle}>What happens next</h2>
              <ol className={s.steps}>
                {steps.map((step, i) => (
                  <li key={step} className={s.step}>
                    <span aria-hidden className={s.num}>
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className={s.actions}>
            {dashboard && (
              <Button asChild>
                <Link href="/student">Back to dashboard</Link>
              </Button>
            )}
            <p className={s.hint}>You can close this window now.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
