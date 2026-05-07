"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PillButton } from "@/components/ui/PillButton";
import { cn } from "@/lib/utils/cn";
import { CypherGraphView } from "./CypherGraphView";

interface PresetMeta {
  id: string;
  title: string;
  description: string;
  kind: "graph" | "table";
}

interface PresetResult {
  preset: {
    id: string;
    title: string;
    description: string;
    cypher: string;
    kind: "graph" | "table";
    columns?: string[];
  };
  latencyMs: number;
  data: unknown;
}

type CypherListResponse = { presets: PresetMeta[]; error?: undefined } | { error: string; presets?: undefined };

export function CypherExplorer() {
  const [presets, setPresets] = useState<PresetMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PresetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap: load preset list once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/cypher")
      .then((r) => r.json())
      .then((data: CypherListResponse) => {
        if (cancelled) return;
        if ("error" in data && data.error) {
          setError(data.error);
          return;
        }
        if (!("presets" in data) || !data.presets) return;
        setPresets(data.presets);
        if (data.presets[0]) setSelected(data.presets[0].id);
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-run when the selected preset changes.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/cypher?preset=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setResult(null);
        } else {
          setResult(data);
        }
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (error && !presets) {
    return (
      <Card className="!p-8">
        <Badge tone="flamingo" className="mb-3">
          Neo4j unavailable
        </Badge>
        <CardTitle>{error}</CardTitle>
        <CardBody className="mt-3">
          The Cypher explorer talks to the Neo4j-backed store via{" "}
          <code className="text-ember">/api/cypher</code>. Set <code>NEO4J_URI</code>,{" "}
          <code>NEO4J_USER</code>, and <code>NEO4J_PASSWORD</code> in <code>.env</code>, then
          restart the dev server.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
      <PresetList presets={presets} selected={selected} onSelect={setSelected} />

      <div className="space-y-4">
        <CypherCard result={result} loading={loading} error={error} />
        <ResultCard result={result} loading={loading} />
      </div>
    </div>
  );
}

function PresetList({
  presets,
  selected,
  onSelect,
}: {
  presets: PresetMeta[] | null;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className="text-ash mb-2 text-[11px] font-medium uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
        Preset queries
      </div>
      {!presets ? (
        <div className="card-inset rounded-cards px-4 py-3 text-[13px] text-ash">Loading…</div>
      ) : (
        presets.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "w-full rounded-cards px-4 py-3 text-left transition",
                active
                  ? "bg-midnight text-white"
                  : "card-inset text-graphite hover:bg-stone-surface",
              )}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-medium"
                  style={{ fontSize: "13px", letterSpacing: "-0.17px" }}
                >
                  {p.title}
                </span>
                <span
                  className={cn(
                    "rounded-tags px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    active ? "bg-white/15 text-white/80" : "bg-stone-surface text-ash",
                  )}
                  style={{ letterSpacing: "0.04em" }}
                >
                  {p.kind}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-[12px] leading-snug",
                  active ? "text-white/70" : "text-ash",
                )}
                style={{ letterSpacing: "-0.14px" }}
              >
                {p.description}
              </p>
            </button>
          );
        })
      )}
    </div>
  );
}

function CypherCard({
  result,
  loading,
  error,
}: {
  result: PresetResult | null;
  loading: boolean;
  error: string | null;
}) {
  const cypher = result?.preset.cypher;
  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between border-b border-stone-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <Badge tone="violet">cypher</Badge>
          <span
            className="text-charcoal font-medium"
            style={{ fontSize: "13px", letterSpacing: "-0.17px" }}
          >
            {result?.preset.title ?? "—"}
          </span>
        </div>
        <span className="text-ash text-[12px]" style={{ letterSpacing: "-0.14px" }}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="bg-ember inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              Running…
            </span>
          ) : result ? (
            `${result.latencyMs} ms`
          ) : null}
        </span>
      </div>
      <pre
        className="m-0 overflow-x-auto px-5 py-4 text-[13px] leading-relaxed text-charcoal"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {error ? <span className="text-coral">{error}</span> : cypher ?? ""}
      </pre>
    </Card>
  );
}

function ResultCard({ result, loading }: { result: PresetResult | null; loading: boolean }) {
  if (!result) return null;
  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between border-b border-stone-surface px-5 py-3">
        <CardTitle>Result</CardTitle>
        {result.preset.kind === "graph" ? (
          <Badge tone="meadow">graph</Badge>
        ) : (
          <Badge tone="sky">table</Badge>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={result.preset.id + result.latencyMs}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: loading ? 0.5 : 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {result.preset.kind === "graph" ? (
            <CypherGraphView data={result.data as { nodes: GraphResultNode[]; edges: GraphResultEdge[] }} />
          ) : (
            <ResultTable
              columns={result.preset.columns ?? []}
              rows={result.data as Record<string, unknown>[]}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

interface GraphResultNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}
interface GraphResultEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

function ResultTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) {
    return (
      <CardBody className="px-5 py-6 text-ash">
        No rows. (The graph might be in seed-only state — run a few rounds in the simulator.)
      </CardBody>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-stone-surface text-ash">
            {columns.map((col) => (
              <th
                key={col}
                className="px-5 py-2 text-left text-[11px] font-medium uppercase"
                style={{ letterSpacing: "0.04em" }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stone-surface last:border-b-0">
              {columns.map((col) => {
                const v = row[col];
                return (
                  <td
                    key={col}
                    className="px-5 py-2.5 text-graphite"
                    style={{ letterSpacing: "-0.17px" }}
                  >
                    {formatCell(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  return String(v);
}
