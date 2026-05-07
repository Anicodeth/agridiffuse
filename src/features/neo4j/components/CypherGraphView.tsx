"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/features/graph/components/nodes";
import type { FlowNodeData } from "@/features/graph/lib/layout";
import { Badge } from "@/components/ui/Badge";

/**
 * Renders a Cypher graph result inline. Smaller than the main canvas, but uses
 * the same node components so the visual language is consistent — what you see
 * in the simulator is the same shape coming straight off the Bolt wire.
 */

interface RawNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}
interface RawEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

const CENTER = { x: 360, y: 220 };

const STROKE_BY_TYPE: Record<string, { stroke: string; dash?: string; animated?: boolean }> = {
  RECOMMENDS: { stroke: "#9f4fff" },
  ADVISES: { stroke: "#0090ff", dash: "4 4" },
  KNOWS: { stroke: "#848281" },
  ADOPTED: { stroke: "#00ca48", animated: true },
};

export function CypherGraphView({
  data,
}: {
  data: { nodes: RawNode[]; edges: RawEdge[] };
}) {
  return (
    <ReactFlowProvider>
      <Inner data={data} />
    </ReactFlowProvider>
  );
}

function Inner({ data }: { data: { nodes: RawNode[]; edges: RawEdge[] } }) {
  const [selected, setSelected] = useState<RawNode | null>(null);

  const flow = useMemo(() => buildFlow(data), [data]);

  const onNodeClick: NodeMouseHandler = (_e, node) => {
    setSelected(data.nodes.find((n) => n.id === node.id) ?? null);
  };

  if (data.nodes.length === 0) {
    return (
      <div className="card-recessed mx-5 my-5 rounded-cards px-4 py-6 text-center text-[13px] text-ash">
        Empty result.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="card-recessed mx-5 my-5 h-[420px] overflow-hidden rounded-cards">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={1.6}
          panOnDrag
          zoomOnScroll
        >
          <Background gap={24} size={1.1} color="#f2f0ed" />
          <Controls
            position="bottom-left"
            showInteractive={false}
            style={{ boxShadow: "var(--shadow-subtle)", borderRadius: 10, background: "#fff" }}
          />
        </ReactFlow>

        <div className="absolute bottom-4 right-4 flex flex-wrap items-center gap-2 text-[11px]">
          <Stat label="nodes" value={data.nodes.length} />
          <Stat label="edges" value={data.edges.length} />
        </div>
      </div>

      {selected ? <NodeInspector node={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function NodeInspector({ node, onClose }: { node: RawNode; onClose: () => void }) {
  const label = node.labels[0]?.toLowerCase() ?? "node";
  const tone =
    label === "expert" ? "violet" : label === "farmer" ? "meadow" : label === "practice" ? "sunburst" : "neutral";
  return (
    <div className="absolute bottom-9 left-9 z-10 w-[280px] max-w-[80%]">
      <div className="card-inset rounded-cards p-4">
        <div className="mb-2 flex items-start justify-between">
          <Badge tone={tone}>{label}</Badge>
          <button
            onClick={onClose}
            className="text-ash hover:text-charcoal text-[16px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          className="text-charcoal mb-2 font-medium"
          style={{ fontSize: "13px", letterSpacing: "-0.17px" }}
        >
          {String(node.properties.name ?? node.id)}
        </div>
        <ul className="space-y-1">
          {Object.entries(node.properties)
            .filter(([k]) => k !== "name")
            .slice(0, 6)
            .map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 text-[12px]">
                <span className="text-ash" style={{ letterSpacing: "-0.14px" }}>
                  {k}
                </span>
                <span className="text-graphite truncate" style={{ letterSpacing: "-0.17px" }}>
                  {formatProp(v)}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inset rounded-tags px-2 py-1 text-ash" style={{ letterSpacing: "-0.14px" }}>
      <span className="text-charcoal font-medium">{value}</span> {label}
    </div>
  );
}

function formatProp(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (Array.isArray(v)) return v.length === 0 ? "[]" : `[${v.length}]`;
  return String(v);
}

/**
 * Lay out a Cypher result as React Flow nodes/edges. Reuses the simulator's
 * concentric ring strategy: practices at the center, experts on the inner
 * ring, farmers on the outer ring. Falls back to a single ring if a result
 * doesn't have all three node kinds.
 */
function buildFlow(data: { nodes: RawNode[]; edges: RawEdge[] }): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  const adoptedFarmers = new Set<string>();
  for (const e of data.edges) {
    if (e.type === "ADOPTED") adoptedFarmers.add(e.source);
  }

  const byLabel = (label: string) => data.nodes.filter((n) => n.labels.includes(label));
  const experts = byLabel("Expert");
  const farmers = byLabel("Farmer");
  const practices = byLabel("Practice");

  const nodes: Node<FlowNodeData>[] = [];

  practices.forEach((p, i) => {
    nodes.push({
      id: p.id,
      type: "agriPractice",
      position: ringPosition(CENTER, 80, i, practices.length, -Math.PI / 2),
      data: {
        label: String(p.properties.name ?? p.id),
        domainKind: "practice",
        category: p.properties.category as string | undefined,
      },
    });
  });

  experts.forEach((e, i) => {
    nodes.push({
      id: e.id,
      type: "agriExpert",
      position: ringPosition(CENTER, 200, i, experts.length, Math.PI / 6),
      data: {
        label: String(e.properties.name ?? e.id),
        domainKind: "expert",
        agentIdShort: e.properties.agentId
          ? `${String(e.properties.agentId).slice(0, 6)}…${String(e.properties.agentId).slice(-4)}`
          : null,
        mood: (e.properties.mood as FlowNodeData["mood"]) ?? "happy",
      },
    });
  });

  farmers.forEach((f, i) => {
    const adoptionRate = Number(f.properties.adoptionRate ?? 0.5);
    const isResistant = adoptionRate <= 0.25;
    nodes.push({
      id: f.id,
      type: "agriFarmer",
      position: ringPosition(CENTER, isResistant ? 360 : 310, i, farmers.length),
      data: {
        label: String(f.properties.name ?? f.id),
        domainKind: "farmer",
        hasAdopted: adoptedFarmers.has(f.id),
        isResistant,
        mood: (f.properties.mood as FlowNodeData["mood"]) ?? "happy",
      },
    });
  });

  // Anything else (uncategorized labels) goes on a ring further out.
  const handled = new Set(nodes.map((n) => n.id));
  const others = data.nodes.filter((n) => !handled.has(n.id));
  others.forEach((o, i) => {
    nodes.push({
      id: o.id,
      type: "agriPractice",
      position: ringPosition(CENTER, 420, i, Math.max(others.length, 1)),
      data: {
        label: String(o.properties.name ?? o.id),
        domainKind: "practice",
      },
    });
  });

  const edges: Edge[] = data.edges.map((e) => {
    const style = STROKE_BY_TYPE[e.type] ?? { stroke: "#a7a7a7" };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type === "KNOWS" ? "straight" : "smoothstep",
      animated: style.animated ?? false,
      style: {
        stroke: style.stroke,
        strokeWidth: 1.4,
        strokeDasharray: style.dash,
        opacity: 0.7,
      },
      data: { kind: e.type },
    };
  });

  return { nodes, edges };
}

function ringPosition(
  center: { x: number; y: number },
  radius: number,
  index: number,
  total: number,
  offset = 0,
): { x: number; y: number } {
  const angle = offset + (index / total) * Math.PI * 2;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}
