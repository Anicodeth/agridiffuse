"use client";

import { create } from "zustand";
import type { GraphNode, GraphSnapshot, NodeId, RoundResult } from "@/lib/graph/types";
import { computeInitialLayout, type PositionMap } from "@/features/graph/lib/layout";

export type SimMode = "view" | "sim" | "build";

export type PaletteKind = "farmer" | "expert" | "practice";

interface GraphStoreState {
  snapshot: GraphSnapshot | null;
  lastResult: RoundResult | null;
  history: RoundResult[];
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Persistent layout — populated on first load and updated on drag.
  nodePositions: PositionMap;

  // Round-replay scrubbing. null means "show the most recent round".
  selectedRound: number | null;

  // Bumped to re-trigger the movement overlay without running a new round.
  replayKey: number;

  // Simulator UX state
  mode: SimMode;
  speed: 1 | 2 | 4; // base × multiplier — affects autoplay tempo + animation duration
  autoplay: boolean;

  load: () => Promise<void>;
  runRound: () => Promise<void>;
  reset: () => Promise<void>;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setNodePosition: (id: NodeId, pos: { x: number; y: number }) => void;
  setSelectedRound: (round: number | null) => void;
  replayLastRound: () => void;
  setMode: (mode: SimMode) => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  setAutoplay: (on: boolean) => void;
  patchEdge: (id: string, patch: { trustWeight?: number; confidence?: number }) => Promise<void>;
  patchFarmer: (id: string, patch: { adoptionRate?: number }) => Promise<void>;

  /** Build mode: create a node at the given canvas position. */
  addNode: (
    kind: PaletteKind,
    position: { x: number; y: number },
  ) => Promise<GraphNode | null>;
  /** Build mode: connect two nodes; type is inferred server-side. */
  addEdge: (source: NodeId, target: NodeId) => Promise<boolean>;
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  snapshot: null,
  lastResult: null,
  history: [],
  isLoading: false,
  isRunning: false,
  error: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  nodePositions: {},
  selectedRound: null,
  replayKey: 0,
  mode: "view",
  speed: 1,
  autoplay: false,

  async load() {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/graph", { cache: "no-store" });
      if (!res.ok) throw new Error(`Graph load failed: ${res.status}`);
      const snapshot = (await res.json()) as GraphSnapshot;
      set((state) => ({
        snapshot,
        isLoading: false,
        nodePositions:
          Object.keys(state.nodePositions).length === 0
            ? computeInitialLayout(snapshot)
            : state.nodePositions,
      }));
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  async runRound() {
    if (get().isRunning) return;
    set({ isRunning: true, error: null });
    try {
      const res = await fetch("/api/round", { method: "POST" });
      if (!res.ok) throw new Error(`Round failed: ${res.status}`);
      const data = (await res.json()) as { snapshot: GraphSnapshot; result: RoundResult };
      set((state) => ({
        snapshot: data.snapshot,
        lastResult: data.result,
        history: [...state.history, data.result],
        selectedRound: null, // jump to latest
        isRunning: false,
      }));
    } catch (err) {
      set({ error: errorMessage(err), isRunning: false });
    }
  },

  async reset() {
    set({ isLoading: true, error: null, lastResult: null, history: [], autoplay: false });
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
      const snapshot = (await res.json()) as GraphSnapshot;
      set({
        snapshot,
        isLoading: false,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedRound: null,
        nodePositions: computeInitialLayout(snapshot),
      });
    } catch (err) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  selectNode(id) {
    set({ selectedNodeId: id, selectedEdgeId: null });
  },

  selectEdge(id) {
    set({ selectedEdgeId: id, selectedNodeId: null });
  },

  setNodePosition(id, pos) {
    set((state) => ({ nodePositions: { ...state.nodePositions, [id]: pos } }));
  },

  setSelectedRound(round) {
    set({ selectedRound: round });
  },

  replayLastRound() {
    set((state) => ({ replayKey: state.replayKey + 1 }));
  },

  setMode(mode) {
    set({ mode });
  },

  setSpeed(speed) {
    set({ speed });
  },

  setAutoplay(on) {
    set({ autoplay: on });
  },

  async patchEdge(id, patch) {
    const res = await fetch(`/api/edge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const snapshot = (await res.json()) as GraphSnapshot;
      set({ snapshot });
    }
  },

  async patchFarmer(id, patch) {
    const res = await fetch(`/api/farmer/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const snapshot = (await res.json()) as GraphSnapshot;
      set({ snapshot });
    }
  },

  async addNode(kind, position) {
    try {
      const res = await fetch("/api/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: kind }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        set({ error: err.error ?? `Add node failed: ${res.status}` });
        return null;
      }
      const data = (await res.json()) as { node: GraphNode; snapshot: GraphSnapshot };
      set((state) => ({
        snapshot: data.snapshot,
        nodePositions: { ...state.nodePositions, [data.node.id]: position },
        selectedNodeId: data.node.id,
        selectedEdgeId: null,
      }));
      return data.node;
    } catch (err) {
      set({ error: errorMessage(err) });
      return null;
    }
  },

  async addEdge(source, target) {
    try {
      const res = await fetch("/api/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, target }),
      });
      if (!res.ok) {
        // Surface the server's reason so the user knows why their drag
        // didn't draw an edge — silent failures feel like the app is
        // broken.
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        set({ error: body.error ?? `Connection rejected (${res.status})` });
        // Auto-clear so it doesn't stick around forever
        setTimeout(() => {
          if (get().error === (body.error ?? `Connection rejected (${res.status})`)) {
            set({ error: null });
          }
        }, 3500);
        return false;
      }
      const data = (await res.json()) as { snapshot: GraphSnapshot };
      set({ snapshot: data.snapshot, error: null });
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },
}));

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
