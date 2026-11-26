import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "small";
  block?: boolean;
  busy?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  busy,
  className,
  disabled,
  children,
  type,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, size === "small" && "btn--small", block && "btn--block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
