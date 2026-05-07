"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewportPortal, useNodes } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { RoundEvent, RoundResult } from "@/lib/graph/types";

/**
 * Movement view.
 *
 * For each event in the active round, we draw a small dot that travels from
 * source to target across the canvas. Adoptions = meadow green (forward flow),
 * rewards = ember (flow back from farmer to expert), blocked = ash (fades out
 * before reaching target). Particles are staggered ~80ms so the round reads as
 * a sequence rather than a single frame.
 *
 * Renders inside ReactFlow's ViewportPortal so the overlay pans/zooms with the
 * graph automatically.
 */

interface EdgeFlowOverlayProps {
  result: RoundResult | null;
  /** Bumped to force a replay of the most recent round without re-running. */
  replayKey: number;
  /** 1 = full-tempo (~1.2s/particle), 2 = double-time, 4 = blink-and-miss. */
  speed: 1 | 2 | 4;
}

interface Particle {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
  color: string;
  faded: boolean;
}

const ADOPT_COLOR = "#00ca48";
const REWARD_COLOR = "#ff3e00";
const BLOCK_COLOR = "#a7a7a7";

// Hard cap on simultaneous particles. Past ~25 the overlay becomes visual
// noise AND a measurable jank source (each particle is a framer motion.div).
// We prioritize rewards & adoptions and drop the long tail of "blocked"
// noise — they're the least informative signal anyway.
const MAX_PARTICLES = 25;

export function EdgeFlowOverlay({ result, replayKey, speed }: EdgeFlowOverlayProps) {
  const nodes = useNodes();
  const positions = useMemo(() => buildPositionMap(nodes), [nodes]);

  const particles = useMemo<Particle[]>(() => {
    if (!result) return [];
    return buildParticles(result, positions);
  }, [result, positions]);

  if (particles.length === 0) return null;

  // Particle baseline duration in seconds; scaled inversely by speed.
  const dur = 1.2 / speed;
  const stagger = 0.08 / speed;

  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ width: 0, height: 0, overflow: "visible" }}
      >
        <AnimatePresence>
          {particles.map((p, i) => (
            <motion.div
              key={`${result?.round}-${replayKey}-${p.id}-${i}`}
              className="absolute rounded-full"
              style={{
                width: 10,
                height: 10,
                top: -5,
                left: -5,
                background: p.color,
                boxShadow: `0 0 12px ${p.color}`,
              }}
              initial={{ x: p.from.x, y: p.from.y, opacity: 0, scale: 0.6 }}
              animate={
                p.faded
                  ? {
                      x: lerp(p.from.x, p.to.x, 0.55),
                      y: lerp(p.from.y, p.to.y, 0.55),
                      opacity: [0, 0.85, 0],
                      scale: [0.6, 1, 0.4],
                    }
                  : {
                      x: p.to.x,
                      y: p.to.y,
                      opacity: [0, 1, 1, 0],
                      scale: [0.6, 1, 1, 0.7],
                    }
              }
              transition={{
                duration: dur,
                delay: p.delay * stagger,
                ease: [0.19, 1, 0.22, 1],
                times: p.faded ? [0, 0.5, 1] : [0, 0.15, 0.8, 1],
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </ViewportPortal>
  );
}

function buildPositionMap(nodes: Node[]): Record<string, { x: number; y: number }> {
  const map: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const w = (n.measured?.width ?? n.width ?? 0) / 2;
    const h = (n.measured?.height ?? n.height ?? 0) / 2;
    map[n.id] = { x: n.position.x + w, y: n.position.y + h };
  }
  return map;
}

function buildParticles(
  result: RoundResult,
  positions: Record<string, { x: number; y: number }>,
): Particle[] {
  // Sort events by importance so a capped overlay still shows the meaningful
  // flow first: rewards (back to expert) > adoptions > blocked.
  const ranked = [...result.events].sort((a, b) => priorityOf(a.kind) - priorityOf(b.kind));
  const out: Particle[] = [];
  for (const evt of ranked) {
    if (out.length >= MAX_PARTICLES) break;
    const span = endpointsFor(evt);
    if (!span) continue;
    const from = positions[span.fromId];
    const to = positions[span.toId];
    if (!from || !to) continue;
    out.push({
      id: span.particleId,
      from,
      to,
      delay: out.length,
      color:
        evt.kind === "adopted"
          ? ADOPT_COLOR
          : evt.kind === "rewarded"
            ? REWARD_COLOR
            : BLOCK_COLOR,
      faded: evt.kind === "blocked",
    });
  }
  return out;
}

function priorityOf(kind: string): number {
  if (kind === "rewarded") return 0;
  if (kind === "adopted") return 1;
  return 2;
}

function endpointsFor(
  evt: RoundEvent,
): { fromId: string; toId: string; particleId: string } | null {
  if (evt.kind === "adopted") {
    return {
      fromId: evt.sourceId,
      toId: evt.farmerId,
      particleId: `adopt_${evt.farmerId}_${evt.practiceId}`,
    };
  }
  if (evt.kind === "rewarded") {
    return {
      fromId: evt.farmerId,
      toId: evt.expertId,
      particleId: `reward_${evt.adoptionEdgeId}`,
    };
  }
  if (evt.kind === "blocked") {
    return {
      fromId: evt.fromId,
      toId: evt.toId,
      particleId: `block_${evt.fromId}_${evt.toId}_${evt.practiceId}`,
    };
  }
  return null;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
