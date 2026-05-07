"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { PillButton } from "@/components/ui/PillButton";
import { Badge } from "@/components/ui/Badge";
import { useGraphStore } from "@/stores/graphStore";
import { explorerUrl, shortenAgent } from "@/lib/integrations/masumi";
import type { GraphNode } from "@/lib/graph/types";

interface NodeDetailResponse {
  node: GraphNode;
  history: string[];
  neighbors: GraphNode[];
}

export function NodePanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const snapshot = useGraphStore((s) => s.snapshot);
  const patchFarmer = useGraphStore((s) => s.patchFarmer);

  const [detail, setDetail] = useState<NodeDetailResponse | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    if (!selectedNodeId) {
      setDetail(null);
      setExplanation(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/node/${selectedNodeId}`)
      .then((r) => r.json())
      .then((data: NodeDetailResponse) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    setExplanation(null);
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId, snapshot?.round]);

  if (!selectedNodeId || !detail) return null;
  const { node, history } = detail;

  const explain = async () => {
    setExplaining(true);
    try {
      const res = await fetch(`/api/node/${node.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "explain" }),
      });
      const data = (await res.json()) as { explanation: string };
      setExplanation(data.explanation);
    } finally {
      setExplaining(false);
    }
  };

  return (
    <aside className="absolute top-4 right-4 z-20 w-[340px] max-w-[90vw]">
      <Card className="!p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <Badge
              tone={node.type === "expert" ? "violet" : node.type === "farmer" ? "meadow" : "sunburst"}
              className="mb-2"
            >
              {node.type}
            </Badge>
            <CardTitle>{node.name}</CardTitle>
          </div>
          <button
            onClick={() => selectNode(null)}
            className="text-ash hover:text-charcoal text-[18px] leading-none"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        <CardBody className="space-y-3 text-[13px]">
          {node.type === "expert" ? <ExpertProps node={node} /> : null}
          {node.type === "farmer" ? (
            <FarmerProps node={node} onPatch={(rate) => patchFarmer(node.id, { adoptionRate: rate })} />
          ) : null}
          {node.type === "practice" ? <PracticeProps node={node} /> : null}
        </CardBody>

        {history.length > 0 ? (
          <div className="bg-stone-surface mt-5 -mx-6 px-6 py-3">
            <div
              className="text-ash mb-2 text-[12px] font-medium uppercase"
              style={{ letterSpacing: "0px" }}
            >
              Recent activity
            </div>
            <ul className="text-graphite space-y-1.5 text-[13px]">
              {history.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-fog">·</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2">
          <PillButton variant="ghost" size="sm" onClick={explain}>
            {explaining ? "Thinking…" : "Explain this node →"}
          </PillButton>
        </div>

        {explanation ? (
          <div className="card-recessed mt-3 rounded-cards px-4 py-3 text-[13px] text-graphite">
            {explanation}
          </div>
        ) : null}
      </Card>
    </aside>
  );
}

function ExpertProps({ node }: { node: Extract<GraphNode, { type: "expert" }> }) {
  return (
    <>
      <Field label="Domain">{node.domain}</Field>
      <Field label="Institution">{node.institution}</Field>
      <Field label="Credibility">{(node.credibilityScore * 100).toFixed(0)}%</Field>
      <Field label="Masumi agent">
        {node.agentId ? (
          <a
            href={explorerUrl(node.agentId)}
            target="_blank"
            rel="noreferrer"
            className="text-ember hover:underline"
          >
            {shortenAgent(node.agentId)}
          </a>
        ) : (
          <span className="text-ash">Not registered</span>
        )}
      </Field>
    </>
  );
}

function FarmerProps({
  node,
  onPatch,
}: {
  node: Extract<GraphNode, { type: "farmer" }>;
  onPatch: (rate: number) => void;
}) {
  return (
    <>
      <Field label="Region">{node.region}</Field>
      <Field label="Farm size">{node.farmSize} ha</Field>
      <Field label="Adoption rate">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(node.adoptionRate * 100)}
          onChange={(e) => onPatch(Number(e.target.value) / 100)}
          className="accent-ember w-full"
        />
        <span className="text-graphite ml-2 text-[12px]">{(node.adoptionRate * 100).toFixed(0)}%</span>
      </Field>
      <Field label="Practices adopted">{node.adoptedPractices.length}</Field>
      <div className="flex gap-2 pt-2">
        <PillButton size="sm" variant="light" onClick={() => onPatch(0.18)}>
          Make resistant
        </PillButton>
        <PillButton size="sm" variant="light" onClick={() => onPatch(0.75)}>
          Make eager
        </PillButton>
      </div>
    </>
  );
}

function PracticeProps({ node }: { node: Extract<GraphNode, { type: "practice" }> }) {
  return (
    <>
      <Field label="Category">{node.category}</Field>
      <Field label="Complexity">{node.complexity}/5</Field>
      <Field label="Evidence">{node.evidenceLevel}</Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ash text-[12px]" style={{ letterSpacing: "-0.14px" }}>
        {label}
      </span>
      <span className="text-graphite text-[13px]" style={{ letterSpacing: "-0.17px" }}>
        {children}
      </span>
    </div>
  );
}
