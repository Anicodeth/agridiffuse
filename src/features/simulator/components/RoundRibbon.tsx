"use client";

import { motion } from "framer-motion";
import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils/cn";

/**
 * Horizontal strip of round chips. Click one to scrub the narrative + event
 * log to that round. The most recent round is highlighted; "latest" pill
 * means selectedRound === null.
 */
export function RoundRibbon() {
  const history = useGraphStore((s) => s.history);
  const selectedRound = useGraphStore((s) => s.selectedRound);
  const setSelectedRound = useGraphStore((s) => s.setSelectedRound);

  const latest = history[history.length - 1];
  if (!latest) {
    return (
      <div className="card-inset rounded-cards px-4 py-2.5 text-[12px] text-ash">
        Round timeline appears here once you run a round.
      </div>
    );
  }
  const isLatest = selectedRound === null || selectedRound === latest.round;

  return (
    <div className="card-inset rounded-cards flex items-center gap-2 overflow-x-auto px-3 py-2">
      <span
        className="text-ash pr-1 text-[11px] font-medium uppercase shrink-0"
        style={{ letterSpacing: "0.04em" }}
      >
        Rounds
      </span>
      {history.map((r) => {
        const active = selectedRound === r.round || (selectedRound === null && r === latest);
        return (
          <motion.button
            layout
            key={r.round}
            onClick={() => setSelectedRound(r === latest ? null : r.round)}
            className={cn(
              "rounded-buttons inline-flex shrink-0 items-center gap-2 px-3 h-8 text-[12px] font-medium transition",
              active
                ? "bg-midnight text-white"
                : "bg-warm-canvas text-graphite hover:bg-stone-surface",
            )}
            style={{ letterSpacing: "-0.14px" }}
            aria-pressed={active}
            title={`Round ${r.round} · ${r.newAdoptions} adoptions · ${r.totalRewardDistributed.toFixed(2)} tADA`}
          >
            <span>R{r.round}</span>
            <span className={cn(active ? "text-white/70" : "text-ash")}>+{r.newAdoptions}</span>
            <span className={cn(active ? "text-white/70" : "text-ember")}>
              {r.totalRewardDistributed.toFixed(1)}
            </span>
          </motion.button>
        );
      })}
      {!isLatest ? (
        <button
          onClick={() => setSelectedRound(null)}
          className="text-ember pl-1 text-[12px] hover:underline"
          style={{ letterSpacing: "-0.14px" }}
        >
          → latest
        </button>
      ) : null}
    </div>
  );
}
