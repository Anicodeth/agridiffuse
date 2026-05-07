"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useGraphStore } from "@/stores/graphStore";
import { PillButton } from "@/components/ui/PillButton";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { BlobCharacter } from "@/components/illustrations/BlobCharacter";
import { cn } from "@/lib/utils/cn";

const SPEEDS: Array<{ value: 1 | 2 | 4; label: string }> = [
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
];

/**
 * Autoplay tempo: lower bound 700ms (4×), 1.4s (2×), 2.4s (1×). The base
 * round particle animation runs ~1.2s; we wait a little longer than that so
 * the next round's events don't pile on top of the previous round's particles.
 */
const AUTOPLAY_MS_BY_SPEED: Record<1 | 2 | 4, number> = {
  1: 2400,
  2: 1400,
  4: 700,
};

export function SimControls() {
  const isRunning = useGraphStore((s) => s.isRunning);
  const runRound = useGraphStore((s) => s.runRound);
  const reset = useGraphStore((s) => s.reset);
  const replayLastRound = useGraphStore((s) => s.replayLastRound);
  const lastResult = useGraphStore((s) => s.lastResult);
  const speed = useGraphStore((s) => s.speed);
  const setSpeed = useGraphStore((s) => s.setSpeed);
  const autoplay = useGraphStore((s) => s.autoplay);
  const setAutoplay = useGraphStore((s) => s.setAutoplay);

  // ── Autoplay loop ────────────────────────────────────────────────
  // We use refs for the latest store values so the timer doesn't churn on every
  // render. The interval is reinstated when speed or autoplay flips.
  const runRoundRef = useRef(runRound);
  runRoundRef.current = runRound;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const setAutoplayRef = useRef(setAutoplay);
  setAutoplayRef.current = setAutoplay;
  const lastAdoptionsRef = useRef(lastResult?.newAdoptions ?? null);
  const consecutiveZerosRef = useRef(0);

  useEffect(() => {
    if (!autoplay) {
      consecutiveZerosRef.current = 0;
      return;
    }
    let cancelled = false;
    const interval = AUTOPLAY_MS_BY_SPEED[speed];

    const tick = async () => {
      if (cancelled) return;
      if (isRunningRef.current) return;
      await runRoundRef.current();
      if (cancelled) return;

      // Stop autoplay once the spread plateaus (3 consecutive empty rounds).
      const adoptions = useGraphStore.getState().lastResult?.newAdoptions ?? 0;
      if (adoptions === 0) consecutiveZerosRef.current += 1;
      else consecutiveZerosRef.current = 0;
      lastAdoptionsRef.current = adoptions;
      if (consecutiveZerosRef.current >= 3) {
        setAutoplayRef.current(false);
      }
    };

    const id = setInterval(tick, interval);
    // Fire one immediately so the first round happens on press, not after a delay.
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [autoplay, speed]);

  // Spacebar = single round (paused) or toggle autoplay (when running).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!isRunningRef.current) runRoundRef.current();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        setAutoplayRef.current(!useGraphStore.getState().autoplay);
      } else if (e.code === "KeyR" && (e.ctrlKey || e.metaKey)) {
        // ignore — let browser refresh handle this
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePlay = () => setAutoplay(!autoplay);

  return (
    <Card className="!p-6">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Spread simulator</CardTitle>
        <BlobCharacter color="ember" size={40} />
      </div>
      <CardBody className="mb-5">
        Each round runs <code className="text-ember">trust × adoption</code> propagation across the
        graph, then traces every adoption back to its closest expert ancestor for a reward.
      </CardBody>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <PillButton
            variant="dark"
            size="lg"
            onClick={togglePlay}
            className="flex-1"
            disabled={isRunning && !autoplay}
          >
            {autoplay ? (
              <span className="flex items-center gap-2">
                <motion.span
                  className="bg-warm-canvas inline-block h-2 w-2 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Pause
              </span>
            ) : (
              <>Play ▶</>
            )}
          </PillButton>
          <PillButton
            variant="light"
            size="lg"
            onClick={() => runRound()}
            disabled={isRunning || autoplay}
            aria-label="Step one round"
            title="Step one round (Space)"
          >
            Step →
          </PillButton>
        </div>

        <div className="card-inset rounded-buttons mt-1 flex items-center justify-between p-1">
          <span className="text-ash pl-3 text-[12px]" style={{ letterSpacing: "-0.14px" }}>
            Speed
          </span>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                className={cn(
                  "rounded-buttons px-3 h-7 text-[12px] font-medium transition",
                  speed === s.value
                    ? "bg-midnight text-white"
                    : "text-graphite hover:text-charcoal",
                )}
                aria-pressed={speed === s.value}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <PillButton
            variant="ghost"
            size="sm"
            onClick={replayLastRound}
            disabled={!lastResult}
            className="flex-1 !justify-start"
            title="Re-animate the most recent round without advancing"
          >
            ⟳ Replay last round
          </PillButton>
          <PillButton variant="ghost" size="sm" onClick={() => reset()}>
            Reset
          </PillButton>
        </div>
      </div>

      <p className="text-ash mt-3 text-center text-[12px]" style={{ letterSpacing: "-0.14px" }}>
        <kbd className="bg-stone-surface rounded px-1.5 py-0.5">space</kbd> step ·{" "}
        <kbd className="bg-stone-surface rounded px-1.5 py-0.5">P</kbd> play/pause ·{" "}
        <kbd className="bg-stone-surface rounded px-1.5 py-0.5">1</kbd>/
        <kbd className="bg-stone-surface rounded px-1.5 py-0.5">2</kbd>/
        <kbd className="bg-stone-surface rounded px-1.5 py-0.5">3</kbd> mode
      </p>
    </Card>
  );
}
