import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "ember" | "meadow" | "sky" | "sunburst" | "violet" | "flamingo";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}

const toneStyles: Record<Tone, string> = {
  neutral: "bg-stone-surface text-charcoal",
  ember: "bg-ember/10 text-ember",
  meadow: "bg-meadow/15 text-meadow",
  sky: "bg-sky/15 text-sky",
  sunburst: "bg-sunburst/20 text-amber-deep",
  violet: "bg-violet/15 text-violet",
  flamingo: "bg-flamingo/15 text-flamingo",
};

export function Badge({ tone = "neutral", icon, children, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-tags px-2 py-0.5 text-[12px] font-medium",
        toneStyles[tone],
        className,
      )}
      style={{ letterSpacing: "-0.14px" }}
      {...rest}
    >
      {icon ? <span className="flex h-3 w-3 items-center">{icon}</span> : null}
      {children}
    </span>
  );
}
