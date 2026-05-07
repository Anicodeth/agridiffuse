import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "dark" | "light" | "ghost";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface AsButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> {
  href?: undefined;
}

interface AsLinkProps extends CommonProps {
  href: string;
  external?: boolean;
}

export type PillButtonProps = AsButtonProps | AsLinkProps;

const variantStyles: Record<Variant, string> = {
  dark: "bg-midnight text-white hover:bg-charcoal",
  light: "bg-stone-surface text-midnight hover:bg-fog/40",
  ghost: "bg-transparent text-ember hover:opacity-80 px-0",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-buttons font-medium transition-[background,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

function isLinkProps(props: PillButtonProps): props is AsLinkProps {
  return typeof (props as AsLinkProps).href === "string";
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(function PillButton(
  props,
  ref,
) {
  const {
    variant = "dark",
    size = "md",
    leadingIcon,
    trailingIcon,
    children,
    className,
  } = props;

  const cls = cn(baseClasses, variantStyles[variant], sizeStyles[size], className);

  const inner = (
    <>
      {leadingIcon ? <span className="-ml-0.5">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="-mr-0.5">{trailingIcon}</span> : null}
    </>
  );

  if (isLinkProps(props)) {
    return (
      <Link
        href={props.href}
        className={cls}
        target={props.external ? "_blank" : undefined}
        rel={props.external ? "noreferrer" : undefined}
      >
        {inner}
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    leadingIcon: _leading,
    trailingIcon: _trailing,
    className: _className,
    children: _children,
    ...buttonAttrs
  } = props;
  void _variant;
  void _size;
  void _leading;
  void _trailing;
  void _className;
  void _children;

  return (
    <button ref={ref} className={cls} {...buttonAttrs}>
      {inner}
    </button>
  );
});
