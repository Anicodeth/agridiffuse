"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, type DragEvent } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useGraphStore, type PaletteKind } from "@/stores/graphStore";
import { snapshotToFlow } from "@/features/graph/lib/layout";
import { nodeTypes } from "@/features/graph/components/nodes";
import { GraphLegend } from "@/features/graph/components/Legend";
import { NodePanel } from "@/features/graph/components/NodePanel";
import { EdgePanel } from "@/features/graph/components/EdgePanel";
import { EdgeFlowOverlay } from "@/features/graph/components/EdgeFlowOverlay";
import { NodePalette, PALETTE_DRAG_TYPE } from "@/features/graph/components/NodePalette";

interface GraphCanvasProps {
  /** When true, render the round-event flow overlay (Sim mode). */
  showFlowOverlay?: boolean;
  /** When true, render the build palette overlay + accept tile drops. */
  buildMode?: boolean;
  /** Override container height. */
  height?: number;
}

export function GraphCanvas(props: GraphCanvasProps = {}) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

function Inner({ showFlowOverlay = false, buildMode = false, height = 640 }: GraphCanvasProps) {
  const snapshot = useGraphStore((s) => s.snapshot);
  const isLoading = useGraphStore((s) => s.isLoading);
  const error = useGraphStore((s) => s.error);
  const load = useGraphStore((s) => s.load);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const setNodePosition = useGraphStore((s) => s.setNodePosition);
  const nodePositions = useGraphStore((s) => s.nodePositions);
  const lastResult = useGraphStore((s) => s.lastResult);
  const replayKey = useGraphStore((s) => s.replayKey);
  const speed = useGraphStore((s) => s.speed);
  const addNode = useGraphStore((s) => s.addNode);
  const addEdge = useGraphStore((s) => s.addEdge);
  const deferredResult = useDeferredValue(lastResult);

  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!snapshot) load();
  }, [snapshot, load]);

  const flow = useMemo(
    () => (snapshot ? snapshotToFlow(snapshot, nodePositions) : null),
    [snapshot, nodePositions],
  );

  const onNodeClick: NodeMouseHandler = (_e, node) => {
    selectNode(node.id);
  };
  const onEdgeClick: EdgeMouseHandler = (_e, edge) => {
    selectEdge(edge.id);
  };
  const onNodeDragStop: OnNodeDrag = (_e, node) => {
    setNodePosition(node.id, { x: node.position.x, y: node.position.y });
  };

  // ── Build mode: palette drop ─────────────────────────────────────
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!buildMode) return;
    if (!e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [buildMode]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!buildMode) return;
      const kind = e.dataTransfer.getData(PALETTE_DRAG_TYPE) as PaletteKind | "";
      if (kind !== "farmer" && kind !== "expert" && kind !== "practice") return;
      e.preventDefault();
      const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      void addNode(kind, position);
    },
    [buildMode, addNode, reactFlow],
  );

  // ── Build mode: connect-by-drag ──────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!buildMode) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      void addEdge(connection.source, connection.target);
    },
    [buildMode, addEdge],
  );

  if (error) {
    return (
      <div className="card-inset rounded-cards p-8 text-center">
        <p className="text-coral">Failed to load: {error}</p>
        <button onClick={() => load()} className="text-ember mt-2 underline">
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || !flow) {
    return (
      <div
        className="card-recessed rounded-cards-large animate-pulse"
        style={{ height }}
      />
    );
  }

  return (
    <div
      className={`card-recessed rounded-cards-large relative overflow-hidden${buildMode ? " build-mode" : ""}`}
      style={{ height }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={32}
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
        }}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.4}
        maxZoom={1.6}
      >
        <Background gap={28} size={1.2} color="#f2f0ed" />
        <Controls
          position="bottom-left"
          showInteractive={false}
          style={{ boxShadow: "var(--shadow-subtle)", borderRadius: 10, background: "#fff" }}
        />
        {showFlowOverlay ? (
          <EdgeFlowOverlay result={deferredResult} replayKey={replayKey} speed={speed} />
        ) : null}
      </ReactFlow>

      <div className="absolute top-4 left-4 z-10">
        <GraphLegend />
      </div>

      {buildMode ? (
        <div className="absolute bottom-4 right-4 z-10">
          <NodePalette />
        </div>
      ) : null}

      <CanvasErrorToast />

      <NodePanel />
      <EdgePanel />
    </div>
  );
}

function CanvasErrorToast() {
  const error = useGraphStore((s) => s.error);
  if (!error) return null;
  return (
    <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2">
      <div
        className="card-inset rounded-buttons border-coral/30 flex items-center gap-2 border px-4 py-2"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <span className="bg-coral inline-block h-2 w-2 rounded-full" />
        <span
          className="text-charcoal text-[13px] font-medium"
          style={{ letterSpacing: "-0.17px" }}
        >
          {error}
        </span>
      </div>
    </div>
  );
}
