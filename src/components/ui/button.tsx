import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { Children, cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
}

type IconProps = { size?: number; style?: CSSProperties; children?: ReactNode };
// shortcut: a component element with no children at either end of the label is taken to be the icon (our buttons use lucide icons there)
const isIcon = (k: ReactNode): k is ReactElement<IconProps> => isValidElement<IconProps>(k) && typeof k.type !== "string" && k.props.children === undefined;
/** Back arrows point the way they go, so they stay on the left. */
const LEADING = new Set(["ArrowLeft", "ChevronLeft"]);

/**
 * Icon goes to the right of the label; while loading, the spinner takes the icon's place (same size, no layout shift).
 * Buttons without an icon get the spinner on the right of the label.
 */
function arrange(children: ReactNode, loading: boolean, size: ButtonSize): ReactNode {
  const kids = Children.toArray(children).filter((k) => !(typeof k === "string" && !k.trim()));
  const at = isIcon(kids[0]) ? 0 : isIcon(kids[kids.length - 1]) ? kids.length - 1 : -1;
  const spinner = (px: number, style?: CSSProperties) => <Loader2 key="spinner" aria-hidden size={px} style={style} className={s.spinner} />;
  if (at === -1) return loading ? [...kids, spinner(size === "sm" ? 14 : 16)] : children;
  const icon = kids[at] as ReactElement<IconProps>;
  const rest = kids.filter((_, i) => i !== at);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the button's gap spaces the icon, so per-icon margins are dropped
  const { marginLeft, marginRight, ...style } = icon.props.style ?? {};
  const shown = loading ? spinner(icon.props.size ?? 16, style) : cloneElement(icon, { key: "icon", style });
  const name = (icon.type as { displayName?: string }).displayName ?? "";
  return LEADING.has(name) ? [shown, ...rest] : [...rest, shown];
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, asChild, className, disabled, children, type, ...rest },
  ref,
) {
  const classes = cn(s.button, s[variant], s[size], className);
  if (asChild) {
    // The icon sits inside the link (or other child), so arrange that element's own children.
    const child = isValidElement<{ children?: ReactNode }>(children) ? cloneElement(children, undefined, arrange(children.props.children, false, size)) : children;
    return (
      <Slot ref={ref} data-variant={variant} className={classes} {...rest}>
        {child}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      data-variant={variant}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {arrange(children, loading, size)}
    </button>
  );
});
