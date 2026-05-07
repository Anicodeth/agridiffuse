"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BlobCharacter } from "@/components/illustrations/BlobCharacter";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import type { FlowNodeData } from "@/features/graph/lib/layout";

// Handle sizing/coloring lives in globals.css (`.react-flow__handle`) so that
// build-mode visibility can be toggled via a parent class without prop drilling.

/**
 * Four-sided handle ring. With ConnectionMode.Loose set on the canvas, any
 * handle can act as either source or target — so giving every node four
 * handles means users can drag from whichever side is closest, in either
 * direction. Each handle needs a unique id; the React Flow connection event
 * doesn't depend on which handle was used, so the API/store layer just sees
 * "source x → target y" regardless of which corner was dragged.
 */
function HandleRing({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <Handle id={`${idPrefix}-t`} type="source" position={Position.Top} />
      <Handle id={`${idPrefix}-r`} type="source" position={Position.Right} />
      <Handle id={`${idPrefix}-b`} type="source" position={Position.Bottom} />
      <Handle id={`${idPrefix}-l`} type="source" position={Position.Left} />
    </>
  );
}

export function ExpertNodeView(props: NodeProps) {
  const data = props.data as FlowNodeData;
  return (
    <div
      className={cn(
        "card-inset flex w-44 items-center gap-3 rounded-cards px-3 py-2.5 relative",
        props.selected && "ring-ember/40 ring-2",
      )}
    >
      <HandleRing idPrefix="e" />
      <div className="bg-violet/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-icons">
        <BlobCharacter color="violet" size={28} mood={data.mood ?? "happy"} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-charcoal truncate font-medium"
          style={{ fontSize: "13px", letterSpacing: "-0.17px" }}
        >
          {data.label}
        </div>
        <div className="text-ash mt-0.5 truncate text-[11px]" style={{ letterSpacing: "-0.12px" }}>
          {data.agentIdShort ?? "Expert"}
        </div>
      </div>
    </div>
  );
}

export function FarmerNodeView(props: NodeProps) {
  const data = props.data as FlowNodeData;
  const color = data.isResistant ? "flamingo" : data.hasAdopted ? "meadow" : "sky";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-illustrations p-1 relative",
        props.selected && "bg-ember/10 ring-ember/40 ring-2",
      )}
    >
      <HandleRing idPrefix="f" />
      <div
        className={cn(
          "flex items-center justify-center rounded-illustrations",
          data.hasAdopted ? "bg-meadow/15" : "bg-warm-canvas",
        )}
      >
        <BlobCharacter color={color} size={56} mood={data.mood ?? "happy"} />
      </div>
      <div
        className="text-charcoal mt-1 font-medium"
        style={{ fontSize: "12px", letterSpacing: "-0.14px" }}
      >
        {data.label}
      </div>
      {data.isResistant ? (
        <Badge tone="flamingo" className="!text-[10px]">
          resistant
        </Badge>
      ) : null}
    </div>
  );
}

export function PracticeNodeView(props: NodeProps) {
  const data = props.data as FlowNodeData;
  const tone =
    data.category === "water"
      ? "sky"
      : data.category === "soil"
        ? "meadow"
        : data.category === "pest"
          ? "violet"
          : "sunburst";
  return (
    <div
      className={cn(
        "card-inset rounded-cards px-3 py-2.5 relative",
        props.selected && "ring-ember/40 ring-2",
      )}
      style={{ minWidth: 152 }}
    >
      <HandleRing idPrefix="p" />
      <Badge tone={tone} className="mb-1">
        {data.category ?? "practice"}
      </Badge>
      <div
        className="text-charcoal font-medium"
        style={{ fontSize: "14px", letterSpacing: "-0.18px" }}
      >
        {data.label}
      </div>
    </div>
  );
}

export const nodeTypes = {
  agriExpert: ExpertNodeView,
  agriFarmer: FarmerNodeView,
  agriPractice: PracticeNodeView,
};
