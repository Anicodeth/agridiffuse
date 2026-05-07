"use client";

import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useGraphStore } from "@/stores/graphStore";
import { explorerUrl } from "@/lib/integrations/masumi";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";

const KIND_TONE: Record<GraphEdge["type"], "violet" | "sky" | "neutral" | "ember"> = {
  RECOMMENDS: "violet",
  ADVISES: "sky",
  KNOWS: "neutral",
  ADOPTED: "ember",
};

export function EdgePanel() {
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const snapshot = useGraphStore((s) => s.snapshot);
  const patchEdge = useGraphStore((s) => s.patchEdge);

  if (!selectedEdgeId || !snapshot) return null;
  const edge = snapshot.edges.find((e) => e.id === selectedEdgeId);
  if (!edge) return null;

  const sourceLabel = labelFor(snapshot.nodes, edge.source);
  const targetLabel = labelFor(snapshot.nodes, edge.target);

  return (
    <aside className="absolute top-4 right-4 z-20 w-[340px] max-w-[90vw]">
      <Card className="!p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <Badge tone={KIND_TONE[edge.type]} className="mb-2">
              {edge.type.toLowerCase()}
            </Badge>
            <CardTitle>
              {sourceLabel} → {targetLabel}
            </CardTitle>
          </div>
          <button
            onClick={() => selectEdge(null)}
            className="text-ash hover:text-charcoal text-[18px] leading-none"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        <CardBody className="space-y-3 text-[13px]">
          {edge.type === "KNOWS" ? (
            <Field label="Trust weight">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(edge.trustWeight * 100)}
                onChange={(e) => patchEdge(edge.id, { trustWeight: Number(e.target.value) / 100 })}
                className="accent-ember w-full"
              />
              <span className="text-graphite ml-2 text-[12px]">
                {(edge.trustWeight * 100).toFixed(0)}%
              </span>
            </Field>
          ) : null}

          {edge.type === "RECOMMENDS" ? (
            <>
              <Field label="Confidence">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(edge.confidence * 100)}
                  onChange={(e) =>
                    patchEdge(edge.id, { confidence: Number(e.target.value) / 100 })
                  }
                  className="accent-ember w-full"
                />
                <span className="text-graphite ml-2 text-[12px]">
                  {(edge.confidence * 100).toFixed(0)}%
                </span>
              </Field>
              <Field label="Date">{shortDate(edge.date)}</Field>
            </>
          ) : null}

          {edge.type === "ADVISES" ? (
            <>
              <Field label="Channel">{edge.channel}</Field>
              <Field label="Date">{shortDate(edge.date)}</Field>
            </>
          ) : null}

          {edge.type === "ADOPTED" ? (
            <>
              <Field label="Round">{edge.round}</Field>
              <Field label="Outcome">{edge.outcome}</Field>
              <Field label="Hops from expert">
                {edge.hopsFromExpert ?? <span className="text-ash">—</span>}
              </Field>
              <Field label="Reward">
                {edge.rewardAmount !== null ? (
                  <span>{edge.rewardAmount.toFixed(2)} tADA</span>
                ) : (
                  <span className="text-ash">peer-only</span>
                )}
              </Field>
              {edge.rewardTx ? (
                <Field label="Tx">
                  <a
                    href={explorerUrl(edge.rewardTx)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ember hover:underline"
                  >
                    {edge.rewardTx.slice(0, 6)}…{edge.rewardTx.slice(-4)}
                  </a>
                </Field>
              ) : null}
            </>
          ) : null}
        </CardBody>
      </Card>
    </aside>
  );
}

function labelFor(nodes: GraphNode[], id: string): string {
  const n = nodes.find((x) => x.id === id);
  return n && "name" in n ? n.name : id;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ash text-[12px]" style={{ letterSpacing: "-0.14px" }}>
        {label}
      </span>
      <span className="text-graphite flex items-center text-[13px]" style={{ letterSpacing: "-0.17px" }}>
        {children}
      </span>
    </div>
  );
}
