import { Badge } from "@/components/ui/badge";

/** Tab switches so far: neutral at 0, amber while warned, red once the limit is reached. */
export function TabSwitchBadge({ count, max }: { count: number; max: number }) {
  const tone = count >= max ? "danger" : count > 0 ? "warning" : "neutral";
  const left = max - count;
  return (
    <Badge tone={tone}>
      <span role="status" aria-live="polite">
        Tab switches {Math.min(count, max)} / {max}
        {left === 1 && " · 1 more closes the test"}
        {left <= 0 && " · test closed"}
      </span>
    </Badge>
  );
}
