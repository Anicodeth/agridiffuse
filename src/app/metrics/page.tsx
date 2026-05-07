import type { Metadata } from "next";
import { MetricsDashboard } from "@/features/metrics/components/MetricsDashboard";
import { PillButton } from "@/components/ui/PillButton";

export const metadata: Metadata = { title: "Metrics" };

export default function MetricsPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="font-heading-lg text-midnight"
            style={{ fontSize: "44px", letterSpacing: "-1.14px" }}
          >
            Influence and value, side by side.
          </h1>
          <p
            className="text-graphite mt-2 max-w-[640px]"
            style={{ fontSize: "17px", letterSpacing: "-0.22px" }}
          >
            Four cards. The first three reflect structural influence. The fourth — earnings — is the
            proof that influence and value tracked together.
          </p>
        </div>
        <div className="flex gap-2">
          <PillButton href="/simulate" variant="dark">
            Run more rounds →
          </PillButton>
        </div>
      </header>

      <MetricsDashboard />
    </div>
  );
}
