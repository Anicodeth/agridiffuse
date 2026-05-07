"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BlobCharacter, Coin } from "@/components/illustrations/BlobCharacter";
import { explorerUrl, shortenAgent } from "@/lib/integrations/masumi";
import { useGraphStore } from "@/stores/graphStore";
import type {
  DeepestChain,
  ExpertEarnings,
  ExpertReach,
  PracticeAdoption,
} from "@/lib/graph/metrics";

interface MetricsResponse {
  practiceAdoption: PracticeAdoption[];
  expertReach: ExpertReach[];
  expertEarnings: ExpertEarnings[];
  deepestChain: DeepestChain;
  round: number;
}

export function MetricsDashboard() {
  const lastResult = useGraphStore((s) => s.lastResult);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/metrics", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: MetricsResponse) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lastResult?.round]);

  if (loading || !data) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-recessed h-64 animate-pulse rounded-cards" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      <PracticeAdoptionCard items={data.practiceAdoption} />
      <ExpertReachCard items={data.expertReach} />
      <DeepestChainCard chain={data.deepestChain} />
      <EarningsCard items={data.expertEarnings} />
    </div>
  );
}

function PracticeAdoptionCard({ items }: { items: PracticeAdoption[] }) {
  const max = Math.max(1, ...items.map((i) => i.adopters));
  return (
    <Card className="!p-6">
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Practice adoption</CardTitle>
        <Badge tone="meadow">leaderboard</Badge>
      </div>
      <CardBody className="text-ash mb-5 text-[13px]">
        Count of farmers who adopted each practice across all rounds.
      </CardBody>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.practiceId} className="flex items-center gap-3">
            <span
              className="text-charcoal min-w-[140px] truncate text-[14px] font-medium"
              style={{ letterSpacing: "-0.18px" }}
            >
              {item.practiceName}
            </span>
            <div className="bg-stone-surface relative h-2 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-meadow h-full rounded-full transition-all duration-500"
                style={{ width: `${(item.adopters / max) * 100}%` }}
              />
            </div>
            <span className="text-graphite w-6 text-right text-[13px] font-medium">
              {item.adopters}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExpertReachCard({ items }: { items: ExpertReach[] }) {
  return (
    <Card className="!p-6">
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Expert reach</CardTitle>
        <Badge tone="violet">2-hop</Badge>
      </div>
      <CardBody className="text-ash mb-5 text-[13px]">
        Unique farmers reachable within 2 hops of each expert.
      </CardBody>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.expertId} className="flex items-center gap-3">
            <span className="text-fog w-6 text-[13px]">#{i + 1}</span>
            <BlobCharacter color="violet" size={28} />
            <span
              className="text-charcoal flex-1 truncate text-[14px] font-medium"
              style={{ letterSpacing: "-0.18px" }}
            >
              {item.name}
            </span>
            <span className="text-graphite text-[14px] font-medium">{item.reach}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DeepestChainCard({ chain }: { chain: DeepestChain }) {
  return (
    <Card className="!p-6">
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Deepest practice chain</CardTitle>
        <Badge tone="sky">lineage</Badge>
      </div>
      <CardBody className="text-ash mb-5 text-[13px]">
        Longest documented path from expert recommendation to peer-relayed adoption.
      </CardBody>
      {chain.length === 0 ? (
        <div className="card-recessed text-ash rounded-cards p-4 text-[13px]">
          Run a round to populate the chain.
        </div>
      ) : (
        <div className="card-recessed rounded-cards p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px]">
            <span className="text-ash" style={{ letterSpacing: "-0.17px" }}>
              {chain.length}-step chain
            </span>
          </div>
          <div
            className="text-charcoal text-[15px] font-medium leading-relaxed"
            style={{ letterSpacing: "-0.2px" }}
          >
            <span className="text-violet">{chain.expertName}</span>
            {" → "}
            <span className="text-sunburst">{chain.practiceName}</span>
            {" → "}
            <span className="text-meadow">peer relay (×{chain.length - 1})</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function EarningsCard({ items }: { items: ExpertEarnings[] }) {
  const max = Math.max(0.01, ...items.map((i) => i.earnings));
  return (
    <Card className="!p-6">
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Expert earnings</CardTitle>
        <Badge tone="ember">via Masumi</Badge>
      </div>
      <CardBody className="text-ash mb-5 flex items-center gap-2 text-[13px]">
        <Coin size={16} /> Sum of rewards routed when adoptions chain back to each expert.
      </CardBody>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.expertId} className="space-y-1.5">
            <div className="flex items-center justify-between text-[14px]">
              <span
                className="text-charcoal flex items-center gap-2 font-medium"
                style={{ letterSpacing: "-0.18px" }}
              >
                <BlobCharacter color="violet" size={24} />
                {item.name}
              </span>
              <span className="text-ember font-medium">{item.earnings.toFixed(2)} tADA</span>
            </div>
            <div className="bg-stone-surface relative h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-ember h-full rounded-full transition-all duration-700"
                style={{ width: `${(item.earnings / max) * 100}%` }}
              />
            </div>
            {item.lastTxHash ? (
              <a
                href={explorerUrl(item.lastTxHash)}
                target="_blank"
                rel="noreferrer"
                className="text-ash hover:text-ember inline-block text-[12px]"
                style={{ letterSpacing: "-0.14px" }}
              >
                last tx · {shortenAgent(item.lastTxHash)} ↗
              </a>
            ) : (
              <span className="text-fog text-[12px]">No rewards yet</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
