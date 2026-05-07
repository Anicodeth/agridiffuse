"use client";

import { useEffect } from "react";
import { useGraphStore, type SimMode } from "@/stores/graphStore";
import { cn } from "@/lib/utils/cn";

const MODES: { id: SimMode; label: string; hint: string }[] = [
  { id: "view", label: "View", hint: "Inspect" },
  { id: "sim", label: "Sim", hint: "Run rounds" },
  { id: "build", label: "Build", hint: "Add nodes" },
];

export function SimToolbar() {
  const mode = useGraphStore((s) => s.mode);
  const setMode = useGraphStore((s) => s.setMode);

  // 1 = view, 2 = sim — quick keyboard shortcut for the demo operator.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "1") setMode("view");
      else if (e.key === "2") setMode("sim");
      else if (e.key === "3") setMode("build");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  return (
    <div className="card-inset rounded-buttons inline-flex p-1">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-buttons inline-flex items-center gap-2 px-4 h-8 text-[13px] font-medium transition",
              active ? "bg-midnight text-white" : "text-graphite hover:text-charcoal",
            )}
            style={{ letterSpacing: "-0.17px" }}
            aria-pressed={active}
          >
            <span>{m.label}</span>
            <span
              className={cn("text-[11px]", active ? "text-white/60" : "text-ash")}
              style={{ letterSpacing: "-0.12px" }}
            >
              {m.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
