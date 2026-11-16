import s from "./interview.module.scss";
import { type Verdict, verdictLabel } from "./use-network-quality";

export function NetworkBars({ verdict }: { verdict: Verdict }) {
  const on = verdict === "good" ? 3 : verdict === "weak" ? 2 : verdict === "offline" ? 1 : 0;
  return (
    <span>
      <span className={s.bars} data-v={verdict} aria-hidden>
        {[6, 10, 14].map((ht, i) => (
          <i key={ht} style={{ height: ht }} data-on={i < on} />
        ))}
      </span>
      {verdictLabel[verdict]}
    </span>
  );
}
