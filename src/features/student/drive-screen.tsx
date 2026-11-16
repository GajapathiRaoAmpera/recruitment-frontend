"use client";

import { Maximize, MapPin, ShieldCheck, Timer } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { hire as h } from "@/components/hire/ui";
import { useStudent } from "@/components/student/hooks";
import { driveRounds, MAX_TAB_SWITCHES, useStore } from "@/mock/store";

const RULES = [
  { icon: ShieldCheck, text: "Before every round you confirm your Student ID and date of birth." },
  { icon: MapPin, text: "Allow location access and accept the terms to start." },
  { icon: Maximize, text: `The test runs in full screen. Leaving the tab ${MAX_TAB_SWITCHES} times closes it; HR can let you resume.` },
  { icon: Timer, text: "Your answers, code and timer are saved as you go — a refresh or network drop won't lose work." },
];

export function DriveScreen() {
  const { state } = useStore();
  const { drive } = useStudent();
  if (!drive) return null;
  return (
    <div className={h.stack}>
      <PageHeader title={drive.roleTitle} description={`${drive.company} · ${drive.campus} · ${drive.window}`} />
      <section className={h.card}>
        <h2 className={h.cardTitle} style={{ marginBottom: 8 }}>
          About the role
        </h2>
        <p>{drive.jd}</p>
      </section>
      <div className={h.grid2}>
        <section className={h.card}>
          <h2 className={h.cardTitle} style={{ marginBottom: 12 }}>
            Selection stages
          </h2>
          <ol className={h.list}>
            {driveRounds(state, drive.id)
              .filter((r) => r.status !== "skipped")
              .map((r, i) => (
                <li key={r.id} className={h.listItem}>
                  <span>
                    {i + 1}. {r.title}
                  </span>
                  <span className={h.xs}>{r.durationMin ? `${r.durationMin} min` : ""}</span>
                </li>
              ))}
          </ol>
        </section>
        <section className={h.card}>
          <h2 className={h.cardTitle} style={{ marginBottom: 12 }}>
            Test rules
          </h2>
          <ul className={h.stackSm}>
            {RULES.map(({ icon: Icon, text }) => (
              <li key={text} className={h.row} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <Icon aria-hidden size={18} style={{ flexShrink: 0, marginTop: 2 }} /> <span className={h.small}>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
