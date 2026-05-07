import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "white" | "recessed" | "product";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  white: "card-inset",
  recessed: "card-recessed",
  product: "card-product",
};

export function Card({ variant = "white", className, children, ...rest }: CardProps) {
  return (
    <div className={cn(variantStyles[variant], "p-8", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-charcoal font-medium", className)}
      style={{ fontSize: "var(--text-heading-sm)", letterSpacing: "-0.25px", lineHeight: 1.38 }}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-graphite", className)}
      style={{ fontSize: "var(--text-body)", lineHeight: 1.47, letterSpacing: "-0.2px" }}
      {...rest}
    >
      {children}
    </div>
  );
}
