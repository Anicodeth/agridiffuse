import type { Metadata } from "next";
import { GraphCanvas } from "@/features/graph/components/GraphCanvas";
import { PillButton } from "@/components/ui/PillButton";

export const metadata: Metadata = { title: "Graph canvas" };

export default function GraphPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="font-heading-lg text-midnight"
            style={{ fontSize: "44px", letterSpacing: "-1.14px" }}
          >
            The graph.
          </h1>
          <p
            className="text-graphite mt-2 max-w-[560px]"
            style={{ fontSize: "17px", letterSpacing: "-0.22px" }}
          >
            Three node types, four edge types. Click any node for properties, history, and a one-click
            Featherless explainer.
          </p>
        </div>
        <div className="flex gap-2">
          <PillButton href="/simulate" variant="light">
            Simulate spread →
          </PillButton>
          <PillButton href="/metrics" variant="dark">
            Metrics
          </PillButton>
        </div>
      </header>

      <GraphCanvas />
    </div>
  );
}
