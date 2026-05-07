"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface NarrativeBoxProps {
  round: number | null;
  narrative: string | null;
  newAdoptions: number;
  blockedAttempts: number;
  totalReward: number;
  isLoading: boolean;
}

export function NarrativeBox({
  round,
  narrative,
  newAdoptions,
  blockedAttempts,
  totalReward,
  isLoading,
}: NarrativeBoxProps) {
  const empty = round === null;

  return (
    <Card className="!p-6">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Round narrator</CardTitle>
        {!empty ? (
          <Badge tone="ember">via Featherless</Badge>
        ) : (
          <Badge tone="neutral">Idle</Badge>
        )}
      </div>

      {empty ? (
        <CardBody className="text-ash">
          Press <span className="text-charcoal font-medium">Next round</span> to run a propagation step.
          The narrator will summarize what happened in 2–3 sentences.
        </CardBody>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Stat label="Round" value={String(round ?? 0)} />
            <Stat label="Adoptions" value={String(newAdoptions)} tone="meadow" />
            <Stat label="tADA paid" value={totalReward.toFixed(2)} tone="ember" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={round}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            >
              {isLoading ? (
                <div className="card-recessed rounded-cards px-4 py-3 text-[14px]">
                  <div className="flex items-center gap-2 text-graphite">
                    <span className="bg-ember h-2 w-2 animate-pulse rounded-full" />
                    Narrating round {round}…
                  </div>
                </div>
              ) : (
                <div
                  className="card-recessed rounded-cards px-5 py-4 text-graphite text-[15px] leading-relaxed"
                  style={{ letterSpacing: "-0.2px" }}
                >
                  {narrative}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {blockedAttempts > 0 ? (
            <div
              className="text-ash mt-3 text-[13px]"
              style={{ letterSpacing: "-0.17px" }}
            >
              {blockedAttempts} attempts stalled at low-trust or skeptical edges.
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ember" | "meadow" }) {
  const colorClass = tone === "ember" ? "text-ember" : tone === "meadow" ? "text-meadow" : "text-charcoal";
  return (
    <div className="card-recessed rounded-cards px-3 py-2">
      <div className="text-ash text-[11px]" style={{ letterSpacing: "-0.12px" }}>
        {label}
      </div>
      <div className={`${colorClass} mt-0.5 text-[20px] font-medium`} style={{ letterSpacing: "-0.4px" }}>
        {value}
      </div>
    </div>
  );
}
