import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "light";
type ButtonSize = "sm" | "md" | "lg";

type ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type LinkButtonProps = ButtonBaseProps & {
  href: string;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "children" | "className" | "href">;

type NativeButtonProps = ButtonBaseProps & {
  href?: undefined;
} & ComponentPropsWithoutRef<"button">;

type ButtonProps = LinkButtonProps | NativeButtonProps;

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-szocial-orange text-white shadow-sm hover:bg-orange-600 focus-visible:ring-szocial-orange",
  secondary:
    "bg-szocial-teal text-white shadow-sm hover:bg-teal-800 focus-visible:ring-szocial-teal",
  outline:
    "border border-slate-200 bg-white text-szocial-ink hover:border-szocial-teal hover:text-szocial-teal focus-visible:ring-szocial-teal",
  ghost:
    "bg-transparent text-szocial-ink hover:bg-slate-100 focus-visible:ring-szocial-teal",
  light:
    "bg-white/95 text-szocial-ink hover:bg-white focus-visible:ring-white"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base"
};

function buttonClasses({
  className,
  size,
  variant
}: {
  className?: string;
  size: ButtonSize;
  variant: ButtonVariant;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    sizes[size],
    variants[variant],
    className
  );
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      children,
      className,
      href,
      size = "md",
      variant = "primary",
      ...linkProps
    } = props;

    return (
      <Link className={buttonClasses({ className, size, variant })} href={href} {...linkProps}>
        {children}
      </Link>
    );
  }

  const {
    children,
    className,
    size = "md",
    type,
    variant = "primary",
    ...buttonProps
  } = props;

  return (
    <button
      className={buttonClasses({ className, size, variant })}
      type={type ?? "button"}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
