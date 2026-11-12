import { hire as h } from "@/components/hire/ui";

export const PAPER_STEPS = ["Setup", "Generate", "Review", "Send"] as const;

/** The 4-step progress strip; `current` is the index of the active step. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className={h.steps} style={{ "--n": PAPER_STEPS.length, marginBottom: "1.5rem" } as React.CSSProperties} aria-label="Paper builder steps">
      {PAPER_STEPS.map((label, i) => (
        <li key={label} className={h.step} data-status={i < current ? "completed" : i === current ? "active" : "pending"} aria-current={i === current ? "step" : undefined}>
          <span className={h.stepBar} />
          <span className={h.stepLabel}>
            {i + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
