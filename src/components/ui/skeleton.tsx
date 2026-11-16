import { RocketLoader } from "./rocket-loader";

/**
 * Kept so existing screens keep working: every loading state is the rocket now.
 * `LoadingLabel` shows the rocket with its label (still a role="status" announcement); `Skeleton` placeholder
 * blocks render nothing, so no grey half-built layout appears before the data.
 */
export function LoadingLabel({ label = "Loading" }: { label?: string }) {
  return <RocketLoader label={label} />;
}

// Props are accepted (and ignored) so existing call sites still type-check.
export const Skeleton: (props: { className?: string; style?: React.CSSProperties }) => null = () => null;
