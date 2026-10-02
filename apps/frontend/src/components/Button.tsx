import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import "./Button.css";

export type ButtonVariant =
  | "primary"
  | "primary-inverse"
  | "ghost-gold"
  | "ghost-bordeaux"
  | "danger"
  | "danger-inverse";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

type NativeProps = Omit<ComponentPropsWithoutRef<"button">, "type">;

type VariantProps =
  | { variant: "ghost-gold" | "ghost-bordeaux"; active?: boolean }
  | {
      variant?: "primary" | "primary-inverse" | "danger" | "danger-inverse";
      active?: never;
    };

type SizeProps =
  | { size?: "sm" | "md" | "lg" }
  | { size: "icon"; "aria-label": string };

export type ButtonProps = NativeProps &
  VariantProps &
  SizeProps & {
    fullWidth?: boolean;
    type?: "button" | "submit" | "reset";
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    active,
    fullWidth = false,
    type = "button",
    className,
    ...rest
  },
  ref,
) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`];
  if (fullWidth) classes.push("btn--full");
  if (active) classes.push("btn--active");
  if (className) classes.push(className);

  return (
    <button
      ref={ref}
      type={type}
      className={classes.join(" ")}
      aria-pressed={active}
      {...rest}
    />
  );
});

export default Button;
