"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GraphNode, RoundResult } from "@/lib/graph/types";
import { Badge } from "@/components/ui/Badge";

interface EventLogProps {
  result: RoundResult | null;
  nodes: GraphNode[];
}

const MAX_VISIBLE = 30;
// Total stagger duration is capped so a 90-event round doesn't run animations
// for 3.6 seconds — past ~0.6s the per-row delay becomes invisible anyway.
const MAX_TOTAL_STAGGER_S = 0.6;

const EVENT_PRIORITY: Record<string, number> = {
  rewarded: 0,
  adopted: 1,
  blocked: 2,
};
const eventPriority = (e: { kind: string }) => EVENT_PRIORITY[e.kind] ?? 99;

export function EventLog({ result, nodes }: EventLogProps) {
  if (!result) {
    return (
      <div className="card-inset rounded-cards p-5 text-[13px] text-ash">
        Event log will populate after the first round.
      </div>
    );
  }

  const labelOf = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n && "name" in n ? n.name : id;
  };

  // Show the most "interesting" events first so a capped view still reads as
  // a story: rewards (paid) > adoptions > blocks. Past MAX_VISIBLE we render
  // a "+N more" footer rather than mounting hundreds of motion nodes.
  const ranked = [...result.events].sort((a, b) => eventPriority(a) - eventPriority(b));
  const visible = ranked.slice(0, MAX_VISIBLE);
  const hidden = ranked.length - visible.length;
  const stagger = visible.length > 1 ? Math.min(0.04, MAX_TOTAL_STAGGER_S / visible.length) : 0;

  return (
    <div className="card-inset rounded-cards p-5">
      <div
        className="text-ash mb-3 flex items-center justify-between text-[12px] font-medium uppercase"
        style={{ letterSpacing: "0px" }}
      >
        <span>Event log · round {result.round}</span>
        <span className="text-fog">{result.events.length} events</span>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={true}>
          {visible.map((event, i) => (
            <motion.li
              key={`${result.round}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * stagger, ease: [0.19, 1, 0.22, 1] }}
              className="flex items-start gap-2 text-[13px]"
            >
              {event.kind === "adopted" ? (
                <>
                  <Badge tone="meadow">adopt</Badge>
                  <span className="text-graphite" style={{ letterSpacing: "-0.17px" }}>
                    <strong className="text-charcoal font-medium">{labelOf(event.farmerId)}</strong>{" "}
                    picked up{" "}
                    <strong className="text-charcoal font-medium">{labelOf(event.practiceId)}</strong>
                    {event.via === "advises"
                      ? ` via ${labelOf(event.sourceId)}`
                      : ` from peer ${labelOf(event.sourceId)} (hop ${event.hopsFromExpert ?? "?"})`}
                  </span>
                </>
              ) : null}

              {event.kind === "rewarded" ? (
                <>
                  <Badge tone="ember">paid</Badge>
                  <span className="text-graphite" style={{ letterSpacing: "-0.17px" }}>
                    {labelOf(event.expertId)} ← {event.amount.toFixed(2)} tADA{" "}
                    <code className="text-ash text-[11px]">
                      ({event.txHash.slice(0, 6)}…{event.txHash.slice(-4)})
                    </code>
                  </span>
                </>
              ) : null}

              {event.kind === "blocked" ? (
                <>
                  <Badge tone="flamingo">blocked</Badge>
                  <span className="text-ash" style={{ letterSpacing: "-0.17px" }}>
                    {labelOf(event.fromId)} → {labelOf(event.toId)}{" "}
                    <span className="text-fog">· {event.reason}</span>
                  </span>
                </>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {hidden > 0 ? (
        <div
          className="text-ash mt-3 border-t border-stone-surface pt-3 text-[12px]"
          style={{ letterSpacing: "-0.14px" }}
        >
          + {hidden} more {hidden === 1 ? "event" : "events"} this round
        </div>
      ) : null}
    </div>
  );
}

