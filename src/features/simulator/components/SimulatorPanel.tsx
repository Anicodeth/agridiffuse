"use client";

import { useDeferredValue, useEffect, useMemo } from "react";
import { useGraphStore } from "@/stores/graphStore";
import { GraphCanvas } from "@/features/graph/components/GraphCanvas";
import { NarrativeBox } from "./NarrativeBox";
import { EventLog } from "./EventLog";
import { SimToolbar } from "./SimToolbar";
import { SimControls } from "./SimControls";
import { RoundRibbon } from "./RoundRibbon";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Coin } from "@/components/illustrations/BlobCharacter";

export function SimulatorPanel() {
  const snapshot = useGraphStore((s) => s.snapshot);
  const lastResult = useGraphStore((s) => s.lastResult);
  const history = useGraphStore((s) => s.history);
  const selectedRound = useGraphStore((s) => s.selectedRound);
  const isRunning = useGraphStore((s) => s.isRunning);
  const load = useGraphStore((s) => s.load);
  const mode = useGraphStore((s) => s.mode);
  const setAutoplay = useGraphStore((s) => s.setAutoplay);

  useEffect(() => {
    if (!snapshot) load();
  }, [snapshot, load]);

  // Switching to View pauses autoplay so the inspection canvas stays still.
  useEffect(() => {
    if (mode === "view") setAutoplay(false);
  }, [mode, setAutoplay]);

  // Resolve which round we're showing in the narrative + event log.
  const activeResult = useMemo(() => {
    if (selectedRound === null) return lastResult;
    return history.find((r) => r.round === selectedRound) ?? lastResult;
  }, [selectedRound, lastResult, history]);

  // Defer the heavy event-log / narrative re-render so clicks (Pause, mode
  // toggle, edge selection) stay responsive while a fresh round mounts up to
  // ~30 staggered list items.
  const deferredResult = useDeferredValue(activeResult);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SimToolbar />
          <span className="text-ash text-[12px]" style={{ letterSpacing: "-0.14px" }}>
            {snapshot ? `${countOf(snapshot.nodes, "expert")} experts · ${countOf(snapshot.nodes, "farmer")} farmers · ${countOf(snapshot.nodes, "practice")} practices` : ""}
          </span>
        </div>

        <GraphCanvas
          showFlowOverlay={mode === "sim"}
          buildMode={mode === "build"}
          height={600}
        />

        <RoundRibbon />

        <EventLog result={deferredResult} nodes={snapshot?.nodes ?? []} />
      </div>

      <aside className="min-w-0 space-y-6">
        <SimControls />

        <NarrativeBox
          round={deferredResult?.round ?? null}
          narrative={deferredResult?.narrative ?? null}
          newAdoptions={deferredResult?.newAdoptions ?? 0}
          blockedAttempts={deferredResult?.blockedAttempts ?? 0}
          totalReward={deferredResult?.totalRewardDistributed ?? 0}
          isLoading={isRunning && (selectedRound === null || selectedRound === lastResult?.round)}
        />

        <Card className="!p-6">
          <div className="mb-3 flex items-center gap-2">
            <Coin size={28} />
            <CardTitle>Economic graph</CardTitle>
          </div>
          <CardBody>
            Each rewarded adoption fires a Masumi micro-payment. Direct adoption pays <strong>1×</strong>,
            each peer hop halves the reward. Same edges, opposite direction.
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function countOf(nodes: { type: string }[], type: string) {
  return nodes.filter((n) => n.type === type).length;
}
